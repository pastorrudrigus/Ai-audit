import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { alerts } from "@aigate/db";
import { eq } from "drizzle-orm";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const data = await db.query.alerts.findMany({
    where: (a, { eq }) => eq(a.orgId, orgId),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });

  return NextResponse.json(data);
}

export async function PATCH() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  await db.update(alerts)
    .set({ isRead: true })
    .where(eq(alerts.orgId, orgId));

  return NextResponse.json({ ok: true });
}
