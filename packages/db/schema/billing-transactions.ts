import { pgTable, uuid, varchar, decimal, boolean, date, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { subscriptions } from "./subscriptions";
import { aiTools } from "./ai-tools";

export const transactionSourceEnum = pgEnum("transaction_source", [
  "csv_import", "brex_api", "ramp_api", "stripe_api", "manual"
]);
export const classificationStatusEnum = pgEnum("classification_status", [
  "auto_matched", "manually_confirmed", "unclassified", "not_ai"
]);

export const billingTransactions = pgTable("billing_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  subscriptionId: uuid("subscription_id").references(() => subscriptions.id, { onDelete: "set null" }),
  source: transactionSourceEnum("source").notNull(),
  transactionDate: date("transaction_date").notNull(),
  merchantName: varchar("merchant_name", { length: 512 }).notNull(),
  matchedToolId: uuid("matched_tool_id").references(() => aiTools.id, { onDelete: "set null" }),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  cardLastFour: varchar("card_last_four", { length: 4 }),
  isRecurring: boolean("is_recurring"),
  classificationStatus: classificationStatusEnum("classification_status").default("unclassified").notNull(),
  rawData: jsonb("raw_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
