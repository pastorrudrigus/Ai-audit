/**
 * GET /api/dashboard/tutela/export?days=30&departmentId=&format=csv
 *
 * Relatório de conformidade em CSV. Uma linha por request_log do período,
 * com colunas: data, area, advogado, modelo, status, dados_tarjados, custo_usd,
 * kind (chat|citation_check).
 *
 * v1 é intencionalmente CSV. PDF pode ser adicionado sem quebrar a rota.
 */

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { requestLogs, users, departments } from "@aigate/db";
import { and, eq, gte, sql, desc } from "drizzle-orm";

function orgId() {
  return process.env.DEMO_ORG_ID ?? "";
}

/** Envelope minimalista de escape CSV: aspeia e escapa aspas duplas. */
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return new Response("Unauthorized", { status: 401 });

  const org = orgId();
  if (!org) return new Response("Org not configured", { status: 404 });

  const url = new URL(req.url);
  const filterDept = url.searchParams.get("departmentId");
  const days = parseInt(url.searchParams.get("days") ?? "30", 10);

  const since = new Date();
  since.setDate(since.getDate() - days);

  const filters = [eq(requestLogs.orgId, org), gte(requestLogs.createdAt, since)];
  if (filterDept) filters.push(eq(requestLogs.departmentId, filterDept));

  const rows = await db
    .select({
      createdAt: requestLogs.createdAt,
      departmentName: departments.name,
      userName: users.name,
      modelId: requestLogs.modelId,
      status: requestLogs.status,
      dlpTotal: sql<string>`COALESCE((${requestLogs.dlpFlags}->>'totalCount')::int, 0)`,
      metadataKind: sql<string>`COALESCE(${requestLogs.metadata}->>'kind', 'chat')`,
      costUsd: requestLogs.costUsd,
      latencyMs: requestLogs.latencyMs,
    })
    .from(requestLogs)
    .leftJoin(departments, eq(departments.id, requestLogs.departmentId))
    .leftJoin(users, eq(users.id, requestLogs.userId))
    .where(and(...filters))
    .orderBy(desc(requestLogs.createdAt));

  const header = [
    "data",
    "area",
    "advogado",
    "modelo",
    "status",
    "dados_tarjados",
    "custo_usd",
    "latencia_ms",
    "tipo",
  ];

  const lines: string[] = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.createdAt?.toISOString?.() ?? "",
        r.departmentName ?? "",
        r.userName ?? "",
        r.modelId ?? "",
        r.status ?? "",
        r.dlpTotal ?? 0,
        r.costUsd ?? "0",
        r.latencyMs ?? 0,
        r.metadataKind ?? "chat",
      ]
        .map(csvCell)
        .join(",")
    );
  }

  const csv = lines.join("\n");
  const filename = `tutela-conformidade-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
