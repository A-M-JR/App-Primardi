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

// 1. comissoes.ts
patchFile(path.join(__dirname, '../lib/actions/comissoes.ts'), [
    [/statusObj/g, 'status'],
    [/formaPagamentoObj/g, 'formaPagamento'],
    [/p\.cliente\?/g, 'p.clienteId ?'],
    [/p\.vendedor\?/g, 'p.vendedorId ?'],
    [/ped\.cliente\?/g, 'ped.clienteId ?'],
    [/ped\.vendedor\?/g, 'ped.vendedorId ?']
]);

// 2. config.ts
patchFile(path.join(__dirname, '../lib/actions/config.ts'), [
    [/endereco: /g, 'logradouro: '],
    [/data: \{\n\s*provider/g, 'data: {\n        empresaId: 1,\n        provider'],
    [/where: \{\n\s*monthYear: currentMonthYear\n\s*\}/g, 'where: { empresaId_monthYear: { empresaId: 1, monthYear: currentMonthYear } }'],
    [/create: \{\n\s*monthYear: currentMonthYear/g, 'create: {\n          empresaId: 1,\n          monthYear: currentMonthYear']
]);

// 3. dashboard.ts
patchFile(path.join(__dirname, '../lib/actions/dashboard.ts'), [
    [/const orcStatsMes = counts\[3\] \|\| \[\];/g, 'const orcStatsMes = (counts[3] as any[]) || [];'],
    [/const pedStatsMes = counts\[4\] \|\| \[\];/g, 'const pedStatsMes = (counts[4] as any[]) || [];']
]);

// 4. oportunidades.ts
patchFile(path.join(__dirname, '../lib/actions/oportunidades.ts'), [
    [/dados: \{\n\s*insight/g, 'empresaId: 1,\n      dados: {\n        insight']
]);

// 5. pedidos.ts
patchFile(path.join(__dirname, '../lib/actions/pedidos.ts'), [
    [/ctx\?\.isAdmin/g, '(ctx && ctx.isAdmin)'],
    [/ctx\?\.vendedorId/g, '(ctx ? ctx.vendedorId : null)'],
    [/requesterId\?: number;\n\s*requesterId\?: number/g, 'requesterId?: number']
]);

console.log("Patched 5");
