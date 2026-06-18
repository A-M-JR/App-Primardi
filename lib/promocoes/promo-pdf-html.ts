import html2canvas from "html2canvas"
import { jsPDF } from "jspdf"

/**
 * PDF visual da promoção (com emojis e gradientes) renderizando o flyer dentro
 * de um IFRAME isolado. Isso evita o bug do html2canvas 1.4 que quebra ao
 * encontrar cores lab()/oklch() do tema global (Tailwind v4). No iframe só
 * existem estilos inline em hex/rgb.
 */

export interface PromoPdfHtmlItem {
  descricao: string
  precoNormal: number
  precoPromo: number
}
export interface PromoPdfHtmlInput {
  titulo: string
  fim: string | null
  itens: PromoPdfHtmlItem[]
  empresaNome?: string | null
  logoUrl?: string | null
  cor?: string | null
}

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "")
const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] || c))

function darken(hex: string, amt = 0.3): string {
  const h = hex.replace("#", "")
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  if (full.length !== 6) return hex
  const n = parseInt(full, 16)
  const r = Math.max(0, Math.round(((n >> 16) & 255) * (1 - amt)))
  const g = Math.max(0, Math.round(((n >> 8) & 255) * (1 - amt)))
  const b = Math.max(0, Math.round((n & 255) * (1 - amt)))
  return `rgb(${r}, ${g}, ${b})`
}

function buildHtml(input: PromoPdfHtmlInput): string {
  const accent = input.cor && input.cor.startsWith("#") ? input.cor : "#ea580c"
  const grad = `linear-gradient(135deg, ${accent}, ${darken(accent)})`

  const itens = input.itens
    .map((it, i) => {
      const desc = it.precoNormal > 0 ? Math.round((1 - it.precoPromo / it.precoNormal) * 100) : 0
      const de = it.precoNormal > 0 ? `<span style="text-decoration:line-through">de ${brl(it.precoNormal)}</span>  ➜  ` : ""
      const badge = desc > 0
        ? `<div style="background:${accent};color:#fff;font-weight:800;font-size:17px;border-radius:999px;padding:8px 16px;white-space:nowrap">-${desc}%</div>`
        : ""
      return `
        <div style="display:flex;align-items:center;gap:14px;padding:12px 16px;border-radius:12px;background:${i % 2 ? "#f6f8fb" : "#ffffff"};border:1px solid #eef2f7;margin-bottom:8px">
          <div style="font-size:22px">🔸</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:16px;color:#111827">${esc(it.descricao)}</div>
            <div style="font-size:14px;color:#6b7280;margin-top:3px">${de}<span style="color:${accent};font-weight:800;font-size:19px">por ${brl(it.precoPromo)}</span></div>
          </div>
          ${badge}
        </div>`
    })
    .join("")

  const logo = input.logoUrl
    ? `<img src="${esc(input.logoUrl)}" alt="logo" style="height:66px;max-width:170px;object-fit:contain;background:#fff;border-radius:10px;padding:6px" />`
    : ""

  return `
    <div id="flyer" style="width:794px;background:#ffffff;font-family:Arial,Helvetica,sans-serif;color:#1f2937">
      <div style="background:${grad};padding:30px 34px;color:#fff;display:flex;justify-content:space-between;align-items:flex-start;gap:20px">
        <div style="min-width:0">
          <div style="font-size:14px;font-weight:700;letter-spacing:2px;opacity:.92">🔥 OFERTAS ESPECIAIS 🔥</div>
          <div style="font-size:36px;font-weight:800;margin-top:6px;line-height:1.05">${esc(input.titulo)}</div>
          <div style="font-size:15px;margin-top:10px;opacity:.95">${input.fim ? `🗓️ Válida até ${dataBR(input.fim)}` : "✨ Aproveite enquanto durar!"}</div>
        </div>
        ${logo}
      </div>
      <div style="padding:18px 28px 6px">${itens}</div>
      <div style="background:${grad};color:#fff;padding:22px 32px;text-align:center;margin-top:8px">
        <div style="font-size:21px;font-weight:800">🛒 Faça seu pedido pelo WhatsApp! 📲</div>
        <div style="font-size:13px;margin-top:8px;opacity:.95">⏳ Promoção por tempo limitado — garanta já!${input.empresaNome ? `  •  ${esc(input.empresaNome)}` : ""}</div>
      </div>
    </div>`
}

export async function gerarPromoPdfHtml(input: PromoPdfHtmlInput): Promise<void> {
  const iframe = document.createElement("iframe")
  iframe.style.cssText = "position:fixed;left:-99999px;top:0;width:820px;height:1400px;border:0;"
  document.body.appendChild(iframe)

  try {
    const idoc = iframe.contentDocument
    if (!idoc) throw new Error("iframe sem documento")
    idoc.open()
    idoc.write(
      `<!doctype html><html><head><meta charset="utf-8"><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#fff}</style></head><body>${buildHtml(input)}</body></html>`
    )
    idoc.close()

    // aguarda layout + carregamento de imagens (logo)
    await new Promise((r) => setTimeout(r, 120))
    await Promise.all(
      Array.from(idoc.images).map((img) =>
        img.complete ? Promise.resolve() : new Promise((res) => { img.onload = img.onerror = () => res(null) })
      )
    )

    const target = (idoc.getElementById("flyer") || idoc.body) as HTMLElement
    const canvas = await html2canvas(target, { scale: 2, backgroundColor: "#ffffff", useCORS: true, logging: false })

    const imgData = canvas.toDataURL("image/png")
    const imgW = 210
    const pageH = 297
    const imgH = (canvas.height * imgW) / canvas.width
    const pdf = new jsPDF("portrait", "mm", "a4")
    let heightLeft = imgH
    let position = 0
    pdf.addImage(imgData, "PNG", 0, position, imgW, imgH)
    heightLeft -= pageH
    while (heightLeft > 0) {
      position = heightLeft - imgH
      pdf.addPage()
      pdf.addImage(imgData, "PNG", 0, position, imgW, imgH)
      heightLeft -= pageH
    }
    pdf.save(`${(input.titulo || "promocao").replace(/[^\w-]/g, "_")}.pdf`)
  } finally {
    document.body.removeChild(iframe)
  }
}
