"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  ScanSearch,
  ScrollText,
  Sparkles,
  Download,
  AlertTriangle,
  Users,
  Wallet,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

interface Kpi {
  totalRequests: number;
  consultasProtegidas: number;
  complianceRate: number;
  dadosTarjados: number;
  bloqueadas: number;
  custoTotal: number;
  citacoesVerificadas: number;
  citacoesSinalizadas: number;
  runsVerificacao: number;
}

interface Data {
  filters: { departmentId: string | null; userId: string | null; days: number };
  kpi: Kpi;
  perDepartment: Array<{ id: string; name: string; cost: number; requests: number }>;
  daily: Array<{ date: string; cost: number; requests: number; protegidas: number }>;
  catalog: {
    departments: Array<{ id: string; name: string }>;
    users: Array<{ id: string; name: string; departmentId: string | null }>;
  };
}

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(n);
const fmtNum = (n: number) => new Intl.NumberFormat("pt-BR").format(n);
const fmtPct = (n: number) => `${(n * 100).toFixed(0)}%`;

export function PainelContent() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [dept, setDept] = useState<string>("");
  const [user, setUser] = useState<string>("");
  const [days, setDays] = useState<number>(30);

  useEffect(() => {
    const params = new URLSearchParams();
    if (dept) params.set("departmentId", dept);
    if (user) params.set("userId", user);
    params.set("days", String(days));
    setLoading(true);
    fetch(`/api/dashboard/tutela?${params.toString()}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [dept, user, days]);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    if (!dept) return data.catalog.users;
    return data.catalog.users.filter((u) => u.departmentId === dept);
  }, [data, dept]);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (dept) params.set("departmentId", dept);
    params.set("days", String(days));
    return `/api/dashboard/tutela/export?${params.toString()}`;
  }, [dept, days]);

  if (loading && !data) return <div className="text-slate-500 text-sm">Carregando…</div>;
  if (!data) return <div className="text-slate-500 text-sm">Sem dados.</div>;

  const { kpi } = data;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold text-slate-500 tracking-wide uppercase mr-2">
          Recorte
        </span>
        <select
          value={dept}
          onChange={(e) => {
            setDept(e.target.value);
            setUser(""); // limpa usuário ao trocar área
          }}
          className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white"
        >
          <option value="">Todas as áreas</option>
          {data.catalog.departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select
          value={user}
          onChange={(e) => setUser(e.target.value)}
          className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white"
        >
          <option value="">Todos os advogados</option>
          {filteredUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          value={days}
          onChange={(e) => setDays(parseInt(e.target.value, 10))}
          className="text-sm border border-slate-200 rounded-md px-2 py-1.5 bg-white"
        >
          <option value={7}>7 dias</option>
          <option value={30}>30 dias</option>
          <option value={90}>90 dias</option>
        </select>
        <a
          href={exportUrl}
          className="ml-auto inline-flex items-center gap-1.5 text-sm bg-[#1F5C45] hover:bg-[#194a37] text-white rounded-md px-3 py-1.5"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar relatório de conformidade (CSV)
        </a>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          icon={ShieldCheck}
          label="Consultas protegidas"
          value={fmtNum(kpi.consultasProtegidas)}
          hint={`${fmtPct(kpi.complianceRate)} de ${fmtNum(kpi.totalRequests)} consultas`}
          accent="emerald"
        />
        <Card
          icon={Sparkles}
          label="Dados tarjados"
          value={fmtNum(kpi.dadosTarjados)}
          hint="entidades sensíveis substituídas antes do envio"
          accent="slate"
        />
        <Card
          icon={ScanSearch}
          label="Citações sinalizadas"
          value={fmtNum(kpi.citacoesSinalizadas)}
          hint={`de ${fmtNum(kpi.citacoesVerificadas)} verificadas em ${fmtNum(kpi.runsVerificacao)} análises`}
          accent="amber"
        />
        <Card
          icon={Wallet}
          label="Custo por IA no período"
          value={fmtMoney(kpi.custoTotal)}
          hint={kpi.bloqueadas > 0 ? `${kpi.bloqueadas} bloqueada(s) por DLP` : "Nenhum bloqueio no período"}
          accent="ink"
        />
      </div>

      {/* Trend */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Consultas e proteção — últimos {days} dias</p>
            <p className="text-xs text-slate-500">Verde: consultas protegidas por anonimização. Cinza: total.</p>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.daily}>
              <defs>
                <linearGradient id="prot" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1F5C45" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#1F5C45" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="tot" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === "cost" ? fmtMoney(value) : fmtNum(value)
                }
              />
              <Area type="monotone" dataKey="requests" stroke="#94a3b8" fill="url(#tot)" name="Total" />
              <Area type="monotone" dataKey="protegidas" stroke="#1F5C45" fill="url(#prot)" name="Protegidas" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Por área */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
          <Users className="w-4 h-4 text-slate-500" />
          <p className="text-sm font-semibold text-slate-900">Custo por área</p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-5 py-2">Área</th>
              <th className="text-right px-5 py-2">Consultas</th>
              <th className="text-right px-5 py-2">Custo (USD)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.perDepartment.length === 0 && (
              <tr>
                <td className="px-5 py-4 text-slate-500" colSpan={3}>
                  Sem atividade no período.
                </td>
              </tr>
            )}
            {data.perDepartment.map((d) => (
              <tr key={d.id}>
                <td className="px-5 py-2.5">{d.name}</td>
                <td className="px-5 py-2.5 text-right font-mono">{fmtNum(d.requests)}</td>
                <td className="px-5 py-2.5 text-right font-mono">{fmtMoney(d.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sinal de conformidade */}
      {kpi.citacoesSinalizadas > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-900">
              {kpi.citacoesSinalizadas} citação(ões) sinalizada(s) no período
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              Peças com citações não confirmadas ou divergentes foram identificadas antes do protocolo.
              Isso é o coração da verificação — o advogado ficou sabendo antes do juiz.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function Card({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: string;
  hint: string;
  accent: "emerald" | "amber" | "slate" | "ink";
}) {
  const accentBg = {
    emerald: "bg-[#1F5C45]/10 text-[#1F5C45]",
    amber: "bg-[#B99154]/15 text-[#8a6a3d]",
    slate: "bg-slate-100 text-slate-700",
    ink: "bg-[#1B2130]/10 text-[#1B2130]",
  }[accent];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${accentBg}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        {label}
      </div>
      <p className="text-2xl font-semibold text-slate-900 mt-2">{value}</p>
      <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
    </div>
  );
}
