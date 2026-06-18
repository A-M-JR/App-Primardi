/**
 * Geração do texto de promoção para WhatsApp (sem dependência de servidor).
 * Placeholders no template: {nome} {titulo} {validade} {itens}
 */

const brl = (n: number) => (n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "")

export const TEMPLATE_PROMO_PADRAO =
  "🔥🔥  *{titulo}*  🔥🔥\n" +
  "━━━━━━━━━━━━━━━\n" +
  "Olá {nome}! 👋\n" +
  "Separamos *ofertas imperdíveis*{validade} 👇\n\n" +
  "{itens}\n\n" +
  "━━━━━━━━━━━━━━━\n" +
  "🛒 *Faça seu pedido pelo WhatsApp!*\n" +
  "⏳ Promoção por tempo limitado — garanta já! 😉"

export interface PromoItemTexto {
  descricao: string
  precoNormal: number
  precoPromo: number
}
export interface PromoTexto {
  titulo: string
  fim: string | null
  itens: PromoItemTexto[]
}

function formatarItens(itens: PromoItemTexto[]): string {
  return itens
    .map((it) => {
      const desc = it.precoNormal > 0 ? Math.round((1 - it.precoPromo / it.precoNormal) * 100) : 0
      const de = it.precoNormal > 0 ? `~de ${brl(it.precoNormal)}~ ➜ ` : ""
      const off = desc > 0 ? `  🏷️ *-${desc}%*` : ""
      return `🔸 *${it.descricao}*\n     ${de}por *${brl(it.precoPromo)}*${off}`
    })
    .join("\n\n")
}

/** Monta a mensagem final substituindo os placeholders. */
export function montarMensagemPromo(template: string, promo: PromoTexto, nomeDestinatario?: string): string {
  const validade = promo.fim ? ` válidas até ${dataBR(promo.fim)}` : ""
  return (template || TEMPLATE_PROMO_PADRAO)
    .replaceAll("{nome}", nomeDestinatario?.trim() || "")
    .replaceAll("{titulo}", promo.titulo)
    .replaceAll("{validade}", validade)
    .replaceAll("{itens}", formatarItens(promo.itens))
    .replace(/Olá +!/, "Olá!") // limpa saudação quando não há nome
    .trim()
}

/** Link wa.me com a mensagem pronta. */
export function linkWhatsPromo(telefone: string, msg: string): string {
  let digits = (telefone || "").replace(/\D/g, "")
  if (!digits) return ""
  if (digits.length <= 11) digits = "55" + digits
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
}
