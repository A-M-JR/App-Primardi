import { prisma } from "@/lib/prisma"

export async function nextPedidoCompraNumero(empresaId: number) {
  const ano = new Date().getFullYear()
  const prefix = `PC-${ano}-`
  const last = await prisma.pedidoCompra.findFirst({
    where: { empresaId, numero: { startsWith: prefix } },
    orderBy: { numero: "desc" },
  })
  const seq = last ? parseInt(last.numero.split("-").pop() || "0", 10) + 1 : 1
  return `${prefix}${String(seq).padStart(4, "0")}`
}
