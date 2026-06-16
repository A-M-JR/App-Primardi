import { NextRequest, NextResponse } from "next/server"
import {
  criarImportacaoFromUpload,
  criarImportacaoMultiFornecedor,
} from "@/lib/actions/compras/importacao"
import { vincularImportacoesAoPlanejamento } from "@/lib/actions/compras/planejamento"

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get("file") as File | null
    const fornecedorId = parseInt(String(formData.get("fornecedorId") || ""), 10)
    const requesterId = parseInt(String(formData.get("requesterId") || "1"), 10)
    const multiFornecedor = formData.get("multiFornecedor") === "true"
    const nomeAba = String(formData.get("nomeAba") || "") || undefined
    const planejamentoId = parseInt(String(formData.get("planejamentoId") || ""), 10)

    if (!file) {
      return NextResponse.json({ error: "Arquivo obrigatório." }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (multiFornecedor) {
      const result = await criarImportacaoMultiFornecedor({
        nomeArquivo: file.name,
        buffer,
        requesterId,
        nomeAba,
      })

      if (planejamentoId) {
        const ids = result.resultados
          .filter((r) => r.importacaoId)
          .map((r) => r.importacaoId!)
        if (ids.length) {
          await vincularImportacoesAoPlanejamento(planejamentoId, ids, requesterId)
        }
      }

      return NextResponse.json(result, { status: 201 })
    }

    if (!fornecedorId) {
      return NextResponse.json({ error: "fornecedorId obrigatório." }, { status: 400 })
    }

    const importacao = await criarImportacaoFromUpload({
      fornecedorId,
      nomeArquivo: file.name,
      buffer,
      requesterId,
    })

    if (planejamentoId && importacao.id) {
      await vincularImportacoesAoPlanejamento(planejamentoId, [importacao.id], requesterId)
    }

    return NextResponse.json(importacao, { status: 201 })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro no upload." },
      { status: 500 }
    )
  }
}
