import { prisma } from "../lib/prisma"
import { getOportunidadesData, getLatestOportunidadesInsight } from "../lib/actions/oportunidades"
import { getAIContextSummary } from "../lib/ai-data-context"

async function run() {
    console.log("=== INICIANDO MEDIÇÕES ===")
    
    // 1. Contagem de registros
    const countClientes = await prisma.cliente.count()
    const countPedidos = await prisma.pedido.count()
    const countOrcamentos = await prisma.orcamento.count()
    const countSugestoes = await prisma.aISugestao.count()
    
    console.log(`Clientes: ${countClientes}`)
    console.log(`Pedidos: ${countPedidos}`)
    console.log(`Orçamentos: ${countOrcamentos}`)
    console.log(`AISugestoes: ${countSugestoes}`)

    // 2. Medir tempo de getLatestOportunidadesInsight()
    const t0 = performance.now()
    const latestInsight = await getLatestOportunidadesInsight()
    const t1 = performance.now()
    console.log(`getLatestOportunidadesInsight demorou: ${(t1 - t0).toFixed(2)}ms (Encontrou: ${latestInsight !== null})`)

    // 3. Medir tempo de getOportunidadesData()
    const t2 = performance.now()
    const opData = await getOportunidadesData()
    const t3 = performance.now()
    console.log(`getOportunidadesData demorou: ${(t3 - t2).toFixed(2)}ms`)

    // 4. Medir tempo de getAIContextSummary()
    const t4 = performance.now()
    const context = await getAIContextSummary()
    const t5 = performance.now()
    console.log(`getAIContextSummary demorou: ${(t5 - t4).toFixed(2)}ms`)
    
    process.exit(0)
}

run().catch(err => {
    console.error("Erro no teste:", err)
    process.exit(1)
})
