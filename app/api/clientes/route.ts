import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    try {
        // Quando ligarmos o BD Supabase:
        // const clientes = await prisma.cliente.findMany({ where: { ativo: true } })
        return NextResponse.json({ success: true, message: "Rota GET de Clientes preparada." }, { status: 200 })
    } catch (error) {
        return NextResponse.json({ success: false, error: "Erro interno no servidor." }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        // const body = await request.json()
        // const novoCliente = await prisma.cliente.create({ data: body })
        return NextResponse.json({ success: true, message: "Rota POST de Clientes preparada." }, { status: 201 })
    } catch (error) {
        return NextResponse.json({ success: false, error: "Erro ao criar cliente." }, { status: 500 })
    }
}
