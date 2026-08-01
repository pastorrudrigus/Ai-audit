-- Attachments — anexos PDF/DOCX/TXT enviados pelo advogado no chat.
-- Idempotente: pode rodar duas vezes sem erro.

DO $$ BEGIN
  CREATE TYPE attachment_status AS ENUM ('uploaded', 'attached', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INTEGER NOT NULL,
  extracted_text TEXT NOT NULL DEFAULT '',
  char_count INTEGER NOT NULL DEFAULT 0,
  page_count INTEGER,
  status attachment_status NOT NULL DEFAULT 'uploaded',
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS attachments_conversation_idx ON attachments(conversation_id);
CREATE INDEX IF NOT EXISTS attachments_message_idx ON attachments(message_id);
CREATE INDEX IF NOT EXISTS attachments_org_created_idx ON attachments(org_id, created_at DESC);
