import { pgTable, uuid, varchar, decimal, integer, boolean, text, date, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { aiTools } from "./ai-tools";
import { departments } from "./departments";
import { users } from "./users";

export const billingCycleEnum = pgEnum("billing_cycle", ["monthly", "annual", "quarterly"]);
export const subscriptionStatusEnum = pgEnum("subscription_status", [
  "active", "paused", "cancelled", "trial", "pending_review"
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "corporate_card", "invoice", "reimbursement", "unknown"
]);
export const subscriptionSourceEnum = pgEnum("subscription_source", [
  "manual", "billing_import", "api_sync"
]);

export const subscriptions = pgTable("subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  aiToolId: uuid("ai_tool_id").notNull().references(() => aiTools.id),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  planName: varchar("plan_name", { length: 255 }).notNull(),
  costMonthly: decimal("cost_monthly", { precision: 10, scale: 2 }).notNull(),
  billingCycle: billingCycleEnum("billing_cycle").default("monthly").notNull(),
  annualCost: decimal("annual_cost", { precision: 10, scale: 2 }),
  totalSeats: integer("total_seats"),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  paymentMethod: paymentMethodEnum("payment_method").default("unknown").notNull(),
  cardLastFour: varchar("card_last_four", { length: 4 }),
  status: subscriptionStatusEnum("status").default("active").notNull(),
  renewalDate: date("renewal_date"),
  ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  source: subscriptionSourceEnum("source").default("manual").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
