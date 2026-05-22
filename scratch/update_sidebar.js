const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../components/app-sidebar.tsx');
if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Add Tags and Truck to lucide-react imports if missing
    if (!content.includes('Tags')) {
        content = content.replace(/lucide-react"/, ', Tags, Truck } from "lucide-react"');
        content = content.replace(/, ,/g, ',');
    }

    // Add the menu items after Produtos
    const targetString = `  {
    title: "Produtos",
    href: "/produtos",
    icon: Layers,
  },`;
    const replacement = `  {
    title: "Produtos",
    href: "/produtos",
    icon: Layers,
  },
  {
    title: "Categorias",
    href: "/categorias",
    icon: Tags,
  },
  {
    title: "Fornecedores",
    href: "/fornecedores",
    icon: Truck,
  },`;

    content = content.replace(targetString, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
}
console.log("Sidebar updated");
