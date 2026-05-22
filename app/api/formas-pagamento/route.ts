import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET() {
  try {
    // Fallback para query bruta devido a cache do Prisma no ambiente de dev
    const formas = await prisma.$queryRaw`SELECT * FROM "FormaPagamento" ORDER BY nome ASC`
    return NextResponse.json(formas)
  } catch (error: any) {
    console.error("API Error - GET /api/formas-pagamento:", error.message);
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json()
    
    if (!data.nome) {
      return NextResponse.json({ error: "Nome é obrigatório" }, { status: 400 })
    }

    // Usando raw SQL para inserção devido a cache do Prisma
    const now = new Date();
    await prisma.$executeRaw`
      INSERT INTO "FormaPagamento" (nome, ativo, "quantidadeParcelas", "criadoEm", "updatedAt")
      VALUES (${data.nome}, ${data.ativo !== undefined ? data.ativo : true}, ${data.quantidadeParcelas || 1}, ${now}, ${now})
    `
    
    const created = await prisma.$queryRaw`
      SELECT * FROM "FormaPagamento" WHERE nome = ${data.nome} LIMIT 1
    ` as any[]

    return NextResponse.json(created[0], { status: 201 })
  } catch (error: any) {
    console.error("API Error - POST /api/formas-pagamento:", error.message);
    return NextResponse.json({ error: "Erro interno do servidor", details: error.message }, { status: 500 })
  }
}
