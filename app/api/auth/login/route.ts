import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { setSession } from "@/lib/session";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), ativo: true },
    });

    if (!user) {
      return NextResponse.json({ error: "user_not_found" }, { status: 404 });
    }

    if (!user.ativo) {
      return NextResponse.json({ error: "user_blocked" }, { status: 403 });
    }

    const passwordMatch = await bcrypt.compare(password, user.senha);
    if (!passwordMatch) {
      return NextResponse.json({ error: "invalid_password" }, { status: 401 });
    }

    // Empresa ativa inicial: 1º membership ativo; MASTER/TI sem membership → 1ª
    // empresa. Não depende mais da coluna legada User.empresaId.
    const crossTenant = user.nivelAcesso === "MASTER" || user.nivelAcesso === "TI";
    const membership = await prisma.userEmpresa.findFirst({
      where: { userId: user.id, ativo: true },
      orderBy: { empresaId: "asc" },
      select: { empresaId: true, vendedorId: true },
    });
    let empresaInicial: number | null = membership?.empresaId ?? null;
    if (empresaInicial == null && crossTenant) {
      const e = await prisma.empresa.findFirst({ orderBy: { id: "asc" }, select: { id: true } });
      empresaInicial = e?.id ?? null;
    }
    if (empresaInicial == null) {
      // Usuário sem empresa vinculada não tem acesso.
      return NextResponse.json({ error: "user_blocked" }, { status: 403 });
    }

    // Cria a sessão server-side (cookie httpOnly assinado) — fonte de verdade do
    // isolamento multitenant.
    await setSession(user.id, empresaInicial);

    let vendor = null;
    const vendId = membership?.vendedorId ?? null;
    if (vendId) {
      vendor = await prisma.vendedor.findUnique({ where: { id: vendId } });
    }

    return NextResponse.json({ 
      success: true, 
      user: {
        ...user,
        criadoEm: user.criadoEm.toISOString()
      },
      vendor: vendor ? {
        ...vendor,
        criadoEm: vendor.criadoEm.toISOString()
      } : null
    });
  } catch (error) {
    console.error("Erro no login:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
