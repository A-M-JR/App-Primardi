import * as XLSX from "xlsx"
import Papa from "papaparse"
import type { CampoImportacaoFornecedor, TipoArquivoImportacao } from "./types"
import { applyTransform, parseMoney, parseNumber } from "./normalize-text"

export type ImportCampoConfig = {
  campo: CampoImportacaoFornecedor
  coluna: string
  obrigatorio?: boolean
  transformacao?: string | null
}

export type ImportConfigInput = {
  tipoArquivo: TipoArquivoImportacao
  nomeAba?: string | null
  linhaCabecalho: number
  linhaInicioDados: number
  delimitadorCsv?: string | null
  encoding?: string | null
  campos: ImportCampoConfig[]
}

export type ParsedRow = Record<string, unknown>

function colIndex(coluna: string, headers: string[]): number {
  if (/^\d+$/.test(coluna)) return parseInt(coluna, 10)
  const idx = headers.findIndex(
    (h) => h.toLowerCase().trim() === coluna.toLowerCase().trim()
  )
  if (idx >= 0) return idx
  const letterMatch = coluna.match(/^[A-Z]+$/i)
  if (letterMatch) {
    let n = 0
    for (const c of coluna.toUpperCase()) n = n * 26 + (c.charCodeAt(0) - 64)
    return n - 1
  }
  return -1
}

function readExcel(buffer: Buffer, config: ImportConfigInput): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" })
  const sheetName = config.nomeAba || wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  if (!sheet) throw new Error(`Aba "${sheetName}" não encontrada.`)
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
  const headerRow = raw[config.linhaCabecalho - 1] || []
  const headers = headerRow.map((h) => String(h ?? ""))
  const rows: ParsedRow[] = []
  for (let i = config.linhaInicioDados - 1; i < raw.length; i++) {
    const rowArr = raw[i]
    if (!rowArr || rowArr.every((c) => c === "" || c === null || c === undefined)) continue
    const obj: ParsedRow = {}
    rowArr.forEach((val, idx) => {
      obj[headers[idx] || `col_${idx}`] = val
      obj[`__idx_${idx}`] = val
    })
    obj.__numeroLinha = i + 1
    rows.push(obj)
  }
  return rows
}

function readCsv(buffer: Buffer, config: ImportConfigInput): ParsedRow[] {
  const text = buffer.toString((config.encoding as BufferEncoding) || "utf-8")
  const parsed = Papa.parse<string[]>(text, {
    delimiter: config.delimitadorCsv || ";",
    skipEmptyLines: true,
  })
  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]?.message || "Erro ao ler CSV.")
  }
  const raw = parsed.data
  const headerRow = raw[config.linhaCabecalho - 1] || []
  const headers = headerRow.map((h) => String(h ?? ""))
  const rows: ParsedRow[] = []
  for (let i = config.linhaInicioDados - 1; i < raw.length; i++) {
    const rowArr = raw[i]
    if (!rowArr || rowArr.every((c) => !c?.trim())) continue
    const obj: ParsedRow = {}
    rowArr.forEach((val, idx) => {
      obj[headers[idx] || `col_${idx}`] = val
      obj[`__idx_${idx}`] = val
    })
    obj.__numeroLinha = i + 1
    rows.push(obj)
  }
  return rows
}

export function listExcelSheetNames(buffer: Buffer): string[] {
  const wb = XLSX.read(buffer, { type: "buffer" })
  return wb.SheetNames
}

function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

/** Detecta colunas padrão (ID, PRODUTO, FORNECEDOR, ESTOQUE, PREÇO, EAN...) */
export function buildAutoImportConfig(
  buffer: Buffer,
  options?: { nomeAba?: string; linhaCabecalho?: number; linhaInicioDados?: number }
): ImportConfigInput {
  const wb = XLSX.read(buffer, { type: "buffer" })
  const sheetName = options?.nomeAba || wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  if (!sheet) throw new Error(`Aba "${sheetName}" não encontrada.`)

  const linhaCabecalho = options?.linhaCabecalho ?? 1
  const linhaInicioDados = options?.linhaInicioDados ?? 2
  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })
  const headers = (raw[linhaCabecalho - 1] || []).map((h) => String(h ?? ""))

  const findCol = (...candidates: string[]) => {
    const idx = headers.findIndex((h) =>
      candidates.some((c) => normalizeHeader(h) === normalizeHeader(c))
    )
    return idx >= 0 ? headers[idx] : null
  }

  const campos: ImportCampoConfig[] = []
  const add = (campo: CampoImportacaoFornecedor, ...names: string[]) => {
    const col = findCol(...names)
    if (col) campos.push({ campo, coluna: col, obrigatorio: campo === "PRECO" })
  }

  add("CODIGO_FORNECEDOR", "id", "codigo", "cod", "sku", "codigo fornecedor")
  add("DESCRICAO", "produto", "descricao", "descrição", "nome")
  add("FORNECEDOR", "fornecedor", "distribuidor", "forn")
  add("ESTOQUE", "estoque", "qtd", "quantidade", "saldo")
  add("PRECO", "preco", "preço", "valor", "preco unitario", "preço unitário")
  add("EAN", "ean", "gtin", "codigo barras", "código barras", "barcode")

  if (!campos.some((c) => c.campo === "PRECO")) {
    throw new Error("Coluna de preço não encontrada (PREÇO/PRECO/VALOR).")
  }

  return {
    tipoArquivo: "XLSX",
    nomeAba: sheetName,
    linhaCabecalho,
    linhaInicioDados,
    campos,
  }
}

