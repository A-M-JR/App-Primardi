const fs = require('fs');
const path = require('path');

function replaceWords(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    
    // File renames imports
    content = content.replace(/etiqueta-form-dialog/g, 'produto-form-dialog');
    content = content.replace(/etiqueta-detail-dialog/g, 'produto-detail-dialog');
    
    // Components and exports
    content = content.replace(/EtiquetaFormDialog/g, 'ProdutoFormDialog');
    content = content.replace(/EtiquetaDetailDialog/g, 'ProdutoDetailDialog');
    content = content.replace(/EtiquetasPage/g, 'ProdutosPage');
    content = content.replace(/etiquetaToEdit/g, 'produtoToEdit');
    content = content.replace(/detailEtiqueta/g, 'detailProduto');
    content = content.replace(/setDetailEtiqueta/g, 'setDetailProduto');
    content = content.replace(/setEtiquetaToEdit/g, 'setProdutoToEdit');

    // Types and Methods
    content = content.replace(/Etiqueta/g, 'Produto');
    content = content.replace(/etiqueta/g, 'produto');
    content = content.replace(/ETIQUETA/g, 'PRODUTO');

    // Human Readable
    content = content.replace(/Nova Produto/g, 'Novo Produto');
    content = content.replace(/Nenhuma produto/g, 'Nenhum produto');
    content = content.replace(/da produto/g, 'do produto');
    
    fs.writeFileSync(filePath, content, 'utf8');
}

const files = [
    'app/produtos/page.tsx',
    'components/produto-form-dialog.tsx',
    'components/produto-detail-dialog.tsx',
    'components/app-sidebar.tsx',
];

files.forEach(f => replaceWords(path.join(__dirname, '../', f)));
console.log('UI refactored Etiquetas -> Produtos');
