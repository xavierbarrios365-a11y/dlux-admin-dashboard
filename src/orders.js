import { supabase } from './supabase.js'

export async function fetchOrders() {
    const { data, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

    if (error) {
        if (error.code === '42P01') {
            console.warn('Orders table does not exist yet.')
            return []
        }
        throw error
    }
    return data
}

export async function updateOrderStatus(orderId, newStatus) {
    const { data, error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId)
        .select()

    if (error) throw error
    return data
}

export async function deleteOrder(orderId) {
    const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderId)

    if (error) throw error
}
