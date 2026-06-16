export type TipoArquivoImportacao = "XLSX" | "XLS" | "CSV"

export type CampoImportacaoFornecedor =
  | "CODIGO_FORNECEDOR"
  | "EAN"
  | "DESCRICAO"
  | "PRECO"
  | "ESTOQUE"
  | "MULTIPLO"
  | "EMBALAGEM"
  | "OBSERVACAO"
  | "LABORATORIO"
  | "FORNECEDOR"

export type TipoMatchProduto = "EAN" | "CODIGO_FORNECEDOR" | "NOME_NORMALIZADO" | "MANUAL"

export type StatusImportacaoLinha = "PENDENTE" | "VALIDA" | "ERRO" | "IGNORADA" | "VINCULADA"

export type FornecedorImportConfigJson = {
  tipoArquivo: TipoArquivoImportacao
  nomeAba?: string | null
  linhaCabecalho: number
  linhaInicioDados: number
  delimitadorCsv?: string | null
  encoding?: string | null
  ativo?: boolean
  campos: {
    campo: CampoImportacaoFornecedor
    coluna: string
    obrigatorio?: boolean
    transformacao?: string | null
  }[]
}

export type LinhaImportacaoFornecedorJson = {
  numeroLinha: number
  status: StatusImportacaoLinha
  dadosOriginais?: Record<string, unknown>
  codigoFornecedor?: string | null
  ean?: string | null
  descricao?: string | null
  preco?: number | null
  estoqueFornecedor?: number | null
  multiplo?: number | null
  embalagem?: string | null
  observacao?: string | null
  laboratorio?: string | null
  produtoId?: number | null
  matchTipo?: TipoMatchProduto | null
  erroMensagem?: string | null
}

export type PrecoFornecedorEntry = {
  preco: number
  estoqueFornecedor?: number | null
  codigoFornecedor?: string | null
  eanFornecedor?: string | null
  descricaoFornecedor?: string | null
  multiplo?: number | null
  embalagem?: string | null
  laboratorio?: string | null
  matchTipo?: TipoMatchProduto | null
  confirmadoManual?: boolean
  importacaoId?: number | null
  atualizadoEm: string
}

export type PrecosFornecedorProduto = Record<string, PrecoFornecedorEntry>

export type StatusEstoqueImportacaoLinha = "OK" | "ERRO" | "IGNORADA"

export type LinhaEstoqueImportacaoJson = {
  numeroLinha: number
  status: StatusEstoqueImportacaoLinha
  dadosOriginais?: Record<string, unknown>
  codigo?: string | null
  descricao?: string | null
  curva?: string | null
  preco?: number | null
  ufo?: string | null
  estoque?: number | null
  mediaConsumo?: number | null
  consumoMensal?: Record<string, unknown> | null
  ean?: string | null
  estoqueAte?: string | null
  ultimaEntrada?: string | null
  quantidade?: number | null
  sugestao?: number | null
  compra?: number | null
  bloqCompra?: boolean | null
  produtoId?: number | null
  estoqueAntes?: number | null
  estoqueDepois?: number | null
  erroMensagem?: string | null
}

export type EstoqueSnapshotJson = {
  importacaoId?: number | null
  nomeArquivo?: string | null
  capturadoEm: string
  usarNoCalculo: boolean
  linhas?: LinhaEstoqueImportacaoJson[]
}

export type CotacaoRespostaJson = {
  cotacaoItemId: number
  precoUnitario?: number | null
  prazoEntregaDias?: number | null
  quantidadeDisponivel?: number | null
  observacao?: string | null
  bloqueado?: boolean
  respondidoEm?: string
}

export type FonteConsumoCompra = "ITEM_PEDIDO" | "MOVIMENTACAO_ESTOQUE"
