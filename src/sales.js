import { supabase } from './supabase.js'

/**
 * Register a manual sale and update inventory
 * @param {Object} saleData - { customer, items: [{ productId, quantity }], notes, userId, currency, exchangeRate, paymentMethod, paymentStatus, dueDate }
 */
export async function registerSale(saleData) {
    const { customer, items, notes, userId, currency, exchangeRate, paymentMethod, paymentStatus, dueDate } = saleData

    try {
        // 1. Calculate total price and prepare order
        let totalAmount = 0
        const processedItems = []

        // Fetch current prices and verify stock
        for (const item of items) {
            const { data: product, error: pError } = await supabase
                .from('products')
                .select('name, price, stock')
                .eq('id', item.productId)
                .single()

            if (pError || !product) throw new Error(`Producto no encontrado ID: ${item.productId} `)
            if (product.stock < item.quantity) {
                throw new Error(`Stock insuficiente para ${product.name}.Disponible: ${product.stock} `)
            }

            const itemTotal = product.price * item.quantity
            totalAmount += itemTotal
            processedItems.push({
                productId: item.productId,
                name: product.name,
                quantity: item.quantity,
                price: product.price,
                total: itemTotal
            })
        }

        // 2. Create the Order
        const { data: order, error: oError } = await supabase
            .from('orders') // Assuming 'orders' table exists from previous context
            .insert([{
                customer_name: customer,
                total_amount: totalAmount,
                status: paymentStatus || 'paid', // Use paymentStatus for order status
                items: processedItems,
                notes: notes,
                created_by: userId
            }])
            .select()
            .single()

        if (oError) throw oError

        // 3. Update Inventory & create Transactions (Atomic-ish)
        for (const item of processedItems) {
            // Deplete stock
            const { error: sError } = await supabase
                .rpc('decrement_stock', { // Custom RPC is better for atomicity
                    row_id: item.productId,
                    amount: item.quantity
                })

            // Fallback if RPC doesn't exist (less safe but works for now)
            if (sError) {
                const { data: currentProd } = await supabase.from('products').select('stock').eq('id', item.productId).single();
                await supabase.from('products').update({ stock: currentProd.stock - item.quantity }).eq('id', item.productId);
            }

            // Create Transaction log
            await supabase.from('transactions').insert([{
                type: 'ingreso',
                category: 'venta',
                concept: `Venta de ${item.quantity}x ${item.name} `,
                amount: item.total,
                currency: currency || 'USD',
                exchange_rate: exchangeRate || 1.0,
                amount_bs: (currency === 'USD' && exchangeRate) ? (item.total * exchangeRate) : (currency === 'BS' ? item.total : null),
                payment_method: paymentMethod,
                payment_status: paymentStatus || 'completed',
                order_id: order.id,
                created_by: userId
            }])
        }

        // 4. Handle Credits/Apartados if applicable
        if (paymentStatus === 'pending' || paymentStatus === 'partial') {
            // totalAmount is already calculated from processedItems
            await supabase.from('credits').insert([{
                customer_name: customer,
                total_amount: totalAmount,
                remaining_amount: totalAmount, // Assuming no initial payment for now
                due_date: dueDate,
                status: 'pending',
                created_by: userId,
                order_id: order.id // Link credit to the order
            }]);
        }

        return { success: true, orderId: order.id }

    } catch (error) {
        console.error('Error registering sale:', error)
        return { success: false, error: error.message }
    }
}

export async function fetchTransactions() {
    const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .order('date', { ascending: false })

    if (error) throw error
    return data
}

export async function getFinancialSummary() {
    const { data: incomeData } = await supabase.rpc('get_total_income') // Placeholder for RPC
    const { data: expenseData } = await supabase.rpc('get_total_expenses')

    // Alternative: manual aggregate
    const { data: all } = await supabase.from('transactions').select('type, amount')
    if (!all) return { totalRevenue: 0, totalExpenses: 0, netProfit: 0 }

    const totals = all.reduce((acc, curr) => {
        if (curr.type === 'ingreso') acc.income += curr.amount
        else acc.expense += curr.amount
        return acc
    }, { income: 0, expense: 0 })

    return {
        totalRevenue: totals.income,
        totalExpenses: totals.expense,
        netProfit: totals.income - totals.expense
    }
}

export async function registerExpense(expenseData) {
    const { concept, category, amount, userId, currency, exchangeRate, paymentMethod } = expenseData
    const { data, error } = await supabase
        .from('transactions')
        .insert([{
            type: 'egreso',
            category,
            concept,
            amount: parseFloat(amount),
            currency: currency || 'USD',
            exchange_rate: exchangeRate || 1.0,
            amount_bs: (currency === 'USD' && exchangeRate) ? (parseFloat(amount) * exchangeRate) : (currency === 'BS' ? parseFloat(amount) : null),
            payment_method: paymentMethod,
            created_by: userId
        }])
        .select()

    if (error) return { success: false, error: error.message }
    return { success: true, data }
}

/**
 * Registra un abono a un crédito existente
 * @param {string} creditId - ID del crédito
 * @param {number} amount - Monto del abono
 * @param {string} paymentMethod - Método de pago
 * @param {string} userId - ID del usuario que registra
 */
export async function registerPayment(creditId, amount, paymentMethod, userId) {
    try {
        // 1. Obtener datos del crédito
        const { data: credit, error: cError } = await supabase
            .from('credits')
            .select('*')
            .eq('id', creditId)
            .single();

        if (cError || !credit) throw new Error("Crédito no encontrado");

        const newRemaining = credit.remaining_amount - amount;
        const newStatus = newRemaining <= 0 ? 'paid' : credit.status;

        // 2. Actualizar el crédito
        const { error: uError } = await supabase
            .from('credits')
            .update({
                remaining_amount: newRemaining,
                status: newStatus
            })
            .eq('id', creditId);

        if (uError) throw uError;

        // 3. Crear transacción de ingreso
        await supabase.from('transactions').insert([{
            type: 'ingreso',
            category: 'abono',
            concept: `Abono de ${credit.customer_name}`,
            amount: parseFloat(amount),
            payment_method: paymentMethod,
            created_by: userId,
            order_id: credit.order_id
        }]);

        return { success: true };
    } catch (error) {
        console.error('Error al registrar pago:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Registra un pago de nómina o servicio
 * @param {Object} payrollData - { employeeName, category, amount, method, periodStart, periodEnd, notes, userId }
 */
export async function registerPayroll(payrollData) {
    const { employeeName, category, amount, method, periodStart, periodEnd, notes, userId } = payrollData;

    try {
        // 1. Crear registro en tabla payroll
        const { data: payroll, error: pError } = await supabase
            .from('payroll')
            .insert([{
                employee_name: employeeName,
                category: category || 'Personal',
                amount: parseFloat(amount),
                payment_method: method,
                period_start: periodStart,
                period_end: periodEnd,
                notes: notes,
                created_by: userId
            }])
            .select()
            .single();

        if (pError) throw pError;

        // 2. Crear transacción de egreso
        await supabase.from('transactions').insert([{
            type: 'egreso',
            category: category || 'Personal',
            concept: `${category || 'Pago'}: ${employeeName}`,
            amount: parseFloat(amount),
            payment_method: method,
            created_by: userId
        }]);

        return { success: true, data: payroll };
    } catch (error) {
        console.error('Error al registrar nómina:', error);
        return { success: false, error: error.message };
    }
}
