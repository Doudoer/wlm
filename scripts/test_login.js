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
  } catch (e) {}
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

const codesToTest = process.argv.slice(2)
if (codesToTest.length === 0) codesToTest.push('CODE123', 'test123', 'BADCODE')

;(async () => {
  console.log('Starting login tests for codes:', codesToTest.join(', '))
  for (const code of codesToTest) {
    try {
      console.log('Querying code:', code)
      const { data, error } = await supabase.from('usuarios').select('id, nombre, codigo_acceso').eq('codigo_acceso', code).limit(1).single()
      if (error) {
        console.log(code, '-> ERROR', error.message)
      } else if (!data) {
        console.log(code, '-> NOT FOUND')
      } else {
        console.log(code, '-> OK:', `${data.id} | ${data.nombre}`)
      }
    } catch (e) {
      console.log(code, '-> EXCEPTION', e && e.message ? e.message : e)
    }
  }
  console.log('Finished tests')
})()
