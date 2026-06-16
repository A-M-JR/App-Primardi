import { NextRequest, NextResponse } from "next/server"

import { processarImportacaoEstoque } from "@/lib/actions/estoque-importacao"

import { previewEstoqueImport, listEstoqueSheetNames } from "@/lib/estoque/import-parser"



export const maxDuration = 300



export async function POST(req: NextRequest) {

  try {

    const formData = await req.formData()

    const file = formData.get("file") as File | null

    const requesterId = parseInt(String(formData.get("requesterId") || "1"), 10)

    const nomeAba = String(formData.get("nomeAba") || "") || undefined

    const previewOnly = formData.get("previewOnly") === "true"



    if (!file) {

      return NextResponse.json({ error: "Arquivo obrigatório." }, { status: 400 })

    }



    const buffer = Buffer.from(await file.arrayBuffer())



    if (previewOnly) {

      const abas = listEstoqueSheetNames(buffer)

      const preview = previewEstoqueImport(buffer, nomeAba || abas[0])

      return NextResponse.json({ abas, ...preview })

    }



    const result = await processarImportacaoEstoque({

      nomeArquivo: file.name,

      buffer,

      requesterId,

      nomeAba,

    })



    return NextResponse.json(result, { status: 201 })

  } catch (e) {

    return NextResponse.json(

      { error: e instanceof Error ? e.message : "Erro no upload." },

      { status: 500 }

    )

  }

}


