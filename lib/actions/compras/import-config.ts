"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "../users"
import { unstable_noStore as noStore } from "next/cache"
import { revalidatePath } from "next/cache"
import type { CampoImportacaoFornecedor, TipoArquivoImportacao } from "@/lib/compras/types"
import { CAMPOS_IMPORTACAO_LABELS } from "@/lib/compras/import-parser"
import { canManageCompras } from "@/lib/compras/guards"
import { parseImportConfig } from "@/lib/compras/json-store"
import type { FornecedorImportConfigJson } from "@/lib/compras/types"

export type SaveImportConfigInput = {
  fornecedorId: number
  tipoArquivo: TipoArquivoImportacao
  nomeAba?: string | null
  linhaCabecalho?: number
  linhaInicioDados?: number
  delimitadorCsv?: string | null
  encoding?: string | null
  campos: {
    campo: CampoImportacaoFornecedor
    coluna: string
    obrigatorio?: boolean
    transformacao?: string | null
  }[]
}

export async function getCamposImportacaoDisponiveis() {
  return Object.entries(CAMPOS_IMPORTACAO_LABELS).map(([value, label]) => ({
    value: value as CampoImportacaoFornecedor,
    label,
  }))
}

export async function getFornecedorImportConfig(fornecedorId: number, requesterId?: number) {
  noStore()
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  const fornecedor = await prisma.fornecedor.findFirst({
    where: { id: fornecedorId, empresaId: ctx.empresaId },
    select: { id: true, razaoSocial: true, importConfig: true },
  })
  if (!fornecedor) return null

  const config = parseImportConfig(fornecedor.importConfig)
  if (!config) return null

  return {
    fornecedorId: fornecedor.id,
    fornecedor: { id: fornecedor.id, razaoSocial: fornecedor.razaoSocial },
    ...config,
    campos: config.campos,
  }
}

export async function saveFornecedorImportConfig(data: SaveImportConfigInput, requesterId?: number) {
  const ctx = requesterId
    ? await getRequesterContext(requesterId)
    : { empresaId: 1, userId: 1, role: "ADMIN" as const }

  if (!canManageCompras(ctx.role)) throw new Error("Sem permissão.")

  const fornecedor = await prisma.fornecedor.findFirst({
    where: { id: data.fornecedorId, empresaId: ctx.empresaId },
  })
  if (!fornecedor) throw new Error("Fornecedor não encontrado.")

  const hasPreco = data.campos.some((c) => c.campo === "PRECO")
  const hasId = data.campos.some(
    (c) => c.campo === "CODIGO_FORNECEDOR" || c.campo === "EAN"
  )
  if (!hasPreco || !hasId) {
    throw new Error("Mapeamento mínimo: PRECO + (CODIGO_FORNECEDOR ou EAN).")
  }

  const camposUnicos = Array.from(
    new Map(data.campos.map((c) => [c.campo, c])).values()
  )

  const importConfig: FornecedorImportConfigJson = {
    tipoArquivo: data.tipoArquivo,
    nomeAba: data.nomeAba,
    linhaCabecalho: data.linhaCabecalho ?? 1,
    linhaInicioDados: data.linhaInicioDados ?? 2,
    delimitadorCsv: data.delimitadorCsv,
    encoding: data.encoding ?? "utf-8",
    ativo: true,
    campos: camposUnicos.map((c) => ({
      campo: c.campo,
      coluna: c.coluna,
      obrigatorio: c.obrigatorio ?? false,
      transformacao: c.transformacao,
    })),
  }

  await prisma.fornecedor.update({
    where: { id: data.fornecedorId },
    data: { importConfig },
  })

  revalidatePath(`/fornecedores/${data.fornecedorId}/import-config`)
  return { fornecedorId: data.fornecedorId, ...importConfig }
}
