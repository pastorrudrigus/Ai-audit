import { pgTable, uuid, text, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { conversations } from "./conversations";
import { requestLogs } from "./request-logs";

export const messageRoleEnum = pgEnum("message_role", ["user", "assistant", "system"]);

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  conversationId: uuid("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
  requestLogId: uuid("request_log_id").references(() => requestLogs.id, { onDelete: "set null" }),
  role: messageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  attachments: jsonb("attachments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
