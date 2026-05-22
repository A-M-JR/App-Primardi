const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const clientes = await prisma.cliente.findMany();
  console.log("Total de Clientes no BD:", clientes.length);
  clientes.forEach(c => console.log(c.id, c.razaoSocial));
}

main().catch(console.error).finally(() => prisma.$disconnect());
