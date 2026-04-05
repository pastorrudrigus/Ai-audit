"use client";

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SpendDataPoint {
  date: string;
  gateway: number;
  platforms: number;
}

export function SpendTrendChart({ data }: { data: SpendDataPoint[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle>Tendência de Gasto — 30 dias</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="colorGateway" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPlatforms" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v}`}
            />
            <Tooltip
              formatter={(value: number, name: string) => [
                `$${value.toFixed(2)}`,
                name === "gateway" ? "Gateway" : "Plataformas",
              ]}
            />
            <Legend
              formatter={(value) => (value === "gateway" ? "Gateway" : "Plataformas")}
            />
            <Area
              type="monotone"
              dataKey="gateway"
              stroke="#3b82f6"
              fill="url(#colorGateway)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="platforms"
              stroke="#22c55e"
              fill="url(#colorPlatforms)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
