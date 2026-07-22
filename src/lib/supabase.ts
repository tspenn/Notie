import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
export const APP_KEY = import.meta.env.VITE_APP_KEY || 'notie';

export const REMEMBER_ME_KEY = 'notie_remember_me';
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

const sessionAwareStorage = {
  getItem: (key: string): string | null =>
    sessionStorage.getItem(key) ?? localStorage.getItem(key),

  setItem: (key: string, value: string): void => {
    if (localStorage.getItem(REMEMBER_ME_KEY) === 'false') {
      sessionStorage.setItem(key, value);
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, value);
      sessionStorage.removeItem(key);
    }
  },

  removeItem: (key: string): void => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  },
};

/** Shared Skyland/Friday Canvas project; scoped via x-app-key. */
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    global: { headers: { 'x-app-key': APP_KEY } },
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: sessionAwareStorage,
    },
  },
);
