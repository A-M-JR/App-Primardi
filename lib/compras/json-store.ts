import type { Prisma } from "@prisma/client"
import type {
  CotacaoRespostaJson,
  FornecedorImportConfigJson,
  LinhaEstoqueImportacaoJson,
  LinhaImportacaoFornecedorJson,
  PrecoFornecedorEntry,
  PrecosFornecedorProduto,
} from "./types"

export function parseLinhasImportacao(raw: unknown): LinhaImportacaoFornecedorJson[] {
  if (!Array.isArray(raw)) return []
  return raw as LinhaImportacaoFornecedorJson[]
}

export function parseLinhasEstoque(raw: unknown): LinhaEstoqueImportacaoJson[] {
  if (!Array.isArray(raw)) return []
  return raw as LinhaEstoqueImportacaoJson[]
}

export function parsePrecosFornecedor(raw: unknown): PrecosFornecedorProduto {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {}
  return raw as PrecosFornecedorProduto
}

export function parseImportConfig(raw: unknown): FornecedorImportConfigJson | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null
  return raw as FornecedorImportConfigJson
}

export function parseRespostasCotacao(raw: unknown): CotacaoRespostaJson[] {
  if (!Array.isArray(raw)) return []
  return raw as CotacaoRespostaJson[]
}

export function toPrecosJson(precos: PrecosFornecedorProduto): Prisma.InputJsonValue {
  return precos as Prisma.InputJsonValue
}

export function toLinhasImportJson(linhas: LinhaImportacaoFornecedorJson[]): Prisma.InputJsonValue {
  return linhas as Prisma.InputJsonValue
}

export function toLinhasEstoqueJson(linhas: LinhaEstoqueImportacaoJson[]): Prisma.InputJsonValue {
  return linhas as Prisma.InputJsonValue
}

export function toRespostasJson(respostas: CotacaoRespostaJson[]): Prisma.InputJsonValue {
  return respostas as Prisma.InputJsonValue
}

export function getPrecoFornecedor(
  precos: PrecosFornecedorProduto,
  fornecedorId: number
): PrecoFornecedorEntry | null {
  return precos[String(fornecedorId)] ?? null
}

export function setPrecoFornecedor(
  precos: PrecosFornecedorProduto,
  fornecedorId: number,
  entry: PrecoFornecedorEntry
): PrecosFornecedorProduto {
  return { ...precos, [String(fornecedorId)]: entry }
}

export function upsertRespostaCotacao(
  respostas: CotacaoRespostaJson[],
  nova: CotacaoRespostaJson
): CotacaoRespostaJson[] {
  const idx = respostas.findIndex((r) => r.cotacaoItemId === nova.cotacaoItemId)
  const merged = {
    ...nova,
    respondidoEm: nova.respondidoEm ?? new Date().toISOString(),
  }
  if (idx < 0) return [...respostas, merged]
  const copy = [...respostas]
  copy[idx] = { ...copy[idx], ...merged }
  return copy
}

export function getRespostaCotacao(
  respostas: CotacaoRespostaJson[],
  cotacaoItemId: number
): CotacaoRespostaJson | null {
  return respostas.find((r) => r.cotacaoItemId === cotacaoItemId) ?? null
}

export function mappedLineToImportJson(
  mapped: {
    numeroLinha: number
    erroMensagem?: string | null
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
    fornecedorNome?: string | null
  }
): LinhaImportacaoFornecedorJson {
  const hasError = !!mapped.erroMensagem
  return {
    numeroLinha: mapped.numeroLinha,
    status: hasError ? "ERRO" : "VALIDA",
    dadosOriginais: mapped.dadosOriginais,
    codigoFornecedor: mapped.codigoFornecedor,
    ean: mapped.ean,
    descricao: mapped.descricao,
    preco: mapped.preco,
    estoqueFornecedor: mapped.estoqueFornecedor,
    multiplo: mapped.multiplo,
    embalagem: mapped.embalagem,
    observacao: mapped.fornecedorNome
      ? `[FORN:${mapped.fornecedorNome}] ${mapped.observacao ?? ""}`.trim()
      : mapped.observacao,
    laboratorio: mapped.laboratorio,
    erroMensagem: mapped.erroMensagem,
  }
}
