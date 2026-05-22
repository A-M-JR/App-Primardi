"use client"

import { Layers } from "lucide-react"

interface LabelPreviewProps {
  largura: number
  altura: number
  material: string
  cores: number
  aplicacoes: string[]
}

export function LabelPreview({ largura, altura, material, cores, aplicacoes }: LabelPreviewProps) {
  const ratio = altura > 0 ? largura / altura : 1
  const maxWidth = 200
  const maxHeight = 160
  
  let w = maxWidth
  let h = maxWidth / ratio

  if (h > maxHeight) {
    h = maxHeight
    w = h * ratio
  }

  const getMaterialColor = () => {
    const m = material.toLowerCase()
    if (m.includes("couch") || m.includes("fosco")) return "bg-white border-slate-300"
    if (m.includes("bopp") || m.includes("brilho")) return "bg-slate-50 border-blue-200"
    if (m.includes("termic")) return "bg-slate-100 border-slate-300"
    if (m.includes("meta") || m.includes("prata")) return "bg-slate-300 border-slate-400 shadow-inner"
    return "bg-slate-50 border-slate-200"
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="relative group perspective-1000">
        <div 
          style={{ width: `${w}px`, height: `${h}px` }}
          className={`rounded-sm border-2 shadow-lg transition-all duration-500 relative overflow-hidden flex flex-col items-center justify-center p-2 ${getMaterialColor()}`}
        >
          <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:10px_10px]" />
          <Layers className="size-6 text-slate-300/50 mb-1" />
          <span className="text-[9px] uppercase font-bold text-slate-400 select-none">
            {largura || "?"} x {altura || "?"} mm
          </span>
          <div className="absolute top-1 right-1 flex flex-col gap-1">
            {aplicacoes.includes("Hot Stamping") && <div className="size-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)] animate-pulse" />}
            {aplicacoes.includes("Verniz UV Local") && <div className="size-2 rounded-full bg-blue-300/50 ring-1 ring-blue-400 border border-white" />}
          </div>
          <div className="mt-2 text-[8px] font-mono text-slate-300">NEWFLEXO</div>
        </div>
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[80%] h-2 bg-black/5 blur-md rounded-full" />
      </div>
      <div className="flex gap-1.5">
        {cores > 0 && Array.from({ length: Math.min(cores, 6) }).map((_, i) => (
          <div key={i} className="size-2.5 rounded-full border border-border/50 shadow-sm bg-primary/20" />
        ))}
        {cores > 6 && <span className="text-[9px] text-muted-foreground">+{cores - 6}</span>}
      </div>
    </div>
  )
}
