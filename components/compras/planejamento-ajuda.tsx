"use client"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { HelpCircle } from "lucide-react"

type Props = {
  variant?: "lista" | "detalhe"
}

export function PlanejamentoAjuda({ variant = "detalhe" }: Props) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-muted-foreground"
        >
          <HelpCircle className="size-4" />
          Dúvidas
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-1rem)] sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Como funciona o Planejamento de Compras?</DialogTitle>
          <DialogDescription>
            Workspace para montar uma reposição: comparar fornecedores, ver estoque e gerar pedidos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          <section>
            <h3 className="font-semibold mb-1">Para que serve?</h3>
            <p className="text-muted-foreground leading-relaxed">
              Cada planejamento é uma sessão independente de compra (ex: &quot;Reposição Junho&quot;).
              Você reúne tabelas de fornecedores, cruza preços, calcula o que falta comprar com base no
              estoque e gera pedidos ou abre cotação — tudo num lugar só, sem percorrer várias telas.
            </p>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Passo a passo</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">Criar planejamento</strong> — dê um título e defina
                os dias de cobertura (por quantos dias de venda você quer repor).
              </li>
              <li>
                <strong className="text-foreground">Importar preços</strong> — faça upload das planilhas
                dos fornecedores ou vincule importações já feitas. Elas entram só neste planejamento.
              </li>
              <li>
                <strong className="text-foreground">Atualizar comparativo</strong> — monta a matriz
                cruzando produtos (código/EAN) e mostra preço de cada fornecedor.
              </li>
              <li>
                <strong className="text-foreground">Calcular necessidade</strong> — usa o estoque
                do cadastro de produtos (mantenha atualizado em Estoque) e preenche
                &quot;Qtd comprar&quot;: (média/dia × dias cobertura) − estoque.
              </li>
              <li>
                <strong className="text-foreground">Ajustar e marcar</strong> — edite quantidades,
                escolha fornecedor e marque os itens que entram na compra.
              </li>
              <li>
                <strong className="text-foreground">Finalizar compra</strong> — no topo da tela: pedido direto
                (preços importados) ou cotação (link para fornecedores negociarem).
              </li>
            </ol>
          </section>

          <section>
            <h3 className="font-semibold mb-2">Termos importantes</h3>
            <ul className="space-y-2 text-muted-foreground">
              <li>
                <strong className="text-foreground">Atualizar comparativo</strong> — relê as
                importações vinculadas e atualiza preços/fornecedores na matriz. Use após novo upload
                ou ao vincular tabelas.
              </li>
              <li>
                <strong className="text-foreground">Coluna Estoque</strong> — vem do cadastro de
                produtos. Importe a planilha em Estoque para atualizar; o planejamento lê esse valor
                ao calcular necessidade ou ao atualizar o comparativo.
              </li>
              <li>
                <strong className="text-foreground">Dias de cobertura</strong> — quantos dias de venda
                você quer cobrir com a compra. Ex: 90 dias = repor ~3 meses de consumo.
              </li>
              <li>
                <strong className="text-foreground">Coluna Dias</strong> — quantos dias o estoque atual
                dura (estoque ÷ média/dia). Ajuda a priorizar itens críticos.
              </li>
            </ul>
          </section>

          {variant === "detalhe" && (
            <section>
              <h3 className="font-semibold mb-2">Dicas na tela de detalhe</h3>
              <ul className="space-y-1.5 text-muted-foreground text-xs">
                <li>• Use a busca e o filtro &quot;Só marcados&quot; para focar nos itens da compra.</li>
                <li>• Altere 20/40/60/100 por página se a lista estiver lenta.</li>
                <li>• O menor preço aparece em verde; você pode trocar o fornecedor manualmente.</li>
                <li>• &quot;Gerar pedidos&quot; cria um pedido por fornecedor com os itens marcados.</li>
              </ul>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
