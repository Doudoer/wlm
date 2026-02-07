# README2 — Next Supabase Chat (documentación detallada)

Este archivo documenta en detalle cómo funciona el proyecto "Next Supabase Chat": la arquitectura, las rutas y APIs, la estructura de la base de datos, las decisiones visuales, características implementadas y un prompt final que puedes reutilizar para reproducir el proyecto con ayuda de un asistente.

---

## 1. Resumen funcional

Next Supabase Chat es una app de chat construida con Next.js (App Router), Tailwind CSS y Supabase/Postgres. Está pensada como un starter completo que incluye:

- Autenticación simple por código de acceso (campo `codigo_acceso`) con login/logout. 
- Gestión de usuarios y perfiles (nombre, avatar, código de acceso).
- Lista de amigos (relaciones unidireccionales) y solicitudes de amistad.
- Mensajería 1:1 con persistencia en Postgres y UI optimista.
- Administrador remoto (`/admin`) protegido por un `ADMIN_CODE` para listar y modificar usuarios.
- PWA (manifest + service worker) con estrategia caching y cola local (outbox) para POSTs offline.
- Subida de avatar/archivos (endpoints de upload), proxy de emoji/giphy y componentes de UI reutilizables.

## 2. Cómo trabaja (flujo principal)

1. Login
   - El usuario envía un POST a `/api/login` con { codigo_acceso, password? }.
   - El servidor valida contra tabla `usuarios`. Si es correcto, establece cookie `user_id` (sencillo demo-session).

2. Obtener usuario actual
   - `/api/me` devuelve el usuario de la cookie o, para debugging, permite `user_id` por query o `x-user-id` header.

3. Amigos y solicitudes
   - `/api/friend-requests` POST crea una solicitud.
   - `/api/friend-requests/incoming` GET lista las solicitudes entrantes para el usuario.
   - Rutas para aceptar/rechazar (`/api/friend-requests/[id]/accept` y `/reject`) actualizan tablas y crean relaciones en `amigos`.

4. Mensajería
   - GET `/api/messages?friendId=...` lista mensajes entre usuarios (o por friendId).
   - POST `/api/messages` persiste un nuevo mensaje. La UI aplica **optimistic UI**: renderiza el mensaje localmente y corrige si falla la persistencia.
   - Si el cliente está offline, el service worker y su `outbox` (IndexedDB) guardan el POST y lo reintentan cuando hay conexión.

5. PWA & Service Worker
   - `public/manifest.json` y `public/sw.js` proveen experiencia PWA.
   - Estrategias usadas:
     - Static assets: cache-first
     - API GET: stale-while-revalidate (caché + revalidación de fondo)
     - POSTs: intentar fetch; si falla, guardar en outbox y devolver 503 indicando `offlineQueued: true`.
   - El SW evita cachear respuestas HTML para rutas API (sólo cachea JSON) para prevenir que se sirvan páginas 404 donde se espera JSON.

## 3. Base de datos (esquema resumido)

A continuación las tablas principales y campos (nombres aproximados según migraciones incluidas):

- usuarios
  - id (uuid / serial)
  - codigo_acceso (string) — identificador público del usuario
  - nombre (string)
  - avatar_url (string, nullable)
  - password_hash (string, nullable)
  - lock_password (string, nullable) — código para bloquear app
  - app_locked (boolean) — si la app está bloqueada para ese usuario
  - created_at (timestamp)

- amigos
  - id (serial)
  - user_id (fk -> usuarios.id)
  - friend_id (fk -> usuarios.id)
  - created_at (timestamp)

- friend_requests
  - id (serial)
  - requester_id (fk -> usuarios.id)
  - recipient_id (fk -> usuarios.id)
  - created_at (timestamp)
  - status (opcional) — en la implementación simple puede ser implícito por existencia/aceptadas

- mensajes
  - id (serial/uuid)
  - sender_id (fk -> usuarios.id)
  - recipient_id (fk -> usuarios.id)
  - content (text)
  - attachments (json / url lista) — opcional para subir archivos
  - created_at (timestamp)

- user_presence
  - user_id
  - online (boolean)
  - last_active (timestamp)

