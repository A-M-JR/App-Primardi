/**
 * Compras.gov.br — Dados Abertos, módulo Pesquisa de Preço (gratuito, sem token).
 * Preços praticados em compras públicas de materiais (inteligência de precificação).
 * GET /modulo-pesquisa-preco/1_consultarMaterial?codigoItemCatalogo={CATMAT}&pagina={n}
 *
 * O filtro principal é o código CATMAT (codigoItemCatalogo) do item.
 */

const BASE = "https://dadosabertos.compras.gov.br/modulo-pesquisa-preco/1_consultarMaterial"

export interface PrecoPraticado {
  descricao: string
  marca: string
  unidade: string
  precoUnitario: number
  quantidade: number
  data: string | null
  fornecedor: string
  orgao: string
  uf: string
  municipio: string
}

export interface PrecosPraticadosResultado {
  itens: PrecoPraticado[]
  totalRegistros: number
  totalPaginas: number
  pagina: number
}

const isoOrNull = (v: unknown) => {
  if (!v || typeof v !== "string") return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

export async function consultarPrecosPraticados(params: {
  codigoItemCatalogo: number
  pagina?: number
}): Promise<PrecosPraticadosResultado> {
  const pagina = params.pagina ?? 1
  const qs = new URLSearchParams({
    pagina: String(pagina),
    codigoItemCatalogo: String(params.codigoItemCatalogo),
  })

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 20000)
  let resp: Response
  try {
    resp = await fetch(`${BASE}?${qs.toString()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: ctrl.signal,
    })
  } catch {
    clearTimeout(t)
    throw new Error("Não foi possível consultar o Compras.gov.br agora.")
  }
  clearTimeout(t)
  if (!resp.ok) throw new Error(`Compras.gov.br retornou ${resp.status}.`)

  const j: any = await resp.json()
  const rows: any[] = Array.isArray(j?.resultado) ? j.resultado : []
  return {
    itens: rows.map((r) => ({
      descricao: String(r?.descricaoItem ?? "").trim(),
      marca: String(r?.marca ?? "").trim(),
      unidade: String(r?.siglaUnidadeFornecimento ?? r?.nomeUnidadeFornecimento ?? "").trim(),
      precoUnitario: Number(r?.precoUnitario ?? 0) || 0,
      quantidade: Number(r?.quantidade ?? 0) || 0,
      data: isoOrNull(r?.dataResultado ?? r?.dataCompra),
      fornecedor: String(r?.nomeFornecedor ?? "").trim(),
      orgao: String(r?.nomeOrgao ?? r?.nomeUasg ?? "").trim(),
      uf: String(r?.estado ?? "").trim(),
      municipio: String(r?.municipio ?? "").trim(),
    })),
    totalRegistros: Number(j?.totalRegistros ?? rows.length) || 0,
    totalPaginas: Number(j?.totalPaginas ?? 1) || 1,
    pagina,
  }
}
