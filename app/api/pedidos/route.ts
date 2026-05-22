import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    try {
        // Quando ligarmos o BD Supabase:
        // const pedidos = await prisma.pedido.findMany({ 
        //    where: { ativo: true },
        //    include: { cliente: true, vendedor: true, itens: true, statusObj: true } 
        // })
        return NextResponse.json({ success: true, message: "Rota GET de Pedidos preparada." }, { status: 200 })
    } catch (error) {
        return NextResponse.json({ success: false, error: "Erro interno no servidor." }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        // const body = await request.json()
        // const novoPedido = await prisma.pedido.create({ 
        //    data: { ...body, itens: { create: body.itens } }
        // })
        return NextResponse.json({ success: true, message: "Rota POST de Pedidos preparada." }, { status: 201 })
    } catch (error) {
        return NextResponse.json({ success: false, error: "Erro ao gerar pedido." }, { status: 500 })
    }
}
