-- Run this SQL in your Supabase SQL editor or psql to create the user_presence table
CREATE TABLE IF NOT EXISTS user_presence (
  user_id uuid PRIMARY KEY,
  last_seen timestamptz NOT NULL DEFAULT now(),
  active_chat_with uuid NULL
);

CREATE INDEX IF NOT EXISTS idx_user_presence_last_seen ON user_presence (last_seen);
