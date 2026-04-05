"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Key, Plus, Copy, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";

interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  isActive: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  department: { name: string } | null;
}

export default function KeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/keys").then(r => r.json()).then(data => setKeys(Array.isArray(data) ? data : []));
  }, []);

  async function createKey() {
    const res = await fetch("/api/keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "Nova chave" }) });
    const data = await res.json();
    if (data.key) {
      setNewKey(data.key);
      setKeys(prev => [data, ...prev]);
      toast.success("Chave criada! Copie agora — ela não será exibida novamente.");
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="API Keys" />
      <main className="flex-1 overflow-y-auto p-6">
        <div className="flex justify-between mb-6">
          <p className="text-sm text-muted-foreground">{keys.length} chave(s)</p>
          <Button size="sm" onClick={createKey}>
            <Plus className="w-4 h-4 mr-2" />Nova chave
          </Button>
        </div>

        {newKey && (
          <Card className="mb-4 border-green-200 bg-green-50">
            <CardContent className="pt-4 pb-4">
              <p className="text-sm font-medium text-green-800 mb-2">Chave criada! Copie agora:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-white rounded px-3 py-2 border text-green-900 font-mono">
                  {newKey}
                </code>
                <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copiado!"); }}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {keys.length === 0 && (
          <EmptyState icon={Key} title="Nenhuma API key" description="Crie uma chave para começar a usar o Gateway." action={{ label: "Criar chave", href: "#" }} />
        )}

        <div className="space-y-3">
          {keys.map((k) => (
            <Card key={k.id}>
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Key className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium text-sm">{k.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {k.keyPrefix}••••••••••••••••
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {k.department && <span className="text-xs text-muted-foreground">{k.department.name}</span>}
                  <span className="text-xs text-muted-foreground">
                    {k.lastUsedAt ? `Usado ${formatDate(k.lastUsedAt)}` : "Nunca usado"}
                  </span>
                  <Badge variant={k.isActive ? "success" : "secondary"}>
                    {k.isActive ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
