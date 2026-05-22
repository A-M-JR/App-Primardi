import { prisma } from '../lib/prisma';
import { ModuloStatus } from '@prisma/client';

async function main() {
  const empresaId = 1;

  await prisma.status.upsert({ where: { id: 1 }, update: { nome: 'Rascunho / Pendente', cor: '#94a3b8' }, create: { id: 1, empresaId, nome: 'Rascunho / Pendente', modulo: ModuloStatus.ORCAMENTO, cor: '#94a3b8', ordem: 1 }});
  await prisma.status.upsert({ where: { id: 2 }, update: { nome: 'Aprovado', cor: '#10b981' }, create: { id: 2, empresaId, nome: 'Aprovado', modulo: ModuloStatus.ORCAMENTO, cor: '#10b981', ordem: 2 }});
  
  const s4 = await prisma.status.findUnique({ where: { id: 4 } });
  if (!s4) await prisma.status.create({ data: { id: 4, empresaId, nome: 'Enviado', modulo: ModuloStatus.ORCAMENTO, cor: '#3b82f6', ordem: 3 } });
  else await prisma.status.update({ where: { id: 4 }, data: { nome: 'Enviado', modulo: ModuloStatus.ORCAMENTO, cor: '#3b82f6' }});

  const s5 = await prisma.status.findUnique({ where: { id: 5 } });
  if (!s5) await prisma.status.create({ data: { id: 5, empresaId, nome: 'Recusado/Perdido', modulo: ModuloStatus.ORCAMENTO, cor: '#ef4444', ordem: 4 } });
  else await prisma.status.update({ where: { id: 5 }, data: { nome: 'Recusado/Perdido', modulo: ModuloStatus.ORCAMENTO, cor: '#ef4444' }});
  
  console.log("DB status arrumados!")
}
main().catch(console.error).finally(()=>process.exit(0));
