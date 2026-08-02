-- Adiciona 'blocked_injection' ao enum request_status para o detector de
-- prompt injection. Idempotente.

DO $$ BEGIN
  ALTER TYPE request_status ADD VALUE IF NOT EXISTS 'blocked_injection';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
