"use server"

import { prisma } from "@/lib/prisma"
import { getRequesterContext } from "./users"
import { unstable_noStore as noStore } from "next/cache"

export async function getCategorias(requesterId?: number) {
  noStore()
  const ctx = await getRequesterContext(requesterId)
  
  return prisma.categoria.findMany({
    where: { empresaId: ctx.empresaId },
    orderBy: { nome: "asc" }
  })
}

export async function saveCategoria(data: any, requesterId?: number) {
  const ctx = await getRequesterContext(requesterId)
  
  if (data.id) {
    const dono = await prisma.categoria.findFirst({ where: { id: data.id, empresaId: ctx.empresaId }, select: { id: true } })
    if (!dono) throw new Error("Categoria não encontrada nesta empresa.")
    return prisma.categoria.update({
      where: { id: data.id },
      data: {
        nome: data.nome,
        ativo: data.ativo
      }
    })
  } else {
    return prisma.categoria.create({
      data: {
        empresaId: ctx.empresaId,
        nome: data.nome,
        ativo: data.ativo ?? true
      }
    })
  }
}
