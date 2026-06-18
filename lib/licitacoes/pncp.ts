/**
 * Integração com o PNCP — Portal Nacional de Contratações Públicas.
 *
 * É a API pública e GRATUITA oficial do governo (Lei 14.133/2021) que agrega
 * editais de todos os entes públicos. Substitui, de forma oficial e sem custo,
 * o que sistemas pagos (ex.: ConLicitação) fazem por assinatura.
 *
 * Endpoint: GET https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao
 *   Obrigatórios: dataInicial, dataFinal (AAAAMMDD), codigoModalidadeContratacao
 *   Opcionais: uf, pagina, tamanhoPagina
 *
 * A API não filtra por palavra-chave no objeto — filtramos em memória.
 * O adapter é defensivo: se a API estiver fora do ar ou mudar o contrato,
 * devolve erro tratável e a tela cai para a entrada manual.
 */

import type { ModalidadeLicitacao } from "@prisma/client"

const PNCP_BASE = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao"

/** Mapa código PNCP → nossa modalidade interna. */
const PNCP_COD_TO_MODALIDADE: Record<number, ModalidadeLicitacao> = {
  1: "LEILAO",
  2: "DIALOGO_COMPETITIVO",
  3: "CONCURSO",
  4: "CONCORRENCIA_ELETRONICA",
  5: "CONCORRENCIA_PRESENCIAL",
  6: "PREGAO_ELETRONICO",
  7: "PREGAO_PRESENCIAL",
  8: "DISPENSA",
  9: "INEXIGIBILIDADE",
  12: "CREDENCIAMENTO",
  13: "LEILAO",
}

/** Opções de modalidade para o seletor de busca (códigos oficiais PNCP). */
export const PNCP_MODALIDADES: { codigo: number; nome: string }[] = [
  { codigo: 6, nome: "Pregão Eletrônico" },
  { codigo: 7, nome: "Pregão Presencial" },
  { codigo: 4, nome: "Concorrência Eletrônica" },
  { codigo: 5, nome: "Concorrência Presencial" },
  { codigo: 8, nome: "Dispensa" },
  { codigo: 9, nome: "Inexigibilidade" },
  { codigo: 12, nome: "Credenciamento" },
  { codigo: 2, nome: "Diálogo Competitivo" },
  { codigo: 3, nome: "Concurso" },
  { codigo: 1, nome: "Leilão" },
]

export const UFS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
]

export interface PncpEdital {
  idExterno: string
  numeroProcesso: string
  numeroEdital: string
  objeto: string
  orgaoNome: string
  orgaoCnpj: string
  orgaoUf: string
  orgaoCidade: string
  modalidade: ModalidadeLicitacao
  modalidadeNome: string
  dataPublicacao: string | null
  dataAbertura: string | null
  dataEncerramento: string | null
  valorEstimado: number
  linkEdital: string
  situacao: string
  anoCompra: number
  sequencialCompra: number
}

/** Item de uma contratação no PNCP. */
export interface PncpItemEdital {
  numeroItem: number
  descricao: string
  quantidade: number
  unidade: string
  precoReferencia: number
}

/** Documento (PDF etc.) de uma contratação no PNCP. */
export interface PncpArquivo {
  titulo: string
  tipo: string
  url: string
  data: string | null
}

export interface BuscarPncpParams {
  uf?: string
  modalidadeCodigo?: number
  dataInicial: string // AAAAMMDD
  dataFinal: string // AAAAMMDD
  palavraChave?: string
  pagina?: number
}

export interface BuscarPncpResultado {
  editais: PncpEdital[]
  totalPaginas: number
  totalRegistros: number
  pagina: number
}

