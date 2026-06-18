/**
 * Consulta de CNPJ — gratuita, com FALLBACK entre provedores públicos.
 *
 * A BrasilAPI limita requisições e às vezes devolve 403/429 sob carga. Para não
 * quebrar, tentamos em ordem: BrasilAPI → minhareceita.org (mesmo schema) →
 * publica.cnpj.ws (schema aninhado). O primeiro que responder 200 vence.
 */

export interface CnpjInfo {
  cnpj: string
  razaoSocial: string
  nomeFantasia: string
  situacao: string
  uf: string
  municipio: string
  cep: string
  logradouro: string
  numero: string
  bairro: string
  complemento: string
  telefone: string
  email: string
  atividade: string
  fonte: string
}

const soDigitos = (s: string) => (s || "").replace(/\D/g, "")
const UA = "Mozilla/5.0 (compatible; AppPrimardi/1.0)"

/** Schema "plano" da BrasilAPI / minhareceita.org. */
function mapFlat(j: any, cnpj: string, fonte: string): CnpjInfo {
  return {
    cnpj,
    razaoSocial: j?.razao_social ?? "",
    nomeFantasia: j?.nome_fantasia ?? "",
    situacao: j?.descricao_situacao_cadastral ?? "",
    uf: j?.uf ?? "",
    municipio: j?.municipio ?? "",
    cep: j?.cep ?? "",
    logradouro: j?.logradouro ?? "",
    numero: j?.numero ?? "",
    bairro: j?.bairro ?? "",
    complemento: j?.complemento ?? "",
    telefone: j?.ddd_telefone_1 ?? "",
    email: j?.email ?? "",
    atividade: j?.cnae_fiscal_descricao ?? "",
    fonte,
  }
}

/** Schema aninhado do publica.cnpj.ws. */
function mapCnpjWs(j: any, cnpj: string): CnpjInfo {
  const est = j?.estabelecimento ?? {}
  const tel = est?.ddd1 && est?.telefone1 ? `${est.ddd1}${est.telefone1}` : ""
  return {
    cnpj,
    razaoSocial: j?.razao_social ?? "",
    nomeFantasia: est?.nome_fantasia ?? "",
    situacao: est?.situacao_cadastral ?? "",
    uf: est?.estado?.sigla ?? "",
    municipio: est?.cidade?.nome ?? "",
    cep: est?.cep ?? "",
    logradouro: est?.logradouro ?? "",
    numero: est?.numero ?? "",
    bairro: est?.bairro ?? "",
    complemento: est?.complemento ?? "",
    telefone: tel,
    email: est?.email ?? "",
    atividade: est?.atividade_principal?.descricao ?? "",
    fonte: "publica.cnpj.ws",
  }
}

interface Provider {
  fonte: string
  url: (cnpj: string) => string
  map: (j: any, cnpj: string) => CnpjInfo
}

const PROVIDERS: Provider[] = [
  { fonte: "BrasilAPI", url: (c) => `https://brasilapi.com.br/api/cnpj/v1/${c}`, map: (j, c) => mapFlat(j, c, "BrasilAPI") },
  { fonte: "minhareceita.org", url: (c) => `https://minhareceita.org/${c}`, map: (j, c) => mapFlat(j, c, "minhareceita.org") },
  { fonte: "publica.cnpj.ws", url: (c) => `https://publica.cnpj.ws/cnpj/${c}`, map: mapCnpjWs },
]

export async function consultarCnpj(cnpjRaw: string): Promise<CnpjInfo> {
  const cnpj = soDigitos(cnpjRaw)
  if (cnpj.length !== 14) throw new Error("CNPJ inválido (precisa de 14 dígitos).")

  let achouNaoEncontrado = false

  for (const p of PROVIDERS) {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 12000)
    try {
      const resp = await fetch(p.url(cnpj), {
        headers: { Accept: "application/json", "User-Agent": UA },
        cache: "no-store",
        signal: ctrl.signal,
      })
      clearTimeout(t)

      if (resp.ok) {
        const j = await resp.json()
        return p.map(j, cnpj)
      }
      if (resp.status === 404) {
        achouNaoEncontrado = true // pode ser que outro provedor tenha; continua
        continue
      }
      // 403/429/5xx → tenta o próximo provedor
    } catch {
      clearTimeout(t)
      // rede/timeout → tenta o próximo provedor
    }
  }

  if (achouNaoEncontrado) throw new Error("CNPJ não encontrado.")
  throw new Error("Serviços de CNPJ indisponíveis no momento. Tente novamente em instantes.")
}
