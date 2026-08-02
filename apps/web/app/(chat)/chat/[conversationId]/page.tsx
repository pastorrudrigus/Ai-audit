"use client";

/**
 * Portal do Advogado — conversa com tarjas reversíveis e verificação de citações.
 *
 * Diferenças em relação a um chat genérico:
 * - a mensagem do usuário exibe as tarjas ⟨TIPO_N⟩ como pílulas clicáveis
 *   (hover mostra o valor original decifrado via /api/chat/reveal);
 * - a mensagem do assistente também detecta tarjas na resposta;
 * - badge "N dados tarjados" aparece quando o gateway retorna anonymized_count > 0;
 * - botão "Verificar antes do protocolo" chama /api/verify e mostra o semáforo
 *   (verde = confirmada, amarelo = divergente, vermelho = não encontrada).
 */

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Send, User, ArrowLeft, ShieldCheck, ScanSearch, Eye, EyeOff, Scale, Paperclip, FileText, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TOKEN_RE = /⟨[A-Z_]+_\d+⟩/g;

interface Usage {
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
  model: string;
}

interface DlpFlags {
  action?: string;
  totalCount?: number;
  byType?: Record<string, number>;
  severity?: string;
  nerStatus?: string;
}

interface AttachmentMeta {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  charCount: number;
  pageCount?: number | null;
  status: "uploaded" | "attached" | "failed";
  errorMessage?: string | null;
  hasOriginal?: boolean;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  usage?: Usage;
  /** Cifrado com AES-256-GCM — vai para /api/chat/reveal quando o usuário pedir. */
  entityMap?: string | null;
  anonymizedCount?: number;
  dlpFlags?: DlpFlags | null;
  attachments?: AttachmentMeta[];
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function formatPageCount(mime: string, n: number | null | undefined): string | null {
  if (!n) return null;
  if (mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    || mime === "application/vnd.ms-excel") {
    return `${n} aba${n === 1 ? "" : "s"}`;
  }
  if (mime === "application/pdf") return `${n}p`;
  return null;
}

type CitStatus = "confirmada" | "divergente" | "nao_encontrada" | "erro";

interface VerifiedCitation {
  referencia: string;
  tipoCitacao: "jurisprudencia" | "legislacao";
  trecho: string;
  status: CitStatus;
  observacao: string;
  fonte?: string;
  fromCache?: boolean;
}

interface VerifySummary {
  total: number;
  confirmada: number;
  divergente: number;
  nao_encontrada: number;
  erro: number;
}

interface VerifyState {
  loading: boolean;
  summary?: VerifySummary;
  citations?: VerifiedCitation[];
}

const statusColor: Record<CitStatus, string> = {
  confirmada: "bg-emerald-100 text-emerald-800 border-emerald-200",
  divergente: "bg-amber-100 text-amber-800 border-amber-200",
  nao_encontrada: "bg-red-100 text-red-800 border-red-200",
  erro: "bg-slate-100 text-slate-700 border-slate-200",
};

const statusLabel: Record<CitStatus, string> = {
  confirmada: "Confirmada",
  divergente: "Divergente",
  nao_encontrada: "Não encontrada",
  erro: "Erro",
};

/**
 * Renderiza um texto substituindo cada tarja ⟨TIPO_N⟩ por uma pílula.
 * O componente pai controla o mapa token→original (pode estar vazio até o
 * usuário pedir para revelar).
 */
function TarjaText({
  text,
  revealed,
  onRevealAll,
}: {
  text: string;
  revealed: Record<string, string>;
  onRevealAll?: () => void;
}) {
  const parts: Array<{ type: "text" | "tag"; value: string }> = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(TOKEN_RE.source, "g");
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push({ type: "text", value: text.slice(last, match.index) });
    }
    parts.push({ type: "tag", value: match[0] });
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push({ type: "text", value: text.slice(last) });

  if (parts.length === 0) return <span className="whitespace-pre-wrap">{text}</span>;

  return (
    <span className="whitespace-pre-wrap">
      {parts.map((p, i) => {
        if (p.type === "text") return <span key={i}>{p.value}</span>;
        const originalValue = revealed[p.value];
        const label = originalValue ?? p.value;
        return (
          <span
            key={i}
            title={originalValue ? "clique para ocultar" : "clique em 'revelar tarjas' para ver o original"}
            onClick={onRevealAll}
            className={cn(
              "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-mono border cursor-pointer align-baseline mx-0.5",
              originalValue
                ? "bg-slate-900 text-white border-slate-900"
                : "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
            )}
          >
            {label}
          </span>
        );
      })}
    </span>
  );
}

