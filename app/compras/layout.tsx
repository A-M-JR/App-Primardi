import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Compras",
}

/** Layout do módulo Compras — permissões por tela em lib/compras/module.ts */
export default function ComprasLayout({ children }: { children: React.ReactNode }) {
  return children
}
