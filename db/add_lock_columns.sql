-- Add columns for app lock functionality
BEGIN;

ALTER TABLE IF EXISTS public.usuarios
  ADD COLUMN IF NOT EXISTS lock_password TEXT;

ALTER TABLE IF EXISTS public.usuarios
  ADD COLUMN IF NOT EXISTS app_locked boolean DEFAULT false;

COMMENT ON COLUMN public.usuarios.lock_password IS 'Plaintext app lock password (used only for local app lock, stored as plain text by design)';
COMMENT ON COLUMN public.usuarios.app_locked IS 'Flag indicating whether the user has the app locked (true/false)';

COMMIT;
