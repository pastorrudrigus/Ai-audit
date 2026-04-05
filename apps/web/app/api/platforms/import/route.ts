import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { billingTransactions, aiTools } from "@aigate/db";
import { createMatcher } from "@aigate/core";

const getOrgId = () => process.env.DEMO_ORG_ID ?? "";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { transactions } = body as {
    transactions: Array<{
      date: string;
      merchant: string;
      amount: number;
      currency: string;
      cardLastFour?: string;
    }>;
  };

  if (!Array.isArray(transactions)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const orgId = getOrgId();
  const allTools = await db.query.aiTools.findMany();
  const matcher = createMatcher(allTools.map((t) => ({ id: t.id, name: t.name, vendor: t.vendor })));

  const preview = transactions.map((tx) => {
    const match = matcher(tx.merchant);
    return {
      ...tx,
      matchedToolId: match?.toolId ?? null,
      matchedToolName: match?.toolName ?? null,
      confidence: match?.confidence ?? 0,
      classificationStatus:
        match && match.confidence > 0.8
          ? "auto_matched"
          : match
          ? "unclassified"
          : "not_ai",
    };
  });

  return NextResponse.json({ preview });
}

export async function PUT(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId = getOrgId();
  const body = await req.json();
  const { confirmed } = body as {
    confirmed: Array<{
      date: string;
      merchant: string;
      amount: number;
      currency: string;
      cardLastFour?: string;
      matchedToolId: string | null;
      classificationStatus: string;
    }>;
  };

  const inserted = await db.insert(billingTransactions).values(
    confirmed.map((tx) => ({
      orgId,
      source: "csv_import" as const,
      transactionDate: tx.date,
      merchantName: tx.merchant,
      matchedToolId: tx.matchedToolId,
      amount: tx.amount.toString(),
      currency: tx.currency ?? "USD",
      cardLastFour: tx.cardLastFour ?? null,
      classificationStatus: tx.classificationStatus as "auto_matched" | "manually_confirmed" | "unclassified" | "not_ai",
    }))
  ).returning();

  return NextResponse.json({ inserted: inserted.length });
}
