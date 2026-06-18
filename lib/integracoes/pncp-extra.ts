/**
 * PNCP — consultas complementares ao módulo de editais: Contratos e Atas de
 * Registro de Preços (gratuitas, sem token).
 *   GET /v1/contratos?dataInicial&dataFinal&pagina
 *   GET /v1/atas?dataInicial&dataFinal&pagina
 */

const BASE = "https://pncp.gov.br/api/consulta/v1"

const isoOrNull = (v: unknown) => {
  if (!v || typeof v !== "string") return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

async function pncpGet(path: string): Promise<any> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 20000)
  let resp: Response
  try {
    resp = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: ctrl.signal,
    })
  } catch {
    clearTimeout(t)
    throw new Error("Não foi possível conectar ao PNCP.")
  }
  clearTimeout(t)
  if (resp.status === 204) return { data: [], totalPaginas: 0, totalRegistros: 0 }
  if (!resp.ok) throw new Error(`PNCP retornou ${resp.status}.`)
  return resp.json()
}

export interface PncpContrato {
  idExterno: string
  numeroContrato: string
  objeto: string
  orgaoNome: string
  orgaoUf: string
  orgaoCidade: string
  fornecedor: string
  valorGlobal: number
  vigenciaInicio: string | null
  vigenciaFim: string | null
  dataAssinatura: string | null
}

export interface PncpAta {
  idExterno: string
  numeroAta: string
  objeto: string
  orgaoNome: string
  orgaoUnidade: string
  vigenciaInicio: string | null
  vigenciaFim: string | null
  dataAssinatura: string | null
  possibilidadeAdesao: boolean
  cancelado: boolean
}

export interface PncpExtraResultado<T> {
  itens: T[]
  totalPaginas: number
  totalRegistros: number
  pagina: number
}

function filtrarKw<T extends { objeto: string; orgaoNome: string }>(itens: T[], kw?: string): T[] {
  const q = kw?.trim().toLowerCase()
  if (!q) return itens
  const termos = q.split(/\s+/).filter(Boolean)
  return itens.filter((e) => {
    const alvo = `${e.objeto} ${e.orgaoNome}`.toLowerCase()
    return termos.every((t) => alvo.includes(t))
  })
}

export async function buscarContratosPNCP(params: {
  dataInicial: string
  dataFinal: string
  palavraChave?: string
  pagina?: number
}): Promise<PncpExtraResultado<PncpContrato>> {
  const pagina = params.pagina ?? 1
  const qs = new URLSearchParams({
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    pagina: String(pagina),
    tamanhoPagina: "50",
  })
  const j = await pncpGet(`/contratos?${qs.toString()}`)
  const data: any[] = Array.isArray(j?.data) ? j.data : []
  const itens = filtrarKw(
    data.map((c) => ({
      idExterno: String(c?.numeroControlePNCP ?? ""),
      numeroContrato: String(c?.numeroContratoEmpenho ?? ""),
      objeto: String(c?.objetoContrato ?? "").trim(),
      orgaoNome: String(c?.orgaoEntidade?.razaoSocial ?? "").trim(),
      orgaoUf: String(c?.unidadeOrgao?.ufSigla ?? ""),
      orgaoCidade: String(c?.unidadeOrgao?.municipioNome ?? ""),
      fornecedor: String(c?.nomeRazaoSocialFornecedor ?? "").trim(),
      valorGlobal: Number(c?.valorGlobal ?? 0) || 0,
      vigenciaInicio: isoOrNull(c?.dataVigenciaInicio),
      vigenciaFim: isoOrNull(c?.dataVigenciaFim),
      dataAssinatura: isoOrNull(c?.dataAssinatura),
    })),
    params.palavraChave
  )
  return { itens, totalPaginas: Number(j?.totalPaginas ?? 1) || 1, totalRegistros: Number(j?.totalRegistros ?? itens.length) || 0, pagina }
}

export async function buscarAtasPNCP(params: {
  dataInicial: string
  dataFinal: string
  palavraChave?: string
  pagina?: number
}): Promise<PncpExtraResultado<PncpAta>> {
  const pagina = params.pagina ?? 1
  const qs = new URLSearchParams({
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    pagina: String(pagina),
    tamanhoPagina: "50",
  })
  const j = await pncpGet(`/atas?${qs.toString()}`)
  const data: any[] = Array.isArray(j?.data) ? j.data : []
  const itens = filtrarKw(
    data.map((a) => ({
      idExterno: String(a?.numeroControlePNCPAta ?? ""),
      numeroAta: String(a?.numeroAtaRegistroPreco ?? ""),
      objeto: String(a?.objetoContratacao ?? "").trim(),
      orgaoNome: String(a?.nomeOrgao ?? "").trim(),
      orgaoUnidade: String(a?.nomeUnidadeOrgao ?? "").trim(),
      vigenciaInicio: isoOrNull(a?.vigenciaInicio),
      vigenciaFim: isoOrNull(a?.vigenciaFim),
      dataAssinatura: isoOrNull(a?.dataAssinatura),
      possibilidadeAdesao: !!a?.possibilidadeAdesao,
      cancelado: !!a?.cancelado,
    })),
    params.palavraChave
  )
  return { itens, totalPaginas: Number(j?.totalPaginas ?? 1) || 1, totalRegistros: Number(j?.totalRegistros ?? itens.length) || 0, pagina }
}
