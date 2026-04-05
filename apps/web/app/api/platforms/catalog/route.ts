import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { like, or } from "drizzle-orm";
import { aiTools } from "@aigate/db";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q") ?? "";

  let tools;
  if (q.length > 1) {
    tools = await db.query.aiTools.findMany({
      where: (t, { or, ilike }) =>
        or(ilike(t.name, `%${q}%`), ilike(t.vendor, `%${q}%`)),
      limit: 20,
    });
  } else {
    tools = await db.query.aiTools.findMany({ limit: 50 });
  }

  return NextResponse.json(tools);
}
