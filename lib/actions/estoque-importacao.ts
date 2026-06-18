"use server"



import { prisma } from "@/lib/prisma"

import { getRequesterContext } from "./users"

import { revalidatePath } from "next/cache"

import { unstable_noStore as noStore } from "next/cache"

import { createHash } from "crypto"

import { parseEstoqueSpreadsheet, type EstoqueImportRow } from "@/lib/estoque/import-parser"

import type { Prisma } from "@prisma/client"

import {

  parseLinhasEstoque,

  toLinhasEstoqueJson,

} from "@/lib/compras/json-store"

import type { LinhaEstoqueImportacaoJson } from "@/lib/compras/types"



const BATCH_SIZE = 250



type ProdutoCache = {

  id: number

  codigo: string

  ean: string | null

  estoque: number

}



function produtoUpdateData(row: EstoqueImportRow, estoque: number) {

  const data: Prisma.ProdutoUpdateInput = {

    estoque,

    bloqCompra: row.bloqCompra ?? false,

  }

  if (row.descricao) {

    data.nome = row.descricao

    data.descricao = row.descricao

  }

  if (row.ean) data.ean = row.ean

  if (row.preco != null) data.precoBase = row.preco

  if (row.curva) data.curva = row.curva

  if (row.ufo) data.ufo = row.ufo

  if (row.mediaConsumo != null) data.mediaConsumo = row.mediaConsumo

  if (row.consumoMensal) data.consumoMensal = row.consumoMensal

  if (row.estoqueAte) data.estoqueAte = row.estoqueAte

  if (row.ultimaEntrada) data.ultimaEntrada = row.ultimaEntrada

  if (row.quantidade != null) data.quantidadePedido = row.quantidade

  if (row.sugestao != null) data.sugestaoCompra = row.sugestao

  if (row.compra != null) data.compra = row.compra

  return data

}



function produtoCreateData(empresaId: number, row: EstoqueImportRow, estoque: number): Prisma.ProdutoUncheckedCreateInput {

  const update = produtoUpdateData(row, estoque)

  return {

    empresaId,

    codigo: row.codigo!,

    nome: row.descricao || row.codigo!,

    estoque: estoque,

    bloqCompra: row.bloqCompra ?? false,

    ...(row.descricao ? { descricao: row.descricao } : {}),

    ...(row.ean ? { ean: row.ean } : {}),

    ...(row.preco != null ? { precoBase: row.preco } : {}),

    ...(row.curva ? { curva: row.curva } : {}),

    ...(row.ufo ? { ufo: row.ufo } : {}),

    ...(row.mediaConsumo != null ? { mediaConsumo: row.mediaConsumo } : {}),

    ...(row.consumoMensal ? { consumoMensal: row.consumoMensal as Prisma.InputJsonValue } : {}),

    ...(row.estoqueAte ? { estoqueAte: row.estoqueAte } : {}),

    ...(row.ultimaEntrada ? { ultimaEntrada: row.ultimaEntrada } : {}),

    ...(row.quantidade != null ? { quantidadePedido: row.quantidade } : {}),

    ...(row.sugestao != null ? { sugestaoCompra: row.sugestao } : {}),

    ...(row.compra != null ? { compra: row.compra } : {}),

  }

}



async function buildProdutoCache(empresaId: number) {

  const produtos = await prisma.produto.findMany({

    where: { empresaId },

    select: { id: true, codigo: true, ean: true, estoque: true },

  })

  const byCodigo = new Map<string, ProdutoCache>()

  const byEan = new Map<string, ProdutoCache>()

  for (const p of produtos) {

    byCodigo.set(p.codigo, p)

    if (p.ean) byEan.set(p.ean, p)

  }

  return { byCodigo, byEan }

}



function findInCache(

  row: EstoqueImportRow,

  byCodigo: Map<string, ProdutoCache>,

  byEan: Map<string, ProdutoCache>

) {

  if (row.codigo) {

    const p = byCodigo.get(row.codigo)

    if (p) return p

  }

  if (row.ean) {

    const p = byEan.get(row.ean)

    if (p) return p

  }

  return null

}



