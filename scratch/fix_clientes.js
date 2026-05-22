const fs = require('fs');
const path = require('path');

function fixClientes(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace endereco -> logradouro, numero, bairro, cep
    // Since this is a React component, let's just use string replace.
    
    // In state
    content = content.replace(/endereco: "",/g, 'logradouro: "",\n    numeroEnd: "",\n    bairro: "",\n    cep: "",');
    content = content.replace(/endereco: /g, 'logradouro: '); // Catch-all for mapping

    // JSX Replacement for Endereço
    const oldJSX = `<div className="space-y-2">\\s*<Label htmlFor="endereco">Endereço Completo</Label>\\s*<Input[^>]*id="endereco"[^>]*value={formData\\.endereco}[^>]*onChange={\\(e\\) => setFormData\\(\\{ \\.\\.\\.formData, endereco: e\\.target\\.value \\}\\)}[^>]*/>\\s*</div>`;
    
    const newJSX = `<div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input id="cep" value={formData.cep} onChange={(e) => setFormData({ ...formData, cep: e.target.value })} />
              </div>
              <div className="space-y-2 col-span-2">
                <Label htmlFor="logradouro">Logradouro</Label>
                <Input id="logradouro" value={formData.logradouro} onChange={(e) => setFormData({ ...formData, logradouro: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="numeroEnd">Número</Label>
                <Input id="numeroEnd" value={formData.numeroEnd} onChange={(e) => setFormData({ ...formData, numeroEnd: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bairro">Bairro</Label>
                <Input id="bairro" value={formData.bairro} onChange={(e) => setFormData({ ...formData, bairro: e.target.value })} />
              </div>`;

    content = content.replace(new RegExp(oldJSX, 'g'), newJSX);

    // Some places might use formData.endereco, replace it with logradouro for simplicity if it missed
    content = content.replace(/formData\.endereco/g, 'formData.logradouro');
    
    fs.writeFileSync(filePath, content, 'utf8');
}

fixClientes(path.join(__dirname, '../app/clientes/novo/page.tsx'));
fixClientes(path.join(__dirname, '../app/clientes/[id]/page.tsx'));

// Fix PDF generator
let pdfPath = path.join(__dirname, '../lib/pdf-generator.ts');
if (fs.existsSync(pdfPath)) {
    let pdfContent = fs.readFileSync(pdfPath, 'utf8');
    pdfContent = pdfContent.replace(/formaPagamentoObj/g, 'formaPagamento');
    fs.writeFileSync(pdfPath, pdfContent, 'utf8');
}

console.log('Clientes and PDF fixed');
