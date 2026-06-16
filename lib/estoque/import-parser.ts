import * as XLSX from "xlsx"
import { parseMoney, parseNumber } from "@/lib/compras/normalize-text"

export type EstoqueImportRow = {
  numeroLinha: number
  codigo?: string | null
  descricao?: string | null
  curva?: string | null
  preco?: number | null
  ufo?: string | null
  estoque?: number | null
  mediaConsumo?: number | null
  consumoMensal?: Record<string, number>
  ean?: string | null
  estoqueAte?: string | null
  ultimaEntrada?: Date | null
  quantidade?: number | null
  sugestao?: number | null
  compra?: number | null
  bloqCompra?: boolean | null
  dadosOriginais: Record<string, unknown>
  erroMensagem?: string | null
}

const FIXED_COLUMNS: Record<string, string[]> = {
  codigo: ["codigo", "código", "cod"],
  descricao: ["descricao", "descrição", "produto", "nome"],
  curva: ["curva"],
  preco: ["preco", "preço", "valor"],
  ufo: ["ufo"],
  estoque: ["estoque", "saldo", "qtd estoque"],
  mediaConsumo: ["media", "média", "media consumo", "média consumo"],
  ean: ["ean", "gtin", "codigo barras", "código barras"],
  estoqueAte: ["est ate", "est. ate", "est até", "estoque ate", "estoque até"],
  ultimaEntrada: ["ult ent", "ult. ent", "ultima entrada", "última entrada", "ult entrega"],
  quantidade: ["quant", "quant.", "quantidade"],
  sugestao: ["sugest", "sugest.", "sugestao", "sugestão"],
  compra: ["compra"],
  bloqCompra: ["bloq compra", "bloqueio compra", "bloq. compra"],
}

function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[.\s_]+/g, " ")
    .trim()
}

function isConsumoMensalHeader(h: string): boolean {
  const n = normalizeHeader(h).replace(/\s/g, "")
  return /^[a-z]{3}\/\d{2}$/.test(n) || /^[a-z]{3}\/\d{4}$/.test(n)
}

function findColumn(headers: string[], candidates: string[]): string | null {
  const normalized = headers.map(normalizeHeader)
  const normalizedCandidates = candidates.map(normalizeHeader)
  const idx = normalized.findIndex((h) =>
    normalizedCandidates.some((c) => h === c || h.startsWith(c + " "))
  )
  return idx >= 0 ? headers[idx] : null
}

function detectHeaderRow(raw: unknown[][]): { linhaCabecalho: number; linhaInicioDados: number } {
  for (let i = 0; i < Math.min(30, raw.length); i++) {
    const row = raw[i] || []
    const headers = row.map((h) => normalizeHeader(String(h ?? "")))
    const hasCodigo = headers.some((h) => h === "codigo" || h.startsWith("codigo"))
    const hasEstoque = headers.some((h) => h === "estoque" || h.startsWith("estoque"))
    if (hasCodigo && hasEstoque) {
      return { linhaCabecalho: i + 1, linhaInicioDados: i + 2 }
    }
  }
  return { linhaCabecalho: 1, linhaInicioDados: 2 }
}

function parseDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === "") return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value)
    if (d) return new Date(d.y, d.m - 1, d.d)
  }
  const str = String(value).trim()
  const br = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (br) {
    const year = br[3].length === 2 ? 2000 + parseInt(br[3], 10) : parseInt(br[3], 10)
    return new Date(year, parseInt(br[2], 10) - 1, parseInt(br[1], 10))
  }
  const d = new Date(str)
  return isNaN(d.getTime()) ? null : d
}

