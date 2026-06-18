import jsPDF from "jspdf"

/**
 * Gera um flyer PDF (A4) bem visual da promoção: faixa colorida, logo,
 * "De/Por", selo de desconto e chamada final. Download no navegador.
 * Obs.: jsPDF (helvetica) não renderiza emojis — o "frufru" aqui é gráfico
 * (cores, selos, zebra). Os emojis ficam no texto do WhatsApp.
 */

export interface PromoPdfItem {
  descricao: string
  precoNormal: number
  precoPromo: number
}
export interface PromoPdfInput {
  titulo: string
  fim: string | null
  itens: PromoPdfItem[]
  empresaNome?: string | null
  logoDataUrl?: string | null
  corPrimaria?: string | null
}

type RGB = [number, number, number]

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "")

function hexToRgb(hex?: string | null): RGB | null {
  if (!hex || !hex.startsWith("#")) return null
  const h = hex.replace("#", "")
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  if (full.length !== 6) return null
  const n = parseInt(full, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Garante contraste: se a cor for muito escura, clareia um pouco para a faixa. */
function vibranteOuPadrao(rgb: RGB | null): RGB {
  if (!rgb) return [234, 88, 12] // laranja vibrante padrão
  const lum = 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]
  if (lum < 40) return [234, 88, 12] // cor quase preta → usa o laranja para "promo"
  return rgb
}

export function gerarPromoPDF(input: PromoPdfInput): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageW = 210
  const pageH = 297
  const mx = 14
  const w = pageW - mx * 2

  const ACCENT = vibranteOuPadrao(hexToRgb(input.corPrimaria))
  const DARK: RGB = [33, 33, 33]
  const GRAY: RGB = [120, 120, 120]
  const ZEBRA: RGB = [245, 246, 248]

  // ── Cabeçalho ──
  const headerH = 46
  doc.setFillColor(...ACCENT)
  doc.rect(0, 0, pageW, headerH, "F")

  // Logo (se houver)
  if (input.logoDataUrl) {
    try {
      const fmt = input.logoDataUrl.includes("image/png")
        ? "PNG"
        : input.logoDataUrl.includes("image/jpeg") || input.logoDataUrl.includes("image/jpg")
        ? "JPEG"
        : "PNG"
      doc.addImage(input.logoDataUrl, fmt, pageW - mx - 28, 8, 28, 16, undefined, "FAST")
    } catch {
      /* logo inválida — ignora */
    }
  }

  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(11)
  doc.text("OFERTAS ESPECIAIS", mx, 14)
  doc.setFontSize(24)
  const tituloLines = doc.splitTextToSize(input.titulo.toUpperCase(), w - 34)
  doc.text(tituloLines, mx, 25)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(11)
  doc.text(input.fim ? `Válida até ${dataBR(input.fim)}` : "Confira nossas ofertas!", mx, 40)

  // ── Itens ──
  let y = headerH + 8
  const rowH = 15

  const novaPagina = () => {
    doc.addPage()
    doc.setFillColor(...ACCENT)
    doc.rect(0, 0, pageW, 12, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(10)
    doc.text(input.titulo.toUpperCase(), mx, 8)
    y = 20
  }

  input.itens.forEach((it, i) => {
    if (y + rowH > pageH - 28) novaPagina()

    // zebra
    if (i % 2 === 0) {
      doc.setFillColor(...ZEBRA)
      doc.rect(mx, y, w, rowH, "F")
    }
    const mid = y + rowH / 2
    const desc = it.precoNormal > 0 ? Math.round((1 - it.precoPromo / it.precoNormal) * 100) : 0

    // descrição (esquerda)
    doc.setTextColor(...DARK)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9.5)
    const descLines = doc.splitTextToSize(it.descricao, 108) as string[]
    doc.text(descLines.slice(0, 2), mx + 3, descLines.length > 1 ? y + 6 : mid + 1)

    // "de R$X" riscado
    const colPreco = mx + 118
    if (it.precoNormal > 0) {
      doc.setFont("helvetica", "normal")
      doc.setFontSize(8)
      doc.setTextColor(...GRAY)
      const deTxt = `de ${brl(it.precoNormal)}`
      doc.text(deTxt, colPreco, mid - 1.5)
      const tw = doc.getTextWidth(deTxt)
      doc.setDrawColor(...GRAY)
      doc.setLineWidth(0.3)
      doc.line(colPreco, mid - 2.6, colPreco + tw, mid - 2.6)
    }
    // "por R$Y" destaque
    doc.setFont("helvetica", "bold")
    doc.setFontSize(13)
    doc.setTextColor(...ACCENT)
    doc.text(brl(it.precoPromo), colPreco, mid + 4.5)

    // selo -Z%
    if (desc > 0) {
      const bw = 20
      const bx = pageW - mx - bw
      const by = mid - 4
      doc.setFillColor(...ACCENT)
      doc.roundedRect(bx, by, bw, 8, 1.5, 1.5, "F")
      doc.setTextColor(255, 255, 255)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(9)
      doc.text(`-${desc}%`, bx + bw / 2, by + 5.4, { align: "center" })
    }

    y += rowH
  })

  // ── Rodapé (chamada final) ──
  const footH = 22
  const fy = pageH - footH
  doc.setFillColor(...ACCENT)
  doc.rect(0, fy, pageW, footH, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(13)
  doc.text("FACA SEU PEDIDO PELO WHATSAPP!", pageW / 2, fy + 9, { align: "center" })
  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.text(
    `${input.empresaNome ? input.empresaNome + "  -  " : ""}Promocao por tempo limitado. Garanta o seu!`,
    pageW / 2,
    fy + 16,
    { align: "center" }
  )

  const nome = input.titulo.replace(/[^\w-]/g, "_") || "promocao"
  doc.save(`${nome}.pdf`)
}
