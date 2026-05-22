"use client"

import React from "react"
import { useAI } from "@/lib/ai-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Sparkles, Activity, Zap, Info } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"

export const AIDashboard = React.memo(function AIDashboard() {
    const { usage, config } = useAI()

    // Mock de dados para o gráfico (pode ser expandido conforme uso)
    const data = [
        { name: "Jan", total: 0 },
        { name: "Fev", total: 0 },
        { name: "Mar", total: usage.count },
    ]

    const usagePercent = config.monthlyLimit > 0
        ? Math.min(100, Math.round((usage.count / config.monthlyLimit) * 100))
        : 0

    const getCostPerMessage = () => {
        if (config.provider === 'gemini-flash') return 0.005 // R$ 0,005
        if (config.provider === 'gpt-4o-mini') return 0.015  // R$ 0,015
        if (config.provider === 'abacus-route') return 0.02  // R$ 0,020 (médio)
        return 0
    }

    const estimatedCost = (usage.count * getCostPerMessage()).toLocaleString('pt-BR', { 
        style: 'currency', 
        currency: 'BRL',
        minimumFractionDigits: 2 
    })

    return (
        <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Uso Mensal</CardTitle>
                        <Activity className="w-4 h-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{usage.count}</div>
                        <p className="text-xs text-muted-foreground">de {config.monthlyLimit} interações</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Limite</CardTitle>
                        <Zap className="w-4 h-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{usagePercent}%</div>
                        <div className="w-full bg-muted h-2 rounded-full mt-2 overflow-hidden">
                            <div
                                className={`h-full transition-all ${usagePercent > 90 ? 'bg-red-500' : 'bg-primary'}`}
                                style={{ width: `${usagePercent}%` }}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Custo Estimado</CardTitle>
                        <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">Flash</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{estimatedCost}</div>
                        <p className="text-xs text-muted-foreground">Baseado em média (~$0,01/msg)</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                        <CardTitle className="text-sm font-medium">Provedor Ativo</CardTitle>
                        <Sparkles className="w-4 h-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-lg font-bold capitalize">{config.provider === 'desativado' ? 'Inativo' : config.provider}</div>
                        <p className="text-xs text-muted-foreground">Otimizado para economia</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        Histórico de Interações (Últimos 3 meses)
                    </CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                            <XAxis dataKey="name" fontSize={12} tickLine={false} axisLine={false} />
                            <YAxis fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                            />
                            <Bar dataKey="total" radius={[4, 4, 0, 0]} barSize={40}>
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={index === 2 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground)/0.3)"} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
                <Info className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="text-sm text-amber-800">
                    <p className="font-semibold">Nota sobre os custos:</p>
                    <p className="opacity-80">Os valores acima são estimativas baseadas no volume de interações. O custo real depende do volume de tokens e pode variar conforme o uso de imagens no chat.</p>
                </div>
            </div>
        </div>
    )
})
