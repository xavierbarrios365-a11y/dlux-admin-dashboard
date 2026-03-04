import { supabase } from './supabase.js'

/**
 * Register a manual sale and update inventory
 * @param {Object} saleData - { customer, items: [{ productId, quantity }], notes, userId }
 */
export async function registerSale(saleData) {
    const { customer, items, notes, userId } = saleData

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

            if (pError || !product) throw new Error(`Producto no encontrado ID: ${item.productId}`)
            if (product.stock < item.quantity) {
                throw new Error(`Stock insuficiente para ${product.name}. Disponible: ${product.stock}`)
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
                status: 'paid', // Manual sales are usually paid immediately
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
                concept: `Venta de ${item.quantity}x ${item.name}`,
                amount: item.total,
                order_id: order.id,
                created_by: userId
            }])
        }

        return { success: true, order }

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
    const { concept, category, amount, userId } = expenseData
    const { data, error } = await supabase
        .from('transactions')
        .insert([{
            type: 'egreso',
            category,
            concept,
            amount: parseFloat(amount),
            created_by: userId
        }])
        .select()

    if (error) return { success: false, error: error.message }
    return { success: true, data }
}
