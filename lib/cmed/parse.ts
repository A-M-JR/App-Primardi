/**
 * Parser da planilha oficial de preços da CMED/ANVISA.
 * Sem dependência de servidor — recebe linhas (array de arrays) já lidas com XLSX.
 *
 * É defensivo quanto à posição das colunas: localiza a linha de cabeçalho e
 * mapeia por nome normalizado (a ANVISA muda layout entre edições).
 */

export interface CmedRow {
  substancia: string | null
  laboratorio: string | null
  produto: string
  apresentacao: string | null
  registro: string | null
  ggrem: string | null
  ean: string | null
  classeTerapeutica: string | null
  tarja: string | null
  precoFabrica: number
  pmvg: number
  precos: Record<string, number>
}

const norm = (s: unknown) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim()

/** Converte "1.234,56" (pt-BR) ou "1234.56" em número. */
function parseNum(v: unknown): number {
  if (v == null || v === "") return 0
  if (typeof v === "number") return v
  let s = String(v).trim().replace(/[^\d.,-]/g, "")
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".")
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

function acharColuna(header: string[], ...keywords: string[]): number {
  // todas as keywords precisam aparecer na célula
  return header.findIndex((h) => keywords.every((k) => h.includes(k)))
}

export function parseCmed(rows: unknown[][]): CmedRow[] {
  if (!rows || rows.length === 0) return []

  // 1) Localiza a linha de cabeçalho (contém PRODUTO e algum PMVG/PF).
  let headerIdx = -1
  for (let i = 0; i < Math.min(rows.length, 60); i++) {
    const linha = (rows[i] || []).map(norm)
    const temProduto = linha.some((c) => c === "PRODUTO" || c.includes("PRODUTO"))
    const temPreco = linha.some((c) => c.includes("PMVG") || c.includes("PF "))
    if (temProduto && temPreco) {
      headerIdx = i
      break
    }
  }
  if (headerIdx === -1) return []

  const header = (rows[headerIdx] || []).map(norm)

  const col = {
    substancia: acharColuna(header, "SUBSTANCIA"),
    laboratorio: acharColuna(header, "LABORATORIO"),
    produto: acharColuna(header, "PRODUTO"),
    apresentacao: acharColuna(header, "APRESENTACAO"),
    registro: acharColuna(header, "REGISTRO"),
    ggrem: acharColuna(header, "GGREM"),
    ean: (() => {
      const e1 = acharColuna(header, "EAN", "1")
      return e1 !== -1 ? e1 : acharColuna(header, "EAN")
    })(),
    classe: acharColuna(header, "CLASSE TERAPEUTICA"),
    tarja: acharColuna(header, "TARJA"),
    pfSemImposto: (() => {
      const c = header.findIndex((h) => h.includes("PF") && h.includes("SEM IMPOSTO"))
      return c !== -1 ? c : header.findIndex((h) => h.startsWith("PF"))
    })(),
    pmvgSemImposto: (() => {
      const c = header.findIndex((h) => h.includes("PMVG") && h.includes("SEM IMPOSTO"))
      return c !== -1 ? c : header.findIndex((h) => h.includes("PMVG"))
    })(),
  }
  if (col.produto === -1) return []

  // Índices de TODAS as faixas de PF/PMVG (para guardar no JSON).
  const colunasPreco = header
    .map((h, idx) => ({ h, idx }))
    .filter(({ h }) => (h.includes("PMVG") || h.includes("PF")) && /\d|SEM IMPOSTO/.test(h))

  const out: CmedRow[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i] || []
    const produto = String(r[col.produto] ?? "").trim()
    if (!produto) continue

    const precos: Record<string, number> = {}
    for (const { h, idx } of colunasPreco) {
      const val = parseNum(r[idx])
      if (val > 0) precos[h] = val
    }

    const get = (c: number) => (c >= 0 ? String(r[c] ?? "").trim() || null : null)

    out.push({
      substancia: get(col.substancia),
      laboratorio: get(col.laboratorio),
      produto,
      apresentacao: get(col.apresentacao),
      registro: get(col.registro),
      ggrem: get(col.ggrem),
      ean: (() => {
        const e = get(col.ean)
        return e ? e.replace(/\D/g, "") || null : null
      })(),
      classeTerapeutica: get(col.classe),
      tarja: get(col.tarja),
      precoFabrica: col.pfSemImposto >= 0 ? parseNum(r[col.pfSemImposto]) : 0,
      pmvg: col.pmvgSemImposto >= 0 ? parseNum(r[col.pmvgSemImposto]) : 0,
      precos,
    })
  }
  return out
}
