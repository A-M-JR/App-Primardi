import { normalizeText } from "./normalize-text"

export function matchFornecedorByNome(
  nomePlanilha: string,
  fornecedores: { id: number; razaoSocial: string }[]
): { id: number; razaoSocial: string } | null {
  const alvo = normalizeText(nomePlanilha)
  if (!alvo) return null

  const exact = fornecedores.find((f) => normalizeText(f.razaoSocial) === alvo)
  if (exact) return exact

  const contains = fornecedores.find((f) => {
    const n = normalizeText(f.razaoSocial)
    return n.includes(alvo) || alvo.includes(n)
  })
  if (contains) return contains

  // palavras-chave: "DIST ALZIRA" → bate se razaoSocial contém "ALZIRA"
  const tokens = alvo.split(" ").filter((t) => t.length >= 4)
  for (const token of tokens) {
    const hit = fornecedores.find((f) => normalizeText(f.razaoSocial).includes(token))
    if (hit) return hit
  }

  return null
}
