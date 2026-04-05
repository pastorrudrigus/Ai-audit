import Fuse from "fuse.js";

export interface ToolEntry {
  id: string;
  name: string;
  vendor: string;
}

export interface MatchResult {
  toolId: string;
  toolName: string;
  confidence: number;
}

export function createMatcher(tools: ToolEntry[]) {
  // Build search entries for both name and vendor
  const entries = tools.flatMap((tool) => [
    { id: tool.id, text: tool.name, type: "name" },
    { id: tool.id, text: tool.vendor, type: "vendor" },
    { id: tool.id, text: `${tool.name} ${tool.vendor}`, type: "combined" },
  ]);

  const fuse = new Fuse(entries, {
    keys: ["text"],
    threshold: 0.4,
    includeScore: true,
  });

  return function matchMerchant(merchant: string): MatchResult | null {
    const normalized = merchant
      .replace(/[*]/g, "")
      .replace(/\.(COM|NET|IO|DEV|AI|ML)/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    const results = fuse.search(normalized);
    if (results.length === 0) return null;

    const best = results[0];
    const score = best.score ?? 1;
    const confidence = 1 - score;

    if (confidence < 0.5) return null;

    const toolId = best.item.id;
    const tool = tools.find((t) => t.id === toolId);
    if (!tool) return null;

    return {
      toolId,
      toolName: tool.name,
      confidence,
    };
  };
}
