"use client"

import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { BookOpen, ChevronRight } from "lucide-react"
import { MANUAIS_META } from "@/lib/manuais/conteudo"

export default function ManuaisPage() {
  return (
    <AppShell>
      <div className="flex flex-col gap-6 max-w-4xl mx-auto w-full">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="size-6 text-primary" /> Manuais da Plataforma
          </h1>
          <p className="text-sm text-muted-foreground">
            Guias e procedimentos (POP) de cada módulo — o que faz, como usar e como alimentar os dados.
          </p>
        </div>

        <div className="grid gap-3">
          {MANUAIS_META.map((m) => (
            <Link key={m.slug} href={m.href}>
              <Card className="border-border/60 hover:border-primary/40 transition-colors">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <m.icon className="size-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{m.titulo}</p>
                    <p className="text-sm text-muted-foreground line-clamp-2">{m.descricao}</p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {m.tags.map((t) => (
                        <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{t}</span>
                      ))}
                    </div>
                  </div>
                  <ChevronRight className="size-5 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppShell>
  )
}
