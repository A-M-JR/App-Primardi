const fs = require('fs');
const path = require('path');

function patchFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    for (const [search, replace] of replacements) {
        content = content.replace(search, replace);
    }
    fs.writeFileSync(filePath, content, 'utf8');
}

// 1. Dashboard
patchFile(path.join(__dirname, '../lib/actions/dashboard.ts'), [
    [/import \{ getRequesterVendedorId \} from "\.\/users"/g, 'import { getRequesterContext } from "./users"'],
    [/getRequesterVendedorId\(/g, 'getRequesterContext('],
    [/const perm = await getRequesterContext\(requesterId\)/g, 'const ctx = await getRequesterContext(requesterId)'],
    [/perm !== 'admin'/g, '!ctx.isAdmin'],
    [/vendedorId = perm as number/g, 'vendedorId = ctx.vendedorId as number'],
    [/orcStatsMes\.find\(\(s: any\)/g, 'orcStatsMes.find((s: any)'],
    [/pedStatsMes\.find\(\(s: any\)/g, 'pedStatsMes.find((s: any)'],
    [/\(s\) => s\.mes === mes/g, '(s: any) => s.mes === mes']
]);

// 2. Oportunidades
patchFile(path.join(__dirname, '../lib/actions/oportunidades.ts'), [
    [/import \{ getRequesterVendedorId \} from "\.\/users"/g, 'import { getRequesterContext } from "./users"'],
    [/getRequesterVendedorId\(/g, 'getRequesterContext('],
    [/const perm = await getRequesterContext\((\w+)\)/g, 'const ctx = await getRequesterContext($1)'],
    [/perm !== 'admin'/g, '!ctx.isAdmin'],
    [/vendedorId = perm as number/g, 'vendedorId = ctx.vendedorId as number'],
    [/!== perm\)/g, '!== ctx.vendedorId)'],
    [/forcedVendedorId = perm/g, 'forcedVendedorId = ctx.vendedorId'],
    [/statusObj/g, 'status'],
    [/p\.cliente\?/g, 'p.clienteId ?'],
    [/\"CONCLUIDO\"/g, '"APLICADA"']
]);

// 3. Orcamentos
patchFile(path.join(__dirname, '../lib/actions/orcamentos.ts'), [
    [/'orcamento'/g, 'ModuloStatus.ORCAMENTO']
]);

// 4. Pedidos
patchFile(path.join(__dirname, '../lib/actions/pedidos.ts'), [
    [/export async function getPedidos\(params: \{\n\s*requesterId\?: number;\n\s*requesterId\?: number/g, 'export async function getPedidos(params: {\n  requesterId?: number'],
    [/const ctx = await getRequesterContext\(params\.requesterId\)/g, 'const ctx = params.requesterId ? await getRequesterContext(params.requesterId) : null'],
    [/const statusAprovadoId = await getOrCreateStatus\('aprovado', 'orcamento'\)/g, "const statusAprovadoId = await getOrCreateStatus(ctx?.empresaId || 1, 'aprovado', ModuloStatus.ORCAMENTO)"],
    [/empresaId: ctx\.empresaId,/g, 'empresaId: ctx ? ctx.empresaId : 1,'],
    [/statusId: Number\(statusId\),/g, 'statusId: Number(statusId),\n    empresaId: ctx ? ctx.empresaId : 1,']
]);

// 5. Etiquetas -> Produtos
const etiquetasPath = path.join(__dirname, '../lib/actions/etiquetas.ts');
const produtosPath = path.join(__dirname, '../lib/actions/produtos.ts');
if (fs.existsSync(etiquetasPath)) {
    let content = fs.readFileSync(etiquetasPath, 'utf8');
    content = content.replace(/etiqueta/g, 'produto');
    content = content.replace(/Etiqueta/g, 'Produto');
    content = content.replace(/ETIQUETA/g, 'PRODUTO');
    fs.writeFileSync(produtosPath, content, 'utf8');
    fs.unlinkSync(etiquetasPath);
}

// 6. AI Context & scratch
patchFile(path.join(__dirname, '../lib/ai-context.tsx'), [
    [/provider: storedProvider/g, 'provider: storedProvider as any']
]);
patchFile(path.join(__dirname, '../scratch.ts'), [
    [/etiquetaId/g, 'produtoId']
]);

console.log("Patched 2");
