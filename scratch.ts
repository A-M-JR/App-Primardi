import { prisma } from "./lib/prisma"

async function main() {
  const orc = await prisma.orcamento.findFirst({
    orderBy: { id: 'desc' },
    include: { itens: true }
  });
  if (!orc) return console.log("No orcamento found");
  
  if (!orc.itens.length) return console.log("Orcamento has no items", orc.id);
  
  console.log("Original items:", orc.itens);
  
  const mappedItens = orc.itens.map(it => ({
    produtoId: it.produtoId,
    descricao: it.descricao,
    quantidade: it.quantidade,
    unidade: it.unidade,
    precoUnitario: it.precoUnitario,
    total: it.total,
    observacao: "TEST AGAIN " + Date.now()
  }));

  console.log("Mapped items to save:", mappedItens);

  const updated = await prisma.orcamento.update({
    where: { id: orc.id },
    data: {
      itens: {
        deleteMany: {},
        create: mappedItens
      }
    },
    include: { itens: true }
  });
  console.log("Updated items from latest:", updated.itens);
}

main().catch(console.error).finally(() => prisma.$disconnect());
