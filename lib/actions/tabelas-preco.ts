"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { getRequesterContext } from "./users"

export async function getTabelasPreco() {
  const { empresaId } = await getRequesterContext()
  const tabelas = await prisma.tabelaPreco.findMany({
    where: { empresaId },
    orderBy: { nome: "asc" },
    include: {
      _count: {
        select: { itens: true, clientes: true }
      }
    }
  })
  
  return tabelas.map(t => ({
    ...t,
    criadoEm: t.criadoEm.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }))
}

export async function getTabelaPrecoById(id: number) {
  const tabela = await prisma.tabelaPreco.findUnique({
    where: { id },
    include: {
      itens: {
        include: {
          produto: {
            select: { nome: true, codigo: true, ean: true, unidadePadrao: true, precoBase: true }
          }
        }
      }
    }
  })
  
  if (!tabela) return null

  return {
    ...tabela,
    criadoEm: tabela.criadoEm.toISOString(),
    updatedAt: tabela.updatedAt.toISOString(),
  }
}

export async function saveTabelaPreco(data: { id?: number; nome: string; ativo: boolean }) {
  const { empresaId } = await getRequesterContext()
  if (data.id) {
    const updated = await prisma.tabelaPreco.update({
      where: { id: data.id },
      data: { nome: data.nome, ativo: data.ativo }
    })
    revalidatePath("/tabelas-preco")
    return updated
  } else {
    const created = await prisma.tabelaPreco.create({
      data: { empresaId, nome: data.nome, ativo: data.ativo }
    })
    revalidatePath("/tabelas-preco")
    return created
  }
}

export async function saveItensTabelaPreco(tabelaPrecoId: number, itens: { produtoId: number, preco: number }[]) {
  // Executar tudo em transação para apagar os antigos e inserir os novos
  await prisma.$transaction(async (tx) => {
    // 1. Apaga tudo daquela tabela
    await tx.tabelaPrecoItem.deleteMany({
      where: { tabelaPrecoId }
    })
    
    // 2. Insere os novos se houver
    if (itens.length > 0) {
      await tx.tabelaPrecoItem.createMany({
        data: itens.map(i => ({
          tabelaPrecoId,
          produtoId: i.produtoId,
          preco: i.preco
        }))
      })
    }
  })
  
  revalidatePath(`/tabelas-preco/${tabelaPrecoId}`)
  return { success: true }
}
