import { pgTable, uuid, varchar, integer, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { conversations } from "./conversations";
import { messages } from "./messages";
import { users } from "./users";

export const attachmentStatusEnum = pgEnum("attachment_status", [
  "uploaded",
  "attached",
  "failed",
]);

/**
 * Anexos enviados pelo advogado no chat (PDF/DOCX/TXT). O texto extraído fica
 * em `extractedText` e é injetado no prompt como se fosse conteúdo do usuário,
 * passando pela mesma pipeline de DLP/tokenização — nomes, CPF, CNPJ, número
 * de processo etc. são tarjados antes de sair para o LLM, exatamente igual ao
 * texto colado. O binário original NÃO é retido: só o texto extraído.
 *
 * Ciclo:
 *   1. upload → status='uploaded', messageId=null
 *   2. usuário aperta enviar → linka na message criada, status='attached'
 *   3. falha na extração → status='failed', errorMessage preenchido
 */
export const attachments = pgTable("attachments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  filename: varchar("filename", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  extractedText: text("extracted_text").notNull().default(""),
  charCount: integer("char_count").notNull().default(0),
  pageCount: integer("page_count"),
  status: attachmentStatusEnum("status").notNull().default("uploaded"),
  errorMessage: text("error_message"),
  // Storage do binário original em R2/S3. Null = não armazenado (R2 não
  // configurado no ambiente, ou upload falhou). Nesse caso o texto extraído
  // ainda existe — só o download original fica indisponível.
  storageBucket: varchar("storage_bucket", { length: 100 }),
  storageKey: varchar("storage_key", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
