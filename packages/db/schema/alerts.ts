import { pgTable, uuid, varchar, text, jsonb, boolean, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const alertTypeEnum = pgEnum("alert_type", [
  "budget_warning", "budget_exceeded", "anomaly", "dlp_violation",
  "provider_error", "idle_seats", "compliance_risk", "tool_overlap"
]);
export const alertSeverityEnum = pgEnum("alert_severity", ["info", "warning", "critical"]);

export const alerts = pgTable("alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  type: alertTypeEnum("type").notNull(),
  severity: alertSeverityEnum("severity").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata").default({}).notNull(),
  isRead: boolean("is_read").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  orgIdCreatedAtIdx: index("alerts_org_id_created_at_idx").on(table.orgId, table.createdAt),
}));
