const fs = require('fs')
const path = require('path')
const { Client } = require('pg')
const bcrypt = require('bcryptjs')

function loadEnv(file) {
  try {
    const txt = fs.readFileSync(file, 'utf8')
    const lines = txt.split(/\r?\n/)
    const out = {}
    for (const line of lines) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/)
      if (!m) continue
      let val = m[2]
      if ((val.startsWith("\'") && val.endsWith("\'")) || (val.startsWith('"') && val.endsWith('"'))) val = val.slice(1, -1)
      out[m[1]] = val
    }
    return out
  } catch (e) { return {} }
}

async function main() {
  const env = loadEnv(path.join(process.cwd(), '.env.local'))
  const databaseUrl = process.env.DATABASE_URL || env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL not found in environment or .env.local')
    process.exit(2)
  }

  const client = new Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    console.log('Fetching usuarios...')
    const res = await client.query("SELECT id, codigo_acceso, password_hash FROM public.usuarios")
    const rows = res.rows || []
    console.log(`Found ${rows.length} usuarios`)
    let updated = 0
    for (const r of rows) {
      const id = r.id
      const code = r.codigo_acceso || ''
      const curr = r.password_hash
      if (curr && curr.length > 0) continue // already has password
      const hash = bcrypt.hashSync(String(code), 10)
      await client.query('UPDATE public.usuarios SET password_hash = $1 WHERE id = $2', [hash, id])
      updated++
      console.log(`Updated user ${id} with password = codigo_acceso (hashed)`)
    }
    console.log(`Done. Updated ${updated} users.`)
  } catch (err) {
    console.error('Error:', err && err.message ? err.message : err)
  } finally {
    await client.end()
  }
}

main()
