/**
 * Bluesoft Cosmos — consulta de produto por GTIN/EAN (inclui medicamentos).
 * Requer token (env COSMOS_TOKEN). Tem limite de uso — o controle de cota
 * diária é feito na action (lib/actions/consultas.ts).
 * https://api.cosmos.bluesoft.com.br/gtins/{ean}.json
 */

export interface CosmosProduto {
  encontrado: boolean
  nome: string
  marca: string
  detalhe: string
  ncm: string
  imagem: string
}

const NAO_ENCONTRADO: CosmosProduto = { encontrado: false, nome: "", marca: "", detalhe: "", ncm: "", imagem: "" }

/**
 * Consulta o GTIN no Cosmos.
 * - Retorna o produto (encontrado:true) ou NAO_ENCONTRADO (404).
 * - Retorna null se não houver token configurado (integração indisponível).
 * - Lança em 429 (limite da API) para a action sinalizar ao usuário.
 */
export async function consultarGtinCosmos(ean: string): Promise<CosmosProduto | null> {
  const token = process.env.COSMOS_TOKEN
  if (!token) return null

  const digits = (ean || "").replace(/\D/g, "")
  if (digits.length < 8) return NAO_ENCONTRADO

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  let resp: Response
  try {
    resp = await fetch(`https://api.cosmos.bluesoft.com.br/gtins/${digits}.json`, {
      headers: {
        "X-Cosmos-Token": token,
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0 (AppPrimardi)",
      },
      cache: "no-store",
      signal: ctrl.signal,
    })
  } catch {
    clearTimeout(t)
    return null
  }
  clearTimeout(t)

  if (resp.status === 404) return NAO_ENCONTRADO
  if (resp.status === 429) throw new Error("Limite de requisições do Cosmos atingido. Tente mais tarde.")
  if (!resp.ok) return null

  let j: any
  try {
    j = await resp.json()
  } catch {
    return null
  }
  if (!j?.description) return NAO_ENCONTRADO

  return {
    encontrado: true,
    nome: String(j.description).trim(),
    marca: String(j?.brand?.name ?? "").trim(),
    detalhe: String(j?.gpc?.description ?? j?.ncm?.description ?? "").trim(),
    ncm: String(j?.ncm?.code ?? ""),
    imagem: String(j?.thumbnail ?? ""),
  }
}
