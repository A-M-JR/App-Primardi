import { NextRequest, NextResponse } from "next/server"
// import { getServerSession } from "next-auth" // Assumindo que o projeto usa next-auth
// Nota: Caso não use next-auth, precisaremos adaptar para o auth-context customizado

export async function GET(request: NextRequest) {
    try {
        /*
        const { searchParams } = new URL(request.url)
        const userId = searchParams.get("userId")

        if (!userId) {
            return NextResponse.json({ error: "Usuário não identificado" }, { status: 401 })
        }

        const messages = await prisma.aIChatMessage.findMany({
            where: { userId },
            orderBy: { timestamp: "asc" },
            take: 50
        })
        */

        return NextResponse.json([]) // Retorna histórico vazio no mock
    } catch (error) {
        return NextResponse.json({ error: "Erro ao buscar histórico" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        // No mock, apenas confirmamos o recebimento
        return NextResponse.json({ ...body, id: Math.random().toString() })
    } catch (error) {
        return NextResponse.json({ error: "Erro ao salvar mensagem" }, { status: 500 })
    }
}
