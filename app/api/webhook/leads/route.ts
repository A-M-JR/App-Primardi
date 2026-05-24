import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Assuming prisma is exported from lib/prisma

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Token de autorização não fornecido ou inválido." },
        { status: 401 }
      );
    }

    const token = authHeader.split(" ")[1];

    // Find company by token
    const empresa = await prisma.empresa.findUnique({
      where: { apiToken: token },
    });

    if (!empresa) {
      return NextResponse.json(
        { error: "Token de integração inválido." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      nome,
      email,
      telefone,
      cargo,
      nomeEmpresa,
      valorEstimado,
      observacoes,
      cep,
      origem: origemNome = "Site", // Default origin
    } = body;

    if (!nome) {
      return NextResponse.json(
        { error: "O campo 'nome' é obrigatório." },
        { status: 400 }
      );
    }

    // Find or create OrigemLead
    let origem = await prisma.origemLead.findFirst({
      where: { empresaId: empresa.id, nome: origemNome },
    });

    if (!origem) {
      origem = await prisma.origemLead.create({
        data: {
          empresaId: empresa.id,
          nome: origemNome,
        },
      });
    }

    // Get the first FunilStatus (order by 'ordem' asc)
    const firstStatus = await prisma.funilStatus.findFirst({
      where: { empresaId: empresa.id, ativo: true },
      orderBy: { ordem: "asc" },
    });

    // Create the Lead
    const lead = await prisma.lead.create({
      data: {
        empresaId: empresa.id,
        nome,
        email,
        telefone,
        cargo,
        nomeEmpresa,
        valorEstimado: valorEstimado ? parseFloat(valorEstimado) : 0,
        observacoes,
        cep,
        origemId: origem.id,
        statusId: firstStatus?.id || null, // Might be null if funnel has no status yet
        vendedorId: null, // As per user request, leads stay without owner until someone picks them up
      },
    });

    return NextResponse.json({
      message: "Lead recebido com sucesso.",
      leadId: lead.id,
    }, { status: 201 });

  } catch (error: any) {
    console.error("Erro no Webhook de Leads:", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao processar o lead.", details: error.message },
      { status: 500 }
    );
  }
}
