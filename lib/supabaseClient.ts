import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, anon)
// expose for debugging in non-production builds only
if (typeof window !== 'undefined' && process.env.NODE_ENV !== 'production') {
	try {
		;(window as any).__supabase = (window as any).__supabase || {}
		;(window as any).__supabase.client = supabase
	} catch (e) {}
}