export default function ConversationPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  /** token → valor original, por mensagem. */
  const [revealedByMsg, setRevealedByMsg] = useState<Record<string, Record<string, string>>>({});
  const [verifyState, setVerifyState] = useState<Record<string, VerifyState>>({});
  /** Anexos pendentes (subidos mas ainda não enviados com uma mensagem). */
  const [pendingAtts, setPendingAtts] = useState<AttachmentMeta[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/chat/${conversationId}`)
      .then((r) => r.json())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => {});
    // Recupera anexos pendentes (usuário fechou a aba antes de enviar)
    fetch(`/api/chat/${conversationId}/attachments?pending=1`)
      .then((r) => r.json())
      .then((data) => setPendingAtts(data.attachments ?? []))
      .catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleUploadFiles(files: FileList | File[]) {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      for (const file of arr) {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch(`/api/chat/${conversationId}/attachments`, {
          method: "POST",
          body: form,
        });
        const data = await res.json();
        if (!res.ok) {
          toast.error(data.error ?? `Falha ao enviar ${file.name}`);
          continue;
        }
        if (data.status === "failed") {
          toast.warning(`${data.filename}: ${data.errorMessage ?? "extração falhou"}`);
        }
        setPendingAtts((prev) => [...prev, data as AttachmentMeta]);
      }
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemovePending(id: string) {
    const prev = pendingAtts;
    setPendingAtts((cur) => cur.filter((a) => a.id !== id));
    const res = await fetch(`/api/chat/${conversationId}/attachments/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      // rollback silencioso
      setPendingAtts(prev);
      toast.error("Não foi possível remover o anexo.");
    }
  }

  async function handleSend() {
    if ((!input.trim() && pendingAtts.length === 0) || loading) return;
    const attachedNow = pendingAtts.filter((a) => a.status !== "failed");
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      createdAt: new Date().toISOString(),
      attachments: attachedNow,
    };
    setMessages((prev) => [...prev, userMsg]);
    const sentInput = input;
    const sentAttIds = attachedNow.map((a) => a.id);
    setInput("");
    setPendingAtts([]);
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          message: sentInput,
          attachmentIds: sentAttIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro ao enviar mensagem");
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
        entityMap: data.tutela?.entity_map ?? null,
        anonymizedCount: data.tutela?.anonymized_count ?? 0,
        dlpFlags: data.tutela?.dlp_flags ?? null,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setLoading(false);
    }
  }

  async function handleReveal(msg: Message) {
    if (!msg.entityMap) {
      toast.info("Não há tarjas para revelar nesta mensagem.");
      return;
    }
    if (revealedByMsg[msg.id]) {
      // toggle off
      setRevealedByMsg((prev) => {
        const next = { ...prev };
        delete next[msg.id];
        return next;
      });
      return;
    }
    try {
      const res = await fetch("/api/chat/reveal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.content, entityMap: msg.entityMap }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Não foi possível revelar as tarjas.");
        return;
      }
      // Deriva o mapa token→valor comparando os tokens presentes no texto original
      // com os trechos correspondentes no texto revelado.
      const tokens = Array.from(new Set(msg.content.match(TOKEN_RE) ?? []));
      const revealed: Record<string, string> = {};
      // Estratégia simples e correta: peça um mapa explícito ao servidor.
      // (Em vez de fazer diff textual, chamamos um endpoint auxiliar abaixo.)
      const mapRes = await fetch("/api/chat/reveal-map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityMap: msg.entityMap }),
      });
      if (mapRes.ok) {
        const map = (await mapRes.json()) as { entries: Array<{ token: string; original: string }> };
        for (const e of map.entries) {
          if (tokens.includes(e.token)) revealed[e.token] = e.original;
        }
      } else {
        // fallback silencioso — usa o texto revelado só para saber que houve sucesso
        void data;
      }
      setRevealedByMsg((prev) => ({ ...prev, [msg.id]: revealed }));
    } catch {
      toast.error("Erro ao revelar tarjas.");
    }
  }

  async function handleVerify(msg: Message) {
    setVerifyState((prev) => ({ ...prev, [msg.id]: { loading: true } }));
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: msg.content }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Erro na verificação");
        setVerifyState((prev) => ({ ...prev, [msg.id]: { loading: false } }));
        return;
      }
      setVerifyState((prev) => ({
        ...prev,
        [msg.id]: {
          loading: false,
          summary: data.summary,
          citations: data.citations,
        },
      }));
    } catch {
      setVerifyState((prev) => ({ ...prev, [msg.id]: { loading: false } }));
      toast.error("Falha na verificação");
    }
  }

  return (
    <div className="flex flex-col h-screen bg-[#FCFBF8]">
      <div className="border-b border-slate-200 h-14 flex items-center px-4 gap-3 bg-white">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/chat"><ArrowLeft className="w-4 h-4" /></Link>
        </Button>
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-[#1F5C45]" />
          <span className="font-medium text-sm">Portal do Advogado</span>
        </div>
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-500">
          <ShieldCheck className="w-3.5 h-3.5 text-[#1F5C45]" />
          Anonimização ativa
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 max-w-4xl w-full mx-auto">
        {messages.map((msg) => {
          const revealed = revealedByMsg[msg.id] ?? {};
          const vs = verifyState[msg.id];
          const hasTokens = TOKEN_RE.test(msg.content);
          TOKEN_RE.lastIndex = 0;
          const anonymized = msg.anonymizedCount ?? 0;

          return (
            <div key={msg.id} className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}>
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1",
                msg.role === "user" ? "bg-[#1B2130] text-white" : "bg-[#1F5C45] text-white"
              )}>
                {msg.role === "user" ? <User className="w-4 h-4" /> : <Scale className="w-4 h-4" />}
              </div>

              <div className={cn("max-w-[85%] space-y-2", msg.role === "user" ? "items-end" : "items-start")}>
                {msg.role === "user" && msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-end">
                    {msg.attachments.map((a) => {
                      const chipInner = (
                        <>
                          <FileText className="w-3 h-3 text-[#1F5C45]" />
                          <span className="max-w-[220px] truncate">{a.filename}</span>
                          <span className="text-slate-400">
                            {formatPageCount(a.mimeType, a.pageCount) ? `${formatPageCount(a.mimeType, a.pageCount)} · ` : ""}{formatBytes(a.sizeBytes)}
                          </span>
                          {a.status === "failed" && (
                            <span className="text-[10px] text-amber-700">falha</span>
                          )}
                        </>
                      );
                      const chipClass = "inline-flex items-center gap-1.5 text-xs rounded-md border border-slate-300 bg-white/90 text-slate-700 px-2 py-1";
                      return a.hasOriginal ? (
                        <a
                          key={a.id}
                          href={`/api/chat/${conversationId}/attachments/${a.id}/download`}
                          className={cn(chipClass, "hover:border-[#1F5C45] hover:text-[#1F5C45]")}
                          title="Baixar arquivo original"
                        >
                          {chipInner}
                        </a>
                      ) : (
                        <span
                          key={a.id}
                          className={chipClass}
                          title={a.errorMessage ?? "Original não disponível"}
                        >
                          {chipInner}
                        </span>
                      );
                    })}
                  </div>
                )}
                {(msg.role !== "user" || msg.content.length > 0) && (
                  <div className={cn(
                    "rounded-xl px-4 py-3 text-sm leading-relaxed border",
                    msg.role === "user"
                      ? "bg-[#1B2130] text-white border-[#1B2130] rounded-tr-sm"
                      : "bg-white text-slate-800 border-slate-200 rounded-tl-sm"
                  )}>
                    <TarjaText
                      text={msg.content}
                      revealed={revealed}
                      onRevealAll={() => handleReveal(msg)}
                    />
                  </div>
                )}

                {/* Badges de proteção — mostradas na resposta do assistente */}
                {msg.role === "assistant" && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {anonymized > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs rounded-full bg-[#1F5C45]/10 text-[#1F5C45] border border-[#1F5C45]/20 px-2 py-0.5">
                        <ShieldCheck className="w-3 h-3" />
                        {anonymized} dado{anonymized === 1 ? "" : "s"} tarjado{anonymized === 1 ? "" : "s"}
                      </span>
                    )}
                    {hasTokens && msg.entityMap && (
                      <button
                        onClick={() => handleReveal(msg)}
                        className="inline-flex items-center gap-1 text-xs rounded-full bg-white text-slate-700 border border-slate-200 hover:border-slate-300 px-2 py-0.5"
                      >
                        {revealed && Object.keys(revealed).length > 0 ? (
                          <>
                            <EyeOff className="w-3 h-3" />
                            Ocultar originais
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" />
                            Revelar tarjas
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleVerify(msg)}
                      disabled={vs?.loading}
                      className="inline-flex items-center gap-1 text-xs rounded-full bg-[#B99154]/10 text-[#8a6a3d] border border-[#B99154]/30 hover:bg-[#B99154]/20 px-2 py-0.5 disabled:opacity-50"
                    >
                      <ScanSearch className="w-3 h-3" />
                      {vs?.loading ? "Verificando..." : "Verificar antes do protocolo"}
                    </button>
                    {msg.usage && (
                      <>
                        <Badge variant="outline" className="text-xs py-0">
                          {msg.usage.model}
                        </Badge>
                        <Badge variant="outline" className="text-xs py-0 text-slate-500">
                          ${parseFloat(msg.usage.costUsd).toFixed(4)}
                        </Badge>
                      </>
                    )}
                  </div>
                )}

                {/* Semáforo de citações */}
                {vs?.summary && (
                  <div className="mt-2 border border-slate-200 rounded-lg bg-white overflow-hidden text-xs">
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2 flex-wrap">
                      <strong>Verificação de citações</strong>
                      <span className="text-slate-500">
                        {vs.summary.total} encontrada{vs.summary.total === 1 ? "" : "s"}
                      </span>
                      {vs.summary.confirmada > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-emerald-100 text-emerald-800">
                          ● {vs.summary.confirmada} confirmada{vs.summary.confirmada === 1 ? "" : "s"}
                        </span>
                      )}
                      {vs.summary.divergente > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-amber-100 text-amber-800">
                          ● {vs.summary.divergente} divergente{vs.summary.divergente === 1 ? "" : "s"}
                        </span>
                      )}
                      {vs.summary.nao_encontrada > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-red-100 text-red-800">
                          ● {vs.summary.nao_encontrada} não encontrada{vs.summary.nao_encontrada === 1 ? "" : "s"}
                        </span>
                      )}
                    </div>
                    {vs.citations && vs.citations.length > 0 && (
                      <ul className="divide-y divide-slate-100">
                        {vs.citations.map((c, i) => (
                          <li key={i} className="px-3 py-2">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="font-mono text-slate-800">{c.referencia}</span>
                              <span className={cn(
                                "text-[10px] uppercase tracking-wide rounded-full border px-1.5 py-0.5",
                                statusColor[c.status]
                              )}>
                                {statusLabel[c.status]}
                              </span>
                              {c.fromCache && (
                                <span className="text-[10px] text-slate-400">cache</span>
                              )}
                            </div>
                            {c.observacao && (
                              <p className="text-slate-600 mt-1">{c.observacao}</p>
                            )}
                            {c.fonte && (
                              <p className="text-[10px] text-slate-400 mt-0.5 truncate">{c.fonte}</p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {vs.summary.total === 0 && (
                      <p className="px-3 py-3 text-slate-500">
                        Nenhuma citação com número identificável foi encontrada.
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1F5C45] text-white flex items-center justify-center shrink-0 mt-1">
              <Scale className="w-4 h-4" />
            </div>
            <div className="bg-white border border-slate-200 rounded-xl rounded-tl-sm px-4 py-3">
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

      <div className="border-t border-slate-200 p-4 bg-white">
        <div className="max-w-3xl mx-auto space-y-2">
          {(pendingAtts.length > 0 || uploading) && (
            <div className="flex flex-wrap gap-1.5">
              {pendingAtts.map((a) => (
                <span
                  key={a.id}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs rounded-md border px-2 py-1",
                    a.status === "failed"
                      ? "bg-amber-50 border-amber-200 text-amber-800"
                      : "bg-slate-50 border-slate-200 text-slate-700"
                  )}
                  title={a.errorMessage ?? undefined}
                >
                  <FileText className="w-3 h-3 text-[#1F5C45]" />
                  <span className="max-w-[220px] truncate">{a.filename}</span>
                  <span className="text-slate-400">
                    {formatPageCount(a.mimeType, a.pageCount) ? `${formatPageCount(a.mimeType, a.pageCount)} · ` : ""}{formatBytes(a.sizeBytes)}
                    {a.charCount > 0 ? ` · ${a.charCount.toLocaleString("pt-BR")} caracteres` : ""}
                  </span>
                  <button
                    onClick={() => handleRemovePending(a.id)}
                    className="text-slate-400 hover:text-slate-700 ml-0.5"
                    aria-label={`Remover ${a.filename}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              {uploading && (
                <span className="inline-flex items-center gap-1.5 text-xs rounded-md border border-slate-200 bg-slate-50 text-slate-500 px-2 py-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  extraindo texto...
                </span>
              )}
            </div>
          )}
          <div className="relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escreva a consulta, cole a peça, ou anexe PDF, DOCX, planilha ou TXT..."
              className="pl-11 pr-12 resize-none min-h-[52px] max-h-[240px] bg-white"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.xls,.csv,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain,text/markdown"
              className="hidden"
              onChange={(e) => e.target.files && handleUploadFiles(e.target.files)}
            />
            <Button
              size="icon"
              variant="ghost"
              className="absolute bottom-2 left-2 h-8 w-8 text-slate-500 hover:text-[#1F5C45]"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              title="Anexar PDF, DOCX, planilha (XLSX/CSV) ou TXT"
              type="button"
            >
              <Paperclip className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              className="absolute bottom-2 right-2 h-8 w-8 bg-[#1F5C45] hover:bg-[#194a37]"
              onClick={handleSend}
              disabled={loading || uploading || (!input.trim() && pendingAtts.length === 0)}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 text-center mt-2 max-w-3xl mx-auto">
          <ShieldCheck className="w-3 h-3 inline mr-1 text-[#1F5C45]" />
          Dados sensíveis (CPF, nomes, números de processo) são tarjados antes de sair para o modelo —
          inclusive dentro de anexos.
        </p>
      </div>
    </div>
  );
}
