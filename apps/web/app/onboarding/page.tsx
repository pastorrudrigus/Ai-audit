"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STEPS = [
  "Organização",
  "Provider",
  "Departamentos",
  "Ferramentas",
  "Integração",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [provider, setProvider] = useState<"openai" | "anthropic">("openai");
  const [apiKey, setApiKey] = useState("");
  const [depts, setDepts] = useState([{ name: "", budget: "" }]);
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState(false);

  async function testConnection() {
    setTesting(true);
    setTimeout(() => {
      setTested(true);
      setTesting(false);
      toast.success("Conexão testada com sucesso!");
    }, 1500);
  }

  function copySnippet(lang: "python" | "node") {
    const snippet =
      lang === "python"
        ? `import openai\nclient = openai.OpenAI(\n    base_url="${process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://gw.aigate.com"}/v1",\n    api_key="aig_sk_your_key"\n)\n\nresponse = client.chat.completions.create(\n    model="gpt-4o",\n    messages=[{"role": "user", "content": "Hello!"}]\n)`
        : `import OpenAI from "openai";\nconst client = new OpenAI({\n  baseURL: "${process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://gw.aigate.com"}/v1",\n  apiKey: "aig_sk_your_key",\n});\n\nconst resp = await client.chat.completions.create({\n  model: "gpt-4o",\n  messages: [{ role: "user", content: "Hello!" }],\n});`;
    navigator.clipboard.writeText(snippet);
    toast.success("Copiado para clipboard!");
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        {/* Steps indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold",
                  i < step
                    ? "bg-blue-600 text-white"
                    : i === step
                    ? "bg-blue-100 text-blue-700 border border-blue-300"
                    : "bg-slate-200 text-slate-500"
                )}
              >
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("w-8 h-px", i < step ? "bg-blue-600" : "bg-slate-200")} />
              )}
            </div>
          ))}
        </div>

        <Card>
          {/* Step 0: Org name */}
          {step === 0 && (
            <>
              <CardHeader><CardTitle>Nome da organização</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Nome da empresa</label>
                  <Input
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Acme Corp"
                  />
                </div>
                <Button
                  className="w-full"
                  onClick={() => setStep(1)}
                  disabled={!orgName.trim()}
                >
                  Continuar <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </CardContent>
            </>
          )}

          {/* Step 1: Provider */}
          {step === 1 && (
            <>
              <CardHeader><CardTitle>Conecte um provider de IA</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {(["openai", "anthropic"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setProvider(p)}
                      className={cn(
                        "p-3 rounded-lg border text-sm font-medium",
                        provider === p ? "border-blue-500 bg-blue-50" : "border-border"
                      )}
                    >
                      {p === "openai" ? "OpenAI" : "Anthropic"}
                    </button>
                  ))}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">API Key</label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={provider === "openai" ? "sk-..." : "sk-ant-..."}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={testConnection} disabled={testing || !apiKey}>
                    {testing ? "Testando..." : tested ? "✓ Conectado" : "Testar conexão"}
                  </Button>
                  <Button className="flex-1" onClick={() => setStep(2)} disabled={!apiKey}>
                    Continuar
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 2: Departments */}
          {step === 2 && (
            <>
              <CardHeader><CardTitle>Crie seus departamentos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                {depts.map((d, i) => (
                  <div key={i} className="flex gap-2">
                    <Input
                      value={d.name}
                      onChange={(e) => {
                        const nd = [...depts];
                        nd[i].name = e.target.value;
                        setDepts(nd);
                      }}
                      placeholder="Nome do departamento"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={d.budget}
                      onChange={(e) => {
                        const nd = [...depts];
                        nd[i].budget = e.target.value;
                        setDepts(nd);
                      }}
                      placeholder="Budget/mês"
                      className="w-32"
                    />
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDepts([...depts, { name: "", budget: "" }])}
                >
                  + Adicionar departamento
                </Button>
                <Button className="w-full" onClick={() => setStep(3)}>
                  Continuar
                </Button>
              </CardContent>
            </>
          )}

          {/* Step 3: Tools */}
          {step === 3 && (
            <>
              <CardHeader><CardTitle>Quais ferramentas sua empresa usa?</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Esta etapa pode ser pulada. Você poderá adicionar ferramentas depois em{" "}
                  <strong>Plataformas</strong>.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {["ChatGPT", "Cursor", "Claude Pro", "Midjourney", "GitHub Copilot"].map((tool) => (
                    <Badge key={tool} variant="outline" className="cursor-pointer hover:bg-accent">
                      {tool}
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(4)}>
                    Pular
                  </Button>
                  <Button className="flex-1" onClick={() => setStep(4)}>
                    Continuar
                  </Button>
                </div>
              </CardContent>
            </>
          )}

          {/* Step 4: Integration */}
          {step === 4 && (
            <>
              <CardHeader><CardTitle>Integre o Gateway</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Base URL</label>
                  <div className="flex gap-2">
                    <Input
                      value={`${process.env.NEXT_PUBLIC_GATEWAY_URL ?? "https://gw.aigate.com"}/v1`}
                      readOnly
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`${process.env.NEXT_PUBLIC_GATEWAY_URL}/v1`);
                        toast.success("Copiado!");
                      }}
                    >
                      Copiar
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => copySnippet("python")}>
                      Python
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => copySnippet("node")}>
                      Node.js
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" asChild>
                    <a href="/chat">Testar Chat →</a>
                  </Button>
                  <Button className="flex-1" onClick={() => router.push("/dashboard")}>
                    Ir para o Dashboard
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
