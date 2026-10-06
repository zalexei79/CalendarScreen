import { createClient } from '@supabase/supabase-js'
import { createPersistentAuthStorage } from './features/auth/persistentAuthStorage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: createPersistentAuthStorage(),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // SDK processes OAuth callbacks, including StrictMode startup.
  },
})
