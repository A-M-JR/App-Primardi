"use client"

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts"

/**
 * Gráfico do dashboard isolado num chunk próprio (lazy) — recharts é pesado
 * (~150KB+) e não precisa entrar no bundle inicial da página inicial.
 */
export default function DashboardChart({
  data,
}: {
  data: Array<{ name: string; orcamentos: number; conversoes: number }>
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dy={10} />
        <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} dx={-10} />
        <Tooltip
          cursor={{ fill: '#f1f5f9' }}
          contentStyle={{ backgroundColor: '#ffffff', borderColor: '#e2e8f0', borderRadius: '8px', color: '#0f172a', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          itemStyle={{ color: '#0f172a', fontWeight: 500 }}
          labelStyle={{ color: '#64748b', marginBottom: '8px', fontWeight: 600 }}
        />
        <Legend wrapperStyle={{ paddingTop: "10px" }} />
        <Bar dataKey="orcamentos" name="Orçamentos Gerados" fill="#94a3b8" radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Bar dataKey="conversoes" name="Conversões Fechadas" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  )
}
