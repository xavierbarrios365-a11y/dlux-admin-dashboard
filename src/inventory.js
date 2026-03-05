import { supabase } from './supabase.js'

export async function uploadImageToCloudinary(file) {
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dko8viuwt';
    const apiKey = import.meta.env.VITE_CLOUDINARY_API_KEY || '232883889939721';
    const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET || 'dDdTLpBdAIDmGPOWhILQXW3Lny8';

    const formData = new FormData();
    formData.append('file', file);

    if (apiSecret) {
        // Subida firmada para evitar el error de "Upload preset not found"
        const timestamp = Math.round((new Date).getTime() / 1000);
        const signatureString = `timestamp=${timestamp}${apiSecret}`;

        const msgBuffer = new TextEncoder().encode(signatureString);
        const hashBuffer = await crypto.subtle.digest('SHA-1', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const signature = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        formData.append('api_key', apiKey);
        formData.append('timestamp', timestamp);
        formData.append('signature', signature);
    } else {
        // Fallback a unsigned
        formData.append('upload_preset', 'ml_default');
    }

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        const errData = await response.json();
        console.error('Error de Cloudinary:', errData);
        throw new Error(errData.error?.message || 'Falló la subida de imagen a Cloudinary');
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