> Nota: los archivos de migración SQL están en `db/` (por ejemplo: `create_user_presence.sql`, `create_friend_requests.sql`, `add_password_to_usuarios.sql`, `add_lock_columns.sql`). Ejecuta esas migraciones en el editor SQL de Supabase o mediante psql en la base de datos destino.

## 4. Endpoints y funciones importantes (APIs)

- POST `/api/login` — iniciar sesión (acepta JSON o form-encoded). Incluye un GET debug opcional (`?debug=1`) para chequear env vars.
- POST `/api/logout` — borrar la cookie o cerrar sesión.
- GET `/api/me` — información del usuario actual (o `user_id` por query/header para debug).
- GET `/api/friends` — lista amigos del usuario.
- POST `/api/friend-requests` — crear solicitud.
- GET `/api/friend-requests/incoming` — solicitudes entrantes.
- POST/GET `/api/messages` — crear / listar mensajes.
- POST `/api/avatar/upload` — subir avatar (implementación con Supabase Storage o similar).
- GET `/api/emoji` o `/api/giphy` — proxies para servicios externos (para evitar exponer keys públicas o CORS).
- Admin: `GET/PATCH /api/admin/users` — listado y edición de usuarios (PATCH para cambiar password, lock_password, app_locked). Protegido por env var `ADMIN_CODE` (header `X-Admin-Code` o query `?admin_code=` para debug).
- Otros: `/api/db/tables` (diagnóstico), `/api/debug/...` (endpoints dev para poblar datos)

> Runtimes: algunas rutas usan `pg`, `bcryptjs` o la `supabaseServer` con service role — estas rutas están marcadas con `export const runtime = 'nodejs'` para que se ejecuten en Node en Vercel.

## 5. Componentes UI y decisiones visuales

Tecnologías visuales
- Tailwind CSS para estilos utilitarios.
- Diseño: una barra lateral con lista de amigos y acciones; panel principal para mensajes; entrada de mensaje con emoji y attachments; modales para buscar/agregar amigos.
- PWA install banner y botón para bloquear/app-lock.

Componentes principales
- `FriendList.tsx` — lista y selección de amigos; muestra estado y avatar.
- `ChatWindow.tsx` — historial de mensajes y área de scroll (usa `bg-[url('/pattern.svg')]` para fondo sutil).
- `MessageInput.tsx` — entrada, emoji picker, botón de enviar.
- `ProfileForm.tsx` — editar nombre, subir avatar.
- `FriendRequests.tsx` / `AddFriendModal.tsx` — gestionar y enviar solicitudes.
- `ServiceWorkerRegister.tsx` — register del SW y lógica para `beforeinstallprompt`.
- `Admin` (app/admin/page.tsx) — interfaz minimal para listar/editar usuarios (pide código admin y lo guarda en sessionStorage para peticiones posteriores).
- `LockOverlay.tsx` — pantalla que aparece cuando la app está "bloqueada" por lock_password.

Decisiones UX
- Mensajería optimista: al enviar, el mensaje aparece inmediatamente con un estado provisional y se corrige si el servidor falla.
- Manejo offline: el Service Worker capta POST fallidos y los coloca en IndexedDB (outbox). El cliente puede solicitar el reenvío manualmente o el SW lo reenviará al reconectar.

## 6. Seguridad y límites

- La autenticación demo está basada en `codigo_acceso` y cookies sencillas. Para producción usa sesiones seguras y tokens (JWT/OAuth).
- `ADMIN_CODE` es un secreto simple para el panel admin. Para producción, reemplazar por un sistema de roles/autenticación de verdad.
- No exponer `SUPABASE_SERVICE_ROLE_KEY` en el cliente; sólo usarlo en funciones server-side.

## 7. Cómo ejecutar y desplegar (pasos rápidos)

1. Instalar dependencias:
```powershell
cd c:\xampp\htdocs\new
npm ci
```

2. Variables de entorno necesarias (ejemplos):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- DATABASE_URL (postgres connection string)
- ADMIN_CODE
- NEXT_PUBLIC_VERCEL_URL (opcional)