function rowToLinhaJson(

  row: EstoqueImportRow,

  status: "OK" | "ERRO",

  extra?: Partial<LinhaEstoqueImportacaoJson>

): LinhaEstoqueImportacaoJson {

  return {

    numeroLinha: row.numeroLinha,

    status,

    dadosOriginais: row.dadosOriginais,

    codigo: row.codigo,

    descricao: row.descricao,

    curva: row.curva,

    preco: row.preco,

    ufo: row.ufo,

    estoque: row.estoque,

    mediaConsumo: row.mediaConsumo,

    consumoMensal: row.consumoMensal ?? null,

    ean: row.ean,

    estoqueAte: row.estoqueAte,

    ultimaEntrada: row.ultimaEntrada?.toISOString() ?? null,

    quantidade: row.quantidade,

    sugestao: row.sugestao,

    compra: row.compra,

    bloqCompra: row.bloqCompra,

    erroMensagem: row.erroMensagem,

    ...extra,

  }

}



export async function getEstoqueImportacoes(requesterId?: number) {

  noStore()

  const ctx = requesterId

    ? await getRequesterContext(requesterId)

    : await getRequesterContext()



  const list = await prisma.estoqueImportacao.findMany({

    where: { empresaId: ctx.empresaId },

    orderBy: { criadoEm: "desc" },

    take: 30,

  })



  return list.map((i) => ({

    ...i,

    criadoEm: i.criadoEm.toISOString(),

    processadoEm: i.processadoEm?.toISOString() ?? null,

  }))

}



export async function getEstoqueImportacaoDetalhe(

  importacaoId: number,

  requesterId?: number,

  page = 1,

  limit = 100

) {

  noStore()

  const ctx = requesterId

    ? await getRequesterContext(requesterId)

    : await getRequesterContext()



  const imp = await prisma.estoqueImportacao.findFirst({

    where: { id: importacaoId, empresaId: ctx.empresaId },

  })

  if (!imp) return null



  const todasLinhas = parseLinhasEstoque(imp.linhas)

  const total = todasLinhas.length

  const slice = todasLinhas.slice((page - 1) * limit, page * limit)



  const produtoIds = [...new Set(slice.filter((l) => l.produtoId).map((l) => l.produtoId!))]

  const produtos = produtoIds.length

    ? await prisma.produto.findMany({

        where: { id: { in: produtoIds } },

        select: { id: true, nome: true, codigo: true },

      })

    : []

  const produtoMap = new Map(produtos.map((p) => [p.id, p]))



  return {

    ...imp,

    criadoEm: imp.criadoEm.toISOString(),

    processadoEm: imp.processadoEm?.toISOString() ?? null,

    linhas: slice.map((l) => ({

      ...l,

      produto: l.produtoId ? produtoMap.get(l.produtoId) ?? null : null,

    })),

    linhasTotal: total,

    page,

    limit,

    totalPages: Math.max(1, Math.ceil(total / limit)),

  }

}



