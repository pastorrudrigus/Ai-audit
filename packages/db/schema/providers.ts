import { pgTable, uuid, varchar, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const providerTypeEnum = pgEnum("provider_type", ["openai", "anthropic", "google", "bedrock", "azure_openai"]);

export const providers = pgTable("providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  providerType: providerTypeEnum("provider_type").notNull(),
  apiKeyEncrypted: varchar("api_key_encrypted", { length: 2048 }).notNull(),
  baseUrl: varchar("base_url", { length: 512 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
