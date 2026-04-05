import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { subscriptions } from "@aigate/db";
import { z } from "zod";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const subs = await db.query.subscriptions.findMany({
    where: (s, { eq }) => eq(s.orgId, orgId),
    with: { aiTool: true, department: true, seats: true },
    orderBy: (s, { desc }) => [desc(s.costMonthly)],
  });

  return NextResponse.json(subs);
}

const createSubscriptionSchema = z.object({
  aiToolId: z.string().uuid(),
  planName: z.string(),
  costMonthly: z.number(),
  billingCycle: z.enum(["monthly", "annual", "quarterly"]).default("monthly"),
  totalSeats: z.number().optional(),
  departmentId: z.string().uuid().optional(),
  paymentMethod: z.enum(["corporate_card", "invoice", "reimbursement", "unknown"]).default("unknown"),
  status: z.enum(["active", "paused", "cancelled", "trial", "pending_review"]).default("active"),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const orgId = getOrgId();
  const [sub] = await db.insert(subscriptions).values({
    orgId,
    ...parsed.data,
    costMonthly: parsed.data.costMonthly.toString(),
    source: "manual",
  }).returning();

  return NextResponse.json(sub, { status: 201 });
}
