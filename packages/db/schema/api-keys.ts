import { pgTable, uuid, varchar, boolean, timestamp } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";
import { projects } from "./projects";
import { departments } from "./departments";

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").notNull().references(() => users.id),
  keyHash: varchar("key_hash", { length: 64 }).notNull().unique(),
  keyPrefix: varchar("key_prefix", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});
