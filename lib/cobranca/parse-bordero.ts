// Parser do relatório "Borderô de Cobrança" (.xls/.xlsx) — formato hierárquico:
// cabeçalho da empresa → por cliente: 1 linha (código, nome, cidade) + N títulos
// + linha "TOTAL TITULOS DO CLIENTE". Roda no cliente (browser) ou servidor.

export interface TituloParsed {
  tipo: string | null
  numero: string | null
  portador: string | null
  emissao: string | null // ISO
  vencimento: string | null // ISO
  valor: number
  saldo: number
  jurosMulta: string | null
  total: number
  prazo: number | null
}

export interface DevedorParsed {
  codigoExterno: string
  nome: string
  cidade: string
  titulos: TituloParsed[]
}

const DATE_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/

function parseDataBR(v: unknown): string | null {
  if (typeof v !== "string") return null
  const m = v.trim().match(DATE_RE)
  if (!m) return null
  const [, d, mo, y] = m
  const dt = new Date(Number(y), Number(mo) - 1, Number(d))
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
}

function num(v: unknown): number {
  if (typeof v === "number") return v
  if (typeof v === "string") {
    const n = parseFloat(v.replace(/\./g, "").replace(",", "."))
    return Number.isNaN(n) ? 0 : n
  }
  return 0
}

/** Recebe as linhas da planilha (array de arrays) e retorna os devedores + títulos. */
export function parseBordero(rows: unknown[][]): DevedorParsed[] {
  const devedores: DevedorParsed[] = []
  let atual: DevedorParsed | null = null

  for (const row of rows) {
    if (!row || row.length === 0) continue
    const c0 = row[0]
    const venc = row[5]

    if (typeof c0 === "string" && c0.trim().toUpperCase().startsWith("TOTAL")) continue

    const ehTitulo = typeof c0 === "number" && parseDataBR(venc) !== null
    if (ehTitulo) {
      if (!atual) continue
      atual.titulos.push({
        tipo: c0 != null ? String(c0) : null,
        numero: row[1] != null ? String(row[1]) : null,
        portador: row[3] ? String(row[3]).trim() : null,
        emissao: parseDataBR(row[4]),
        vencimento: parseDataBR(row[5]),
        valor: num(row[6]),
        saldo: num(row[7]),
        jurosMulta: row[8] ? String(row[8]) : null,
        total: num(row[9]),
        prazo: row[10] != null && row[10] !== "" ? Math.round(num(row[10])) : null,
      })
      continue
    }

    const ehCliente = typeof c0 === "number" && typeof row[1] === "string" && String(row[1]).trim().length > 0
    if (ehCliente) {
      atual = {
        codigoExterno: String(c0),
        nome: String(row[1]).trim(),
        cidade: row[2] ? String(row[2]).trim() : "",
        titulos: [],
      }
      devedores.push(atual)
    }
  }

  // descarta devedores sem títulos (ruído de cabeçalho)
  return devedores.filter((d) => d.titulos.length > 0)
}