export async function processarImportacaoEstoque(params: {

  nomeArquivo: string

  buffer: Buffer

  requesterId?: number

  nomeAba?: string

}) {

  const ctx = params.requesterId

    ? await getRequesterContext(params.requesterId)

    : await getRequesterContext()



  const hashArquivo = createHash("sha256").update(params.buffer).digest("hex")

  const rows = parseEstoqueSpreadsheet(params.buffer, { nomeAba: params.nomeAba })



  const importacao = await prisma.estoqueImportacao.create({

    data: {

      empresaId: ctx.empresaId,

      nomeArquivo: params.nomeArquivo,

      hashArquivo,

      importadoPorUserId: ctx.userId,

      totalLinhas: rows.length,

      status: "PROCESSANDO",

    },

  })



  let linhasOk = 0

  let linhasErro = 0

  let linhasCriadas = 0

  let linhasAtualizadas = 0

  const linhasJson: LinhaEstoqueImportacaoJson[] = []



  const errorRows = rows.filter((r) => r.erroMensagem)

  const validRows = rows.filter((r) => !r.erroMensagem)



  for (const row of errorRows) {

    linhasJson.push(rowToLinhaJson(row, "ERRO"))

    linhasErro++

  }



  try {

    const { byCodigo, byEan } = await buildProdutoCache(ctx.empresaId)



    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {

      const batch = validRows.slice(i, i + BATCH_SIZE)



      await prisma.$transaction(

        async (tx) => {

          const movsBatch: Prisma.MovimentacaoEstoqueCreateManyInput[] = []

          const now = new Date()



          for (const row of batch) {

            const estoqueNovo = row.estoque ?? 0

            let produto = findInCache(row, byCodigo, byEan)

            let estoqueAntes = 0

            let criado = false



            try {

              if (!produto) {

                if (!row.codigo) throw new Error("Código obrigatório para criar produto")

                const created = await tx.produto.create({

                  data: produtoCreateData(ctx.empresaId, row, estoqueNovo),

                  select: { id: true, codigo: true, ean: true, estoque: true },

                })

                produto = created

                byCodigo.set(created.codigo, created)

                if (created.ean) byEan.set(created.ean, created)

                estoqueAntes = 0

                criado = true

                linhasCriadas++

              } else {

                estoqueAntes = produto.estoque

                const updated = await tx.produto.update({

                  where: { id: produto.id },

                  data: produtoUpdateData(row, estoqueNovo),

                  select: { id: true, codigo: true, ean: true, estoque: true },

                })

                byCodigo.set(updated.codigo, updated)

                if (updated.ean) byEan.set(updated.ean, updated)

                if (produto.ean && produto.ean !== updated.ean) byEan.delete(produto.ean)

                produto = updated

                linhasAtualizadas++

              }



              if (estoqueAntes !== estoqueNovo) {

                movsBatch.push({

                  empresaId: ctx.empresaId,

                  produtoId: produto.id,

                  tipo: "AJUSTE",

                  quantidade: estoqueNovo,

                  estoqueAntes,

                  estoqueDepois: estoqueNovo,

                  descricao: `Importação planilha: ${params.nomeArquivo}`,

                  criadoEm: now,

                })

              }



              linhasJson.push(

                rowToLinhaJson(row, "OK", {

                  produtoId: produto.id,

                  estoqueAntes,

                  estoqueDepois: estoqueNovo,

                })

              )

              linhasOk++

            } catch (rowError: unknown) {

              const msg = rowError instanceof Error ? rowError.message : "Erro ao processar linha"

              if (criado) linhasCriadas--

              else if (produto && !criado) linhasAtualizadas--

              linhasJson.push(rowToLinhaJson(row, "ERRO", { erroMensagem: msg }))

              linhasErro++

            }

          }



          if (movsBatch.length) {

            await tx.movimentacaoEstoque.createMany({ data: movsBatch })

          }

        },

        { timeout: 120_000 }

      )



      await prisma.estoqueImportacao.update({

        where: { id: importacao.id },

        data: {

          linhas: toLinhasEstoqueJson(linhasJson),

          linhasOk,

          linhasErro,

          linhasCriadas,

          linhasAtualizadas,

        },

      })

    }



    const updated = await prisma.estoqueImportacao.update({

      where: { id: importacao.id },

      data: {

        status: "CONCLUIDA",

        linhas: toLinhasEstoqueJson(linhasJson),

        linhasOk,

        linhasErro,

        linhasCriadas,

        linhasAtualizadas,

        processadoEm: new Date(),

      },

    })



    revalidatePath("/estoque")

    revalidatePath("/produtos")



    return {

      ...updated,

      criadoEm: updated.criadoEm.toISOString(),

      processadoEm: updated.processadoEm?.toISOString() ?? null,

    }

  } catch (error: unknown) {

    const msg = error instanceof Error ? error.message : "Erro ao processar importação"

    await prisma.estoqueImportacao.update({

      where: { id: importacao.id },

      data: {

        status: "ERRO",

        mensagemErro: msg,

        linhas: toLinhasEstoqueJson(linhasJson),

        linhasOk,

        linhasErro,

        linhasCriadas,

        linhasAtualizadas,

        processadoEm: new Date(),

      },

    })

    throw new Error(msg)

  }

}


