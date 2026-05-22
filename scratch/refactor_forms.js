const fs = require('fs');
const path = require('path');

function refactorFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    // Rename Etiqueta to Produto globally in variables/state
    content = content.replace(/Etiqueta/g, 'Produto');
    content = content.replace(/etiqueta/g, 'produto');
    content = content.replace(/ETIQUETA/g, 'PRODUTO');
    content = content.replace(/getProdutos/g, 'getProdutos'); // In case it wasn't there

    // Fix imports for getProdutos
    content = content.replace(/from "@\/lib\/actions\/produtos"/g, 'from "@/lib/actions/produtos"');

    // Remove obsolete Pedido fields from initial data / form state
    const obsoleteFields = [
        "sentidoSaidaRolo", "tipoTubete", "gapEntreProdutos", "numeroPistas",
        "observacoesEmbalagem", "observacoesFaturamento"
    ];
    obsoleteFields.forEach(field => {
        // Regex to remove line containing this field in object literals
        const regex = new RegExp(`\\s*${field}:\\s*[^,]+,`, 'g');
        content = content.replace(regex, '');
        // Also remove if it is the last item
        const regex2 = new RegExp(`\\s*${field}:\\s*[^,}]+`, 'g');
        content = content.replace(regex2, '');
    });

    // Replace inputs for obsolete fields (JSX)
    content = content.replace(/<div[^>]*>\s*<Label[^>]*>Sentido de Saída[\s\S]*?<\/div>/g, '');
    content = content.replace(/<div[^>]*>\s*<Label[^>]*>Tipo de Tubete[\s\S]*?<\/div>/g, '');
    content = content.replace(/<div[^>]*>\s*<Label[^>]*>Gap entre Produtos[\s\S]*?<\/div>/g, '');
    content = content.replace(/<div[^>]*>\s*<Label[^>]*>Número de Pistas[\s\S]*?<\/div>/g, '');
    content = content.replace(/<div[^>]*>\s*<Label[^>]*>Observações de Embalagem[\s\S]*?<\/div>/g, '');
    content = content.replace(/<div[^>]*>\s*<Label[^>]*>Observações de Faturamento[\s\S]*?<\/div>/g, '');

    // Replace frete to tipoFrete and valorFrete
    content = content.replace(/formData\.frete/g, 'formData.tipoFrete');
    content = content.replace(/setFormData\(\{ \.\.\.formData, frete/g, 'setFormData({ ...formData, tipoFrete');
    content = content.replace(/frete:/g, 'tipoFrete:');

    // Replace specific select mapping if needed (e.g. frete -> tipoFrete)
    content = content.replace(/onValueChange=\{\(val\) => setFormData\(\{ \.\.\.formData, tipoFrete: val \}\)\}/g, 'onValueChange={(val) => setFormData({ ...formData, tipoFrete: val })}');

    fs.writeFileSync(filePath, content, 'utf8');
}

const files = [
    'app/pedidos/novo/page.tsx',
    'app/pedidos/[id]/page.tsx',
    'app/orcamentos/novo/page.tsx',
    'app/orcamentos/[id]/page.tsx',
];

files.forEach(f => refactorFile(path.join(__dirname, '../', f)));
console.log('Forms refactored');
