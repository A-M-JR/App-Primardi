/**
 * Consulta de código de barras (EAN/GTIN) via Open Food Facts (gratuita, sem token).
 * Cobre bem produtos de consumo; medicamentos vêm melhor da base CMED (ver lib/cmed).
 * https://world.openfoodfacts.org/api/v2/product/{ean}.json
 */

export interface EanInfo {
  ean: string
  encontrado: boolean
  nome: string
  marca: string
  quantidade: string
  imagem: string
  fonte: "Open Food Facts"
}

const soDigitos = (s: string) => (s || "").replace(/\D/g, "")

export async function consultarEan(eanRaw: string): Promise<EanInfo> {
  const ean = soDigitos(eanRaw)
  if (ean.length < 8) throw new Error("EAN inválido (mínimo 8 dígitos).")

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  let resp: Response
  try {
    resp = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=product_name,brands,quantity,image_url,code`,
      { headers: { Accept: "application/json", "User-Agent": "AppPrimardi/1.0" }, cache: "no-store", signal: ctrl.signal }
    )
  } catch {
    clearTimeout(t)
    throw new Error("Não foi possível consultar o EAN agora.")
  }
  clearTimeout(t)

  // 404 = produto não está na base do Open Food Facts (ex.: medicamentos).
  // Não é erro: devolvemos "não encontrado" para a consulta seguir (e cruzar com a CMED).
  if (resp.status === 404) {
    return { ean, encontrado: false, nome: "", marca: "", quantidade: "", imagem: "", fonte: "Open Food Facts" }
  }
  if (!resp.ok) throw new Error(`Falha ao consultar EAN (${resp.status}).`)

  const j: any = await resp.json()
  const found = j?.status === 1 && j?.product
  return {
    ean,
    encontrado: !!found,
    nome: found ? (j.product.product_name ?? "") : "",
    marca: found ? (j.product.brands ?? "") : "",
    quantidade: found ? (j.product.quantity ?? "") : "",
    imagem: found ? (j.product.image_url ?? "") : "",
    fonte: "Open Food Facts",
  }
}
