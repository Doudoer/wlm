-- Add password_hash column to usuarios table
-- Stores bcrypt hashed passwords. NULL allowed for existing users.

BEGIN;

ALTER TABLE IF EXISTS public.usuarios
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

COMMENT ON COLUMN public.usuarios.password_hash IS 'bcrypt hashed password (e.g. $2b$...), nullable for users created without a password';

COMMIT;
