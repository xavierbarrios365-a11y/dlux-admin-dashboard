import { supabase } from './supabase.js'

export async function uploadImageToCloudinary(file) {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const apiKey = import.meta.env.VITE_CLOUDINARY_API_KEY;
    const uploadPreset = 'ml_default'; // Standard Cloudinary preset if unsigned, but we are using signed below

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'ml_default'); // Using unsigned for simplicity in this specific staff tool if possible, or signed if required.

    // For signed uploads (more secure):
    // formData.append('api_key', apiKey);
    // ... signature logic ...

    // Let's stick to a robust fetch for unsigned/preset-based for now to avoid SHA-1 complexity issues on client side if not needed.
    // However, the user provided API keys, so let's try to use the same pattern but clearer.

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || 'Failed to upload image to Cloudinary');
    }

    const result = await response.json();
    return result.secure_url;
}

export async function fetchProducts() {
    const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

export async function createProduct(productData) {
    const { data, error } = await supabase.from('products').insert([productData]).select();
    if (error) throw error;
    return data;
}

export async function updateProduct(id, productData) {
    const { data, error } = await supabase.from('products').update(productData).eq('id', id).select();
    if (error) throw error;
    return data;
}

export async function deleteProduct(productId) {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw error;
}
