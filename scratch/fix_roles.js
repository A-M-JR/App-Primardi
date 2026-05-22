const fs = require('fs');
const path = require('path');

function patch(filePath, replaces) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    replaces.forEach(r => { content = content.replace(r[0], r[1]) });
    fs.writeFileSync(filePath, content, 'utf8');
}

// 1. usuario-form-dialog.tsx
patch(path.join(__dirname, '../components/usuario-form-dialog.tsx'), [
    [/"vendedor"/g, '"VENDEDOR"'],
    [/"admin"/g, '"ADMIN"']
]);

// 2. vendedor-form-dialog.tsx
patch(path.join(__dirname, '../components/vendedor-form-dialog.tsx'), [
    [/const handleSubmit = async \(e: React\.FormEvent\) => \{/, 'const handleSubmit = async (e: React.FormEvent) => {\n    if (!formData.empresaId) formData.empresaId = 1;\n'],
    [/empresaId: vendedorToEdit\?\.empresaId \|\| 0,/g, 'empresaId: vendedorToEdit?.empresaId || 1,']
]);

// 3. clientes.ts
patch(path.join(__dirname, '../lib/actions/clientes.ts'), [
    [/etiquetasExclusivas:/g, 'produtosExclusivos:'],
    [/statusObj/g, 'status']
]);

// 4. comissoes.ts (last attempt)
patch(path.join(__dirname, '../lib/actions/comissoes.ts'), [
    [/ped\.formaPagamentoObj/g, 'ped.formaPagamento'],
    [/ped\.statusObj/g, 'ped.status']
]);

console.log("Fixed UI Roles and Clientes");
