"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "./users"
import { unstable_noStore as noStore } from "next/cache"

export async function getFornecedores(requesterId?: number) {
  noStore()
  const ctx = requesterId ? await getRequesterContext(requesterId) : { empresaId: 1, isAdmin: true }
  
  return prisma.fornecedor.findMany({
    where: { empresaId: ctx.empresaId },
    orderBy: { razaoSocial: "asc" }
  })
}

export async function saveFornecedor(data: any, requesterId?: number) {
  const ctx = requesterId ? await getRequesterContext(requesterId) : { empresaId: 1, isAdmin: true }
  
  if (data.id) {
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
