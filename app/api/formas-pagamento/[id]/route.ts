import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getRequesterContext } from "@/lib/actions/users"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getRequesterContext()
    const { id } = await params
    const data = await req.json()

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 })
    }

    const now = new Date();
    await prisma.$executeRaw`
      UPDATE "crm_formas_pagamento"
      SET nome = ${data.nome}, ativo = ${data.ativo !== undefined ? data.ativo : true}, "quantidadeParcelas" = ${data.quantidadeParcelas !== undefined ? data.quantidadeParcelas : 1}, "updatedAt" = ${now}
      WHERE id = ${Number(id)} AND "empresaId" = ${ctx.empresaId}
    `

    const updated = await prisma.$queryRaw`
      SELECT * FROM "crm_formas_pagamento" WHERE id = ${Number(id)} AND "empresaId" = ${ctx.empresaId} LIMIT 1
    ` as any[]

    return NextResponse.json(updated[0])
  } catch (error: any) {
    console.error("API Error - PUT /api/formas-pagamento/[id]:", error.message);
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const ctx = await getRequesterContext()
    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 })
    }

    // Confirma que a forma pertence à empresa ativa ANTES de qualquer operação.
    const forma = await prisma.formaPagamento.findFirst({ where: { id: Number(id), empresaId: ctx.empresaId }, select: { id: true } })
    if (!forma) return NextResponse.json({ error: "Forma de pagamento não encontrada" }, { status: 404 })

    // Verifica se está em uso primeiro
    const isUsedOrc = await prisma.orcamento.findFirst({ where: { formaPagamentoId: Number(id) } })
    const isUsedPed = await prisma.pedido.findFirst({ where: { formaPagamentoId: Number(id) } })

    if (isUsedOrc || isUsedPed) {
      return NextResponse.json({ error: "Esta forma de pagamento não pode ser excluída pois está vinculada a orçamentos ou pedidos. Tente desativá-la." }, { status: 400 })
    }

    await prisma.$executeRaw`
      DELETE FROM "crm_formas_pagamento" WHERE id = ${Number(id)} AND "empresaId" = ${ctx.empresaId}
    `

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("API Error - DELETE /api/formas-pagamento/[id]:", error.message);
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}
