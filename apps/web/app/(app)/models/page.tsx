"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/shared/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

interface Model {
  id: string;
  displayName: string;
  providerType: string;
  modelId: string;
  inputCostPer1mTokens: string;
  outputCostPer1mTokens: string;
  maxContextWindow: number;
  category: string;
  supportsVision: boolean;
  supportsTools: boolean;
}

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);

  useEffect(() => {
    fetch("/api/models").then(r => r.json()).then(data => setModels(Array.isArray(data) ? data : []));
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Modelos & Providers" />
      <main className="flex-1 overflow-y-auto p-6">
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b">
                <th className="text-left py-2 px-4 text-xs text-muted-foreground">Modelo</th>
                <th className="text-left py-2 px-4 text-xs text-muted-foreground">Provider</th>
                <th className="text-center py-2 px-4 text-xs text-muted-foreground">Categoria</th>
                <th className="text-right py-2 px-4 text-xs text-muted-foreground">Input / 1M</th>
                <th className="text-right py-2 px-4 text-xs text-muted-foreground">Output / 1M</th>
                <th className="text-right py-2 px-4 text-xs text-muted-foreground">Contexto</th>
                <th className="text-center py-2 px-4 text-xs text-muted-foreground">Recursos</th>
              </tr></thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-2.5 px-4 font-medium">{m.displayName}</td>
                    <td className="py-2.5 px-4 text-muted-foreground capitalize">{m.providerType}</td>
                    <td className="py-2.5 px-4 text-center">
                      <Badge variant={m.category === "flagship" ? "info" : m.category === "fast" ? "success" : "secondary"}>
                        {m.category}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-right">${m.inputCostPer1mTokens}</td>
                    <td className="py-2.5 px-4 text-right">${m.outputCostPer1mTokens}</td>
                    <td className="py-2.5 px-4 text-right">{(m.maxContextWindow / 1000).toFixed(0)}k</td>
                    <td className="py-2.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {m.supportsVision && <Badge variant="outline" className="text-xs py-0">Vision</Badge>}
                        {m.supportsTools && <Badge variant="outline" className="text-xs py-0">Tools</Badge>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
