import { supabase } from './supabase.js'

export async function uploadImageToCloudinary(file) {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    const apiKey = import.meta.env.VITE_CLOUDINARY_API_KEY;
    const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET;

    // Generate Cloudinary Signature
    const timestamp = Math.round((new Date).getTime() / 1000);
    const paramsToSign = `timestamp=${timestamp}${apiSecret}`;

    // SHA-1 Hash
    const encoder = new TextEncoder();
    const data = encoder.encode(paramsToSign);
    const hashBuffer = await crypto.subtle.digest('SHA-1', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Prepare FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', apiKey);
    formData.append('timestamp', timestamp);
    formData.append('signature', signature);

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

export async function deleteProduct(productId) {
    const { error } = await supabase.from('products').delete().eq('id', productId);
    if (error) throw error;
}
