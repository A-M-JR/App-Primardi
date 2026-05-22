import { PrismaClient, ModuloStatus } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const empresaId = 1; // Fallback para empresa default no seed

  await prisma.status.upsert({
    where: { id: 1 },
    update: { nome: 'Rascunho', cor: 'slate', ordem: 1, modulo: ModuloStatus.ORCAMENTO },
    create: { id: 1, empresaId, nome: 'Rascunho', cor: 'slate', ordem: 1, modulo: ModuloStatus.ORCAMENTO, ativo: true }
  })
  
  await prisma.status.upsert({
    where: { id: 4 },
    update: { nome: 'Enviado', cor: 'indigo', ordem: 2, modulo: ModuloStatus.ORCAMENTO },
    create: { id: 4, empresaId, nome: 'Enviado', cor: 'indigo', ordem: 2, modulo: ModuloStatus.ORCAMENTO, ativo: true }
  })

  await prisma.status.upsert({
    where: { id: 2 },
    update: { nome: 'Aprovado', cor: 'emerald', ordem: 3, modulo: ModuloStatus.ORCAMENTO },
    create: { id: 2, empresaId, nome: 'Aprovado', cor: 'emerald', ordem: 3, modulo: ModuloStatus.ORCAMENTO, ativo: true }
  })

  await prisma.status.upsert({
    where: { id: 5 },
    update: { nome: 'Recusado', cor: 'rose', ordem: 4, modulo: ModuloStatus.ORCAMENTO },
    create: { id: 5, empresaId, nome: 'Recusado', cor: 'rose', ordem: 4, modulo: ModuloStatus.ORCAMENTO, ativo: true }
  })

  console.log('Status de Orcamento seed finalizdo.')
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
