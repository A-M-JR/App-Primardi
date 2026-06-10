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

const UPLOAD_DIR = path.join(process.cwd(), "uploads", "compras")

async function ensureUploadDir(empresaId: number) {
  const dir = path.join(UPLOAD_DIR, String(empresaId))
  await mkdir(dir, { recursive: true })
  return dir
}

export async function getImportacoes(requesterId?: number, fornecedorId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  return prisma.fornecedorImportacao.findMany({
    where: {
      empresaId: ctx.empresaId,
      ...(fornecedorId ? { fornecedorId } : {}),
    },
    include: {
      fornecedor: { select: { id: true, razaoSocial: true } },
    },
    orderBy: { criadoEm: "desc" },
    take: 50,
  })
}

export async function getImportacaoDetalhe(importacaoId: number, requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  return prisma.fornecedorImportacao.findFirst({
    where: { id: importacaoId, empresaId: ctx.empresaId },
    include: {
      fornecedor: true,
      config: { include: { campos: true } },
      linhas: {
        include: { produto: { select: { id: true, codigo: true, nome: true } } },
        orderBy: { numeroLinha: "asc" },
      },
    },
  })
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

  const config = await prisma.fornecedorImportConfig.findFirst({
    where: { fornecedorId: params.fornecedorId, empresaId: ctx.empresaId },
    include: { campos: true },
  })
  if (!config) throw new Error("Configure a importação do fornecedor primeiro.")

  const hash = createHash("sha256").update(params.buffer).digest("hex")
  const dir = await ensureUploadDir(ctx.empresaId)
  const filePath = path.join(dir, `${Date.now()}_${params.nomeArquivo}`)
  await writeFile(filePath, params.buffer)

  const importacao = await prisma.fornecedorImportacao.create({
    data: {
      empresaId: ctx.empresaId,
      fornecedorId: params.fornecedorId,
      configId: config.id,
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
  await prisma.fornecedorImportacaoLinha.deleteMany({ where: { importacaoId } })

  let validas = 0
  let erros = 0

  for (const mapped of mappedLines) {
    const hasError = !!mapped.erroMensagem
    if (hasError) erros++
    else validas++

    await prisma.fornecedorImportacaoLinha.create({
      data: {
        importacaoId,
        numeroLinha: mapped.numeroLinha,
        status: hasError ? "ERRO" : "VALIDA",
        dadosOriginais: mapped.dadosOriginais as object,
        codigoFornecedor: mapped.codigoFornecedor,
        ean: mapped.ean,
        descricao: mapped.descricao,
        preco: mapped.preco ?? undefined,
        estoqueFornecedor: mapped.estoqueFornecedor ?? undefined,
        multiplo: mapped.multiplo ?? undefined,
        embalagem: mapped.embalagem,
        observacao: mapped.fornecedorNome
          ? `[FORN:${mapped.fornecedorNome}] ${mapped.observacao ?? ""}`.trim()
          : mapped.observacao,
        laboratorio: mapped.laboratorio,
        erroMensagem: mapped.erroMensagem,
      },
    })
  }

  await prisma.fornecedorImportacao.update({
    where: { id: importacaoId },
    data: {
      status: "CONCLUIDA",
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
  revalidatePath("/compras/comparativo")

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
    const config = await prisma.fornecedorImportConfig.findFirst({
      where: { fornecedorId: imp.fornecedorId },
      include: { campos: true },
    })
    if (!config) throw new Error("Config de importação não encontrada.")

    let buffer: Buffer
    if (filePath) {
      buffer = await readFile(filePath)
    } else {
      throw new Error("Arquivo não encontrado. Faça upload novamente.")
    }

    const configInput: ImportConfigInput = {
      tipoArquivo: config.tipoArquivo,
      nomeAba: config.nomeAba,
      linhaCabecalho: config.linhaCabecalho,
      linhaInicioDados: config.linhaInicioDados,
      delimitadorCsv: config.delimitadorCsv,
      encoding: config.encoding,
      campos: config.campos.map((c) => ({
        campo: c.campo,
        coluna: c.coluna,
        obrigatorio: c.obrigatorio,
        transformacao: c.transformacao,
      })),
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

export async function getLinhasPendentesMatch(importacaoId: number, requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  return prisma.fornecedorImportacaoLinha.findMany({
    where: {
      importacaoId,
      status: { in: ["VALIDA", "PENDENTE"] },
      produtoId: null,
      importacao: { empresaId: ctx.empresaId },
    },
    orderBy: { numeroLinha: "asc" },
  })
}
