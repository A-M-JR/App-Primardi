const { PrismaClient } = require('@prisma/client'); 
const prisma = new PrismaClient(); 
async function run() { 
  await prisma.status.updateMany({ where: { nome: { contains: 'Produção' } }, data: { cor: '#a855f7' } }); 
  await prisma.status.updateMany({ where: { nome: { contains: 'Análise' } }, data: { cor: '#3b82f6' } }); 
  await prisma.status.updateMany({ where: { nome: { contains: 'Separação' } }, data: { cor: '#f97316' } }); 
  await prisma.status.updateMany({ where: { nome: { contains: 'Entregue' } }, data: { cor: '#22c55e' } }); 
  console.log('Colors updated'); 
} 
run();
