"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { unstable_noStore as noStore } from "next/cache"
import { revalidatePath } from "next/cache"
import { createHash } from "crypto"
import { readFile, mkdir, writeFile } from "fs/promises"
import path from "path"
import {
  mapRowToFields,
  parseImportFile,
  buildAutoImportConfig,
  type ImportConfigInput,
  type MappedLine,
} from "@/lib/compras/import-parser"
import { matchFornecedorByNome } from "@/lib/compras/match-fornecedor"
import { assertImportacaoEditavel, canManageCompras } from "@/lib/compras/guards"
import { registrarAuditoriaCompra } from "@/lib/compras/auditoria"
import { executarMatchImportacao } from "./produto-match"
import { consolidarPrecosImportacao } from "./precos"
import { parseImportConfig, parseLinhasImportacao, mappedLineToImportJson, toLinhasImportJson } from "@/lib/compras/json-store"
import type { LinhaImportacaoFornecedorJson } from "@/lib/compras/types"
import type { ComprasListFiltros } from "@/lib/compras/list-filters"
import { buildCriadoEmFilter } from "@/lib/compras/list-filters"
import type { StatusImportacao } from "@prisma/client"

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "compras")

async function ensureUploadDir(empresaId: number) {
  const dir = path.join(UPLOAD_DIR, String(empresaId))
  await mkdir(dir, { recursive: true })
  return dir
}

async function getConfigInput(fornecedorId: number, empresaId: number): Promise<ImportConfigInput> {
  const fornecedor = await prisma.fornecedor.findFirst({
    where: { id: fornecedorId, empresaId },
    select: { importConfig: true },
  })
  const config = parseImportConfig(fornecedor?.importConfig)
  if (!config) throw new Error("Configure a importação do fornecedor primeiro.")
  return {
    tipoArquivo: config.tipoArquivo,
    nomeAba: config.nomeAba,
    linhaCabecalho: config.linhaCabecalho,
    linhaInicioDados: config.linhaInicioDados,
    delimitadorCsv: config.delimitadorCsv,
    encoding: config.encoding,
    campos: config.campos,
  }
}

