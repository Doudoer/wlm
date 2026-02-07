import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { Client } from 'pg'

// Ensure this API route runs in the Node.js runtime (not Edge) because
// it uses the `pg` package which depends on Node core modules.
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 500 })

  const client = new Client({ connectionString: databaseUrl })
  try {
    await client.connect()
    // List base tables excluding Postgres internal schemas
    const q = `
      SELECT table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
        AND table_schema NOT IN ('pg_catalog', 'information_schema')
      ORDER BY table_schema, table_name;
    `
    const res = await client.query(q)
    const rows = res.rows || []
    return NextResponse.json({ tables: rows })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 })
  } finally {
    try { await client.end() } catch (e) {}
  }
}
