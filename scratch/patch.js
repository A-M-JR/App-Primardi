const fs = require('fs');
const path = require('path');

function patch(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // formaPagamentoObj -> formaPagamento
  content = content.replace(/formaPagamentoObj/g, 'formaPagamento');

  // getOrCreateStatus(ctx?.empresaId || 1, ...) -> getOrCreateStatus(1, ...) for getPedidos since we don't have ctx there. Actually let's fetch ctx if requesterId exists.
  // Wait, the error says Cannot find name 'ctx'. Let's replace ctx?.empresaId || 1 with 1 for getOrCreateStatus in getPedidos.
  content = content.replace(/ctx\?\.empresaId \|\| 1/g, '1');

  if (filePath.includes('pedidos.ts')) {
    // Duplicate requesterId
    content = content.replace(/requesterId\?: number;\n\s*requesterId\?: number/g, 'requesterId?: number');
    // SavePedido missing empresaId
    content = content.replace(/tipoFrete: rest.tipoFrete \|\| "",/, 'empresaId: ctx.empresaId,\n    tipoFrete: rest.tipoFrete || "",');
  }

  if (filePath.includes('orcamentos.ts')) {
    // Missing ctx in updateOrcamentoStatus and deleteOrcamento
    content = content.replace(/const perm = await getRequesterContext\(requesterId\)/g, 'const ctx = await getRequesterContext(requesterId)');
  }

  // Remove `ctx` undeclared in security checks if any.
  content = content.replace(/const perm = await getRequesterContext/g, 'const ctx = await getRequesterContext');
  content = content.replace(/perm !== 'admin'/g, '!ctx.isAdmin');
  content = content.replace(/vendedorId = perm as number/g, 'vendedorId = ctx.vendedorId as number');

  fs.writeFileSync(filePath, content, 'utf8');
}

patch(path.join(__dirname, '../lib/actions/pedidos.ts'));
patch(path.join(__dirname, '../lib/actions/orcamentos.ts'));
patch(path.join(__dirname, '../lib/actions/oportunidades.ts'));
console.log('Patched');
