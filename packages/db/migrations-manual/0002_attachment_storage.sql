-- Storage do binário original dos anexos (Cloudflare R2 / S3).
-- Idempotente.

ALTER TABLE attachments ADD COLUMN IF NOT EXISTS storage_bucket VARCHAR(100);
ALTER TABLE attachments ADD COLUMN IF NOT EXISTS storage_key VARCHAR(500);
