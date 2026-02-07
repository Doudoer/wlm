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
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      env[key] = val
    })
  } catch (e) {}
  return env
}

const env = loadEnv('.env.local')
const url = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Missing Supabase env vars')
  process.exit(1)
}

const supabase = createClient(url, key)

const requestId = process.argv[2]
if (!requestId) {
  console.error('Usage: node scripts/accept_friend_request.js <request_id>')
  process.exit(1)
}

;(async () => {
  try {
    const { data: fr, error: efr } = await supabase.from('friend_requests').select('*').eq('id', requestId).maybeSingle()
    if (efr) { console.error('Error reading request:', efr.message); process.exit(1) }
    if (!fr) { console.error('Request not found'); process.exit(1) }

    const inserts = [
      { user_id: fr.requester_id, friend_id: fr.recipient_id },
      { user_id: fr.recipient_id, friend_id: fr.requester_id }
    ]

    const { error: einsert } = await supabase.from('amigos').insert(inserts)
    if (einsert) {
      // If duplicates already exist, log and continue to delete the friend_request
      if (einsert.message && einsert.message.includes('duplicate key')) {
        console.warn('Some amigos entries already existed, continuing to delete the friend_request')
      } else {
        console.error('Error inserting amigos:', einsert.message)
        process.exit(1)
      }
    }

    const { error: edel } = await supabase.from('friend_requests').delete().eq('id', requestId)
    if (edel) { console.error('Error deleting request:', edel.message); process.exit(1) }

    console.log('Accepted request (or already existed) ', requestId)
    process.exit(0)
  } catch (e) {
    console.error('Exception:', e && e.message ? e.message : e)
    process.exit(1)
  }
})()
