// Script simple para listar codigo_acceso desde la tabla usuarios usando Supabase
const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Cargar .env.local manualmente (evita dependencia dotenv)
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
  console.error('Faltan variables de entorno NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY/NEXT_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

;(async () => {
  try {
    const { data, error } = await supabase.from('usuarios').select('id, nombre, codigo_acceso')
    if (error) {
      console.error('Error consultando usuarios:', error)
      process.exit(1)
    }
    if (!data || data.length === 0) {
      console.log('No se encontraron usuarios')
      process.exit(0)
    }
    // Imprimir lista legible
    console.log('Usuarios encontrados:')
    data.forEach((u) => {
      console.log(`- id: ${u.id} | nombre: ${u.nombre || ''} | codigo_acceso: ${u.codigo_acceso}`)
    })
  } catch (e) {
    console.error('Exception:', e)
    process.exit(1)
  }
})()