function isoOrNull(v: unknown): string | null {
  if (!v || typeof v !== "string") return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

function mapItem(it: any): PncpEdital {
  const numeroCompra = it?.numeroCompra ?? ""
  const anoCompra = it?.anoCompra ?? ""
  return {
    idExterno: String(it?.numeroControlePNCP ?? `${it?.orgaoEntidade?.cnpj ?? ""}-${anoCompra}-${numeroCompra}`),
    numeroProcesso: String(it?.processo ?? ""),
    numeroEdital: numeroCompra && anoCompra ? `${numeroCompra}/${anoCompra}` : String(numeroCompra || ""),
    objeto: String(it?.objetoCompra ?? "").trim(),
    orgaoNome: String(it?.orgaoEntidade?.razaoSocial ?? "").trim(),
    orgaoCnpj: String(it?.orgaoEntidade?.cnpj ?? ""),
    orgaoUf: String(it?.unidadeOrgao?.ufSigla ?? ""),
    orgaoCidade: String(it?.unidadeOrgao?.municipioNome ?? ""),
    modalidade: PNCP_COD_TO_MODALIDADE[Number(it?.modalidadeId)] ?? "OUTRA",
    modalidadeNome: String(it?.modalidadeNome ?? ""),
    dataPublicacao: isoOrNull(it?.dataPublicacaoPncp),
    dataAbertura: isoOrNull(it?.dataAberturaProposta),
    dataEncerramento: isoOrNull(it?.dataEncerramentoProposta),
    valorEstimado: Number(it?.valorTotalEstimado ?? 0) || 0,
    linkEdital: String(it?.linkSistemaOrigem ?? ""),
    situacao: String(it?.situacaoCompraNome ?? ""),
    anoCompra: Number(it?.anoCompra ?? 0) || 0,
    sequencialCompra: Number(it?.sequencialCompra ?? 0) || 0,
  }
}

/** Busca editais publicados no PNCP. Lança erro tratável em falha de rede/contrato. */
export async function buscarEditaisPNCP(params: BuscarPncpParams): Promise<BuscarPncpResultado> {
  const modalidade = params.modalidadeCodigo ?? 6
  const pagina = params.pagina ?? 1

  const qs = new URLSearchParams({
    dataInicial: params.dataInicial,
    dataFinal: params.dataFinal,
    codigoModalidadeContratacao: String(modalidade),
    pagina: String(pagina),
    tamanhoPagina: "50",
  })
  if (params.uf) qs.set("uf", params.uf)

  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 20000)

  let resp: Response
  try {
    resp = await fetch(`${PNCP_BASE}?${qs.toString()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: ctrl.signal,
    })
  } catch {
    clearTimeout(timeout)
    throw new Error("Não foi possível conectar ao PNCP. Tente novamente ou use a entrada manual.")
  }
  clearTimeout(timeout)

  // 204 = sem resultados no período/UF/modalidade.
  if (resp.status === 204) {
    return { editais: [], totalPaginas: 0, totalRegistros: 0, pagina }
  }
  if (!resp.ok) {
    throw new Error(`PNCP retornou ${resp.status}. Ajuste o período/modalidade e tente de novo.`)
  }

  let json: any
  try {
    json = await resp.json()
  } catch {
    throw new Error("Resposta inválida do PNCP.")
  }

  const data: any[] = Array.isArray(json?.data) ? json.data : []
  let editais = data.map(mapItem)

  const kw = params.palavraChave?.trim().toLowerCase()
  if (kw) {
    const termos = kw.split(/\s+/).filter(Boolean)
    editais = editais.filter((e) => {
      const alvo = `${e.objeto} ${e.orgaoNome}`.toLowerCase()
      return termos.every((t) => alvo.includes(t))
    })
  }

  return {
    editais,
    totalPaginas: Number(json?.totalPaginas ?? 1) || 1,
    totalRegistros: Number(json?.totalRegistros ?? editais.length) || editais.length,
    pagina,
  }
}

// ── Detalhe de uma contratação (itens + arquivos) — base /api/pncp/v1 ──
const PNCP_API = "https://pncp.gov.br/api/pncp/v1"

async function pncpApiGet(path: string): Promise<any> {
  const ctrl = new AbortController()
  const timeout = setTimeout(() => ctrl.abort(), 15000)
  try {
    const resp = await fetch(`${PNCP_API}${path}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: ctrl.signal,
    })
    clearTimeout(timeout)
    if (!resp.ok) return null
    return await resp.json()
  } catch {
    clearTimeout(timeout)
    return null
  }
}

/** Itens de uma contratação. Vazio se indisponível (não quebra a importação). */
export async function buscarItensPNCP(cnpj: string, ano: number, sequencial: number): Promise<PncpItemEdital[]> {
  if (!cnpj || !ano || !sequencial) return []
  const j = await pncpApiGet(`/orgaos/${cnpj}/compras/${ano}/${sequencial}/itens`)
  const arr: any[] = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : []
  return arr.map((it) => ({
    numeroItem: Number(it?.numeroItem ?? 0) || 0,
    descricao: String(it?.descricao ?? "").trim(),
    quantidade: Number(it?.quantidade ?? 0) || 0,
    unidade: String(it?.unidadeMedida ?? "UN").trim() || "UN",
    precoReferencia: Number(it?.valorUnitarioEstimado ?? 0) || 0,
  }))
}

/** Documentos (PDF do edital etc.) de uma contratação. */
export async function buscarArquivosPNCP(cnpj: string, ano: number, sequencial: number): Promise<PncpArquivo[]> {
  if (!cnpj || !ano || !sequencial) return []
  const j = await pncpApiGet(`/orgaos/${cnpj}/compras/${ano}/${sequencial}/arquivos`)
  const arr: any[] = Array.isArray(j) ? j : Array.isArray(j?.data) ? j.data : []
  return arr
    .filter((a) => a?.url || a?.uri)
    .map((a) => ({
      titulo: String(a?.titulo ?? a?.tipoDocumentoNome ?? "Documento"),
      tipo: String(a?.tipoDocumentoNome ?? ""),
      url: String(a?.url ?? a?.uri),
      data: (() => {
        const d = a?.dataPublicacaoPncp
        if (!d || typeof d !== "string") return null
        const dt = new Date(d)
        return isNaN(dt.getTime()) ? null : dt.toISOString()
      })(),
    }))
}
