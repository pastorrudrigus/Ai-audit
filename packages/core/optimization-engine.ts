import { eq, and, lt, sql } from "drizzle-orm";
import type { createDb } from "@aigate/db";
import {
  subscriptions,
  subscriptionSeats,
  optimizationInsights,
  aiTools,
} from "@aigate/db";

type Db = ReturnType<typeof createDb>;

export interface OptimizationInsight {
  type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  estimatedSavingsMonthly?: number;
  relatedSubscriptionIds: string[];
  relatedToolIds?: string[];
  actionLabel?: string;
}

const IDLE_THRESHOLD_DAYS = 30;

export async function detectIdleSeats(
  db: Db,
  orgId: string
): Promise<OptimizationInsight[]> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - IDLE_THRESHOLD_DAYS);

  const allSubs = await db.query.subscriptions.findMany({
    where: and(
      eq(subscriptions.orgId, orgId),
      eq(subscriptions.status, "active")
    ),
    with: { seats: true },
  });

  const insights: OptimizationInsight[] = [];

  for (const sub of allSubs) {
    const idleSeats = sub.seats.filter((seat) => {
      if (seat.status === "inactive") return true;
      if (!seat.lastActiveAt) return false;
      return new Date(seat.lastActiveAt) < thirtyDaysAgo;
    });

    if (idleSeats.length === 0) continue;

    const costPerSeat = Number(sub.costMonthly) / (sub.totalSeats || 1);
    const estimatedSavings = costPerSeat * idleSeats.length;

    insights.push({
      type: "idle_seats",
      severity: idleSeats.length >= 5 ? "warning" : "info",
      title: `${idleSeats.length} assento(s) inativo(s) em ${sub.planName}`,
      description: `${idleSeats.length} usuário(s) não usam esta ferramenta há mais de ${IDLE_THRESHOLD_DAYS} dias. Considere remover esses assentos.`,
      estimatedSavingsMonthly: estimatedSavings,
      relatedSubscriptionIds: [sub.id],
      actionLabel: "Ver assentos inativos",
    });
  }

  return insights;
}

export async function detectToolOverlap(
  db: Db,
  orgId: string
): Promise<OptimizationInsight[]> {
  const activeSubs = await db.query.subscriptions.findMany({
    where: and(
      eq(subscriptions.orgId, orgId),
      eq(subscriptions.status, "active")
    ),
    with: { aiTool: true },
  });

  const insights: OptimizationInsight[] = [];
  const categoryMap = new Map<string, typeof activeSubs>();

  for (const sub of activeSubs) {
    const category = sub.aiTool?.category ?? "unknown";
    if (!categoryMap.has(category)) categoryMap.set(category, []);
    categoryMap.get(category)!.push(sub);
  }

  for (const [category, subs] of categoryMap.entries()) {
    if (subs.length < 2) continue;

    const totalCost = subs.reduce((s, sub) => s + Number(sub.costMonthly), 0);
    const names = subs.map((s) => s.aiTool?.name ?? "Unknown").join(", ");

    insights.push({
      type: "tool_overlap",
      severity: "warning",
      title: `Sobreposição na categoria: ${category}`,
      description: `Ferramentas com funções similares em uso: ${names}. Considere consolidar em uma única solução.`,
      estimatedSavingsMonthly: totalCost * 0.3, // Estimated 30% saving
      relatedSubscriptionIds: subs.map((s) => s.id),
      relatedToolIds: subs.map((s) => s.aiToolId),
      actionLabel: "Ver análise de sobreposição",
    });
  }

  return insights;
}

export async function detectComplianceRisks(
  db: Db,
  orgId: string
): Promise<OptimizationInsight[]> {
  const activeSubs = await db.query.subscriptions.findMany({
    where: and(
      eq(subscriptions.orgId, orgId),
      eq(subscriptions.status, "active")
    ),
    with: { aiTool: true },
  });

  const insights: OptimizationInsight[] = [];

  for (const sub of activeSubs) {
    const tool = sub.aiTool;
    if (!tool) continue;

    const issues: string[] = [];
    if (!tool.hasDpa) issues.push("sem DPA");
    if (tool.trainsOnData === "yes") issues.push("treina com dados do usuário");
    if (!tool.hasSso) issues.push("sem SSO");

    if (issues.length === 0) continue;

    insights.push({
      type: "compliance_risk",
      severity: tool.trainsOnData === "yes" || !tool.hasDpa ? "critical" : "warning",
      title: `Risco de compliance: ${tool.name}`,
      description: `${tool.name} possui os seguintes riscos: ${issues.join(", ")}. Revise a política de uso desta ferramenta.`,
      relatedSubscriptionIds: [sub.id],
      relatedToolIds: [tool.id],
      actionLabel: "Revisar política de uso",
    });
  }

  return insights;
}

export async function detectPlanDowngrade(
  db: Db,
  orgId: string
): Promise<OptimizationInsight[]> {
  const activeSubs = await db.query.subscriptions.findMany({
    where: and(
      eq(subscriptions.orgId, orgId),
      eq(subscriptions.status, "active")
    ),
    with: { seats: true, aiTool: true },
  });

  const insights: OptimizationInsight[] = [];

  for (const sub of activeSubs) {
    if (!sub.totalSeats || sub.totalSeats === 0) continue;

    const activeSeats = sub.seats.filter((s) => s.status === "active").length;
    const utilization = activeSeats / sub.totalSeats;

    if (utilization < 0.5) {
      const costPerSeat = Number(sub.costMonthly) / sub.totalSeats;
      const unusedSeats = sub.totalSeats - activeSeats;
      const estimatedSavings = costPerSeat * unusedSeats;

      insights.push({
        type: "plan_downgrade",
        severity: utilization < 0.3 ? "warning" : "info",
        title: `${sub.aiTool?.name}: utilização abaixo de ${Math.round(utilization * 100)}%`,
        description: `Apenas ${activeSeats} de ${sub.totalSeats} assentos estão em uso. Considere reduzir o plano ou número de licenças.`,
        estimatedSavingsMonthly: estimatedSavings,
        relatedSubscriptionIds: [sub.id],
        actionLabel: "Ver detalhes do plano",
      });
    }
  }

  return insights;
}

export async function runOptimizationEngine(db: Db, orgId: string) {
  const [idle, overlap, compliance, downgrade] = await Promise.all([
    detectIdleSeats(db, orgId),
    detectToolOverlap(db, orgId),
    detectComplianceRisks(db, orgId),
    detectPlanDowngrade(db, orgId),
  ]);

  const allInsights = [...idle, ...overlap, ...compliance, ...downgrade];

  // Insert new insights (skip duplicates by title)
  for (const insight of allInsights) {
    await db.insert(optimizationInsights).values({
      orgId,
      type: insight.type as "idle_seats" | "plan_downgrade" | "tool_overlap" | "compliance_risk" | "consolidation" | "cost_anomaly",
      severity: insight.severity,
      title: insight.title,
      description: insight.description,
      estimatedSavingsMonthly: insight.estimatedSavingsMonthly?.toFixed(2),
      relatedSubscriptionIds: insight.relatedSubscriptionIds,
      relatedToolIds: insight.relatedToolIds ?? null,
      actionLabel: insight.actionLabel ?? null,
      status: "open",
    }).onConflictDoNothing();
  }

  return allInsights;
}
