import { prisma } from "../lib/prisma"

async function run() {
  console.log("=== INICIANDO ANÁLISE DE RETENÇÃO ===")

  // 1. Contagem geral
  const totalClientes = await prisma.cliente.count()
  const clientesComUltimaCompra = await prisma.cliente.count({
    where: { ultimaCompra: { not: null } }
  })
  const clientesSemUltimaCompra = await prisma.cliente.count({
    where: { ultimaCompra: null }
  })

  console.log(`Total de Clientes: ${totalClientes}`)
  console.log(`Clientes com 'ultimaCompra' preenchido: ${clientesComUltimaCompra}`)
  console.log(`Clientes com 'ultimaCompra' nulo (null): ${clientesSemUltimaCompra}`)

  // 2. Buscar todos os clientes e verificar seus pedidos reais contra o campo 'ultimaCompra'
  const clientes = await prisma.cliente.findMany({
    include: {
      pedidos: {
        orderBy: { criadoEm: 'desc' },
        take: 1
      }
    }
  })

  let comInconsistencia = 0
  let semCompraMasComPedido = 0

  console.log("\n--- Detalhes dos Clientes ---")
  for (const c of clientes) {
    const ultimoPedidoReal = c.pedidos[0]
    const ultimaCompraVal = c.ultimaCompra
    
    if (ultimoPedidoReal) {
      const dataPedidoStr = ultimoPedidoReal.criadoEm.toISOString()
      const ultimaCompraStr = ultimaCompraVal ? ultimaCompraVal.toISOString() : "NULO"
      
      const datasDiferentes = ultimaCompraVal 
        ? Math.abs(ultimoPedidoReal.criadoEm.getTime() - ultimaCompraVal.getTime()) > 1000 * 60 // tolerância de 1 min
        : true

      if (datasDiferentes) {
        comInconsistencia++
        console.log(`Cliente: ${c.razaoSocial} (ID: ${c.id})`)
        console.log(`  - Campo 'ultimaCompra': ${ultimaCompraStr}`)
        console.log(`  - Data do Último Pedido Real: ${dataPedidoStr} (${ultimoPedidoReal.numero})`)
      }
      
      if (!ultimaCompraVal) {
        semCompraMasComPedido++
      }
    } else {
      if (ultimaCompraVal) {
        console.log(`Cliente: ${c.razaoSocial} (ID: ${c.id})`)
        console.log(`  - Campo 'ultimaCompra': ${ultimaCompraVal.toISOString()}`)
        console.log(`  - NÃO POSSUI PEDIDOS NO SISTEMA!`)
      }
    }
  }

  console.log("\n--- Resumo de Inconsistências ---")
  console.log(`Clientes com datas divergentes entre 'ultimaCompra' e último pedido real: ${comInconsistencia}`)
  console.log(`Clientes com 'ultimaCompra' nulo mas que possuem pedidos reais: ${semCompraMasComPedido}`)

  // 3. Simular o cálculo de inativos de 40 dias com base no campo 'ultimaCompra'
  const quarentaDiasAtras = new Date()
  quarentaDiasAtras.setDate(quarentaDiasAtras.getDate() - 40)
  
  const inativosCampo = await prisma.cliente.findMany({
    where: {
      ultimaCompra: { lt: quarentaDiasAtras, not: null }
    },
    select: { id: true, razaoSocial: true, ultimaCompra: true }
  })
  
  console.log(`\nClientes considerados INATIVOS (> 40 dias) pelo campo 'ultimaCompra' (${inativosCampo.length}):`)
  inativosCampo.forEach(c => {
    const dias = Math.floor((new Date().getTime() - new Date(c.ultimaCompra!).getTime()) / (1000 * 3600 * 24))
    console.log(`  - ${c.razaoSocial}: ${c.ultimaCompra?.toISOString()} (${dias} dias atrás)`)
  })

  // 4. Simular o cálculo de inativos de 40 dias com base nos pedidos REAIS
  console.log("\nClientes que deveriam ser considerados INATIVOS (> 40 dias) com base nos PEDIDOS REAIS:")
  let inativosReaisCont = 0
  for (const c of clientes) {
    const ultimoPedido = c.pedidos[0]
    if (ultimoPedido) {
      if (ultimoPedido.criadoEm < quarentaDiasAtras) {
        inativosReaisCont++
        const dias = Math.floor((new Date().getTime() - ultimoPedido.criadoEm.getTime()) / (1000 * 3600 * 24))
        console.log(`  - ${c.razaoSocial}: Último pedido em ${ultimoPedido.criadoEm.toISOString()} (${dias} dias atrás, ${ultimoPedido.numero})`)
      }
    } else {
      // Cliente nunca comprou
      // console.log(`  - ${c.razaoSocial}: Nunca realizou uma compra no sistema.`)
    }
  }
  console.log(`Total de inativos reais com base em pedidos: ${inativosReaisCont}`)

  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
