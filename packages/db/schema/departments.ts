import { pgTable, uuid, varchar, decimal, integer, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  monthlyBudget: decimal("monthly_budget", { precision: 10, scale: 2 }),
  budgetAlertThreshold: integer("budget_alert_threshold").default(80).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
