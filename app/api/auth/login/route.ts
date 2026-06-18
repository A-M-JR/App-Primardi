import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { setSession } from "@/lib/session";

// Rate-limit best-effort EM MEMÓRIA (por instância serverless — reseta em cold
// start). Levanta a barra contra brute force ingênuo; para robustez em produção,
// migrar para um store compartilhado (ex.: Upstash/Redis).
const tentativasLogin = new Map<string, { count: number; resetAt: number }>()
const MAX_TENTATIVAS = 8
const JANELA_MS = 10 * 60 * 1000

function registrarFalhaLogin(chave: string) {
  const agora = Date.now()
  const reg = tentativasLogin.get(chave)
  if (!reg || agora >= reg.resetAt) tentativasLogin.set(chave, { count: 1, resetAt: agora + JANELA_MS })
  else reg.count++
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "Email é obrigatório" }, { status: 400 });
    }

    const chaveLogin = String(email).toLowerCase();
    const reg = tentativasLogin.get(chaveLogin);
    if (reg && Date.now() < reg.resetAt && reg.count >= MAX_TENTATIVAS) {
      return NextResponse.json({ error: "too_many_attempts" }, { status: 429 });
    }

    const user = await prisma.user.findFirst({
      where: { email: chaveLogin, ativo: true },
    });

    // Erro GENÉRICO para usuário inexistente/inativo OU senha errada — não revela
    // qual dos dois falhou (evita enumeração de e-mails).
    if (!user) {
      registrarFalhaLogin(chaveLogin);
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    const passwordMatch = await bcrypt.compare(password, user.senha);
    if (!passwordMatch) {
      registrarFalhaLogin(chaveLogin);
      return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
    }

    tentativasLogin.delete(chaveLogin);

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

    // NUNCA devolver o hash da senha ao cliente.
    const { senha: _omitSenha, ...safeUser } = user
    return NextResponse.json({
      success: true,
      user: {
        ...safeUser,
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
