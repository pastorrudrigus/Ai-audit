import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { apiKeys } from "@aigate/db";
import { generateApiKey } from "@/lib/encryption";
import { z } from "zod";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const keys = await db.query.apiKeys.findMany({
    where: (k, { eq }) => eq(k.orgId, orgId),
    with: { department: true },
    orderBy: (k, { desc }) => [desc(k.createdAt)],
  });

  return NextResponse.json(keys);
}

const createKeySchema = z.object({
  name: z.string().min(1),
  departmentId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const body = await req.json();
  const parsed = createKeySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  let user = await db.query.users.findFirst({
    where: (u, { eq, and }) => and(eq(u.orgId, orgId), eq(u.clerkId, clerkId)),
  });
  // Fallback for demo: any user in the org
  if (!user) {
    user = await db.query.users.findFirst({
      where: (u, { eq }) => eq(u.orgId, orgId),
    });
  }
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { key, prefix, hash } = generateApiKey();

  const [created] = await db.insert(apiKeys).values({
    orgId,
    createdBy: user.id,
    keyHash: hash,
    keyPrefix: prefix,
    name: parsed.data.name,
    departmentId: parsed.data.departmentId ?? null,
    projectId: parsed.data.projectId ?? null,
  }).returning();

  return NextResponse.json({ ...created, key }, { status: 201 });
}
