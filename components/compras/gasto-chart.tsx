"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"

/**
 * Gráfico "Gasto por mês" do dashboard de Compras, isolado num chunk lazy
 * (recharts é pesado e não precisa entrar no bundle inicial da rota).
 */
export default function GastoChart({
  data,
  formatter,
}: {
  data: Array<{ mes: string; total: number }>
  formatter: (v: number) => string
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.2} />
        <XAxis dataKey="mes" fontSize={12} tickLine={false} axisLine={false} />
        <YAxis
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `${Math.round(v / 1000)}k`}
          width={40}
        />
        <Tooltip formatter={(v: number) => formatter(v)} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="total" fill="#1D9E75" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
