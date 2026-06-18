import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireMasterOrTI } from "@/lib/actions/users"
import { assertAcesso } from "@/lib/licitacoes/guards"
import { uploadR2, r2Configurado, removerR2PorUrl } from "@/lib/storage/r2"

/**
 * Upload de arquivos para o R2.
 *  - scope=logo: branding da empresa (MASTER/TI). Limpa a logo anterior (previousUrl).
 *  - scope=licitacao: anexos de uma licitação (licitacoes:edit), requer licitacaoId.
 * Se o R2 não estiver configurado, responde 503 (o cliente trata).
 */
export async function POST(req: Request) {
  if (!r2Configurado()) {
    return NextResponse.json({ error: "r2_nao_configurado" }, { status: 503 })
  }

  const form = await req.formData()
  const file = form.get("file")
  const scope = String(form.get("scope") || "geral")
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "no_file" }, { status: 400 })
  }

  const stamp = `${Date.now()}-${Math.round(Math.random() * 1e6)}`
  const ext = (file.type.split("/")[1] || "bin").replace("+xml", "")
  let empresaId = 0
  let key = ""

  try {
    if (scope === "logo") {
      const ctx = await requireMasterOrTI()
      empresaId = ctx.empresaId
      if (file.size > 3 * 1024 * 1024) return NextResponse.json({ error: "too_large" }, { status: 413 })
      key = `empresas/${empresaId}/logo-${stamp}.${ext}`
    } else if (scope === "licitacao") {
      const ctx = await assertAcesso("licitacoes", "edit")
      empresaId = ctx.empresaId
      const licitacaoId = Number(form.get("licitacaoId"))
      if (!licitacaoId) return NextResponse.json({ error: "no_licitacao" }, { status: 400 })
      const lic = await prisma.licitacao.findFirst({ where: { id: licitacaoId, empresaId }, select: { id: true } })
      if (!lic) return NextResponse.json({ error: "licitacao_nao_encontrada" }, { status: 404 })
      if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "too_large" }, { status: 413 })
      const safeName = (file.name || `anexo.${ext}`).replace(/[^\w.\-]/g, "_").slice(-60)
      key = `licitacoes/${empresaId}/${licitacaoId}/${stamp}-${safeName}`
    } else {
      return NextResponse.json({ error: "invalid_scope" }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const buf = Buffer.from(await file.arrayBuffer())
  try {
    const url = await uploadR2(key, buf, file.type || "application/octet-stream")

    if (scope === "logo") {
      const previousUrl = String(form.get("previousUrl") || "")
      const base = (process.env.R2_PUBLIC_URL || "").replace(/\/$/, "")
      if (previousUrl && base && previousUrl !== url && previousUrl.startsWith(`${base}/empresas/${empresaId}/`)) {
        await removerR2PorUrl(previousUrl)
      }
    }

    return NextResponse.json({ url, nome: file.name || "arquivo", tipo: file.type, tamanho: file.size })
  } catch {
    return NextResponse.json({ error: "upload_failed" }, { status: 500 })
  }
}
