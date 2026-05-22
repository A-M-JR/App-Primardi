const fs = require('fs');
const path = require('path');

function fixFile(filePath, isPedido) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix imports
  content = content.replace(/import \{ getRequesterVendedorId \} from "\.\/users"/, 'import { getRequesterContext } from "./users"');
  if (!content.includes('ModuloStatus')) {
      content = content.replace(/import \{ Prisma \} from "@prisma\/client"/, 'import { Prisma, ModuloStatus } from "@prisma/client"');
  }

  // Fix requester authorization
  content = content.replace(/getRequesterVendedorId\(/g, 'getRequesterContext(');
  content = content.replace(/const perm = await getRequesterContext\((\w+)\)/g, 'const ctx = await getRequesterContext($1)');
  
  // Replace old perm checks
  content = content.replace(/perm !== 'admin'/g, '!ctx.isAdmin');
  content = content.replace(/vendedorId = perm as number/g, 'vendedorId = ctx.vendedorId as number');
  content = content.replace(/!== perm\)/g, '!== ctx.vendedorId)');
  content = content.replace(/forcedVendedorId = perm/g, 'forcedVendedorId = ctx.vendedorId');
  
  // Inject empresaId
  content = content.replace(/const dbPedidos = await prisma\.pedido\.findMany\(\{\n\s*where,/g, 'const dbPedidos = await prisma.pedido.findMany({\n    where: { ...where, empresaId: params.requesterId ? (await getRequesterContext(params.requesterId)).empresaId : undefined },');
  content = content.replace(/const dbOrcs = await prisma\.orcamento\.findMany\(\{\n\s*where,/g, 'const dbOrcs = await prisma.orcamento.findMany({\n    where: { ...where, empresaId: params.requesterId ? (await getRequesterContext(params.requesterId)).empresaId : undefined },');
  
  // statusObj -> status
  content = content.replace(/statusObj/g, 'status');
  
  // etiqueta -> produto
  content = content.replace(/etiquetaId/g, 'produtoId');
  content = content.replace(/etiqueta:/g, 'produto:');
  content = content.replace(/etiqueta \}/g, 'produto }');
  content = content.replace(/etiquetas/g, 'produtos');
  content = content.replace(/Etiqueta/g, 'Produto');

  // ModuloStatus and getOrCreateStatus
  if (isPedido) {
    content = content.replace(/getOrCreateStatus\('em_analise'\)/g, "getOrCreateStatus(ctx?.empresaId || 1, 'em_analise', ModuloStatus.PEDIDO)");
    content = content.replace(/getOrCreateStatus\('em_producao'\)/g, "getOrCreateStatus(ctx?.empresaId || 1, 'em_producao', ModuloStatus.PEDIDO)");
    content = content.replace(/getOrCreateStatus\('separacao'\)/g, "getOrCreateStatus(ctx?.empresaId || 1, 'separacao', ModuloStatus.PEDIDO)");
    content = content.replace(/getOrCreateStatus\('entregue'\)/g, "getOrCreateStatus(ctx?.empresaId || 1, 'entregue', ModuloStatus.PEDIDO)");
    content = content.replace(/getOrCreateStatus\(String\(statusIdent\)\)/g, "getOrCreateStatus(ctx?.empresaId || 1, String(statusIdent), ModuloStatus.PEDIDO)");
    
    // savePedido payload adjustments (remove obsolete fields)
    content = content.replace(/sentidoSaidaRolo: rest\.sentidoSaidaRolo \|\| "Ext 0º",\n\s*tipoTubete: rest\.tipoTubete \|\| "76",\n\s*gapEntreEtiquetas: rest\.gapEntreEtiquetas \|\| "3mm",\n\s*numeroPistas: Number\(rest\.numeroPistas\) \|\| 1,\n\s*observacoesEmbalagem: rest\.observacoesEmbalagem \|\| "",\n\s*observacoesFaturamento: rest\.observacoesFaturamento \|\| "",/g, 
        'empresaId: ctx.empresaId,\ntipoFrete: rest.tipoFrete || "",\nvalorFrete: Number(rest.valorFrete) || 0,');
    
    // add ctx for savePedido
    content = content.replace(/export async function savePedido\(data: any, requesterId\?: number\) \{/, "export async function savePedido(data: any, requesterId: number) {\n  const ctx = await getRequesterContext(requesterId);\n");

    // add ctx for getPedidos
    content = content.replace(/export async function getPedidos\(params: \{/, "export async function getPedidos(params: {\n  requesterId?: number;\n");
  } else {
    // saveOrcamento
    content = content.replace(/export async function saveOrcamento\(data: any, requesterId\?: number\) \{/, "export async function saveOrcamento(data: any, requesterId: number) {\n  const ctx = await getRequesterContext(requesterId);\n");
    content = content.replace(/const prismaData = \{/, 'const prismaData = {\n    empresaId: ctx.empresaId,\n    tipoFrete: rest.tipoFrete || "",\n    valorFrete: Number(rest.valorFrete) || 0,\n');
  }

  // ctx fallback in updates
  content = content.replace(/updatePedidoStatus\(id: number, statusIdent: string \| number, requesterId\?: number\)/, "updatePedidoStatus(id: number, statusIdent: string | number, requesterId: number)");
  content = content.replace(/updateOrcamentoStatus\(id: number, statusIdent: string \| number, requesterId\?: number\)/, "updateOrcamentoStatus(id: number, statusIdent: string | number, requesterId: number)");

  fs.writeFileSync(filePath, content, 'utf8');
}

fixFile(path.join(__dirname, '../lib/actions/pedidos.ts'), true);
fixFile(path.join(__dirname, '../lib/actions/orcamentos.ts'), false);
console.log('Arquivos ajustados.');
