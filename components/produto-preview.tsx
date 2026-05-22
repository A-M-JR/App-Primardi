"use client"

interface LabelPreviewProps {
  largura: number
  altura: number
  material?: string | null
  cores?: number | null
  aplicacoes?: string[]
}

/**
 * Renderiza uma prévia visual da etiqueta em escala proporcional dentro do container.
 * A proporção largura/altura é preservada e o tamanho máximo é limitado ao container.
 */
export function LabelPreview({ largura, altura, material, cores, aplicacoes = [] }: LabelPreviewProps) {
  const w = largura || 100
  const h = altura || 50

  // Escala para caber num box de ~180x180 px
  const MAX = 160
  const ratio = w / h
  let displayW: number
  let displayH: number

  if (ratio >= 1) {
    displayW = MAX
    displayH = MAX / ratio
  } else {
    displayH = MAX
    displayW = MAX * ratio
  }

  // Cor de fundo baseada no material
  const materialBg: Record<string, string> = {
    BOPP: "#f0f9ff",
    "BOPP Branco": "#f8fafc",
    "BOPP Transparente": "#e0f2fe",
    Couché: "#fefce8",
    "Couché Brilho": "#fef9c3",
    "Kraft": "#fef3c7",
    "PP Transparente": "#f0fdf4",
    Poliéster: "#f5f3ff",
    Vinil: "#fff1f2",
  }
  const bg = material ? (materialBg[material] ?? "#f8fafc") : "#f8fafc"

  // Indicadores de cores como swatches
  const swatchColors = ["#1e293b", "#e11d48", "#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#64748b"]
  const numCores = Math.min(cores ?? 1, swatchColors.length)

  // Aplicações especiais como badges
  const hasVarnish = aplicacoes.some((a) => a.toLowerCase().includes("verniz"))
  const hasHotStamping = aplicacoes.some((a) => a.toLowerCase().includes("hot"))
  const hasRelevo = aplicacoes.some((a) => a.toLowerCase().includes("relevo"))

  return (
    <div className="flex flex-col items-center gap-3 w-full">
      {/* Label visual */}
      <div className="flex items-center justify-center" style={{ width: MAX + 20, height: MAX + 20 }}>
        <div
          className="relative rounded border border-slate-300 shadow-md flex items-center justify-center overflow-hidden transition-all group-hover:shadow-lg group-hover:scale-[1.02]"
          style={{
            width: displayW,
            height: displayH,
            background: bg,
          }}
        >
          {/* Linhas de impressão simuladas */}
          <div className="absolute inset-0 flex flex-col justify-evenly opacity-20 pointer-events-none px-2">
            {Array.from({ length: Math.max(2, Math.round(displayH / 14)) }).map((_, i) => (
              <div
                key={i}
                className="rounded-full"
                style={{
                  height: 3,
                  background: swatchColors[i % swatchColors.length],
                  width: `${55 + Math.sin(i) * 25}%`,
                  marginLeft: i % 2 === 0 ? 0 : "auto",
                }}
              />
            ))}
          </div>

          {/* Dimensão overlay */}
          <span className="relative z-10 text-[9px] font-bold text-slate-600 bg-white/70 px-1.5 py-0.5 rounded backdrop-blur-sm">
            {w} × {h} mm
          </span>

          {/* Indicadores de acabamento */}
          {hasVarnish && (
            <div className="absolute top-0.5 right-0.5 size-2 rounded-full bg-amber-400 opacity-80" title="Verniz" />
          )}
          {hasHotStamping && (
            <div className="absolute top-0.5 left-0.5 size-2 rounded-full bg-yellow-500 opacity-90" title="Hot Stamping" />
          )}
          {hasRelevo && (
            <div className="absolute bottom-0.5 right-0.5 size-2 rounded-full bg-purple-400 opacity-80" title="Relevo" />
          )}
        </div>
      </div>

      {/* Swatches de cores */}
      {numCores > 0 && (
        <div className="flex items-center gap-1">
          {Array.from({ length: numCores }).map((_, i) => (
            <span
              key={i}
              className="size-3 rounded-full border border-white shadow-sm ring-1 ring-slate-200"
              style={{ background: swatchColors[i] }}
              title={`Cor ${i + 1}`}
            />
          ))}
          <span className="text-[10px] text-muted-foreground ml-1">{numCores}C</span>
        </div>
      )}
    </div>
  )
}
