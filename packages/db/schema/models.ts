import { pgTable, uuid, varchar, decimal, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const modelCategoryEnum = pgEnum("model_category", ["flagship", "balanced", "fast", "embedding"]);

export const models = pgTable("models", {
  id: uuid("id").primaryKey().defaultRandom(),
  providerType: varchar("provider_type", { length: 50 }).notNull(),
  modelId: varchar("model_id", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }).notNull(),
  inputCostPer1mTokens: decimal("input_cost_per_1m_tokens", { precision: 10, scale: 6 }).notNull(),
  outputCostPer1mTokens: decimal("output_cost_per_1m_tokens", { precision: 10, scale: 6 }).notNull(),
  maxContextWindow: integer("max_context_window").notNull(),
  supportsVision: boolean("supports_vision").default(false).notNull(),
  supportsTools: boolean("supports_tools").default(false).notNull(),
  category: modelCategoryEnum("category").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
