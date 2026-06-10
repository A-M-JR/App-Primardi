import { NextRequest, NextResponse } from "next/server"
import { getPortalCotacaoData, responderCotacaoPortal } from "@/lib/actions/compras/cotacao"
import { registrarAuditoriaCompra } from "@/lib/compras/auditoria"
import { prisma } from "@/lib/prisma"
import { createHash } from "crypto"

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const data = await getPortalCotacaoData(token)
  if (!data) return NextResponse.json({ error: "Link inválido." }, { status: 404 })

  return NextResponse.json({
    fornecedor: data.fornecedor.razaoSocial,
    cotacao: {
      numero: data.cotacao.numero,
      titulo: data.cotacao.titulo,
      prazoResposta: data.cotacao.prazoResposta,
    },
    itens: data.cotacao.itens.map((i) => ({
      id: i.id,
      produto: i.produto,
      quantidade: i.quantidade,
      unidade: i.unidade,
      resposta: i.respostas[0] || null,
    })),
    bloqueado: "bloqueado" in data ? data.bloqueado : false,
    expirado: "expirado" in data ? data.expirado : false,
  })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await req.json()
    const { respostas, finalizar } = body

    await responderCotacaoPortal(token, respostas, finalizar ?? false)

    if (finalizar) {
      const tokenHash = createHash("sha256").update(token).digest("hex")
      const cf = await prisma.cotacaoCompraFornecedor.findUnique({
        where: { tokenHash },
        include: { cotacao: true },
      })
      if (cf) {
        await registrarAuditoriaCompra({
          empresaId: cf.cotacao.empresaId,
          acao: "RESPONDER_COTACAO",
          entidade: "CotacaoCompraFornecedor",
          entidadeId: cf.id,
        })
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao responder." },
      { status: 400 }
    )
  }
}
