import * as XLSX from "xlsx"

interface PedidoExportItem {
  produto?: { codigo?: string | null } | null
  descricao: string
  quantidade: number
  unidade: string
  precoUnitario: number
  total: number
}

interface PedidoExport {
  numero: string
  fornecedor?: { razaoSocial?: string | null } | null
  totalGeral: number
  itens: PedidoExportItem[]
}

/** Exporta um pedido de compra para .xlsx (download no navegador). */
export function exportPedidoCompraXlsx(pedido: PedidoExport) {
  const cabecalho = [
    [`Pedido de Compra: ${pedido.numero}`],
    [`Fornecedor: ${pedido.fornecedor?.razaoSocial ?? "-"}`],
    [],
    ["Código", "Descrição", "Qtd", "Unidade", "Preço unit.", "Total"],
  ]

  const linhas = pedido.itens.map((i) => [
    i.produto?.codigo ?? "",
    i.descricao,
    i.quantidade,
    i.unidade,
    i.precoUnitario,
    i.total,
  ])

  const rodape = [[], ["", "", "", "", "Total geral", pedido.totalGeral]]

  const ws = XLSX.utils.aoa_to_sheet([...cabecalho, ...linhas, ...rodape])
  ws["!cols"] = [{ wch: 12 }, { wch: 48 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 14 }]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Pedido")
  XLSX.writeFile(wb, `${pedido.numero}.xlsx`)
}
