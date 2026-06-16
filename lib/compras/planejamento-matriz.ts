import { parsePrecosFornecedor } from "@/lib/compras/json-store"

export type PrecoFornecedorMatriz = {
  fornecedorId: number
  razaoSocial: string
  preco: number
  estoqueFornecedor: number | null
}

export type MatrizPlanejamentoItem = {
  chave: string
  produtoId: number | null
  ean: string | null
  descricao: string | null
  estoqueAtual: number
  fornecedores: PrecoFornecedorMatriz[]
  melhorFornecedorId: number | null
  melhorPreco: number | null
}

function normalizeEan(ean: string | null | undefined): string | null {
  if (!ean) return null
  const n = ean.replace(/\D/g, "")
  return n.length >= 8 ? n : null
}

function grupoKey(produtoId: number | null, ean: string | null): string {
  if (produtoId) return `p:${produtoId}`
  if (ean) return `e:${ean}`
  return ""
}

type LinhaImport = {
  produtoId: number | null
  produto: {
    id: number
    codigo: string
    nome: string
    ean: string | null
    estoque: number
  } | null
  ean: string | null
  descricao: string | null
  preco: number | null
  estoqueFornecedor: number | null
}

type ImportacaoInput = {
  fornecedorId: number
  fornecedor: { id: number; razaoSocial: string }
  linhas: LinhaImport[]
}

type ProdutoPrecosInput = {
  id: number
  codigo: string
  nome: string
  ean: string | null
  estoque: number
  precosFornecedor: unknown
}

export function montarMatrizFromPrecosProduto(
  produtos: ProdutoPrecosInput[],
  fornecedores: Map<number, { id: number; razaoSocial: string }>
): MatrizPlanejamentoItem[] {
  const resultado: MatrizPlanejamentoItem[] = []

  for (const produto of produtos) {
    const precos = parsePrecosFornecedor(produto.precosFornecedor)
    const fornecedoresLinha: PrecoFornecedorMatriz[] = []

    for (const [fidStr, entry] of Object.entries(precos)) {
      const fornecedorId = parseInt(fidStr, 10)
      const fornecedor = fornecedores.get(fornecedorId)
      if (!fornecedor || entry.preco == null) continue
      fornecedoresLinha.push({
        fornecedorId,
        razaoSocial: fornecedor.razaoSocial,
        preco: entry.preco,
        estoqueFornecedor: entry.estoqueFornecedor ?? null,
      })
    }

    if (!fornecedoresLinha.length) continue
    fornecedoresLinha.sort((a, b) => a.preco - b.preco)
    const melhor = fornecedoresLinha[0]
    const eanNorm = normalizeEan(produto.ean)

    resultado.push({
      chave: `p:${produto.id}`,
      produtoId: produto.id,
      ean: eanNorm,
      descricao: produto.nome,
      estoqueAtual: produto.estoque,
      fornecedores: fornecedoresLinha,
      melhorFornecedorId: melhor.fornecedorId,
      melhorPreco: melhor.preco,
    })
  }

  return resultado.sort((a, b) => (a.descricao ?? "").localeCompare(b.descricao ?? ""))
}

export function montarMatrizFromImportacoes(importacoes: ImportacaoInput[]): MatrizPlanejamentoItem[] {
  type Grupo = {
    produtoId: number | null
    produto: LinhaImport["produto"]
    ean: string | null
    descricao: string | null
    fornecedores: Map<number, PrecoFornecedorMatriz>
  }

  const grupos = new Map<string, Grupo>()

  function upsertPreco(
    produtoId: number | null,
    produto: LinhaImport["produto"],
    ean: string | null,
    descricao: string | null,
    fornecedorId: number,
    fornecedor: { id: number; razaoSocial: string },
    preco: number,
    estoqueFornecedor: number | null
  ) {
    const eanNorm = normalizeEan(ean)
    const key = grupoKey(produtoId, eanNorm)
    if (!key) return

    if (!grupos.has(key)) {
      grupos.set(key, {
        produtoId,
        produto,
        ean: eanNorm,
        descricao,
        fornecedores: new Map(),
      })
    }

    const g = grupos.get(key)!
    if (!g.produto && produto) g.produto = produto
    if (!g.descricao && descricao) g.descricao = descricao
    if (!g.ean && eanNorm) g.ean = eanNorm

    const atual = g.fornecedores.get(fornecedorId)
    if (!atual || preco < atual.preco) {
      g.fornecedores.set(fornecedorId, {
        fornecedorId,
        razaoSocial: fornecedor.razaoSocial,
        preco,
        estoqueFornecedor,
      })
    }
  }

  for (const imp of importacoes) {
    for (const linha of imp.linhas) {
      if (linha.preco === null) continue
      const ean = normalizeEan(linha.ean ?? linha.produto?.ean)
      upsertPreco(
        linha.produtoId,
        linha.produto,
        ean,
        linha.descricao ?? linha.produto?.nome ?? null,
        imp.fornecedorId,
        imp.fornecedor,
        linha.preco,
        linha.estoqueFornecedor
      )
    }
  }

  const produtoPorEan = new Map<string, string>()
  for (const [key, g] of grupos) {
    if (key.startsWith("p:") && g.ean) produtoPorEan.set(g.ean, key)
  }
  for (const [key, g] of [...grupos]) {
    if (!key.startsWith("e:") || !g.ean) continue
    const prodKey = produtoPorEan.get(g.ean)
    if (!prodKey || prodKey === key) continue
    const dest = grupos.get(prodKey)!
    for (const [fid, f] of g.fornecedores) {
      const atual = dest.fornecedores.get(fid)
      if (!atual || f.preco < atual.preco) dest.fornecedores.set(fid, f)
    }
    grupos.delete(key)
  }

  const resultado: MatrizPlanejamentoItem[] = []

  for (const [key, g] of grupos) {
    const fornecedores = Array.from(g.fornecedores.values()).sort((a, b) => a.preco - b.preco)
    if (!fornecedores.length) continue

    const melhor = fornecedores[0]
    resultado.push({
      chave: key,
      produtoId: g.produtoId,
      ean: g.ean,
      descricao: g.descricao,
      estoqueAtual: g.produto?.estoque ?? 0,
      fornecedores,
      melhorFornecedorId: melhor.fornecedorId,
      melhorPreco: melhor.preco,
    })
  }

  return resultado.sort((a, b) =>
    (a.descricao ?? "").localeCompare(b.descricao ?? "")
  )
}
