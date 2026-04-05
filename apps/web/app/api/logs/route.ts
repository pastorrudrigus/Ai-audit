import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const logs = await db.query.requestLogs.findMany({
    where: (l, { eq }) => eq(l.orgId, orgId),
    orderBy: (l, { desc }) => [desc(l.createdAt)],
    limit: 100,
  });

  return NextResponse.json(logs);
}
