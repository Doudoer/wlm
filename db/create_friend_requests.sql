-- Run this on your Postgres / Supabase SQL editor to add friend_requests table
-- Adjust schema/permissions as needed

CREATE TABLE IF NOT EXISTS friend_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Optional: ensure one active request per pair
CREATE UNIQUE INDEX IF NOT EXISTS ux_friend_requests_pair ON friend_requests(requester_id, recipient_id);
