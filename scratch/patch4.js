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

// Comissoes
patchFile(path.join(__dirname, '../lib/actions/comissoes.ts'), [
    [/p\.cliente\?/g, 'p.clienteId ?'],
    [/p\.vendedor\?/g, 'p.vendedorId ?'],
    [/p\.statusObj\?/g, 'p.status?'],
    [/p\.formaPagamentoObj\?/g, 'p.formaPagamento?']
]);

// Config
patchFile(path.join(__dirname, '../lib/actions/config.ts'), [
    [/endereco: /g, 'logradouro: '],
    [/data: \{\n\s*provider/g, 'data: {\n        empresaId: 1,\n        provider'],
    [/where: \{\n\s*monthYear: currentMonthYear\n\s*\}/g, 'where: { empresaId_monthYear: { empresaId: 1, monthYear: currentMonthYear } }'],
    [/create: \{\n\s*monthYear: currentMonthYear/g, 'create: {\n          empresaId: 1,\n          monthYear: currentMonthYear']
]);

// Dashboard
patchFile(path.join(__dirname, '../lib/actions/dashboard.ts'), [
    [/const orcStatsMes = counts\[3\] \|\| \[\]/g, 'const orcStatsMes: any[] = counts[3] || []'],
    [/const pedStatsMes = counts\[4\] \|\| \[\]/g, 'const pedStatsMes: any[] = counts[4] || []']
]);

// Oportunidades
patchFile(path.join(__dirname, '../lib/actions/oportunidades.ts'), [
    [/dados: \{\n\s*insight/g, 'empresaId: 1,\n      dados: {\n        insight']
]);

// Pedidos
patchFile(path.join(__dirname, '../lib/actions/pedidos.ts'), [
    [/ctx\?\.isAdmin/g, 'ctx && ctx.isAdmin'],
    [/ctx\?\.vendedorId/g, 'ctx ? ctx.vendedorId : null'],
    [/requesterId\?: number;\n\s*requesterId\?: number/g, 'requesterId?: number']
]);

console.log("Patched 4");
