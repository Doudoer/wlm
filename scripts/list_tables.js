const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

function loadEnvFile(file) {
  try {
    const txt = fs.readFileSync(file, 'utf8')
    const lines = txt.split(/\r?\n/)
    const out = {}
    for (const line of lines) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)=(.*)$/)
      if (!m) continue
      let val = m[2]
      // trim quotes
      if ((val.startsWith("\'") && val.endsWith("\'")) || (val.startsWith('"') && val.endsWith('"'))) {
        val = val.slice(1, -1)
      }
      out[m[1]] = val
    }
    return out
  } catch (err) {
    return {}
  }
}

async function main() {
  const cwd = process.cwd()
  const envFile = path.join(cwd, '.env.local')
  const env = loadEnvFile(envFile)
  const databaseUrl = process.env.DATABASE_URL || env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL not found in environment or .env.local')
    process.exit(2)
  }

  const client = new Client({ connectionString: databaseUrl })
  try {
    await client.connect()
    const q = `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `
    const res = await client.query(q)
    console.log(JSON.stringify({ tables: res.rows }, null, 2))
  } catch (err) {
    console.error('error', err && err.message ? err.message : String(err))
    process.exit(3)
  } finally {
    try { await client.end() } catch (e) {}
  }
}

main()
