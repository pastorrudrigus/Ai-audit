import { pgTable, uuid, varchar, jsonb, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const policyTypeEnum = pgEnum("policy_type", ["dlp", "model_access", "rate_limit", "budget", "content"]);

export const policies = pgTable("policies", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  type: policyTypeEnum("type").notNull(),
  rules: jsonb("rules").notNull(),
  scope: jsonb("scope").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
