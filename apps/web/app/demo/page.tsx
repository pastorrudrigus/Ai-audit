import Link from "next/link";
import { Bot, Zap, Building2, MessageSquare, LayoutDashboard, ShieldCheck, TrendingDown, Key, FileText, Cpu, Users, Bell } from "lucide-react";

const features = [
  {
    section: "VISÃO GERAL",
    items: [
      {
        href: "/dashboard",
        icon: LayoutDashboard,
        title: "Dashboard Unificado",
        description: "Visão 100% do gasto de IA da empresa — gateway + plataformas em um só lugar.",
        bullets: [
          "5 KPIs: gasto total, gateway, plataformas, requests, alertas ativos",
          "Spend trend chart: 30 dias, gateway (azul) vs plataformas (verde)",
          "Top tools ranqueadas por custo com badge de compliance",
          "Savings panel: economia potencial com top 3 insights",
          "Alertas recentes com severidade",
        ],
        color: "blue",
      },
    ],
  },
  {
    section: "GATEWAY DE IA",
    items: [
      {
        href: "/gateway",
        icon: Zap,
        title: "Gateway — Uso e Gasto",
        description: "Monitor do proxy OpenAI-compatible. Toda requisição via API passa aqui.",
        bullets: [
          "Gasto do mês, total de requests, requests bloqueados por DLP",
          "Latência média em ms",
          "Gasto diário em área chart",
          "Uso por modelo: requests, tokens e custo",
        ],
        color: "blue",
      },
      {
        href: "/keys",
        icon: Key,
        title: "API Keys",
        description: "Gerencie as chaves de acesso ao gateway (formato aig_sk_...).",
        bullets: [
          "Crie chaves por departamento ou projeto",
          "Chave exibida apenas uma vez no momento da criação",
          "Hash SHA-256 — nunca armazenada em plain text",
          "Status ativa/inativa + data do último uso",
        ],
        color: "blue",
      },
      {
        href: "/logs",
        icon: FileText,
        title: "Logs de Requisições",
        description: "Histórico completo de todas as requisições que passaram pelo gateway.",
        bullets: [
          "Data, modelo, fonte (gateway/web), tokens, custo, latência",
          "Status: success, error, blocked_dlp, blocked_policy, blocked_budget",
          "Últimas 100 requisições com paginação",
        ],
        color: "blue",
      },
      {
        href: "/policies",
        icon: ShieldCheck,
        title: "Políticas",
        description: "Regras de controle aplicadas automaticamente em cada requisição.",
        bullets: [
          "DLP: bloqueia/mascara CPF, CNPJ, cartão de crédito, API keys, email, telefone",
          "Model Access: restringe modelos por departamento (ex: Marketing só usa mini)",
          "Rate Limit: limite de requisições por chave/departamento",
          "Budget: hard limit bloqueia, soft limit cria alerta",
        ],
        color: "violet",
      },
    ],
  },
  {
    section: "GESTÃO DE PLATAFORMAS",
    items: [
      {
        href: "/platforms",
        icon: Building2,
        title: "Plataformas & Assinaturas",
        description: "Controle de todas as ferramentas de IA pagas — ChatGPT, Cursor, Midjourney, etc.",
        bullets: [
          "Cards com custo/mês, plano, departamento, status",
          "Badge de compliance: DPA, treina com dados, opt-out",
          "Indicador de assentos inativos por subscription",
          "Total do gasto mensal em plataformas",
        ],
        color: "green",
      },
      {
        href: "/platforms/add",
        icon: Building2,
        title: "Adicionar Plataforma",
        description: "Typeahead no catálogo de 18+ ferramentas de IA pré-cadastradas.",
        bullets: [
          "Busca por nome ou vendor (ex: 'cursor', 'openai')",
          "Exibe planos disponíveis com preços e limites",
          "Badge de riscos: sem DPA, treina com dados",
          "Seleciona plano → preenche custo e seats → salva",
        ],
        color: "green",
      },
      {
        href: "/platforms/[id]",
        icon: Building2,
        title: "Detalhe da Assinatura",
        description: "Visão completa de uma assinatura: compliance, seats, alertas de ociosidade.",
        bullets: [
          "KPIs: custo, assentos ativos, inativos >30d, total contratado",
          "Badges de compliance: DPA, SSO, política de dados",
          "Alerta amarelo se há seats inativos com economia estimada",
          "Tabela de seats: email, nome, último uso, status",
        ],
        color: "green",
      },
      {
        href: "/platforms/import",
        icon: Building2,
        title: "Importar CSV de Billing",
        description: "Upload de extrato do cartão (Brex, Ramp, qualquer CSV) com auto-match.",
        bullets: [
          "Arrasta CSV → parser (Papaparse) detecta colunas",
          "Fuzzy match do merchant contra catálogo (Fuse.js)",
          "Preview: merchant original → ferramenta matched (confidence %)",
          "Auto: confidence >80% = auto_matched, resto = revisar",
          "Confirmar importa billing_transactions e atualiza budgets",
        ],
        color: "green",
      },
    ],
  },
  {
    section: "INTERFACE DE CHAT",
    items: [
      {
        href: "/chat",
        icon: MessageSquare,
        title: "Chat IA — Nova Conversa",
        description: "Interface de chat para times de negócio usarem IA sem precisar de API key.",
        bullets: [
          "5 templates: Resumir doc, Revisar texto, Analisar dados, Gerar email, Traduzir",
          "Template ativo pré-preenche o system prompt",
          "Ctrl+Enter ou ⌘+Enter envia mensagem",
          "Usa o mesmo pipeline do gateway (DLP, budget, routing)",
        ],
        color: "purple",
      },
      {
        href: "/chat/[id]",
        icon: MessageSquare,
        title: "Chat IA — Conversa",
        description: "Histórico da conversa com transparência total de custo por mensagem.",
        bullets: [
          "Bubbles: usuário (azul, direita) e assistente (cinza, esquerda)",
          "Badge após cada resposta: modelo · tokens · $0.0012 · ✓ OK",
          "Streaming com indicador de typing (3 pontos animados)",
          "Enter envia, Shift+Enter quebra linha",
          "Histórico persistido no banco por conversa",
        ],
        color: "purple",
      },
    ],
  },
  {
    section: "OTIMIZAÇÕES & ALERTAS",
    items: [
      {
        href: "/optimizations",
        icon: TrendingDown,
        title: "Otimizações",
        description: "Insights gerados automaticamente para reduzir custos e riscos.",
        bullets: [
          "Idle seats: detecta usuários inativos >30 dias com economia estimada",
          "Tool overlap: ferramentas com mesma função em uso simultâneo",
          "Compliance risk: ferramentas sem DPA ou que treinam com dados",
          "Plan downgrade: planos com utilização <50% dos seats",
          "Severidade: info / warning / critical",
          "Ações: reconhecer, dispensar, resolver",
        ],
        color: "green",
      },
      {
        href: "/alerts",
        icon: Bell,
        title: "Alertas",
        description: "Central de notificações do sistema — budget, DLP, compliance, anomalias.",
        bullets: [
          "Tipos: budget_warning, budget_exceeded, dlp_violation, idle_seats,",
          "        compliance_risk, tool_overlap, anomaly, provider_error",
          "Badge vermelho na sidebar para alertas não lidos",
          "Marcar todos como lidos de uma vez",
          "Borda lateral colorida por severidade",
        ],
        color: "amber",
      },
    ],
  },
  {
    section: "CONFIGURAÇÃO",
    items: [
      {
        href: "/departments",
        icon: Users,
        title: "Departamentos",
        description: "Estrutura de custos por área com budget mensal.",
        bullets: [
          "Engineering ($3.000/mês), Marketing ($2.000), Design ($1.000)",
          "Threshold de alerta configurável (default: 80%)",
          "Budget compartilhado entre gateway e plataformas",
        ],
        color: "slate",
      },
      {
        href: "/models",
        icon: Cpu,
        title: "Modelos & Providers",
        description: "Catálogo de modelos disponíveis com pricing atualizado.",
        bullets: [
          "9 modelos: GPT-4o, GPT-4o Mini, o3 Mini, Claude Sonnet 4,",
          "           Claude Haiku 4.5, Claude Opus 4.6, Gemini 2.0 Flash, 2.5 Pro",
          "Custo por 1M tokens: input e output separados",
          "Categoria: flagship / balanced / fast / embedding",
          "Suporte a vision e tools",
        ],
        color: "slate",
      },
      {
        href: "/onboarding",
        icon: Bot,
        title: "Onboarding Wizard",
        description: "Setup guiado em 5 steps para novos times.",
        bullets: [
          "Step 1: Nome da organização",
          "Step 2: Conectar provider (OpenAI/Anthropic) + testar conexão",
          "Step 3: Criar departamentos com budget",
          "Step 4: Selecionar ferramentas já usadas pelo time",
          "Step 5: Instruções de integração + snippets Python/Node copiáveis",
        ],
        color: "slate",
      },
    ],
  },
];

