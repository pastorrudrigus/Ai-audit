import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { subscriptionSeats } from "@aigate/db";
import { z } from "zod";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

const createSeatSchema = z.object({
  subscriptionId: z.string().uuid(),
  userEmail: z.string().email(),
  userName: z.string().optional(),
  status: z.enum(["active", "inactive", "invited", "unknown"]).default("active"),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const body = await req.json();
  const parsed = createSeatSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [seat] = await db
    .insert(subscriptionSeats)
    .values({ orgId, ...parsed.data, source: "manual" })
    .returning();

  return NextResponse.json(seat, { status: 201 });
}
