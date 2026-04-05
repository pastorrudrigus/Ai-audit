import Link from "next/link";
import { TrendingDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

interface Insight {
  id: string;
  title: string;
  estimatedSavingsMonthly: number | null;
  severity: string;
  type: string;
}

interface SavingsPanelProps {
  insights: Insight[];
  totalSavings: number;
}

export function SavingsPanel({ insights, totalSavings }: SavingsPanelProps) {
  return (
    <Card className="border-green-200 bg-green-50/50">
      <CardHeader className="pb-2 flex flex-row items-start justify-between">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-green-600" />
            Economia Potencial
          </CardTitle>
          <p className="text-2xl font-bold text-green-700 mt-1">
            {formatCurrency(totalSavings)}<span className="text-sm font-normal text-green-600">/mês</span>
          </p>
        </div>
        <Link href="/optimizations" className="text-xs text-green-700 hover:underline whitespace-nowrap">
          Ver todas →
        </Link>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.slice(0, 3).map((insight) => (
          <Link
            key={insight.id}
            href="/optimizations"
            className="flex items-center justify-between group p-2 rounded-md hover:bg-green-100/50 transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{insight.title}</p>
              {insight.estimatedSavingsMonthly && (
                <p className="text-xs text-green-700">
                  Economia: {formatCurrency(insight.estimatedSavingsMonthly)}/mês
                </p>
              )}
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground shrink-0" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
