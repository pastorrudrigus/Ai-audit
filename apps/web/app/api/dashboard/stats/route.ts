import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { eq, and, gte, sum, count, sql } from "drizzle-orm";
import { requestLogs, subscriptions, budgets, optimizationInsights, alerts, departments } from "@aigate/db";

function getOrgId() {
  return process.env.DEMO_ORG_ID ?? "";
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  if (!orgId) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Current month gateway spend + requests
  const [gatewayStats] = await db
    .select({
      totalCost: sum(requestLogs.costUsd),
      totalRequests: count(requestLogs.id),
    })
    .from(requestLogs)
    .where(and(eq(requestLogs.orgId, orgId), gte(requestLogs.createdAt, startOfMonth)));

  // Prev month stats
  const [prevStats] = await db
    .select({
      totalCost: sum(requestLogs.costUsd),
      totalRequests: count(requestLogs.id),
    })
    .from(requestLogs)
    .where(
      and(
        eq(requestLogs.orgId, orgId),
        gte(requestLogs.createdAt, prevMonthStart),
        sql`${requestLogs.createdAt} <= ${prevMonthEnd}`
      )
    );

  // Platform spend from subscriptions
  const [platformStats] = await db
    .select({ totalCost: sum(subscriptions.costMonthly) })
    .from(subscriptions)
    .where(and(eq(subscriptions.orgId, orgId), eq(subscriptions.status, "active")));

  // Budget data for chart (last 30 days by day)
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const dailyGateway = await db
    .select({
      date: sql<string>`DATE(${requestLogs.createdAt})`,
      spend: sum(requestLogs.costUsd),
    })
    .from(requestLogs)
    .where(and(eq(requestLogs.orgId, orgId), gte(requestLogs.createdAt, thirtyDaysAgo)))
    .groupBy(sql`DATE(${requestLogs.createdAt})`)
    .orderBy(sql`DATE(${requestLogs.createdAt})`);

  // Active alerts
  const [alertStats] = await db
    .select({ count: count(alerts.id) })
    .from(alerts)
    .where(and(eq(alerts.orgId, orgId), eq(alerts.isRead, false)));

  // Optimization insights
  const openInsights = await db.query.optimizationInsights.findMany({
    where: (ins, { eq, and }) =>
      and(eq(ins.orgId, orgId), eq(ins.status, "open")),
    orderBy: (ins, { desc }) => [desc(ins.estimatedSavingsMonthly)],
    limit: 5,
  });

  const totalSavings = openInsights.reduce(
    (s, i) => s + Number(i.estimatedSavingsMonthly ?? 0),
    0
  );

  // Recent alerts
  const recentAlerts = await db.query.alerts.findMany({
    where: (a, { eq }) => eq(a.orgId, orgId),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
    limit: 5,
  });

  // Subscriptions for top tools
  const activeSubs = await db.query.subscriptions.findMany({
    where: (s, { eq, and }) =>
      and(eq(s.orgId, orgId), eq(s.status, "active")),
    with: { aiTool: true, department: true },
    orderBy: (s, { desc }) => [desc(s.costMonthly)],
    limit: 10,
  });

  const gatewaySpend = Number(gatewayStats.totalCost ?? 0);
  const platformSpend = Number(platformStats.totalCost ?? 0);
  const prevGatewaySpend = Number(prevStats.totalCost ?? 0);

  // Build spend trend data
  const spendByDate = new Map<string, { gateway: number; platforms: number }>();
  const daysToShow = 30;
  for (let i = daysToShow - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    spendByDate.set(key, { gateway: 0, platforms: platformSpend / daysToShow });
  }
  for (const row of dailyGateway) {
    const existing = spendByDate.get(row.date);
    if (existing) {
      existing.gateway = Number(row.spend ?? 0);
    }
  }

  const trendData = Array.from(spendByDate.entries()).map(([date, v]) => ({
    date: date.slice(5), // MM-DD
    gateway: parseFloat(v.gateway.toFixed(2)),
    platforms: parseFloat(v.platforms.toFixed(2)),
  }));

  return NextResponse.json({
    kpi: {
      totalSpend: gatewaySpend + platformSpend,
      gatewaySpend,
      platformSpend,
      totalRequests: Number(gatewayStats.totalRequests ?? 0),
      activeAlerts: Number(alertStats.count ?? 0),
      prevTotalSpend: prevGatewaySpend + platformSpend,
      prevRequests: Number(prevStats.totalRequests ?? 0),
    },
    trendData,
    recentAlerts,
    openInsights,
    totalSavings,
    topTools: activeSubs.map((s, i) => ({
      rank: i + 1,
      name: s.aiTool?.name ?? "Unknown",
      vendor: s.aiTool?.vendor ?? "",
      type: "platform" as const,
      department: s.department?.name ?? "—",
      costMonthly: Number(s.costMonthly),
      hasDpa: s.aiTool?.hasDpa ?? false,
      trainsOnData: s.aiTool?.trainsOnData ?? "unknown",
    })),
  });
}