export async function getImportacoes(filtros?: ComprasListFiltros, requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const criadoEm = buildCriadoEmFilter(filtros?.dataInicio, filtros?.dataFim)
  const search = filtros?.search?.trim()

  return prisma.fornecedorImportacao.findMany({
    where: {
      empresaId: ctx.empresaId,
      ...(filtros?.fornecedorId ? { fornecedorId: filtros.fornecedorId } : {}),
      ...(filtros?.status ? { status: filtros.status as StatusImportacao } : {}),
      ...(criadoEm ? { criadoEm } : {}),
      ...(search
        ? {
            OR: [
              { nomeArquivo: { contains: search, mode: "insensitive" } },
              { fornecedor: { razaoSocial: { contains: search, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      fornecedor: { select: { id: true, razaoSocial: true } },
    },
    orderBy: { criadoEm: "desc" },
    take: 50,
  })
}

export async function getImportacaoDetalhe(
  importacaoId: number,
  requesterId?: number,
  page = 1,
  limit = 100
) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const imp = await prisma.fornecedorImportacao.findFirst({
    where: { id: importacaoId, empresaId: ctx.empresaId },
    include: { fornecedor: true },
  })
  if (!imp) return null

  const todasLinhas = parseLinhasImportacao(imp.linhas)
  const total = todasLinhas.length
  const slice = todasLinhas.slice((page - 1) * limit, page * limit)

  const produtoIds = [...new Set(slice.filter((l) => l.produtoId).map((l) => l.produtoId!))]
  const produtos = produtoIds.length
    ? await prisma.produto.findMany({
        where: { id: { in: produtoIds } },
        select: { id: true, codigo: true, nome: true },
      })
    : []
  const produtoMap = new Map(produtos.map((p) => [p.id, p]))

  const linhas = slice.map((l) => ({
    ...l,
    produto: l.produtoId ? produtoMap.get(l.produtoId) ?? null : null,
  }))

  const config = parseImportConfig(
    (
      await prisma.fornecedor.findFirst({
        where: { id: imp.fornecedorId },
        select: { importConfig: true },
      })
    )?.importConfig
  )

  return {
    ...imp,
    config,
    linhas,
    linhasTotal: total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  }
}

export async function criarImportacaoFromUpload(params: {
  fornecedorId: number
  nomeArquivo: string
  buffer: Buffer
  requesterId?: number
}) {
  const ctx = params.requesterId
    ? await getRequesterContext(params.requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")

  await getConfigInput(params.fornecedorId, ctx.empresaId)

  const hash = createHash("sha256").update(params.buffer).digest("hex")
  const dir = await ensureUploadDir(ctx.empresaId)
  const filePath = path.join(dir, `${Date.now()}_${params.nomeArquivo}`)
  await writeFile(filePath, params.buffer)

  const importacao = await prisma.fornecedorImportacao.create({
    data: {
      empresaId: ctx.empresaId,
      fornecedorId: params.fornecedorId,
      nomeArquivo: params.nomeArquivo,
      hashArquivo: hash,
      importadoPorUserId: ctx.userId,
      status: "RASCUNHO",
    },
  })

  await registrarAuditoriaCompra({
    empresaId: ctx.empresaId,
    userId: ctx.userId,
    acao: "IMPORTAR",
    entidade: "FornecedorImportacao",
    entidadeId: importacao.id,
    detalhes: { nomeArquivo: params.nomeArquivo, filePath },
  })

  await processarImportacao(importacao.id, ctx.userId, filePath)
  return importacao
}

async function salvarLinhasImportacao(importacaoId: number, mappedLines: MappedLine[]) {
  const linhas: LinhaImportacaoFornecedorJson[] = mappedLines.map(mappedLineToImportJson)
  let validas = 0
  let erros = 0
  for (const l of linhas) {
    if (l.status === "ERRO") erros++
    else validas++
  }

  await prisma.fornecedorImportacao.update({
    where: { id: importacaoId },
    data: {
      status: "CONCLUIDA",
      linhas: toLinhasImportJson(linhas),
      totalLinhas: mappedLines.length,
      linhasValidas: validas,
      linhasErro: erros,
      processadoEm: new Date(),
    },
  })

  return { totalLinhas: mappedLines.length, validas, erros }
}

export async function criarImportacaoMultiFornecedor(params: {
  nomeArquivo: string
  buffer: Buffer
  requesterId?: number
  nomeAba?: string
}) {
  const ctx = params.requesterId
    ? await getRequesterContext(params.requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")

  const configInput = buildAutoImportConfig(params.buffer, { nomeAba: params.nomeAba })
  if (!configInput.campos.some((c) => c.campo === "FORNECEDOR")) {
    throw new Error('Coluna "FORNECEDOR" não encontrada. Use modo multi-fornecedor só nesse layout.')
  }

  const fornecedores = await prisma.fornecedor.findMany({
    where: { empresaId: ctx.empresaId, ativo: true },
  })
  if (!fornecedores.length) throw new Error("Cadastre fornecedores antes de importar.")

  const hash = createHash("sha256").update(params.buffer).digest("hex")
  const dir = await ensureUploadDir(ctx.empresaId)
  const filePath = path.join(dir, `${Date.now()}_${params.nomeArquivo}`)
  await writeFile(filePath, params.buffer)

  const rows = parseImportFile(params.buffer, configInput)
  const mappedAll = rows.map((row) => mapRowToFields(row, configInput))

  const porFornecedor = new Map<string, MappedLine[]>()
  const semFornecedor: MappedLine[] = []

  for (const line of mappedAll) {
    const nome = line.fornecedorNome?.trim()
    if (!nome) {
      semFornecedor.push({ ...line, erroMensagem: "Fornecedor ausente na linha" })
      continue
    }
    const list = porFornecedor.get(nome) ?? []
    list.push(line)
    porFornecedor.set(nome, list)
  }

  const resultados: {
    fornecedor: string
    fornecedorId?: number
    importacaoId?: number
    linhas: number
    erro?: string
  }[] = []

  for (const [nomePlanilha, linhas] of porFornecedor) {
    const fornecedor = matchFornecedorByNome(nomePlanilha, fornecedores)
    if (!fornecedor) {
      resultados.push({
        fornecedor: nomePlanilha,
        linhas: linhas.length,
        erro: `Fornecedor "${nomePlanilha}" não encontrado no cadastro`,
      })
      continue
    }

    const importacao = await prisma.fornecedorImportacao.create({
      data: {
        empresaId: ctx.empresaId,
        fornecedorId: fornecedor.id,
        nomeArquivo: `${params.nomeArquivo} [${nomePlanilha}]`,
        hashArquivo: hash,
        importadoPorUserId: ctx.userId,
        status: "PROCESSANDO",
      },
    })

    const stats = await salvarLinhasImportacao(importacao.id, linhas)
    await executarMatchImportacao(importacao.id, ctx.userId)
    await consolidarPrecosImportacao(importacao.id, ctx.userId)

    await registrarAuditoriaCompra({
      empresaId: ctx.empresaId,
      userId: ctx.userId,
      acao: "IMPORTAR",
      entidade: "FornecedorImportacao",
      entidadeId: importacao.id,
      detalhes: { multiFornecedor: true, nomePlanilha, filePath, ...stats },
    })

    resultados.push({
      fornecedor: fornecedor.razaoSocial,
      fornecedorId: fornecedor.id,
      importacaoId: importacao.id,
      linhas: linhas.length,
    })
  }

  if (semFornecedor.length) {
    resultados.push({
      fornecedor: "(sem fornecedor)",
      linhas: semFornecedor.length,
      erro: "Linhas ignoradas — coluna FORNECEDOR vazia",
    })
  }

  revalidatePath("/compras/importacoes")

  return { resultados, abasDetectadas: configInput.nomeAba, colunas: configInput.campos }
}

export async function processarImportacao(
  importacaoId: number,
  requesterId?: number,
  filePath?: string
) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const userId = ctx.userId
  const imp = await assertImportacaoEditavel(importacaoId, ctx.empresaId)

  await prisma.fornecedorImportacao.update({
    where: { id: importacaoId },
    data: { status: "PROCESSANDO" },
  })

  try {
    const configInput = await getConfigInput(imp.fornecedorId, ctx.empresaId)

    let buffer: Buffer
    if (filePath) {
      buffer = await readFile(filePath)
    } else {
      throw new Error("Arquivo não encontrado. Faça upload novamente.")
    }

    const rows = parseImportFile(buffer, configInput)
    const mappedLines = rows.map((row) => mapRowToFields(row, configInput))
    const stats = await salvarLinhasImportacao(importacaoId, mappedLines)

    await executarMatchImportacao(importacaoId, userId)
    await consolidarPrecosImportacao(importacaoId, userId)

    revalidatePath("/compras/importacoes")
    revalidatePath(`/compras/importacoes/${importacaoId}`)
    return stats
  } catch (e) {
    await prisma.fornecedorImportacao.update({
      where: { id: importacaoId },
      data: {
        status: "ERRO",
        mensagemErro: e instanceof Error ? e.message : "Erro desconhecido",
      },
    })
    throw e
  }
}

export async function cancelarImportacao(importacaoId: number, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  await assertImportacaoEditavel(importacaoId, ctx.empresaId)
  await prisma.fornecedorImportacao.update({
    where: { id: importacaoId },
    data: { status: "CANCELADA" },
  })
  revalidatePath("/compras/importacoes")
}

export async function excluirImportacao(importacaoId: number, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")

  const imp = await prisma.fornecedorImportacao.findFirst({
    where: { id: importacaoId, empresaId: ctx.empresaId },
  })
  if (!imp) throw new Error("Importação não encontrada.")

  const planejamentos = await prisma.planejamentoCompra.findMany({
    where: { empresaId: ctx.empresaId, importacaoIds: { has: importacaoId } },
    select: { id: true, importacaoIds: true },
  })

  for (const p of planejamentos) {
    await prisma.planejamentoCompra.update({
      where: { id: p.id },
      data: { importacaoIds: p.importacaoIds.filter((id) => id !== importacaoId) },
    })
    revalidatePath(`/compras/planejamentos/${p.id}`)
  }

  await prisma.fornecedorImportacao.delete({ where: { id: importacaoId } })

  revalidatePath("/compras/importacoes")
  revalidatePath(`/compras/importacoes/${importacaoId}`)
  return { ok: true }
}

export async function getLinhasPendentesMatch(importacaoId: number, requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const imp = await prisma.fornecedorImportacao.findFirst({
    where: { id: importacaoId, empresaId: ctx.empresaId },
  })
  if (!imp) return []

  return parseLinhasImportacao(imp.linhas).filter(
    (l) => (l.status === "VALIDA" || l.status === "PENDENTE") && !l.produtoId
  )
}
