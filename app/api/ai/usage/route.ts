import { NextRequest, NextResponse } from "next/server"

/**
 * GET /api/ai/usage
 * Retorna o consumo de IA para o mês atual.
 */
export async function GET() {
    try {
        const now = new Date()
        const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`

        /*
        let usage = await prisma.aIUsage.findUnique({
            where: { monthYear }
        })
        */

        return NextResponse.json({ monthYear, count: 0, tokensUsed: 0 })
    } catch (error) {
        return NextResponse.json({ error: "Erro ao buscar estatísticas de consumo" }, { status: 500 })
    }
}

/**
 * POST /api/ai/usage
 * Incrementa o contador de uso.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { tokensUsed = 0 } = body
        const now = new Date()
        const monthYear = `${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`

        return NextResponse.json({ monthYear, count: 1, tokensUsed })
    } catch (error) {
        return NextResponse.json({ error: "Erro ao atualizar estatísticas de consumo" }, { status: 500 })
    }
}
