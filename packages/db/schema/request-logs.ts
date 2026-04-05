import { pgTable, uuid, varchar, integer, decimal, jsonb, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { apiKeys } from "./api-keys";
import { departments } from "./departments";
import { projects } from "./projects";

export const requestSourceEnum = pgEnum("request_source", ["gateway", "web_interface"]);
export const requestStatusEnum = pgEnum("request_status", ["success", "error", "blocked_policy", "blocked_budget", "blocked_dlp"]);

export const requestLogs = pgTable("request_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  source: requestSourceEnum("source").notNull(),
  providerType: varchar("provider_type", { length: 50 }).notNull(),
  modelId: varchar("model_id", { length: 255 }).notNull(),
  inputTokens: integer("input_tokens").notNull(),
  outputTokens: integer("output_tokens").notNull(),
  totalTokens: integer("total_tokens").notNull(),
  costUsd: decimal("cost_usd", { precision: 10, scale: 6 }).notNull(),
  latencyMs: integer("latency_ms").notNull(),
  status: requestStatusEnum("status").notNull(),
  blockedReason: varchar("blocked_reason", { length: 512 }),
  dlpFlags: jsonb("dlp_flags"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  orgIdCreatedAtIdx: index("request_logs_org_id_created_at_idx").on(table.orgId, table.createdAt),
}));
