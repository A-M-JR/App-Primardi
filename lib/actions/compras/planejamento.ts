"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { unstable_noStore as noStore } from "next/cache"
import { revalidatePath } from "next/cache"
import { canManageCompras } from "@/lib/compras/guards"
import { registrarAuditoriaCompra } from "@/lib/compras/auditoria"
import { montarMatrizFromImportacoes, montarMatrizFromPrecosProduto, type PrecoFornecedorMatriz } from "@/lib/compras/planejamento-matriz"
import { calcularMediaConsumo, getCompraConfig } from "@/lib/compras/compra-config"
import { parseLinhasImportacao, parsePrecosFornecedor } from "@/lib/compras/json-store"
import { nextPedidoCompraNumero } from "./pedido-compra-helpers"
import type { ComprasListFiltros } from "@/lib/compras/list-filters"
import { buildCriadoEmFilter } from "@/lib/compras/list-filters"
import type { StatusPlanejamentoCompra } from "@prisma/client"

async function nextPlanejamentoNumero(empresaId: number) {
  const ano = new Date().getFullYear()
  const prefix = `PL-${ano}-`
  const last = await prisma.planejamentoCompra.findFirst({
    where: { empresaId, numero: { startsWith: prefix } },
    orderBy: { numero: "desc" },
  })
  const seq = last ? parseInt(last.numero.split("-").pop() || "0", 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, "0")}`
}

export async function getPlanejamentos(filtros?: ComprasListFiltros, requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const criadoEm = buildCriadoEmFilter(filtros?.dataInicio, filtros?.dataFim)
  const search = filtros?.search?.trim()

  return prisma.planejamentoCompra.findMany({
    where: {
      empresaId: ctx.empresaId,
      ...(filtros?.status ? { status: filtros.status as StatusPlanejamentoCompra } : {}),
      ...(criadoEm ? { criadoEm } : {}),
      ...(search
        ? {
            OR: [
              { numero: { contains: search, mode: "insensitive" } },
              { titulo: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      _count: { select: { itens: true } },
    },
    orderBy: { criadoEm: "desc" },
    take: 50,
  }).then((list) =>
    list.map((p) => ({ ...p, _count: { ...p._count, importacoes: p.importacaoIds.length } }))
  )
}

export async function criarPlanejamento(
  data?: { titulo?: string; diasCobertura?: number },
  requesterId?: number
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")

  const numero = await nextPlanejamentoNumero(ctx.empresaId)
  const planejamento = await prisma.planejamentoCompra.create({
    data: {
      empresaId: ctx.empresaId,
      numero,
      titulo: data?.titulo || `Planejamento ${numero}`,
      diasCobertura: data?.diasCobertura ?? 90,
      criadoPorUserId: ctx.userId,
      status: "RASCUNHO",
    },
  })

  revalidatePath("/compras/planejamentos")
  return planejamento
}

export async function getPlanejamentoById(id: number, requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const planejamento = await prisma.planejamentoCompra.findFirst({
    where: { id, empresaId: ctx.empresaId },
    include: {
      cotacao: {
        select: {
          id: true,
          numero: true,
          status: true,
          fornecedores: {
            select: {
              id: true,
              fornecedorId: true,
              status: true,
              fornecedor: { select: { id: true, razaoSocial: true } },
            },
          },
        },
      },
      pedidosCompra: {
        select: {
          id: true,
          numero: true,
          status: true,
          totalGeral: true,
          fornecedor: { select: { id: true, razaoSocial: true } },
        },
        orderBy: { criadoEm: "desc" },
      },
      _count: { select: { itens: true } },
    },
  })

  if (!planejamento) return null

  const importacoes = planejamento.importacaoIds.length
    ? await prisma.fornecedorImportacao.findMany({
        where: { id: { in: planejamento.importacaoIds }, empresaId: ctx.empresaId },
        include: { fornecedor: { select: { id: true, razaoSocial: true } } },
        orderBy: { criadoEm: "desc" },
      })
    : []

  const [itensMarcados, itensElegiveis] = await Promise.all([
    prisma.planejamentoCompraItem.count({
      where: { planejamentoId: id, incluir: true },
    }),
    prisma.planejamentoCompraItem.count({
      where: {
        planejamentoId: id,
        incluir: true,
        produtoId: { not: null },
        qtdNecessaria: { gt: 0 },
      },
    }),
  ])

  const { pedidosCompra, ...rest } = planejamento

  return {
    ...rest,
    pedidos: pedidosCompra,
    importacoes: importacoes.map((importacao) => ({
      importacao: {
        ...importacao,
        linhasCount: parseLinhasImportacao(importacao.linhas).length,
      },
    })),
    itensIncluidos: itensElegiveis,
    itensMarcados,
  }
}

const LIMITES_PAGINA = [20, 40, 60, 100] as const

function normalizarLimite(limit?: number) {
  return LIMITES_PAGINA.includes(limit as (typeof LIMITES_PAGINA)[number]) ? limit! : 20
}

export async function getPlanejamentoItens(
  planejamentoId: number,
  params: {
    page?: number
    limit?: number
    search?: string
    soIncluidos?: boolean
  } = {},
  requesterId?: number
) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const plan = await prisma.planejamentoCompra.findFirst({
    where: { id: planejamentoId, empresaId: ctx.empresaId },
    select: { id: true },
  })
  if (!plan) return null

  const page = Math.max(1, params.page ?? 1)
  const limit = normalizarLimite(params.limit)
  const search = params.search?.trim()

  const where = {
    planejamentoId,
    ...(params.soIncluidos ? { incluir: true } : {}),
    ...(search
      ? {
          OR: [
            { produto: { nome: { contains: search, mode: "insensitive" as const } } },
            { produto: { codigo: { contains: search, mode: "insensitive" as const } } },
            { ean: { contains: search } },
            { descricao: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  }

  const [itens, total] = await Promise.all([
    prisma.planejamentoCompraItem.findMany({
      where,
      include: {
        produto: { select: { id: true, codigo: true, nome: true, ean: true } },
        fornecedorEscolhido: { select: { id: true, razaoSocial: true } },
        melhorFornecedor: { select: { id: true, razaoSocial: true } },
      },
      orderBy: [{ incluir: "desc" }, { qtdNecessaria: "desc" }, { id: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.planejamentoCompraItem.count({ where }),
  ])

  return {
    itens: itens.map((item) => ({
      ...item,
      precos: (item.precosJson as PrecoFornecedorMatriz[] | null) ?? [],
    })),
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

async function assertPlanejamentoEditavel(planejamentoId: number, empresaId: number) {
  const p = await prisma.planejamentoCompra.findFirst({
    where: { id: planejamentoId, empresaId },
  })
  if (!p) throw new Error("Planejamento não encontrado.")
  if (p.status === "CONVERTIDO" || p.status === "CANCELADO") {
    throw new Error("Planejamento bloqueado para edição.")
  }
  return p
}

export async function finalizarPlanejamento(planejamentoId: number, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")
  await assertPlanejamentoEditavel(planejamentoId, ctx.empresaId)

  return prisma.planejamentoCompra.update({
    where: { id: planejamentoId },
    data: { status: "FINALIZADO" },
  })
}

export async function atualizarPlanejamento(
  planejamentoId: number,
  data: {
    titulo?: string
    diasCobertura?: number
    observacoes?: string
  },
  requesterId?: number
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")
  await assertPlanejamentoEditavel(planejamentoId, ctx.empresaId)

  const updated = await prisma.planejamentoCompra.update({
    where: { id: planejamentoId },
    data,
  })

  revalidatePath(`/compras/planejamentos/${planejamentoId}`)
  return updated
}

export async function vincularImportacao(
  planejamentoId: number,
  importacaoId: number,
  requesterId?: number
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")
  await assertPlanejamentoEditavel(planejamentoId, ctx.empresaId)

  const imp = await prisma.fornecedorImportacao.findFirst({
    where: { id: importacaoId, empresaId: ctx.empresaId },
  })
  if (!imp) throw new Error("Importação não encontrada.")
  if (imp.status !== "CONCLUIDA") throw new Error("Importação precisa estar concluída.")

  const planejamento = await prisma.planejamentoCompra.findFirst({
    where: { id: planejamentoId, empresaId: ctx.empresaId },
  })
  if (!planejamento) throw new Error("Planejamento não encontrado.")

  if (!planejamento.importacaoIds.includes(importacaoId)) {
    await prisma.planejamentoCompra.update({
      where: { id: planejamentoId },
      data: { importacaoIds: [...planejamento.importacaoIds, importacaoId] },
    })
  }

  await sincronizarMatriz(planejamentoId, ctx.userId)
  revalidatePath(`/compras/planejamentos/${planejamentoId}`)
  return { ok: true }
}

export async function vincularImportacoesAoPlanejamento(
  planejamentoId: number,
  importacaoIds: number[],
  requesterId?: number
) {
  for (const importacaoId of importacaoIds) {
    await vincularImportacao(planejamentoId, importacaoId, requesterId)
  }
}

export async function desvincularImportacao(
  planejamentoId: number,
  importacaoId: number,
  requesterId?: number
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")
  await assertPlanejamentoEditavel(planejamentoId, ctx.empresaId)

  const planejamento = await prisma.planejamentoCompra.findFirst({
    where: { id: planejamentoId, empresaId: ctx.empresaId },
  })
  if (!planejamento) throw new Error("Planejamento não encontrado.")

  await prisma.planejamentoCompra.update({
    where: { id: planejamentoId },
    data: {
      importacaoIds: planejamento.importacaoIds.filter((id) => id !== importacaoId),
    },
  })

  await sincronizarMatriz(planejamentoId, ctx.userId)
  revalidatePath(`/compras/planejamentos/${planejamentoId}`)
  return { ok: true }
}

export async function sincronizarMatriz(planejamentoId: number, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const planejamento = await prisma.planejamentoCompra.findFirst({
    where: { id: planejamentoId, empresaId: ctx.empresaId },
    include: { itens: true },
  })

  if (!planejamento) throw new Error("Planejamento não encontrado.")

  const importacoesDb = planejamento.importacaoIds.length
    ? await prisma.fornecedorImportacao.findMany({
        where: { id: { in: planejamento.importacaoIds }, empresaId: ctx.empresaId },
        include: { fornecedor: { select: { id: true, razaoSocial: true } } },
      })
    : []

  const fornecedorMap = new Map(
    importacoesDb.map((imp) => [imp.fornecedorId, imp.fornecedor])
  )

  const produtoIds = new Set<number>()
  const eans = new Set<string>()
  for (const imp of importacoesDb) {
    for (const l of parseLinhasImportacao(imp.linhas)) {
      if (l.produtoId) produtoIds.add(l.produtoId)
      const ean = l.ean?.replace(/\D/g, "")
      if (ean && ean.length >= 8) eans.add(ean)
    }
  }

  const [produtosById, produtosComEan] = await Promise.all([
    produtoIds.size
      ? prisma.produto.findMany({
          where: { id: { in: [...produtoIds] }, empresaId: ctx.empresaId },
          select: { id: true, codigo: true, nome: true, ean: true, estoque: true },
        })
      : Promise.resolve([]),
    eans.size
      ? prisma.produto.findMany({
          where: { empresaId: ctx.empresaId, ativo: true, ean: { not: null } },
          select: { id: true, codigo: true, nome: true, ean: true, estoque: true },
        })
      : Promise.resolve([]),
  ])

  const produtoMap = new Map(produtosById.map((p) => [p.id, p]))
  const eanMap = new Map<string, (typeof produtosComEan)[0]>()
  for (const p of produtosComEan) {
    const norm = p.ean?.replace(/\D/g, "")
    if (norm && norm.length >= 8 && eans.has(norm)) eanMap.set(norm, p)
  }

  function resolveProduto(l: { produtoId?: number | null; ean?: string | null }) {
    if (l.produtoId) return produtoMap.get(l.produtoId) ?? null
    const ean = l.ean?.replace(/\D/g, "")
    if (ean && ean.length >= 8) return eanMap.get(ean) ?? null
    return null
  }

  const importacoes = importacoesDb.map((imp) => ({
    fornecedorId: imp.fornecedorId,
    fornecedor: imp.fornecedor,
    linhas: parseLinhasImportacao(imp.linhas)
      .filter((l) => l.preco != null && (l.status === "VALIDA" || l.status === "VINCULADA"))
      .map((l) => {
        const produto = resolveProduto(l)
        return {
          produtoId: l.produtoId ?? produto?.id ?? null,
          produto,
          ean: l.ean ?? null,
          descricao: l.descricao ?? null,
          preco: l.preco ?? null,
          estoqueFornecedor: l.estoqueFornecedor ?? null,
        }
      }),
  }))

  let matriz = montarMatrizFromImportacoes(importacoes)

  if (!matriz.length && fornecedorMap.size > 0) {
    const fornecedorIds = [...fornecedorMap.keys()]
    const produtosComPrecos = await prisma.produto.findMany({
      where: { empresaId: ctx.empresaId, ativo: true },
      select: {
        id: true,
        codigo: true,
        nome: true,
        ean: true,
        estoque: true,
        precosFornecedor: true,
      },
    })
    const filtrados = produtosComPrecos.filter((p) => {
      const precos = parsePrecosFornecedor(p.precosFornecedor)
      return fornecedorIds.some((fid) => precos[String(fid)]?.preco != null)
    })
    if (filtrados.length) {
      matriz = montarMatrizFromPrecosProduto(filtrados, fornecedorMap)
    }
  }

  const importsSemDados = importacoesDb.filter(
    (imp) => imp.totalLinhas > 0 && parseLinhasImportacao(imp.linhas).length === 0
  )
  if (!matriz.length && importsSemDados.length) {
    throw new Error(
      `Planilha(s) sem dados salvos (${importsSemDados.map((i) => i.nomeArquivo).join(", ")}). Faça upload novamente das planilhas de preço dos fornecedores.`
    )
  }
  const existentes = new Map(planejamento.itens.map((i) => [i.chave, i]))

  for (const row of matriz) {
    const atual = existentes.get(row.chave)
    const precosJson = row.fornecedores

    if (atual) {
      const fornecedorId = atual.fornecedorEscolhidoId ?? row.melhorFornecedorId
      const precoEscolhido =
        precosJson.find((p) => p.fornecedorId === fornecedorId)?.preco ?? row.melhorPreco

      await prisma.planejamentoCompraItem.update({
        where: { id: atual.id },
        data: {
          produtoId: row.produtoId,
          ean: row.ean,
          descricao: row.descricao ?? atual.descricao,
          estoqueAtual: row.estoqueAtual,
          melhorFornecedorId: row.melhorFornecedorId,
          precoUnitario: precoEscolhido,
          precosJson,
        },
      })
      existentes.delete(row.chave)
    } else {
      await prisma.planejamentoCompraItem.create({
        data: {
          planejamentoId,
          chave: row.chave,
          produtoId: row.produtoId,
          ean: row.ean,
          descricao: row.descricao,
          estoqueAtual: row.estoqueAtual,
          melhorFornecedorId: row.melhorFornecedorId,
          fornecedorEscolhidoId: row.melhorFornecedorId,
          precoUnitario: row.melhorPreco,
          precosJson,
          incluir: false,
          qtdNecessaria: 0,
        },
      })
    }
  }

  if (existentes.size) {
    await prisma.planejamentoCompraItem.deleteMany({
      where: { id: { in: [...existentes.values()].map((i) => i.id) } },
    })
  }

  if (planejamento.status === "RASCUNHO" && matriz.length) {
    await prisma.planejamentoCompra.update({
      where: { id: planejamentoId },
      data: { status: "EM_ANALISE" },
    })
  }

  revalidatePath(`/compras/planejamentos/${planejamentoId}`)
  return { total: matriz.length }
}

export async function calcularNecessidade(planejamentoId: number, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")

  const planejamento = await assertPlanejamentoEditavel(planejamentoId, ctx.empresaId)
  const config = await getCompraConfig(ctx.userId)

  const itens = await prisma.planejamentoCompraItem.findMany({
    where: { planejamentoId },
    include: { produto: { select: { id: true, estoque: true, mediaConsumo: true } } },
  })

  for (const item of itens) {
    if (!item.produtoId) continue

    let media = item.mediaConsumo > 0 ? item.mediaConsumo : (item.produto?.mediaConsumo ?? null)
    if (media == null || media === 0) {
      media = await calcularMediaConsumo(item.produtoId, config, ctx.empresaId)
    }

    const estoque = item.produto?.estoque ?? item.estoqueAtual
    const qtd = Math.max(0, media * planejamento.diasCobertura - estoque)

    await prisma.planejamentoCompraItem.update({
      where: { id: item.id },
      data: {
        mediaConsumo: media,
        estoqueAtual: estoque,
        qtdNecessaria: qtd,
        incluir: qtd > 0,
      },
    })
  }

  revalidatePath(`/compras/planejamentos/${planejamentoId}`)
  return { ok: true }
}

export async function ajustarPlanejamentoItem(
  itemId: number,
  data: {
    qtdNecessaria?: number
    incluir?: boolean
    fornecedorEscolhidoId?: number | null
  },
  requesterId?: number
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const item = await prisma.planejamentoCompraItem.findFirst({
    where: { id: itemId },
    include: { planejamento: true },
  })
  if (!item || item.planejamento.empresaId !== ctx.empresaId) {
    throw new Error("Item não encontrado.")
  }
  await assertPlanejamentoEditavel(item.planejamentoId, ctx.empresaId)

  let qtdNecessaria = data.qtdNecessaria
  if (data.incluir === true && qtdNecessaria === undefined && item.qtdNecessaria <= 0) {
    qtdNecessaria = 1
  }

  let precoUnitario = item.precoUnitario
  if (data.fornecedorEscolhidoId !== undefined) {
    const precos = (item.precosJson as PrecoFornecedorMatriz[] | null) ?? []
    precoUnitario =
      precos.find((p) => p.fornecedorId === data.fornecedorEscolhidoId)?.preco ?? precoUnitario
  }

  return prisma.planejamentoCompraItem.update({
    where: { id: itemId },
    data: {
      ...data,
      ...(qtdNecessaria !== undefined ? { qtdNecessaria } : {}),
      precoUnitario,
    },
  })
}

export async function gerarPedidosFromPlanejamento(planejamentoId: number, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")
  await assertPlanejamentoEditavel(planejamentoId, ctx.empresaId)

  const itens = await prisma.planejamentoCompraItem.findMany({
    where: {
      planejamentoId,
      incluir: true,
      qtdNecessaria: { gt: 0 },
      produtoId: { not: null },
    },
    include: { produto: true },
  })

  if (!itens.length) throw new Error("Nenhum item marcado para compra.")

  const porFornecedor = new Map<number, typeof itens>()
  for (const item of itens) {
    const fid = item.fornecedorEscolhidoId ?? item.melhorFornecedorId
    if (!fid) continue
    const list = porFornecedor.get(fid) ?? []
    list.push(item)
    porFornecedor.set(fid, list)
  }

  if (!porFornecedor.size) throw new Error("Itens sem fornecedor escolhido.")

  const pedidos = []

  for (const [fornecedorId, grupo] of porFornecedor) {
    const numero = await nextPedidoCompraNumero(ctx.empresaId)
    let total = 0
    const itensData = grupo.map((item) => {
      const preco = item.precoUnitario ?? 0
      const qtd = item.qtdNecessaria
      const itemTotal = preco * qtd
      total += itemTotal
      return {
        produtoId: item.produtoId!,
        descricao: item.produto?.nome ?? item.descricao ?? "Produto",
        quantidade: qtd,
        precoUnitario: preco,
        total: itemTotal,
      }
    })

    const pedido = await prisma.pedidoCompra.create({
      data: {
        empresaId: ctx.empresaId,
        fornecedorId,
        planejamentoId,
        numero,
        status: "RASCUNHO",
        totalGeral: total,
        geradoPorUserId: ctx.userId,
        itens: { create: itensData },
      },
      include: { fornecedor: true, itens: true },
    })

    await registrarAuditoriaCompra({
      empresaId: ctx.empresaId,
      userId: ctx.userId,
      acao: "GERAR_PEDIDO",
      entidade: "PedidoCompra",
      entidadeId: pedido.id,
      detalhes: { planejamentoId, fornecedorId },
    })

    pedidos.push(pedido)
  }

  await prisma.planejamentoCompra.update({
    where: { id: planejamentoId },
    data: { status: "CONVERTIDO" },
  })

  revalidatePath("/compras/pedidos")
  revalidatePath(`/compras/planejamentos/${planejamentoId}`)
  return pedidos
}

export async function getImportacoesDisponiveis(planejamentoId: number, requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const planejamento = await prisma.planejamentoCompra.findFirst({
    where: { id: planejamentoId, empresaId: ctx.empresaId },
    select: { importacaoIds: true },
  })
  const idsVinculados = new Set(planejamento?.importacaoIds ?? [])

  const importacoes = await prisma.fornecedorImportacao.findMany({
    where: { empresaId: ctx.empresaId, status: "CONCLUIDA" },
    include: { fornecedor: { select: { id: true, razaoSocial: true } } },
    orderBy: { criadoEm: "desc" },
    take: 50,
  })

  return importacoes.map((imp) => ({
    ...imp,
    vinculada: idsVinculados.has(imp.id),
  }))
}
