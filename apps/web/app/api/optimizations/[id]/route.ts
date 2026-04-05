import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { optimizationInsights } from "@aigate/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

const patchSchema = z.object({
  status: z.enum(["open", "acknowledged", "resolved", "dismissed"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [updated] = await db
    .update(optimizationInsights)
    .set({
      status: parsed.data.status,
      resolvedAt: parsed.data.status === "resolved" ? new Date() : undefined,
    })
    .where(
      and(
        eq(optimizationInsights.id, params.id),
        eq(optimizationInsights.orgId, orgId)
      )
    )
    .returning();

  return NextResponse.json(updated);
}
