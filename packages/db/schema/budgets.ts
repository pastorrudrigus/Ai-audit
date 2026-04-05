import { pgTable, uuid, varchar, decimal, boolean, timestamp, unique } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { departments } from "./departments";
import { projects } from "./projects";

export const budgets = pgTable("budgets", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "cascade" }),
  period: varchar("period", { length: 7 }).notNull(), // "YYYY-MM"
  limitAmount: decimal("limit_amount", { precision: 10, scale: 2 }).notNull(),
  spentGateway: decimal("spent_gateway", { precision: 10, scale: 6 }).default("0").notNull(),
  spentPlatforms: decimal("spent_platforms", { precision: 10, scale: 2 }).default("0").notNull(),
  alertSent: boolean("alert_sent").default(false).notNull(),
  isHardLimit: boolean("is_hard_limit").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  uniqueBudget: unique("unique_budget").on(table.orgId, table.departmentId, table.projectId, table.period),
}));
