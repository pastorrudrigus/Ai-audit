import { pgTable, uuid, varchar, integer, jsonb, boolean, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { providers } from "./providers";

export const routingRules = pgTable("routing_rules", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  priority: integer("priority").notNull(),
  conditions: jsonb("conditions").notNull(),
  targetProviderId: uuid("target_provider_id").notNull().references(() => providers.id),
  targetModelId: varchar("target_model_id", { length: 255 }).notNull(),
  fallbackProviderId: uuid("fallback_provider_id").references(() => providers.id),
  fallbackModelId: varchar("fallback_model_id", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
