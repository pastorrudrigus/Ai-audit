"use client";

import { useState, useRef } from "react";
import Papa from "papaparse";
import Link from "next/link";
import { Header } from "@/components/shared/header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, ChevronLeft, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";

interface ParsedRow {
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  cardLastFour?: string;
}

interface PreviewRow extends ParsedRow {
  matchedToolId: string | null;
  matchedToolName: string | null;
  confidence: number;
  classificationStatus: string;
}

export default function ImportPage() {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(file: File) {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        const rows = (result.data as Record<string, string>[]).map((row) => ({
          date: row.date ?? row.Date ?? new Date().toISOString().split("T")[0],
          merchant: row.merchant ?? row.description ?? row.Description ?? "",
          amount: parseFloat(row.amount ?? row.Amount ?? "0"),
          currency: row.currency ?? row.Currency ?? "USD",
          cardLastFour: row.card_last_four ?? row.card ?? undefined,
        })).filter((r) => r.merchant && r.amount > 0);

        setLoading(true);
        try {
          const res = await fetch("/api/platforms/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ transactions: rows }),
          });
          const data = await res.json();
          setPreview(data.preview);
          setStep("preview");
        } catch {
          toast.error("Erro ao processar CSV");
        } finally {
          setLoading(false);
        }
      },
    });
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      const res = await fetch("/api/platforms/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: preview }),
      });
      const data = await res.json();
      toast.success(`${data.inserted} transações importadas!`);
      setStep("done");
    } catch {
      toast.error("Erro ao confirmar importação");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="Importar Billing CSV" />
      <main className="flex-1 overflow-y-auto p-6 max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/platforms"><ChevronLeft className="w-4 h-4 mr-1" />Voltar</Link>
          </Button>
        </div>

        {step === "upload" && (
          <Card>
            <CardHeader>
              <CardTitle>Upload de arquivo CSV</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Colunas esperadas: <code>date, merchant/description, amount, currency, card_last_four (opcional)</code>
              </p>
              <div
                className="border-2 border-dashed border-border rounded-lg p-12 text-center cursor-pointer hover:border-primary transition-colors"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm font-medium">Clique para selecionar ou arraste o CSV aqui</p>
                <p className="text-xs text-muted-foreground mt-1">Brex, Ramp, ou qualquer extrato CSV</p>
              </div>
              <input
                ref={inputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </CardContent>
          </Card>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{preview.length} transações encontradas</h2>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("upload")}>Voltar</Button>
                <Button onClick={handleConfirm} disabled={loading}>
                  {loading ? "Confirmando..." : "Confirmar importação"}
                </Button>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-4 text-xs text-muted-foreground">Data</th>
                      <th className="text-left py-2 px-4 text-xs text-muted-foreground">Merchant</th>
                      <th className="text-left py-2 px-4 text-xs text-muted-foreground">Ferramenta</th>
                      <th className="text-right py-2 px-4 text-xs text-muted-foreground">Valor</th>
                      <th className="text-center py-2 px-4 text-xs text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 px-4 text-muted-foreground">{row.date}</td>
                        <td className="py-2 px-4">{row.merchant}</td>
                        <td className="py-2 px-4">
                          {row.matchedToolName ? (
                            <span className="text-foreground font-medium">
                              {row.matchedToolName}
                              <span className="text-xs text-muted-foreground ml-1">
                                ({(row.confidence * 100).toFixed(0)}%)
                              </span>
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-right font-medium">
                          {formatCurrency(row.amount, row.currency)}
                        </td>
                        <td className="py-2 px-4 text-center">
                          <Badge
                            variant={
                              row.classificationStatus === "auto_matched" ? "success"
                              : row.classificationStatus === "not_ai" ? "secondary"
                              : "warning"
                            }
                          >
                            {row.classificationStatus === "auto_matched" ? "Auto"
                              : row.classificationStatus === "not_ai" ? "Não-IA"
                              : "Revisar"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        )}

        {step === "done" && (
          <Card>
            <CardContent className="py-16 text-center">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Importação concluída!</h2>
              <p className="text-muted-foreground mb-6">Transações importadas com sucesso.</p>
              <Button asChild>
                <Link href="/platforms">Ver plataformas</Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
