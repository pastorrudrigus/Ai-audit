import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const insights = await db.query.optimizationInsights.findMany({
    where: (i, { eq }) => eq(i.orgId, orgId),
    orderBy: (i, { desc }) => [desc(i.createdAt)],
  });

  return NextResponse.json(insights);
}
