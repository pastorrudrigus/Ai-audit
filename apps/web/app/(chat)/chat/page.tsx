"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, FileText, Mail, BarChart2, Languages, Edit3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const TEMPLATES = [
  {
    icon: FileText,
    label: "Resumir documento",
    systemPrompt: "Você é um especialista em sumarização. Analise o conteúdo fornecido e crie um resumo conciso e estruturado, destacando os pontos principais.",
    starter: "Resuma o seguinte documento:",
  },
  {
    icon: Edit3,
    label: "Revisar texto",
    systemPrompt: "Revise o texto a seguir para clareza, gramática e estilo. Sugira melhorias mantendo o tom original.",
    starter: "Revise o seguinte texto:",
  },
  {
    icon: BarChart2,
    label: "Analisar dados",
    systemPrompt: "Analise os dados fornecidos e apresente insights, tendências e recomendações de forma clara e estruturada.",
    starter: "Analise os seguintes dados:",
  },
  {
    icon: Mail,
    label: "Gerar email",
    systemPrompt: "Redija um email profissional com tom apropriado, estrutura clara e linguagem adequada ao contexto corporativo.",
    starter: "Escreva um email sobre:",
  },
  {
    icon: Languages,
    label: "Traduzir",
    systemPrompt: "Traduza o texto fornecido de forma natural e precisa, mantendo o tom e estilo do original.",
    starter: "Traduza para português:",
  },
];

export default function ChatPage() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [systemPrompt, setSystemPrompt] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  function selectTemplate(tpl: typeof TEMPLATES[0]) {
    setSystemPrompt(tpl.systemPrompt);
    setInput(tpl.starter + "\n\n");
  }

  async function handleSend() {
    if (!input.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, systemPrompt }),
      });
      const data = await res.json();
      if (data.conversationId) {
        router.push(`/chat/${data.conversationId}`);
      }
    } catch {
      toast.error("Erro ao enviar mensagem");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="border-b border-border h-14 flex items-center px-6">
        <h1 className="font-semibold">Chat IA</h1>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-2xl">
          <h2 className="text-2xl font-semibold text-center mb-2">Como posso ajudar?</h2>
          <p className="text-muted-foreground text-center mb-8 text-sm">
            Converse com IA usando os modelos aprovados pela sua empresa
          </p>

          {/* Templates */}
          <div className="grid grid-cols-5 gap-2 mb-6">
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.label}
                onClick={() => selectTemplate(tpl)}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center hover:border-primary hover:bg-accent/50 transition-colors text-xs",
                  systemPrompt === tpl.systemPrompt
                    ? "border-primary bg-accent"
                    : "border-border"
                )}
              >
                <tpl.icon className="w-4 h-4 text-muted-foreground" />
                <span className="leading-tight">{tpl.label}</span>
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="pr-12 resize-none min-h-[100px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSend();
              }}
            />
            <Button
              size="icon"
              className="absolute bottom-3 right-3"
              onClick={handleSend}
              disabled={loading || !input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {systemPrompt && (
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
              Template ativo: {TEMPLATES.find(t => t.systemPrompt === systemPrompt)?.label}
              <button className="ml-1 hover:underline" onClick={() => setSystemPrompt(undefined)}>
                remover
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
