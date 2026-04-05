import { pgTable, uuid, varchar, decimal, boolean, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { departments } from "./departments";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  name: varchar("name", { length: 255 }).notNull(),
  monthlyBudget: decimal("monthly_budget", { precision: 10, scale: 2 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
