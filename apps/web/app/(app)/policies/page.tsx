"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/shared/header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Plus } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

interface Policy {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  rules: unknown;
  scope: unknown;
  createdAt: string;
}

const typeLabel: Record<string, string> = {
  dlp: "DLP",
  model_access: "Acesso a Modelos",
  rate_limit: "Rate Limit",
  budget: "Budget",
  content: "Conteúdo",
};

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<Policy[]>([]);

  useEffect(() => {
    fetch("/api/policies").then((r) => r.json()).then((data) =>
      setPolicies(Array.isArray(data) ? data : [])
    );
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Políticas" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex justify-between mb-6">
          <p className="text-sm text-muted-foreground">{policies.length} política(s)</p>
          <Button size="sm">
            <Plus className="w-4 h-4 mr-2" />Nova política
          </Button>
        </div>

        {policies.length === 0 && (
          <EmptyState
            icon={ShieldCheck}
            title="Nenhuma política configurada"
            description="Configure políticas de DLP, acesso a modelos e rate limiting."
            action={{ label: "Criar política", href: "#" }}
          />
        )}

        <div className="space-y-3">
          {policies.map((policy) => (
            <Card key={policy.id}>
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{policy.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {typeLabel[policy.type] ?? policy.type}
                    </p>
                  </div>
                </div>
                <Badge variant={policy.isActive ? "success" : "secondary"}>
                  {policy.isActive ? "Ativa" : "Inativa"}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