const colorMap: Record<string, string> = {
  blue: "border-blue-200 bg-blue-50/50 hover:border-blue-400",
  green: "border-green-200 bg-green-50/50 hover:border-green-400",
  purple: "border-purple-200 bg-purple-50/50 hover:border-purple-400",
  violet: "border-violet-200 bg-violet-50/50 hover:border-violet-400",
  amber: "border-amber-200 bg-amber-50/50 hover:border-amber-400",
  slate: "border-slate-200 bg-slate-50/50 hover:border-slate-300",
};

const iconColorMap: Record<string, string> = {
  blue: "text-blue-600 bg-blue-100",
  green: "text-green-600 bg-green-100",
  purple: "text-purple-600 bg-purple-100",
  violet: "text-violet-600 bg-violet-100",
  amber: "text-amber-600 bg-amber-100",
  slate: "text-slate-600 bg-slate-100",
};

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">AIGate</h1>
              <p className="text-sm text-slate-500">Plataforma Unificada de IA Corporativa</p>
            </div>
          </div>

          <p className="text-slate-600 max-w-2xl mb-6">
            Gateway + Gestão de Plataformas + Chat Web + Dashboard Unificado.
            Controle 100% do gasto de IA da sua empresa em um só lugar.
          </p>

          {/* Quick stats from demo data */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Ferramentas no catálogo", value: "18+" },
              { label: "Tabelas no banco", value: "19" },
              { label: "Modelos com pricing", value: "9" },
              { label: "Páginas do app", value: "14" },
            ].map((s) => (
              <div key={s.label} className="bg-slate-100 rounded-lg px-4 py-3">
                <p className="text-xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Architecture overview */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-10">
          <h2 className="font-semibold text-slate-900 mb-4">Arquitetura — 3 camadas de captura</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div className="text-center p-4 rounded-lg bg-blue-50 border border-blue-200">
              <Zap className="w-6 h-6 text-blue-600 mx-auto mb-2" />
              <p className="font-semibold text-blue-900">API Gateway</p>
              <p className="text-blue-700 text-xs mt-1">Proxy OpenAI-compatible<br/>para times técnicos</p>
              <p className="text-blue-500 text-xs mt-2 font-mono">POST /v1/chat/completions</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-green-50 border border-green-200">
              <Building2 className="w-6 h-6 text-green-600 mx-auto mb-2" />
              <p className="font-semibold text-green-900">Gestão de Plataformas</p>
              <p className="text-green-700 text-xs mt-1">Monitor de ferramentas fechadas<br/>ChatGPT, Cursor, Midjourney...</p>
              <p className="text-green-500 text-xs mt-2">Cadastro manual + import CSV</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-purple-50 border border-purple-200">
              <MessageSquare className="w-6 h-6 text-purple-600 mx-auto mb-2" />
              <p className="font-semibold text-purple-900">Interface Web</p>
              <p className="text-purple-700 text-xs mt-1">Chat universal para<br/>times de negócio</p>
              <p className="text-purple-500 text-xs mt-2">Sem precisar de API key</p>
            </div>
          </div>
          <div className="mt-4 text-center">
            <div className="inline-flex items-center gap-2 bg-slate-900 text-white rounded-lg px-4 py-2 text-sm">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard Unificado — 100% do gasto de IA da empresa
            </div>
          </div>
        </div>

        {/* Pipeline do Gateway */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-10">
          <h2 className="font-semibold text-slate-900 mb-4">Pipeline do Gateway — cada request passa por:</h2>
          <div className="flex items-center gap-1 flex-wrap">
            {[
              { step: "1. AUTH", desc: "Bearer aig_sk_... → SHA-256 hash → valida API key", color: "bg-slate-100 text-slate-700" },
              { step: "2. POLICY", desc: "Model access, rate limit", color: "bg-violet-100 text-violet-700" },
              { step: "3. DLP", desc: "CPF, CNPJ, cartão, API key → block/mask", color: "bg-red-100 text-red-700" },
              { step: "4. ROUTE", desc: "Routing rules por prioridade", color: "bg-blue-100 text-blue-700" },
              { step: "5. BUDGET", desc: "Hard limit → 402, Soft → alerta", color: "bg-amber-100 text-amber-700" },
              { step: "6. FORWARD", desc: "OpenAI ou Anthropic adapter", color: "bg-green-100 text-green-700" },
              { step: "7. LOG", desc: "request_logs + atualiza budget", color: "bg-slate-100 text-slate-700" },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className={`rounded-lg px-3 py-2 text-xs font-medium ${item.color}`}>
                  <p className="font-semibold">{item.step}</p>
                  <p className="opacity-75 text-xs mt-0.5">{item.desc}</p>
                </div>
                {i < 6 && <span className="text-slate-300 text-lg">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Features by section */}
        {features.map((section) => (
          <div key={section.section} className="mb-10">
            <h2 className="text-xs font-bold text-slate-400 tracking-widest mb-4">
              {section.section}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href.replace("[id]", "demo")}
                  className={`group block rounded-xl border p-5 transition-all ${colorMap[item.color]}`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconColorMap[item.color]}`}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 group-hover:underline">
                        {item.title}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                    </div>
                  </div>
                  <ul className="space-y-1">
                    {item.bullets.map((b, i) => (
                      <li key={i} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="text-slate-300 mt-0.5">·</span>
                        {b}
                      </li>
                    ))}
                  </ul>
                </Link>
              ))}
            </div>
          </div>
        ))}

        {/* DLP patterns */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-10">
          <h2 className="font-semibold text-slate-900 mb-4">DLP — Padrões detectados automaticamente</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { pattern: "CPF", example: "123.456.789-09", severity: "Alto", color: "text-red-600 bg-red-50" },
              { pattern: "CNPJ", example: "12.345.678/0001-90", severity: "Alto", color: "text-red-600 bg-red-50" },
              { pattern: "Cartão de Crédito", example: "4111 1111 1111 1111", severity: "Crítico", color: "text-red-700 bg-red-100" },
              { pattern: "API Key", example: "sk-proj-abc123...", severity: "Crítico", color: "text-red-700 bg-red-100" },
              { pattern: "Email", example: "user@empresa.com", severity: "Médio", color: "text-amber-600 bg-amber-50" },
              { pattern: "Telefone BR", example: "(11) 99999-9999", severity: "Médio", color: "text-amber-600 bg-amber-50" },
            ].map((p) => (
              <div key={p.pattern} className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-slate-800">{p.pattern}</p>
                  <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${p.color}`}>
                    {p.severity}
                  </span>
                </div>
                <p className="text-xs font-mono text-slate-400">{p.example}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Catálogo de ferramentas */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-10">
          <h2 className="font-semibold text-slate-900 mb-4">Catálogo de Ferramentas de IA (seed)</h2>
          <div className="flex flex-wrap gap-2">
            {[
              "ChatGPT", "Claude Pro", "Cursor", "Lovable", "v0", "Midjourney",
              "GitHub Copilot", "Claude Code", "Base44", "Manus", "Gemini",
              "DALL-E", "Perplexity", "Runway", "ElevenLabs", "Jasper",
              "Notion AI", "Canva AI",
            ].map((tool) => (
              <span key={tool} className="text-xs bg-slate-100 text-slate-700 rounded-full px-3 py-1">
                {tool}
              </span>
            ))}
          </div>
        </div>

        {/* Stack técnica */}
        <div className="bg-slate-900 rounded-xl p-6 text-white">
          <h2 className="font-semibold mb-4">Stack técnica completa</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            {[
              { cat: "Monorepo", items: ["Turborepo"] },
              { cat: "Frontend", items: ["Next.js 14 (App Router)", "TypeScript strict"] },
              { cat: "UI", items: ["shadcn/ui", "Tailwind CSS", "Recharts"] },
              { cat: "Gateway", items: ["Fastify", "Node.js 22"] },
              { cat: "Banco", items: ["PostgreSQL (Neon)", "Drizzle ORM"] },
              { cat: "Auth", items: ["Clerk (dashboard)", "SHA-256 (gateway)"] },
              { cat: "Segurança", items: ["AES-256-GCM", "DLP engine"] },
              { cat: "Deploy", items: ["Railway", "Docker multi-stage"] },
            ].map((s) => (
              <div key={s.cat}>
                <p className="text-slate-400 text-xs font-semibold mb-1">{s.cat}</p>
                {s.items.map((i) => (
                  <p key={i} className="text-slate-200 text-xs">{i}</p>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/tech"
            className="inline-flex items-center gap-2 bg-white border border-slate-200 hover:border-slate-300 text-slate-700 rounded-lg px-6 py-3 font-medium transition-colors"
          >
            <Cpu className="w-4 h-4" />
            Stack, banco e regras de negócio
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-6 py-3 font-medium transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Acessar o Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
