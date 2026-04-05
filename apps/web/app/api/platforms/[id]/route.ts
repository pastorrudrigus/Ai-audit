import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { subscriptions } from "@aigate/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const sub = await db.query.subscriptions.findFirst({
    where: (s, { eq, and }) =>
      and(eq(s.id, params.id), eq(s.orgId, orgId)),
    with: { aiTool: true, department: true, seats: true },
  });

  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(sub);
}

const updateSchema = z.object({
  status: z.enum(["active", "paused", "cancelled", "trial", "pending_review"]).optional(),
  costMonthly: z.number().optional(),
  planName: z.string().optional(),
  notes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const data = parsed.data;
  const [updated] = await db
    .update(subscriptions)
    .set({
      ...data,
      costMonthly: data.costMonthly?.toString(),
      updatedAt: new Date(),
    })
    .where(and(eq(subscriptions.id, params.id), eq(subscriptions.orgId, orgId)))
    .returning();

  return NextResponse.json(updated);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  await db
    .delete(subscriptions)
    .where(and(eq(subscriptions.id, params.id), eq(subscriptions.orgId, orgId)));

  return NextResponse.json({ ok: true });
}
