"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Search, Plus } from "lucide-react";
import { toast } from "sonner";

interface AiTool {
  id: string;
  name: string;
  vendor: string;
  category: string;
  pricingModel: string;
  plans: Array<{ name: string; price_monthly: number | null; limits: string }>;
  hasDpa: boolean;
  trainsOnData: string;
}

export default function AddPlatformPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [tools, setTools] = useState<AiTool[]>([]);
  const [selected, setSelected] = useState<AiTool | null>(null);
  const [planName, setPlanName] = useState("");
  const [costMonthly, setCostMonthly] = useState("");
  const [totalSeats, setTotalSeats] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch(`/api/platforms/catalog?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((data) => setTools(Array.isArray(data) ? data : []));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  async function handleAdd() {
    if (!selected || !planName || !costMonthly) return;
    setSaving(true);
    try {
      const res = await fetch("/api/platforms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          aiToolId: selected.id,
          planName,
          costMonthly: parseFloat(costMonthly),
          totalSeats: totalSeats ? parseInt(totalSeats) : undefined,
        }),
      });
      if (res.ok) {
        toast.success(`${selected.name} adicionado!`);
        router.push("/platforms");
      } else {
        toast.error("Erro ao adicionar");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Adicionar Plataforma" />
      <main className="flex-1 overflow-y-auto p-6 max-w-2xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/platforms">
              <ChevronLeft className="w-4 h-4 mr-1" />Voltar
            </Link>
          </Button>
        </div>

        {!selected ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar ferramentas (ex: ChatGPT, Cursor, Midjourney...)"
                className="pl-9"
              />
            </div>

            <div className="space-y-2">
              {tools.map((tool) => (
                <Card
                  key={tool.id}
                  className="cursor-pointer hover:border-primary transition-colors"
                  onClick={() => {
                    setSelected(tool);
                    if (tool.plans?.[0]) {
                      setPlanName(tool.plans[0].name);
                      setCostMonthly(tool.plans[0].price_monthly?.toString() ?? "");
                    }
                  }}
                >
                  <CardContent className="pt-3 pb-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{tool.name}</p>
                      <p className="text-xs text-muted-foreground">{tool.vendor} · {tool.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {tool.hasDpa ? (
                        <Badge variant="success" className="text-xs">DPA</Badge>
                      ) : (
                        <Badge variant="critical" className="text-xs">Sem DPA</Badge>
                      )}
                      {tool.trainsOnData === "yes" && (
                        <Badge variant="critical" className="text-xs">Treina dados</Badge>
                      )}
                      <Badge variant="outline" className="text-xs">{tool.pricingModel}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold">{selected.name}</p>
                  <p className="text-sm text-muted-foreground">{selected.vendor}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
                  Trocar
                </Button>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Plano</label>
                <div className="grid grid-cols-2 gap-2">
                  {selected.plans?.map((plan) => (
                    <button
                      key={plan.name}
                      onClick={() => {
                        setPlanName(plan.name);
                        setCostMonthly(plan.price_monthly?.toString() ?? "");
                      }}
                      className={`p-3 rounded-lg border text-sm text-left transition-colors ${
                        planName === plan.name ? "border-primary bg-accent" : "border-border"
                      }`}
                    >
                      <p className="font-medium">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {plan.price_monthly != null ? `$${plan.price_monthly}/mês` : "Preço sob consulta"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{plan.limits}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Custo mensal (USD)</label>
                  <Input
                    type="number"
                    value={costMonthly}
                    onChange={(e) => setCostMonthly(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Total de assentos</label>
                  <Input
                    type="number"
                    value={totalSeats}
                    onChange={(e) => setTotalSeats(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleAdd}
                disabled={saving || !planName || !costMonthly}
              >
                <Plus className="w-4 h-4 mr-2" />
                {saving ? "Adicionando..." : "Adicionar assinatura"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
