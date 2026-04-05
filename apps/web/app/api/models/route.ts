import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const modelsData = await db.query.models.findMany({
    where: (m, { eq }) => eq(m.isActive, true),
    orderBy: (m, { asc }) => [asc(m.providerType)],
  });

  return NextResponse.json(modelsData);
}
