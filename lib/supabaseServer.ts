import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Server side client uses service role to perform inserts/reads safely from server APIs
export const supabaseServer = createClient(url, serviceRole)
