import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const depts = await db.query.departments.findMany({
    where: (d, { eq }) => eq(d.orgId, orgId),
    orderBy: (d, { asc }) => [asc(d.name)],
  });

  return NextResponse.json(depts);
}
