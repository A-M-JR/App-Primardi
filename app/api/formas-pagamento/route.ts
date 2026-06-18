import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"
import { getRequesterContext } from "@/lib/actions/users"

export async function GET() {
  try {
    const ctx = await getRequesterContext()
    const formas = await prisma.$queryRaw`SELECT * FROM "crm_formas_pagamento" WHERE "empresaId" = ${ctx.empresaId} ORDER BY nome ASC`
    return NextResponse.json(formas)
  } catch (error: any) {
    console.error("API Error - GET /api/formas-pagamento:", error.message);
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await getRequesterContext()
    const data = await req.json()

    if (!data.nome) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
    }

    // Insere SEMPRE na empresa ativa da sessão (nunca em empresaId vindo do cliente).
    const now = new Date();
    await prisma.$executeRaw`
      INSERT INTO "crm_formas_pagamento" (nome, ativo, "quantidadeParcelas", "criadoEm", "updatedAt", "empresaId")
      VALUES (${data.nome}, ${data.ativo !== undefined ? data.ativo : true}, ${data.quantidadeParcelas || 1}, ${now}, ${now}, ${ctx.empresaId})
    `

    const created = await prisma.$queryRaw`
      SELECT * FROM "crm_formas_pagamento" WHERE nome = ${data.nome} AND "empresaId" = ${ctx.empresaId} ORDER BY id DESC LIMIT 1
    ` as any[]

    return NextResponse.json(created[0], { status: 201 })
  } catch (error: any) {
    console.error("API Error - POST /api/formas-pagamento:", error.message);
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}
