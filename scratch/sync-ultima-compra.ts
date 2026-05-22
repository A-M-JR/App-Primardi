import { prisma } from "../lib/prisma"

async function run() {
  console.log("=== SINCRONIZANDO CAMPO 'ultimaCompra' ===")

  // 1. Busca todos os clientes
  const clientes = await prisma.cliente.findMany()
  console.log(`Encontrados ${clientes.length} clientes.`)

  let atualizados = 0

  for (const c of clientes) {
    // Busca o pedido ativo mais recente do cliente
    const ultimoPedido = await prisma.pedido.findFirst({
      where: {
        clienteId: c.id,
        ativo: true
      },
      orderBy: {
        criadoEm: 'desc'
      },
      select: {
        criadoEm: true,
        numero: true
      }
    })

    if (ultimoPedido) {
      console.log(`Cliente: ${c.razaoSocial} (ID: ${c.id})`)
      console.log(`  - Último pedido real: ${ultimoPedido.numero} em ${ultimoPedido.criadoEm.toISOString()}`)
      console.log(`  - Atualizando 'ultimaCompra' no banco de dados...`)
      
      await prisma.cliente.update({
        where: { id: c.id },
        data: {
          ultimaCompra: ultimoPedido.criadoEm
        }
      })
      atualizados++
    } else {
      console.log(`Cliente: ${c.razaoSocial} (ID: ${c.id}) - Não possui pedidos. Mantendo 'ultimaCompra' como NULL.`)
      // Se por algum motivo tinha valor mas não tem pedido, limpamos
      if (c.ultimaCompra) {
        await prisma.cliente.update({
          where: { id: c.id },
          data: { ultimaCompra: null }
        })
        atualizados++
      }
    }
  }

  console.log(`\nSincronização concluída! ${atualizados} clientes atualizados.`)
  process.exit(0)
}

run().catch(err => {
  console.error("Erro na sincronização:", err)
  process.exit(1)
})
