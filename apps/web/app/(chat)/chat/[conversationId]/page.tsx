"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Send, Bot, User, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  requestLogId?: string | null;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    costUsd: string;
    model: string;
  };
}

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUsage, setLastUsage] = useState<{ inputTokens: number; outputTokens: number; costUsd: string; model: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/chat/${conversationId}`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || loading) return;
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: input }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro");
        return;
      }
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.message,
        createdAt: new Date().toISOString(),
        usage: {
          inputTokens: data.usage.inputTokens,
          outputTokens: data.usage.outputTokens,
          costUsd: data.usage.costUsd,
          model: data.model,
        },
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setLastUsage({ ...data.usage, model: data.model });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <div className="border-b border-border h-14 flex items-center px-4 gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/chat"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <span className="font-medium text-sm">Conversa</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1",
              msg.role === "user" ? "bg-blue-600 text-white" : "bg-slate-100"
            )}>
              {msg.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-slate-600" />}
            </div>
            <div className={cn("max-w-[75%] space-y-1", msg.role === "user" ? "items-end" : "items-start")}>
              <div className={cn(
                "rounded-xl px-4 py-2.5 text-sm",
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-tr-sm"
                  : "bg-slate-100 text-foreground rounded-tl-sm"
              )}>
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
              {msg.usage && (
                <div className="flex items-center gap-1 flex-wrap">
                  <Badge variant="outline" className="text-xs py-0">
                    {msg.usage.model}
                  </Badge>
                  <Badge variant="outline" className="text-xs py-0">
                    {msg.usage.inputTokens + msg.usage.outputTokens} tokens
                  </Badge>
                  <Badge variant="outline" className="text-xs py-0 text-green-700">
                    ${parseFloat(msg.usage.costUsd).toFixed(4)}
                  </Badge>
                  <Badge variant="success" className="text-xs py-0">✓ OK</Badge>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-1">
              <Bot className="w-3.5 h-3.5 text-slate-600" />
            </div>
            <div className="bg-slate-100 rounded-xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-border p-4">
        <div className="relative max-w-3xl mx-auto">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Mensagem..."
            className="pr-12 resize-none min-h-[52px] max-h-[200px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            size="icon"
            className="absolute bottom-2 right-2 h-8 w-8"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