export function parseImportFile(buffer: Buffer, config: ImportConfigInput): ParsedRow[] {
  if (config.tipoArquivo === "CSV") return readCsv(buffer, config)
  return readExcel(buffer, config)
}

export function previewColumns(buffer: Buffer, config: ImportConfigInput, maxRows = 5): {
  headers: string[]
  preview: ParsedRow[]
} {
  const rows = parseImportFile(buffer, config)
  const first = rows[0]
  const headers = first
    ? Object.keys(first).filter((k) => !k.startsWith("__"))
    : []
  return { headers, preview: rows.slice(0, maxRows) }
}

export type MappedLine = {
  numeroLinha: number
  dadosOriginais: Record<string, unknown>
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
  erroMensagem?: string | null
}

export function mapRowToFields(
  row: ParsedRow,
  config: ImportConfigInput
): MappedLine {
  const headers = Object.keys(row).filter((k) => !k.startsWith("__"))
  const getVal = (coluna: string): unknown => {
    const idx = colIndex(coluna, headers)
    if (idx >= 0) return row[`__idx_${idx}`] ?? row[headers[idx]]
    return row[coluna]
  }

  const result: MappedLine = {
    numeroLinha: Number(row.__numeroLinha) || 0,
    dadosOriginais: { ...row },
  }

  const errors: string[] = []

  for (const campo of config.campos) {
    const raw = getVal(campo.coluna)
    const strVal =
      raw !== null && raw !== undefined ? applyTransform(String(raw), campo.transformacao) : ""

    switch (campo.campo) {
      case "CODIGO_FORNECEDOR":
        result.codigoFornecedor = strVal || null
        break
      case "EAN":
        result.ean = strVal.replace(/\D/g, "") || null
        break
      case "DESCRICAO":
        result.descricao = strVal || null
        break
      case "PRECO":
        result.preco = parseMoney(raw)
        break
      case "ESTOQUE":
        result.estoqueFornecedor = parseNumber(raw)
        break
      case "MULTIPLO":
        result.multiplo = parseNumber(raw)
        break
      case "EMBALAGEM":
        result.embalagem = strVal || null
        break
      case "OBSERVACAO":
        result.observacao = strVal || null
        break
      case "LABORATORIO":
        result.laboratorio = strVal || null
        break
      case "FORNECEDOR":
        result.fornecedorNome = strVal || null
        break
    }

    if (campo.obrigatorio) {
      const val =
        campo.campo === "PRECO"
          ? result.preco
          : campo.campo === "ESTOQUE"
            ? result.estoqueFornecedor
            : strVal
      if (val === null || val === undefined || val === "") {
        errors.push(`Campo ${campo.campo} obrigatório`)
      }
    }
  }

  if (!result.codigoFornecedor && !result.ean) {
    errors.push("Código fornecedor ou EAN necessário")
  }
  if (result.preco === null || result.preco === undefined) {
    errors.push("Preço inválido ou ausente")
  }

  if (errors.length) result.erroMensagem = errors.join("; ")
  return result
}

export const CAMPOS_IMPORTACAO_LABELS: Record<CampoImportacaoFornecedor, string> = {
  CODIGO_FORNECEDOR: "Código Fornecedor",
  EAN: "EAN",
  DESCRICAO: "Descrição",
  PRECO: "Preço",
  ESTOQUE: "Estoque",
  MULTIPLO: "Múltiplo",
  EMBALAGEM: "Embalagem",
  OBSERVACAO: "Observação",
  LABORATORIO: "Laboratório",
  FORNECEDOR: "Fornecedor (coluna)",
}
