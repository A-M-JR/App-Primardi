import type { AcaoAuditoriaCompra } from "@prisma/client"

export const ACAO_LABELS: Record<AcaoAuditoriaCompra, string> = {
  IMPORTAR: "Planilha importada",
  VINCULAR: "Produto vinculado",
  ESCOLHER_VENCEDOR: "Vencedor escolhido",
  GERAR_PEDIDO: "Pedido gerado",
  RESPONDER_COTACAO: "Cotação respondida",
  ALTERAR_STATUS: "Status alterado",
}

const STATUS_PEDIDO: Record<string, string> = {
  RASCUNHO: "Rascunho",
  ENVIADO: "Enviado",
  CONFIRMADO: "Confirmado",
  RECEBIDO_PARCIAL: "Recebido parcial",
  RECEBIDO: "Recebido",
  CANCELADO: "Cancelado",
}

export function formatDetalhesAuditoria(
  acao: AcaoAuditoriaCompra,
  detalhes: unknown
): string | null {
  if (!detalhes || typeof detalhes !== "object") return null
  const d = detalhes as Record<string, unknown>

  switch (acao) {
    case "IMPORTAR":
      if (typeof d.nomeArquivo === "string") return `Arquivo: ${d.nomeArquivo}`
      if (typeof d.nomePlanilha === "string") return `Planilha: ${d.nomePlanilha}`
      return null
    case "VINCULAR":
      if (d.numeroLinha != null) return `Linha ${d.numeroLinha}`
      return null
    case "GERAR_PEDIDO":
      if (d.planejamentoId != null) return `A partir do planejamento #${d.planejamentoId}`
      if (d.cotacaoId != null) return `A partir da cotação #${d.cotacaoId}`
      return null
    case "ALTERAR_STATUS": {
      const de = STATUS_PEDIDO[String(d.de)] ?? d.de
      const para = STATUS_PEDIDO[String(d.para)] ?? d.para
      if (de && para) return `${de} → ${para}`
      return null
    }
    default:
      return null
  }
}
