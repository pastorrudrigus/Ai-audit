import { relations } from "drizzle-orm";
import { organizations } from "./organizations";
import { users } from "./users";
import { departments } from "./departments";
import { projects } from "./projects";
import { apiKeys } from "./api-keys";
import { providers } from "./providers";
import { routingRules } from "./routing-rules";
import { policies } from "./policies";
import { requestLogs } from "./request-logs";
import { conversations } from "./conversations";
import { messages } from "./messages";
import { attachments } from "./attachments";
import { budgets } from "./budgets";
import { alerts } from "./alerts";
import { aiTools } from "./ai-tools";
import { subscriptions } from "./subscriptions";
import { subscriptionSeats } from "./subscription-seats";
import { billingTransactions } from "./billing-transactions";
import { optimizationInsights } from "./optimization-insights";

export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(users),
  departments: many(departments),
  projects: many(projects),
  apiKeys: many(apiKeys),
  providers: many(providers),
  routingRules: many(routingRules),
  policies: many(policies),
  requestLogs: many(requestLogs),
  conversations: many(conversations),
  subscriptions: many(subscriptions),
  alerts: many(alerts),
  budgets: many(budgets),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, { fields: [users.orgId], references: [organizations.id] }),
  department: one(departments, { fields: [users.departmentId], references: [departments.id] }),
  conversations: many(conversations),
  requestLogs: many(requestLogs),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  organization: one(organizations, { fields: [departments.orgId], references: [organizations.id] }),
  users: many(users),
  projects: many(projects),
  subscriptions: many(subscriptions),
  budgets: many(budgets),
}));

export const projectsRelations = relations(projects, ({ one }) => ({
  organization: one(organizations, { fields: [projects.orgId], references: [organizations.id] }),
  department: one(departments, { fields: [projects.departmentId], references: [departments.id] }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  organization: one(organizations, { fields: [apiKeys.orgId], references: [organizations.id] }),
  createdBy: one(users, { fields: [apiKeys.createdBy], references: [users.id] }),
  department: one(departments, { fields: [apiKeys.departmentId], references: [departments.id] }),
  project: one(projects, { fields: [apiKeys.projectId], references: [projects.id] }),
}));

export const providersRelations = relations(providers, ({ one }) => ({
  organization: one(organizations, { fields: [providers.orgId], references: [organizations.id] }),
}));

export const requestLogsRelations = relations(requestLogs, ({ one }) => ({
  organization: one(organizations, { fields: [requestLogs.orgId], references: [organizations.id] }),
  user: one(users, { fields: [requestLogs.userId], references: [users.id] }),
  department: one(departments, { fields: [requestLogs.departmentId], references: [departments.id] }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  organization: one(organizations, { fields: [conversations.orgId], references: [organizations.id] }),
  user: one(users, { fields: [conversations.userId], references: [users.id] }),
  messages: many(messages),
  attachments: many(attachments),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  requestLog: one(requestLogs, { fields: [messages.requestLogId], references: [requestLogs.id] }),
  attachments: many(attachments),
}));

export const attachmentsRelations = relations(attachments, ({ one }) => ({
  organization: one(organizations, { fields: [attachments.orgId], references: [organizations.id] }),
  conversation: one(conversations, { fields: [attachments.conversationId], references: [conversations.id] }),
  message: one(messages, { fields: [attachments.messageId], references: [messages.id] }),
  user: one(users, { fields: [attachments.userId], references: [users.id] }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one, many }) => ({
  organization: one(organizations, { fields: [subscriptions.orgId], references: [organizations.id] }),
  aiTool: one(aiTools, { fields: [subscriptions.aiToolId], references: [aiTools.id] }),
  department: one(departments, { fields: [subscriptions.departmentId], references: [departments.id] }),
  seats: many(subscriptionSeats),
}));

export const subscriptionSeatsRelations = relations(subscriptionSeats, ({ one }) => ({
  subscription: one(subscriptions, { fields: [subscriptionSeats.subscriptionId], references: [subscriptions.id] }),
  user: one(users, { fields: [subscriptionSeats.userId], references: [users.id] }),
}));

export const aiToolsRelations = relations(aiTools, ({ many }) => ({
  subscriptions: many(subscriptions),
}));

export const billingTransactionsRelations = relations(billingTransactions, ({ one }) => ({
  organization: one(organizations, { fields: [billingTransactions.orgId], references: [organizations.id] }),
  subscription: one(subscriptions, { fields: [billingTransactions.subscriptionId], references: [subscriptions.id] }),
  matchedTool: one(aiTools, { fields: [billingTransactions.matchedToolId], references: [aiTools.id] }),
}));
