const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ped = await prisma.pedido.findUnique({
    where: { numero: 'PED-2026-0816' },
    include: {
      statusObj: true,
      vendedor: true,
      formaPagamentoObj: true,
      itens: true
    }
  });
  console.log('PEDIDO:', JSON.stringify(ped, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
