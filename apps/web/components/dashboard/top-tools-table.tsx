import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface ToolRow {
  rank: number;
  name: string;
  vendor: string;
  type: "gateway" | "platform";
  department: string;
  costMonthly: number;
  hasDpa: boolean;
  trainsOnData: string;
}

export function TopToolsTable({ tools }: { tools: ToolRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Top Ferramentas por Custo</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-4 text-xs text-muted-foreground font-medium">#</th>
              <th className="text-left py-2 px-4 text-xs text-muted-foreground font-medium">Ferramenta</th>
              <th className="text-left py-2 px-4 text-xs text-muted-foreground font-medium">Tipo</th>
              <th className="text-left py-2 px-4 text-xs text-muted-foreground font-medium">Depto</th>
              <th className="text-right py-2 px-4 text-xs text-muted-foreground font-medium">Custo/mês</th>
              <th className="text-center py-2 px-4 text-xs text-muted-foreground font-medium">Compliance</th>
            </tr>
          </thead>
          <tbody>
            {tools.map((tool) => (
              <tr key={tool.rank} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-2.5 px-4 text-muted-foreground">{tool.rank}</td>
                <td className="py-2.5 px-4 font-medium">{tool.name}</td>
                <td className="py-2.5 px-4">
                  <Badge variant={tool.type === "gateway" ? "info" : "secondary"}>
                    {tool.type === "gateway" ? "Gateway" : "Plataforma"}
                  </Badge>
                </td>
                <td className="py-2.5 px-4 text-muted-foreground">{tool.department}</td>
                <td className="py-2.5 px-4 text-right font-medium">{formatCurrency(tool.costMonthly)}</td>
                <td className="py-2.5 px-4 text-center">
                  {tool.trainsOnData === "yes" || !tool.hasDpa ? (
                    <Badge variant="critical">Risco</Badge>
                  ) : tool.trainsOnData === "opt-out" ? (
                    <Badge variant="warning">Revisar</Badge>
                  ) : (
                    <Badge variant="success">OK</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
