import { pgTable, uuid, varchar, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { departments } from "./departments";

export const userRoleEnum = pgEnum("user_role", ["owner", "admin", "manager", "member", "viewer"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  clerkId: varchar("clerk_id", { length: 255 }).unique(),
  email: varchar("email", { length: 255 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  role: userRoleEnum("role").default("member").notNull(),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});
