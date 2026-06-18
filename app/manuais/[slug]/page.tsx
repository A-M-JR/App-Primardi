"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { AppShell } from "@/components/app-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  BookOpen,
  ArrowLeft,
  ListChecks,
  Workflow,
  BookMarked,
  Plug,
  Upload,
  Zap,
  Search,
} from "lucide-react"
import { getManual } from "@/lib/manuais/conteudo"

function Caminho({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-muted px-1.5 py-0.5 text-[12px] font-mono text-primary">{children}</code>
}
function Secao({ id, icon: Icon, titulo, children }: { id: string; icon: typeof BookOpen; titulo: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <h2 className="text-lg font-bold flex items-center gap-2 mb-3">
        <Icon className="size-5 text-primary" /> {titulo}
      </h2>
      {children}
    </section>
  )
}

export default function ManualDinamicoPage() {
  const params = useParams()
  const slug = String(params?.slug || "")
  const manual = getManual(slug)

  if (!manual) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center gap-3 h-[60vh] text-center text-muted-foreground">
          <BookOpen className="size-10 text-muted-foreground/50" />
          <p>Manual não encontrado.</p>
          <Link href="/manuais" className="text-primary hover:underline text-sm">← Voltar aos manuais</Link>
        </div>
      </AppShell>
    )
  }

  const Icon = manual.icon

  return (
    <AppShell>
      <div className="flex flex-col gap-8 max-w-4xl mx-auto w-full pb-12">
        <div>
          <Link href="/manuais" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="size-3.5" /> Manuais
          </Link>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Icon className="size-6 text-primary" /> {manual.titulo}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{manual.intro}</p>
        </div>

        {/* Telas */}
        <Secao id="telas" icon={ListChecks} titulo="Telas do módulo">
          <div className="grid gap-2">
            {manual.telas.map((t) => (
              <Card key={t.nome}><CardContent className="p-3.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{t.nome}</span>
                  <Caminho>{t.caminho}</Caminho>
                </div>
                <p className="text-sm text-muted-foreground mt-1">{t.desc}</p>
              </CardContent></Card>
            ))}
          </div>
        </Secao>

        {/* Fluxo */}
        {manual.fluxo && manual.fluxo.length > 0 && (
          <Secao id="fluxo" icon={Workflow} titulo="Fluxo recomendado (passo a passo)">
            <Card><CardContent className="p-4">
              <ol className="space-y-3">
                {manual.fluxo.map((passo, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">{i + 1}</span>
                    <span className="leading-relaxed">{passo}</span>
                  </li>
                ))}
              </ol>
            </CardContent></Card>
          </Secao>
        )}

        {/* Campos */}
        {manual.campos && manual.campos.length > 0 && (
          <Secao id="campos" icon={BookMarked} titulo="Campos">
            <Card><CardContent className="p-4">
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {manual.campos.map((c) => (
                  <div key={c.termo}>
                    <dt className="font-medium">{c.termo}</dt>
                    <dd className="text-muted-foreground text-xs mt-0.5">{c.desc}</dd>
                  </div>
                ))}
              </dl>
            </CardContent></Card>
          </Secao>
        )}

        {/* APIs */}
        {manual.apis && manual.apis.length > 0 && (
          <Secao id="apis" icon={Plug} titulo="Integrações (APIs)">
            <div className="grid gap-3">
              {manual.apis.map((a) => (
                <Card key={a.nome}><CardContent className="p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                    <span className="font-semibold flex items-center gap-2"><Plug className="size-4 text-primary" /> {a.nome}</span>
                    {a.tipo === "Grava no sistema" ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]"><Zap className="size-3 mr-1" /> {a.tipo}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground"><Search className="size-3 mr-1" /> {a.tipo}</Badge>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
                    <Campo l="O que faz" v={a.oQueFaz} />
                    <Campo l="Para que serve" v={a.paraQueServe} />
                    <Campo l="Como alimentar" v={a.comoAlimentar} />
                    <Campo l="Onde buscar" v={a.ondeBuscar} />
                    <div className="sm:col-span-2"><Campo l="Impacto no sistema" v={a.impacto} destaque /></div>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">Onde usar: <Caminho>{a.onde}</Caminho></p>
                </CardContent></Card>
              ))}
            </div>
          </Secao>
        )}

        {/* Seções extras */}
        {manual.secoes?.map((s) => (
          <Secao key={s.titulo} id={s.titulo} icon={BookMarked} titulo={s.titulo}>
            <Card><CardContent className="p-4">
              <dl className="space-y-3 text-sm">
                {s.itens.map((it) => (
                  <div key={it.t}>
                    <dt className="font-medium">{it.t}</dt>
                    <dd className="text-muted-foreground text-xs mt-0.5">{it.d}</dd>
                  </div>
                ))}
              </dl>
            </CardContent></Card>
          </Secao>
        ))}

        {/* Como alimentar */}
        {manual.comoAlimentar && manual.comoAlimentar.length > 0 && (
          <Secao id="alimentar" icon={Upload} titulo="Como alimentar os dados">
            <Card><CardContent className="p-4">
              <ul className="space-y-2 text-sm">
                {manual.comoAlimentar.map((c, i) => (
                  <li key={i} className="flex gap-2"><span className="text-primary">•</span><span className="text-muted-foreground">{c}</span></li>
                ))}
              </ul>
            </CardContent></Card>
          </Secao>
        )}

        {/* Glossário */}
        {manual.glossario && manual.glossario.length > 0 && (
          <Secao id="glossario" icon={BookMarked} titulo="Glossário">
            <Card><CardContent className="p-4">
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                {manual.glossario.map((g) => (
                  <div key={g.termo}>
                    <dt className="font-medium">{g.termo}</dt>
                    <dd className="text-muted-foreground text-xs mt-0.5">{g.desc}</dd>
                  </div>
                ))}
              </dl>
            </CardContent></Card>
          </Secao>
        )}
      </div>
    </AppShell>
  )
}

function Campo({ l, v, destaque }: { l: string; v: React.ReactNode; destaque?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{l}</p>
      <p className={`text-sm mt-0.5 ${destaque ? "text-foreground font-medium" : "text-muted-foreground"}`}>{v}</p>
    </div>
  )
}
