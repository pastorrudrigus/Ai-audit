import { pgTable, uuid, varchar, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { subscriptions } from "./subscriptions";
import { organizations } from "./organizations";
import { users } from "./users";

export const seatStatusEnum = pgEnum("seat_status", ["active", "inactive", "invited", "unknown"]);
export const seatSourceEnum = pgEnum("seat_source", ["manual", "sso_detected", "billing_import"]);

export const subscriptionSeats = pgTable("subscription_seats", {
  id: uuid("id").primaryKey().defaultRandom(),
  subscriptionId: uuid("subscription_id").notNull().references(() => subscriptions.id, { onDelete: "cascade" }),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  userEmail: varchar("user_email", { length: 255 }).notNull(),
  userName: varchar("user_name", { length: 255 }),
  status: seatStatusEnum("status").default("active").notNull(),
  lastActiveAt: timestamp("last_active_at"),
  source: seatSourceEnum("source").default("manual").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
