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

// 1. Config
patchFile(path.join(__dirname, '../lib/actions/config.ts'), [
    [/endereco: /g, 'logradouro: '],
    [/data: \{\n\s*provider/g, 'data: {\n        empresaId: 1,\n        provider'],
    [/where: \{\n\s*monthYear: currentMonthYear\n\s*\}/g, 'where: { empresaId_monthYear: { empresaId: 1, monthYear: currentMonthYear } }'],
    [/create: \{\n\s*monthYear: currentMonthYear/g, 'create: {\n          empresaId: 1,\n          monthYear: currentMonthYear']
]);

// 2. Dashboard
patchFile(path.join(__dirname, '../lib/actions/dashboard.ts'), [
    [/const orcStatsMes = counts\[3\] \|\| \[\];/g, 'const orcStatsMes: any[] = counts[3] || [];'],
    [/const pedStatsMes = counts\[4\] \|\| \[\];/g, 'const pedStatsMes: any[] = counts[4] || [];']
]);

// 3. Oportunidades
patchFile(path.join(__dirname, '../lib/actions/oportunidades.ts'), [
    [/p\.clienteId \?\.razaoSocial/g, 'p.cliente?.razaoSocial'],
    [/dados: \{\n\s*insight/g, 'empresaId: 1,\n      dados: {\n        insight']
]);

// 4. Orcamentos
patchFile(path.join(__dirname, '../lib/actions/orcamentos.ts'), [
    [/nome: 'Bonificação',/g, 'empresaId: 1,\n          nome: \'Bonificação\',']
]);

// 5. Pedidos
patchFile(path.join(__dirname, '../lib/actions/pedidos.ts'), [
    [/export async function getPedidos\(params: \{\n\s*requesterId\?: number;\n\}/g, 'export async function getPedidos(params: {\n  page?: number\n  limit?: number\n  search?: string\n  status?: string\n  dataInicio?: string\n  dataFim?: string\n  vendedorId?: number\n  apenasSla?: boolean\n  requesterId?: number\n} = {})'],
    [/ctx\?/g, 'ctx']
]);

// 6. Produtos
patchFile(path.join(__dirname, '../lib/actions/produtos.ts'), [
    [/export async function saveProduto\(data: any\) \{/g, 'export async function saveProduto(data: any, empresaId = 1) {'],
    [/const prismaData = \{/g, 'const prismaData = {\n    empresaId,']
]);

// 7. AI Context
patchFile(path.join(__dirname, '../lib/ai-context.tsx'), [
    [/provider: storedProvider as any/g, 'provider: storedProvider as "openai" | "anthropic" | "gemini"']
]);

console.log("Patched 3");
