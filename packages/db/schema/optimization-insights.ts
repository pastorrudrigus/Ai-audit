import { pgTable, uuid, varchar, text, decimal, jsonb, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

export const insightTypeEnum = pgEnum("insight_type", [
  "idle_seats", "plan_downgrade", "tool_overlap", "compliance_risk",
  "consolidation", "cost_anomaly"
]);
export const insightSeverityEnum = pgEnum("insight_severity", ["info", "warning", "critical"]);
export const insightStatusEnum = pgEnum("insight_status", [
  "open", "acknowledged", "resolved", "dismissed"
]);

export const optimizationInsights = pgTable("optimization_insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  type: insightTypeEnum("type").notNull(),
  severity: insightSeverityEnum("severity").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  estimatedSavingsMonthly: decimal("estimated_savings_monthly", { precision: 10, scale: 2 }),
  relatedSubscriptionIds: jsonb("related_subscription_ids").default([]).notNull(),
  relatedToolIds: jsonb("related_tool_ids"),
  actionLabel: varchar("action_label", { length: 100 }),
  status: insightStatusEnum("status").default("open").notNull(),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
