import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    try {
        // Quando ligarmos o BD Supabase:
        // const status = await prisma.status.findMany({ 
        //    where: { ativo: true }, orderBy: { ordem: 'asc' } 
        // })
        return NextResponse.json({ success: true, message: "Rota GET de Status preparada." }, { status: 200 })
    } catch (error) {
        return NextResponse.json({ success: false, error: "Erro interno no servidor." }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        // const body = await request.json()
        // const novoStatus = await prisma.status.create({ data: body })
        return NextResponse.json({ success: true, message: "Rota POST de Status criada." }, { status: 201 })
    } catch (error) {
        return NextResponse.json({ success: false, error: "Erro ao gerar Status de UI livre." }, { status: 500 })
    }
}
