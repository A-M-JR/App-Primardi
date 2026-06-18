"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "./users"
import { unstable_noStore as noStore } from "next/cache"

export async function getFornecedores(requesterId?: number) {
  noStore()
  const ctx = await getRequesterContext(requesterId)
  
  return prisma.fornecedor.findMany({
    where: { empresaId: ctx.empresaId },
    orderBy: { razaoSocial: "asc" }
  })
}

export async function saveFornecedor(data: any, requesterId?: number) {
  const ctx = await getRequesterContext(requesterId)
  
  if (data.id) {
    const dono = await prisma.fornecedor.findFirst({ where: { id: data.id, empresaId: ctx.empresaId }, select: { id: true } })
    if (!dono) throw new Error("Fornecedor não encontrado nesta empresa.")
    return prisma.fornecedor.update({
      where: { id: data.id },
      data: {
        razaoSocial: data.razaoSocial,
        cnpj: data.cnpj
      }
    })
  } else {
    return prisma.fornecedor.create({
      data: {
        empresaId: ctx.empresaId,
        razaoSocial: data.razaoSocial,
        cnpj: data.cnpj
      }
    })
  }
}
