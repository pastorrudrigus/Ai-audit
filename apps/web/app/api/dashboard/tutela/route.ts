/**
 * GET /api/dashboard/tutela — KPIs do painel do sócio.
 *
 * Métricas: consultas protegidas (requests com dlpFlags não-nulo), dados
 * tarjados (soma de totalCount de dlpFlags), citações sinalizadas
 * (nao_encontrada + divergente em request_logs.metadata.kind=citation_check),
 * custo por área (agregado por department_id), taxa de conformidade
 * (protegidas / total).
 *
 * Filtros opcionais via query string: ?departmentId=<uuid>&userId=<uuid>.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requestLogs, departments, users } from "@aigate/db";
import { and, eq, gte, sql, count, sum, isNotNull } from "drizzle-orm";

function orgId() {
  return process.env.DEMO_ORG_ID ?? "";
}

export async function GET(req: NextRequest) {
  const { userId: clerkUserId } = await auth();
  if (!clerkUserId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = orgId();
  if (!org) return NextResponse.json({ error: "Org not configured" }, { status: 404 });

  const url = new URL(req.url);
  const filterDept = url.searchParams.get("departmentId");
  const filterUser = url.searchParams.get("userId");
  const days = parseInt(url.searchParams.get("days") ?? "30", 10);

  const since = new Date();
  since.setDate(since.getDate() - days);

  // Filtros — sempre incluem orgId e janela de tempo
  const base = [eq(requestLogs.orgId, org), gte(requestLogs.createdAt, since)];
  if (filterDept) base.push(eq(requestLogs.departmentId, filterDept));
  if (filterUser) base.push(eq(requestLogs.userId, filterUser));

  // Total de requests no período
  const [totalRow] = await db
    .select({ n: count(requestLogs.id) })
    .from(requestLogs)
    .where(and(...base));

  // Consultas protegidas — as que passaram por anonimização
  const [protectedRow] = await db
    .select({ n: count(requestLogs.id) })
    .from(requestLogs)
    .where(and(...base, isNotNull(requestLogs.dlpFlags)));

  // Custo total no período (só requests com custo, exclui citation_check)
  const [costRow] = await db
    .select({ c: sum(requestLogs.costUsd) })
    .from(requestLogs)
    .where(and(...base));

  // Requests bloqueadas por DLP
  const [blockedRow] = await db
    .select({ n: count(requestLogs.id) })
    .from(requestLogs)
    .where(and(...base, eq(requestLogs.status, "blocked_dlp")));

  // Verificações de citação e sinalizadas — usa jsonb metadata.kind e agregações
  const citationRows = await db
    .select({
      total: sql<string>`COALESCE(SUM((${requestLogs.metadata}->>'total')::int), 0)`,
      naoEncontrada: sql<string>`COALESCE(SUM((${requestLogs.metadata}->>'nao_encontrada')::int), 0)`,
      divergente: sql<string>`COALESCE(SUM((${requestLogs.metadata}->>'divergente')::int), 0)`,
      runs: count(requestLogs.id),
    })
    .from(requestLogs)
    .where(and(...base, sql`${requestLogs.metadata}->>'kind' = 'citation_check'`));

  // Dados tarjados — soma de dlpFlags.totalCount
  const [tarjadoRow] = await db
    .select({
      total: sql<string>`COALESCE(SUM((${requestLogs.dlpFlags}->>'totalCount')::int), 0)`,
    })
    .from(requestLogs)
    .where(and(...base, isNotNull(requestLogs.dlpFlags)));

  // Custo por área — join com departments para nome
  const perDept = await db
    .select({
      departmentId: requestLogs.departmentId,
      departmentName: departments.name,
      cost: sum(requestLogs.costUsd),
      requests: count(requestLogs.id),
    })
    .from(requestLogs)
    .leftJoin(departments, eq(departments.id, requestLogs.departmentId))
    .where(and(...base))
    .groupBy(requestLogs.departmentId, departments.name);

  // Séries temporais dos últimos `days` (para gráfico simples)
  const daily = await db
    .select({
      date: sql<string>`DATE(${requestLogs.createdAt})`,
      cost: sum(requestLogs.costUsd),
      requests: count(requestLogs.id),
      protegidas: sql<string>`COUNT(*) FILTER (WHERE ${requestLogs.dlpFlags} IS NOT NULL)`,
    })
    .from(requestLogs)
    .where(and(...base))
    .groupBy(sql`DATE(${requestLogs.createdAt})`)
    .orderBy(sql`DATE(${requestLogs.createdAt})`);

  // Filtros disponíveis (para preencher os selects no front)
  const allDepartments = await db.query.departments.findMany({
    where: (d, { eq }) => eq(d.orgId, org),
    orderBy: (d, { asc }) => [asc(d.name)],
  });
  const allUsers = await db.query.users.findMany({
    where: (u, { eq }) => eq(u.orgId, org),
    orderBy: (u, { asc }) => [asc(u.name)],
  });

  const total = Number(totalRow?.n ?? 0);
  const prot = Number(protectedRow?.n ?? 0);
  const complianceRate = total > 0 ? prot / total : 0;

  return NextResponse.json({
    filters: {
      departmentId: filterDept,
      userId: filterUser,
      days,
    },
    kpi: {
      totalRequests: total,
      consultasProtegidas: prot,
      complianceRate,
      dadosTarjados: Number(tarjadoRow?.total ?? 0),
      bloqueadas: Number(blockedRow?.n ?? 0),
      custoTotal: Number(costRow?.c ?? 0),
      citacoesVerificadas: Number(citationRows[0]?.total ?? 0),
      citacoesSinalizadas:
        Number(citationRows[0]?.naoEncontrada ?? 0) +
        Number(citationRows[0]?.divergente ?? 0),
      runsVerificacao: Number(citationRows[0]?.runs ?? 0),
    },
    perDepartment: perDept
      .filter((r) => r.departmentId !== null)
      .map((r) => ({
        id: r.departmentId,
        name: r.departmentName ?? "—",
        cost: Number(r.cost ?? 0),
        requests: Number(r.requests ?? 0),
      })),
    daily: daily.map((r) => ({
      date: r.date,
      cost: Number(r.cost ?? 0),
      requests: Number(r.requests ?? 0),
      protegidas: Number(r.protegidas ?? 0),
    })),
    catalog: {
      departments: allDepartments.map((d) => ({ id: d.id, name: d.name })),
      users: allUsers.map((u) => ({ id: u.id, name: u.name, departmentId: u.departmentId })),
    },
  });
}
