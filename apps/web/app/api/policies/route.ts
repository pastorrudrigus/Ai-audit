import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const data = await db.query.policies.findMany({
    where: (p, { eq }) => eq(p.orgId, orgId),
    orderBy: (p, { asc }) => [asc(p.name)],
  });

  return NextResponse.json(data);
}
