const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

function loadEnv(file) {
  const env = {}
  try {
    const content = fs.readFileSync(path.resolve(file), 'utf8')
    content.split(/\r?\n/).forEach((line) => {
      line = line.trim()
      if (!line || line.startsWith('#')) return
      const i = line.indexOf('=')
      if (i === -1) return
      const key = line.slice(0, i)
      let val = line.slice(i + 1)
      if (val.startsWith("\"") && val.endsWith('"')) val = val.slice(1, -1)
      env[key] = val
    })
  } catch (e) {
    // ignore
  }
  return env
}

const env = loadEnv('.env.local')
const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(url, key)

const recipientCode = process.argv[2]
if (!recipientCode) {
  console.error('Usage: node scripts/check_friend_requests.js <recipient_codigo_acceso>')
  process.exit(1)
}

;(async () => {
  try {
    const { data: user } = await supabase.from('usuarios').select('id, nombre, codigo_acceso').eq('codigo_acceso', recipientCode).limit(1).maybeSingle()
    if (!user) {
      console.log('Recipient not found for code:', recipientCode)
      process.exit(0)
    }
    console.log('Recipient:', user.id, user.nombre)

    const { data, error } = await supabase
      .from('friend_requests')
      .select('id, requester_id, recipient_id, created_at')
      .eq('recipient_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error querying friend_requests:', error.message)
      process.exit(1)
    }

    if (!data || data.length === 0) {
      console.log('No friend requests found for recipient', recipientCode)
    } else {
      console.log('Found friend requests:')
      for (const r of data) {
        // fetch requester info
        const { data: requester } = await supabase.from('usuarios').select('id, nombre, codigo_acceso, avatar_url').eq('id', r.requester_id).limit(1).maybeSingle()
        console.log('-', r.id, 'from', requester ? `${requester.id} | ${requester.nombre} | ${requester.codigo_acceso}` : r.requester_id, 'at', r.created_at)
      }
    }
  } catch (e) {
    console.error('Exception:', e && e.message ? e.message : e)
    process.exit(1)
  }
})()
