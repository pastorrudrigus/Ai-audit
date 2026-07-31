import { db } from "@/lib/db";
import { Header } from "@/components/shared/header";
import { ShieldCheck, ScanSearch, Ban, Zap } from "lucide-react";

export const dynamic = "force-dynamic";

/**
 * Página de transparência — mostra ao advogado O QUE está ativo agora:
 * quais políticas de proteção rodam nas consultas dele, quais padrões de
 * anonimização, quais modelos estão liberados, e o rate limit da banca.
 *
 * A ideia é vender confiança: o advogado entende o mecanismo, não pede fé.
 */
export default async function PolicyStatusPage() {
  const orgId = process.env.DEMO_ORG_ID ?? "";

  const policies = orgId
    ? await db.query.policies.findMany({
        where: (p, { eq, and }) => and(eq(p.orgId, orgId), eq(p.isActive, true)),
      })
    : [];

  const routingRules = orgId
    ? await db.query.routingRules.findMany({
        where: (r, { eq, and }) => and(eq(r.orgId, orgId), eq(r.isActive, true)),
        orderBy: (r, { asc }) => [asc(r.priority)],
      })
    : [];

  const dlp = policies.find((p) => p.type === "dlp");
  const dlpRules = (dlp?.rules ?? {}) as {
    action?: string;
    patterns?: string[];
    nerTypes?: string[];
  };
  const modelAccess = policies.filter((p) => p.type === "model_access");
  const citationCheck = policies.find((p) => p.type === "citation_check");

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Header title="O que está ativo agora" />
      <main className="flex-1 overflow-y-auto p-6 bg-[#FCFBF8]">
        <div className="max-w-4xl space-y-4">
          <p className="text-sm text-slate-600">
            Estas são as políticas ativas para a sua banca. Nenhuma pode ser burlada por parâmetro
            de requisição — elas rodam em todas as consultas, pelo Portal ou pela API.
          </p>

          {/* DLP */}
          <Section
            icon={ShieldCheck}
            title="Anonimização de dados sensíveis"
            state={dlp ? (dlpRules.action ?? "warn") : "inativa"}
            active={!!dlp}
          >
            {dlp ? (
              <>
                <p className="text-sm text-slate-700">
                  Ação:{" "}
                  <span className="font-mono text-xs bg-slate-100 rounded px-1.5 py-0.5">
                    {dlpRules.action ?? "warn"}
                  </span>{" "}
                  — quando um dado sensível é detectado no que o advogado escreve, o sistema{" "}
                  {actionExplanation(dlpRules.action ?? "warn")}.
                </p>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-3">
                    Padrões detectados por regex
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(dlpRules.patterns ?? [
                      "cpf",
                      "cnpj",
                      "credit_card",
                      "email",
                      "phone_br",
                      "api_key",
                      "processo_cnj",
                      "oab",
                    ]).map((p) => (
                      <span
                        key={p}
                        className="text-xs font-mono bg-white border border-slate-200 rounded px-2 py-0.5"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                </div>
                {dlpRules.nerTypes && dlpRules.nerTypes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 mt-3">
                      Entidades detectadas por NER (LLM)
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {dlpRules.nerTypes.map((t) => (
                        <span
                          key={t}
                          className="text-xs font-mono bg-white border border-slate-200 rounded px-2 py-0.5"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-amber-800">
                Nenhuma política de anonimização ativa. Nada é tarjado antes de sair para o modelo.
              </p>
            )}
          </Section>

          {/* Citação */}
          <Section
            icon={ScanSearch}
            title="Verificação de citações jurídicas"
            state={citationCheck ? ((citationCheck.rules as { mode?: string })?.mode ?? "on_demand") : "inativa"}
            active={!!citationCheck}
          >
            {citationCheck ? (
              <p className="text-sm text-slate-700">
                A verificação existe e roda quando o advogado clicar em{" "}
                <em>&quot;Verificar antes do protocolo&quot;</em> no Portal. O resultado (confirmada
                / divergente / não encontrada) é auditado em request_logs para o painel do sócio.
              </p>
            ) : (
              <p className="text-sm text-slate-600">
                Verificação inativa — o Portal não oferece a checagem de citações.
              </p>
            )}
          </Section>

          {/* Restrição de modelo */}
          <Section
            icon={Ban}
            title="Restrição de modelos"
            state={modelAccess.length > 0 ? `${modelAccess.length} regra(s)` : "sem restrição"}
            active={modelAccess.length > 0}
          >
            {modelAccess.length === 0 ? (
              <p className="text-sm text-slate-600">
                Nenhuma restrição — todas as áreas podem usar qualquer modelo configurado.
              </p>
            ) : (
              <ul className="space-y-2">
                {modelAccess.map((p) => {
                  const rules = p.rules as { allowedModels?: string[] };
                  return (
                    <li key={p.id} className="text-sm text-slate-700">
                      <strong>{p.name}:</strong> permitidos{" "}
                      <span className="font-mono text-xs">
                        {(rules.allowedModels ?? []).join(", ")}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* Roteamento */}
          <Section
            icon={Zap}
            title="Roteamento de modelos"
            state={`${routingRules.length} regra(s)`}
            active={routingRules.length > 0}
          >
            {routingRules.length === 0 ? (
              <p className="text-sm text-slate-600">Nenhuma regra — fica no primeiro provider ativo.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {routingRules.map((r) => {
                  const c = (r.conditions ?? {}) as {
                    taskComplexity?: string;
                    maxInputTokens?: number;
                  };
                  return (
                    <li key={r.id} className="text-slate-700">
                      <span className="font-mono text-xs bg-slate-100 rounded px-1 py-0.5 mr-2">
                        p{r.priority}
                      </span>
                      <strong>{r.name}</strong>
                      <span className="text-slate-500"> → </span>
                      <span className="font-mono text-xs">{r.targetModelId}</span>
                      {c.taskComplexity && (
                        <span className="ml-2 text-xs text-slate-500">
                          (quando complexidade = {c.taskComplexity}
                          {c.maxInputTokens ? `, entrada ≤ ${c.maxInputTokens} tokens` : ""})
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </Section>

          <div className="text-xs text-slate-500 pt-4 border-t border-slate-200">
            Rate limit atual do gateway: <strong>{process.env.TUTELA_RATE_LIMIT_MAX ?? "200"}</strong>{" "}
            requisições por {process.env.TUTELA_RATE_LIMIT_WINDOW ?? "1 minute"} por chave.
          </div>
        </div>
      </main>
    </div>
  );
}

function actionExplanation(action: string): string {
  switch (action) {
    case "anonymize":
      return "substitui por tokens reversíveis (⟨CPF_1⟩) antes de enviar ao modelo — a resposta volta com os tokens e é decifrada localmente";
    case "block":
      return "bloqueia a consulta e nada é enviado ao modelo";
    case "mask":
      return "substitui por [REDACTED] destrutivamente antes de enviar";
    default:
      return "registra a ocorrência sem bloquear a consulta";
  }
}

function Section({
  icon: Icon,
  title,
  state,
  active,
  children,
}: {
  icon: typeof ShieldCheck;
  title: string;
  state: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
        <div
          className={`w-8 h-8 rounded-lg flex items-center justify-center ${
            active ? "bg-[#1F5C45]/10 text-[#1F5C45]" : "bg-slate-100 text-slate-400"
          }`}
        >
          <Icon className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">{title}</p>
        </div>
        <span
          className={`text-xs rounded-full px-2 py-0.5 font-medium ${
            active ? "bg-[#1F5C45]/10 text-[#1F5C45]" : "bg-slate-100 text-slate-500"
          }`}
        >
          {state}
        </span>
      </div>
      <div className="p-5 space-y-2">{children}</div>
    </section>
  );
}
