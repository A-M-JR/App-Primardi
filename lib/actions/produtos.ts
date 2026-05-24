"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath, unstable_noStore as noStore } from "next/cache"

export async function getProdutos() {
  const dbProdutos = await prisma.produto.findMany({
    orderBy: { id: "desc" }, // Most recent first
    include: {
      clientesAutorizados: {
        include: {
          cliente: {
            select: { id: true, razaoSocial: true }
          }
        }
      },
      tabelasPreco: {
        select: {
          tabelaPrecoId: true,
          preco: true
        }
      }
    }
  })
  
  return dbProdutos.map(e => ({
    ...e,
    criadoEm: e.criadoEm.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
    clientesIds: e.clientesAutorizados.map(ca => ca.clienteId),
    clientesVinculados: e.clientesAutorizados.map(ca => ({
      id: ca.clienteId,
      razaoSocial: ca.cliente.razaoSocial,
      preco: (ca as any).preco
    }))
  }))
}

export async function getNextProdutoCode() {
  const lastProduto = await prisma.produto.findFirst({
    orderBy: { id: 'desc' },
    select: { codigo: true }
  })

  if (!lastProduto) return "1"

  const lastCode = parseInt(lastProduto.codigo)
  if (isNaN(lastCode)) {
      // If the last code wasn't a number, count all and suggest next
      const count = await prisma.produto.count()
      return (count + 1).toString()
  }

  return (lastCode + 1).toString()
}

export async function saveProduto(data: any, empresaId = 1) {
  try {
    const { id, clientes, ...rest } = data
    
    const prismaData = {
      empresaId,
      nome: rest.nome,
      codigo: rest.codigo,
      ean: rest.ean,
      descricao: rest.descricao || null,
      unidadePadrao: rest.unidadePadrao || "UN",
      precoBase: rest.precoBase ? Number(rest.precoBase) : 0,
      ativo: rest.ativo !== undefined ? rest.ativo : true,
      categoriaId: rest.categoriaId ? Number(rest.categoriaId) : null,
      fornecedorId: rest.fornecedorId ? Number(rest.fornecedorId) : null,
    }

    if (!id) {
      const created = await prisma.$transaction(async (tx) => {
        const produto = await tx.produto.create({
          data: prismaData
        })

        if (clientes && clientes.length > 0) {
          await Promise.all(clientes.map((c: any) => 
            tx.clienteProduto.create({
              data: {
                produtoId: produto.id,
                clienteId: Number(c.id),
                preco: c.preco ? Number(c.preco) : null
              }
            })
          ))
        }
        return produto
      })

      revalidatePath("/produtos")
      return created
    } else {
      const updated = await prisma.$transaction(async (tx) => {
        // Remove vínculos antigos
        await tx.clienteProduto.deleteMany({
          where: { produtoId: Number(id) }
        })
        
        // Atualiza a produto
        const produto = await tx.produto.update({
          where: { id: Number(id) },
          data: prismaData
        })

        // Cria novos vínculos
        if (clientes && clientes.length > 0) {
          await Promise.all(clientes.map((c: any) => 
            tx.clienteProduto.create({
              data: {
                produtoId: produto.id,
                clienteId: Number(c.id),
                preco: c.preco ? Number(c.preco) : null
              }
            })
          ))
        }
        return produto
      })

      revalidatePath("/produtos")
      return updated
    }
  } catch (error: any) {
    console.error("ERRO DETALHADO EM saveProduto:", error)
    throw new Error(error.message || "Erro interno ao salvar produto")
  }
}

export async function deleteProduto(id: number) {
    await prisma.produto.delete({
        where: { id }
    })
    revalidatePath("/produtos")
    return { success: true }
}
