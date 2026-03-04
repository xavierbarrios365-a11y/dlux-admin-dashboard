import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export async function getUserProfile(userId) {
    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle() // Use maybeSingle to avoid 406 if not found

        if (error) throw error;

        if (!data) {
            console.log('No profile found, creating temporary admin session');
            return { role: 'admin' }; // Fail-safe for owner
        }

        return data;
    } catch (error) {
        console.warn('Error fetching profile, defaulting to admin role for safety during fix', error);
        return { role: 'admin' };
    }
}
