-- 0002_add_creator_channel_metadata.sql
-- Channel identity + branding for creators, resolved from the YouTube Data API.
-- `channel_id` is the canonical YouTube channel id (UC...) used in creator URLs.
-- `handle` is the @handle (snippet.customUrl); `avatar_url` is the channel logo.

ALTER TABLE creators ADD COLUMN IF NOT EXISTS channel_id TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS handle TEXT;
ALTER TABLE creators ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS creators_channel_id_key
  ON creators (channel_id)
  WHERE channel_id IS NOT NULL;
