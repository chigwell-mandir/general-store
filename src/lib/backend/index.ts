import { createDemoBackend } from './demo'
import { createSupabaseBackend } from './supabase'
import type { Backend } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const email = import.meta.env.VITE_DESK_EMAIL as string | undefined

// No Supabase settings → demo mode, so the app can be tried with no accounts at all.
export const backend: Backend = url && key && email ? createSupabaseBackend(url, key, email) : createDemoBackend()

export { InsufficientStockError } from './types'
export type { Backend } from './types'
