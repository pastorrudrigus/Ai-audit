import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requestLogs } from "@aigate/db";
import { eq, and, gte, sum, count, avg, sql } from "drizzle-orm";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [overview] = await db
    .select({
      totalCost: sum(requestLogs.costUsd),
      totalRequests: count(requestLogs.id),
      avgLatency: avg(requestLogs.latencyMs),
    })
    .from(requestLogs)
    .where(and(eq(requestLogs.orgId, orgId), gte(requestLogs.createdAt, startOfMonth)));

  const [blockedDlpResult] = await db
    .select({ count: count(requestLogs.id) })
    .from(requestLogs)
    .where(and(
      eq(requestLogs.orgId, orgId),
      eq(requestLogs.status, "blocked_dlp"),
      gte(requestLogs.createdAt, startOfMonth)
    ));

  const byModel = await db
    .select({
      modelId: requestLogs.modelId,
      requests: count(requestLogs.id),
      tokens: sum(requestLogs.totalTokens),
      cost: sum(requestLogs.costUsd),
    })
    .from(requestLogs)
    .where(and(eq(requestLogs.orgId, orgId), gte(requestLogs.createdAt, startOfMonth)))
    .groupBy(requestLogs.modelId)
    .orderBy(sql`SUM(${requestLogs.costUsd}) DESC`);

  const dailySpend = await db
    .select({
      date: sql<string>`DATE(${requestLogs.createdAt})`,
      cost: sum(requestLogs.costUsd),
    })
    .from(requestLogs)
    .where(and(eq(requestLogs.orgId, orgId), gte(requestLogs.createdAt, thirtyDaysAgo)))
    .groupBy(sql`DATE(${requestLogs.createdAt})`)
    .orderBy(sql`DATE(${requestLogs.createdAt})`);

  return NextResponse.json({
    totalCost: Number(overview.totalCost ?? 0),
    totalRequests: Number(overview.totalRequests ?? 0),
    avgLatency: Math.round(Number(overview.avgLatency ?? 0)),
    blockedDlp: Number(blockedDlpResult.count ?? 0),
    byModel: byModel.map(m => ({
      modelId: m.modelId,
      requests: Number(m.requests),
      tokens: Number(m.tokens ?? 0),
      cost: Number(m.cost ?? 0),
    })),
    dailySpend: dailySpend.map(d => ({
      date: d.date.slice(5),
      cost: parseFloat(Number(d.cost ?? 0).toFixed(4)),
    })),
  });
}