function formatDateBr(value: unknown): string | null {
  const d = parseDate(value)
  if (!d) {
    const str = String(value ?? "").trim()
    return str || null
  }
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}/${mm}/${yyyy}`
}

function parseEan(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number" && !isNaN(value)) {
    return String(Math.round(value))
  }
  const str = String(value).trim()
  const sci = str.match(/^([\d,]+)\s*[eE]\s*\+?\s*(\d+)$/)
  if (sci) {
    const base = parseFloat(sci[1].replace(",", "."))
    const exp = parseInt(sci[2], 10)
    if (!isNaN(base) && !isNaN(exp)) {
      return String(Math.round(base * Math.pow(10, exp)))
    }
  }
  const digits = str.replace(/\D/g, "")
  return digits.length >= 8 ? digits : null
}

function parseEstoque(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number") return isNaN(value) ? null : value
  const str = String(value).trim()
  if (str === "-" || str === "—") return 0
  return parseNumber(value)
}

function parseCompra(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const str = String(value).trim()
  if (!str || str === "[]" || str === "[ ]" || str === "-") return null
  return parseNumber(value)
}

function parseBool(value: unknown): boolean | null {
  if (value === null || value === undefined || value === "") return null
  const str = String(value).trim().toLowerCase()
  if (["sim", "s", "1", "true", "x", "bloqueado"].includes(str)) return true
  if (["nao", "não", "n", "0", "false"].includes(str)) return false
  return null
}

function getCell(row: Record<string, unknown>, col: string | null): unknown {
  if (!col) return null
  return row[col] ?? null
}

function isRowEmpty(rowArr: unknown[]): boolean {
  return rowArr.every((c) => c === "" || c === null || c === undefined)
}

function sanitizeJson(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith("__")) continue
    if (v instanceof Date) out[k] = v.toISOString()
    else if (v === undefined) out[k] = null
    else out[k] = v
  }
  return out
}

function parseCodigo(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number" && !isNaN(value)) return String(Math.round(value))
  const str = String(value).trim()
  return str || null
}

export function parseEstoqueSpreadsheet(
  buffer: Buffer,
  options?: { nomeAba?: string; linhaCabecalho?: number; linhaInicioDados?: number }
): EstoqueImportRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true })
  const sheetName = options?.nomeAba || wb.SheetNames[0]
  const sheet = wb.Sheets[sheetName]
  if (!sheet) throw new Error(`Aba "${sheetName}" não encontrada.`)

  const raw: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })

  const detected = detectHeaderRow(raw)
  const linhaCabecalho = options?.linhaCabecalho ?? detected.linhaCabecalho
  const linhaInicioDados = options?.linhaInicioDados ?? detected.linhaInicioDados
  const headers = (raw[linhaCabecalho - 1] || []).map((h) => String(h ?? "").trim())

  if (!findColumn(headers, FIXED_COLUMNS.codigo)) {
    throw new Error('Coluna "Código" não encontrada na planilha.')
  }
  if (!findColumn(headers, FIXED_COLUMNS.estoque)) {
    throw new Error('Coluna "Estoque" não encontrada na planilha.')
  }

  const colMap: Record<string, string | null> = {}
  for (const [field, candidates] of Object.entries(FIXED_COLUMNS)) {
    colMap[field] = findColumn(headers, candidates)
  }

  const consumoCols = headers.filter(isConsumoMensalHeader)
  const rows: EstoqueImportRow[] = []

  for (let i = linhaInicioDados - 1; i < raw.length; i++) {
    const rowArr = raw[i]
    if (!rowArr || isRowEmpty(rowArr)) continue

    const dadosOriginais: Record<string, unknown> = {}
    headers.forEach((h, idx) => {
      if (h) dadosOriginais[h] = rowArr[idx] ?? ""
    })

    const codigo = parseCodigo(getCell(dadosOriginais, colMap.codigo))
    const descricao = String(getCell(dadosOriginais, colMap.descricao) ?? "").trim() || null
    const ean = parseEan(getCell(dadosOriginais, colMap.ean))
    const estoque = parseEstoque(getCell(dadosOriginais, colMap.estoque))

    if (!codigo && !descricao) continue

    const consumoMensal: Record<string, number> = {}
    for (const col of consumoCols) {
      const val = parseNumber(dadosOriginais[col])
      if (val !== null) consumoMensal[col] = val
    }

    const errors: string[] = []
    if (!codigo && !ean) errors.push("Código ou EAN obrigatório")
    if (estoque === null) errors.push("Estoque inválido ou ausente")

    rows.push({
      numeroLinha: i + 1,
      codigo,
      descricao,
      curva: String(getCell(dadosOriginais, colMap.curva) ?? "").trim() || null,
      preco: parseMoney(getCell(dadosOriginais, colMap.preco)),
      ufo: String(getCell(dadosOriginais, colMap.ufo) ?? "").trim() || null,
      estoque,
      mediaConsumo: parseNumber(getCell(dadosOriginais, colMap.mediaConsumo)),
      consumoMensal: Object.keys(consumoMensal).length ? consumoMensal : undefined,
      ean,
      estoqueAte: formatDateBr(getCell(dadosOriginais, colMap.estoqueAte)),
      ultimaEntrada: parseDate(getCell(dadosOriginais, colMap.ultimaEntrada)),
      quantidade: parseNumber(getCell(dadosOriginais, colMap.quantidade)),
      sugestao: parseNumber(getCell(dadosOriginais, colMap.sugestao)),
      compra: parseCompra(getCell(dadosOriginais, colMap.compra)),
      bloqCompra: parseBool(getCell(dadosOriginais, colMap.bloqCompra)),
      dadosOriginais: sanitizeJson(dadosOriginais),
      erroMensagem: errors.length ? errors.join("; ") : null,
    })
  }

  if (rows.length === 0) {
    throw new Error("Nenhuma linha de dados encontrada na planilha.")
  }

  return rows
}

export function listEstoqueSheetNames(buffer: Buffer): string[] {
  const wb = XLSX.read(buffer, { type: "buffer" })
  return wb.SheetNames
}

export function previewEstoqueImport(buffer: Buffer, nomeAba?: string, maxRows = 5) {
  const rows = parseEstoqueSpreadsheet(buffer, { nomeAba })
  return {
    total: rows.length,
    validas: rows.filter((r) => !r.erroMensagem).length,
    erros: rows.filter((r) => r.erroMensagem).length,
    preview: rows.slice(0, maxRows),
  }
}
