import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

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

    let vendor = null;
    if (user.vendedorId) {
      vendor = await prisma.vendedor.findUnique({
        where: { id: user.vendedorId },
      });
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
