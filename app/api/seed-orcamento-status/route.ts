import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    await prisma.status.upsert({
      where: { id: 1 },
      update: { nome: 'Rascunho', cor: 'slate', ordem: 1, modulo: 'orcamento' },
      create: { id: 1, nome: 'Rascunho', cor: 'slate', ordem: 1, modulo: 'orcamento', ativo: true }
    })
    
    await prisma.status.upsert({
      where: { id: 4 },
      update: { nome: 'Enviado', cor: 'indigo', ordem: 2, modulo: 'orcamento' },
      create: { id: 4, nome: 'Enviado', cor: 'indigo', ordem: 2, modulo: 'orcamento', ativo: true }
    })

    await prisma.status.upsert({
      where: { id: 2 },
      update: { nome: 'Aprovado', cor: 'emerald', ordem: 3, modulo: 'orcamento' },
      create: { id: 2, nome: 'Aprovado', cor: 'emerald', ordem: 3, modulo: 'orcamento', ativo: true }
    })

    await prisma.status.upsert({
      where: { id: 5 },
      update: { nome: 'Recusado', cor: 'rose', ordem: 4, modulo: 'orcamento' },
      create: { id: 5, nome: 'Recusado', cor: 'rose', ordem: 4, modulo: 'orcamento', ativo: true }
    })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