3. Ejecutar en local (dev):
```powershell
npm run dev
# abre http://localhost:3000
```

4. Build & Deploy (Vercel):
- Pushea `main` al repo. En Vercel, configura las env vars arriba y despliega la rama `main`.
- Si usas rutas que emplean `pg` o `bcryptjs`, asegúrate de marcar esas APIs con `export const runtime = 'nodejs'` (ya aplicado donde hace falta).

5. Migraciones DB:
- Ejecuta los SQLs en `db/` desde el SQL editor de Supabase o con psql contra tu `DATABASE_URL`.

## 8. Diagnóstico de problemas comunes

- Respuesta HTML 404 para rutas API (cliente recibiendo `<!DOCTYPE html>` en `res.json()`):
  - Causa: la ruta no existe en la build desplegada o Vercel está sirviendo un 404 cacheado.
  - Solución: forzar un redeploy, revisar build logs en Vercel y limpiar el Service Worker/caché del navegador.

- `getaddrinfo ENOTFOUND` al intentar conectar DB en producción:
  - Revisa `DATABASE_URL` y la accesibilidad desde el entorno en la nube. Verifica que no haya caracteres escapados incorrectamente.

- Admin devuelve `403`: verificar que `ADMIN_CODE` esté correctamente configurado en las env vars del entorno de producción y que coincida con lo que se envía en la petición (header `X-Admin-Code` o `?admin_code=`).

## 9. Ficheros importantes en el repositorio

- `app/` — páginas (App Router) y `app/api` con los endpoints.
- `components/` — UI components reutilizables.
- `lib/` — helpers y clientes `supabaseClient.ts` / `supabaseServer.ts`.
- `public/` — `manifest.json`, `sw.js`, `icons/`, `pattern.svg`.
- `db/` — SQL migration scripts.
- `package.json` — dependencias y scripts.

---

## 10. Prompt para replicar este proyecto con un asistente (usar tal cual)

A continuación tienes un prompt listo para pedir a un asistente (o a otro copiloto) que genere un proyecto igual o similar. Incluye la lista mínima de requisitos y entregables esperados.

"Genera un proyecto Next.js (App Router) + Tailwind + Supabase para una aplicación de chat 1:1 con las siguientes características:

- Autenticación básica por código de acceso y cookies.
- Tablas Postgres: usuarios, amigos, friend_requests, mensajes, user_presence. Incluye SQL de migración para crear estas tablas.
- Rutas API (App Routes):
  - POST /api/login (acepta JSON y form-encoded; devuelve cookie user_id)
  - POST /api/logout
  - GET /api/me (usa cookie o ?user_id o x-user-id para debugging)
  - GET /api/friends?user_id=
  - POST /api/friend-requests
  - GET /api/friend-requests/incoming?user_id=
  - POST /api/messages (persistir mensaje)
  - GET /api/messages?friendId=
  - Admin: GET/PATCH /api/admin/users protegido por env ADMIN_CODE
- Implementa un Service Worker (public/sw.js) que:
  - Cachee assets estáticos (cache-first)
  - Use stale-while-revalidate para GETs de /api/
  - Recoja POSTs fallidos en IndexedDB y los reenvíe (outbox)
  - Evite cachear respuestas HTML en rutas API (cachear sólo application/json)
- Componentes UI con Tailwind: FriendList, ChatWindow (con fondo pattern.svg), MessageInput (emoji picker), ProfileForm, Admin page.
- PWA manifest y SVG icons.
- Script README con pasos para instalar, correr, migrar la DB y desplegar en Vercel. Incluir variables de entorno necesarias.

Entregables:
- Repositorio con el código, migraciones SQL, y README claro.
- Small demo of optimistic UI for new messages.

Usa Next 14 (App Router), React 18, TypeScript opcional, y @supabase/supabase-js para cliente/servidor. Marca rutas que usan `pg` o `bcryptjs` con `export const runtime = 'nodejs'`." 

---

Si quieres que genere una versión `README2.html` o traduzca alguna sección a otro idioma, o que publique este README2 en otra ruta del repo, dímelo y lo hago.

Fin del README2.
