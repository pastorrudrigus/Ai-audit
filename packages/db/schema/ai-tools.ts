import { pgTable, uuid, varchar, text, boolean, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const toolCategoryEnum = pgEnum("tool_category", [
  "ide", "code_gen", "app_builder", "chat", "image_gen",
  "agent", "writing", "data", "design", "video", "audio"
]);

export const pricingModelEnum = pgEnum("pricing_model", [
  "per_seat", "per_credit", "per_usage", "flat", "freemium"
]);

export const aiTools = pgTable("ai_tools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  vendor: varchar("vendor", { length: 255 }).notNull(),
  category: toolCategoryEnum("category").notNull(),
  pricingModel: pricingModelEnum("pricing_model").notNull(),
  plans: jsonb("plans").notNull().default([]),
  hasApi: boolean("has_api").default(false).notNull(),
  hasSso: boolean("has_sso").default(false).notNull(),
  hasDpa: boolean("has_dpa").default(false).notNull(),
  dataResidency: jsonb("data_residency"),
  trainsOnData: varchar("trains_on_data", { length: 50 }).default("unknown").notNull(),
  complianceNotes: text("compliance_notes"),
  alternativeToolIds: jsonb("alternative_tool_ids"),
  websiteUrl: varchar("website_url", { length: 512 }).notNull(),
  logoUrl: varchar("logo_url", { length: 512 }),
  isVerified: boolean("is_verified").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
