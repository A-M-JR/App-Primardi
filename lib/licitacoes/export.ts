import * as XLSX from "xlsx"
import { MODALIDADE_LABEL, STATUS_LICITACAO_META } from "@/lib/licitacoes/constants"
import type { getLicitacao } from "@/lib/actions/licitacoes"

type LicitacaoDetalhe = Awaited<ReturnType<typeof getLicitacao>>

const dataBR = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "")

/** Exporta a licitação/contrato (dados + itens com saldo + empenhos) para .xlsx. */
export function exportLicitacaoXlsx(lic: LicitacaoDetalhe) {
  const wb = XLSX.utils.book_new()

  // ── Aba 1: Contrato + itens ──
  const cabecalho: (string | number)[][] = [
    [`Licitação / Contrato — ${lic.orgaoNome}`],
    [`Objeto: ${lic.objeto}`],
    [`Modalidade: ${MODALIDADE_LABEL[lic.modalidade]}   |   Status: ${STATUS_LICITACAO_META[lic.status].label}`],
    [
      `Processo: ${lic.numeroProcesso ?? "-"}   |   Edital: ${lic.numeroEdital ?? "-"}   |   Ata: ${lic.numeroAta ?? "-"}   |   Contrato: ${lic.numeroContrato ?? "-"}`,
    ],
    [`Vigência: ${dataBR(lic.vigenciaInicio)} a ${dataBR(lic.vigenciaFim)}`],
    [
      `Contratado: ${lic.resumo.valorContratado}   |   Faturado: ${lic.resumo.valorFaturado}   |   Saldo: ${lic.resumo.saldo}   |   Execução: ${lic.resumo.percExecutado.toFixed(0)}%`,
    ],
    [],
    ["Item", "Descrição", "Marca", "Unid.", "Qtd contratada", "Preço unit.", "Total", "Faturado", "Saldo", "% exec."],
  ]

  const linhas = lic.itens.map((it) => [
    it.numeroItem ?? "",
    it.descricao,
    it.marca ?? "",
    it.unidade,
    it.quantidade,
    it.precoUnitario,
    it.valorItem,
    it.faturadoQtd,
    it.saldoQtd,
    Number(it.percExecutado.toFixed(1)),
  ])

  const wsContrato = XLSX.utils.aoa_to_sheet([...cabecalho, ...linhas])
  wsContrato["!cols"] = [
    { wch: 8 }, { wch: 46 }, { wch: 16 }, { wch: 8 }, { wch: 14 },
    { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 9 },
  ]
  XLSX.utils.book_append_sheet(wb, wsContrato, "Contrato")

  // ── Aba 2: Empenhos ──
  if (lic.empenhos.length > 0) {
    const cabEmp: (string | number)[][] = [
      ["Empenho", "NF", "Status", "Data", "Prazo entrega", "Itens", "Valor total"],
    ]
    const linhasEmp = lic.empenhos.map((e) => [
      e.numero,
      e.numeroNotaFiscal ?? "",
      e.status,
      dataBR(e.dataEmpenho),
      dataBR(e.prazoEntrega),
      e.qtdItens,
      e.valorTotal,
    ])
    const wsEmp = XLSX.utils.aoa_to_sheet([...cabEmp, ...linhasEmp])
    wsEmp["!cols"] = [{ wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, wsEmp, "Empenhos")
  }

  const nome = (lic.numeroContrato || lic.numeroAta || lic.numeroEdital || `licitacao-${lic.id}`)
    .toString()
    .replace(/[^\w-]/g, "_")
  XLSX.writeFile(wb, `${nome}.xlsx`)
}
