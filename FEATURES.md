# Newflexo - Funcionalidades Implementadas

## 📋 Visão Geral
Sistema de gestão de pedidos para gráfica de rótulos e etiquetas com suporte para clientes, catálogo de etiquetas, orçamentos e pedidos de produção.

---

## 🆕 Funcionalidades Recentes

### 1. 🔄 Recompra (Repurchase Feature)
**Localização:** `/orcamentos/novo`

**Descrição:**
- Ao selecionar um cliente no formulário de novo orçamento, o sistema verifica automaticamente se existe histórico de pedidos anteriores
- Se houver histórico, a seção de "Recompra" se expande automaticamente, mostrando todos os itens de orçamentos anteriores
- Permite rápida adição de itens previamente solicitados pelo cliente
- Exibe preço unitário previamente utilizado

**Como Usar:**
1. Acesse `Orçamentos > Novo Orçamento`
2. Selecione um cliente que tenha pedidos anteriores
3. A seção "Recompra" aparecerá expandida automaticamente
4. Clique em qualquer item para adicioná-lo ao novo orçamento
5. Ajuste quantidade e preço conforme necessário

**Benefícios:**
- ✅ Agiliza o processo de recompra de itens recorrentes
- ✅ Mantém consistência de preços históricos
- ✅ Reduz tempo de preparação de orçamentos

---

### 2. 📄 Exportação de PDF (PDF Export)

#### PDF de Orçamentos
**Localização:** `/orcamentos/[id]/pdf`

**Funcionalidades:**
- Visualização formatada do orçamento completo
- Dados do cliente com endereço completo
- Tabela de itens com preço unitário e subtotal
- Cálculo automático de total com desconto
- Data de emissão, validade e status
- Rodapé com informações de geração

**Como Acessar:**
1. Na lista de orçamentos, clique em um orçamento
2. Clique no botão "Gerar PDF" (azul)
3. Você será levado à página de visualização de PDF
4. Use os botões:
   - **Imprimir:** Abre o diálogo de impressão do navegador
   - **Download PDF:** Faz download do arquivo em PDF

#### PDF de Pedidos
**Localização:** `/pedidos/[id]/pdf`

**Funcionalidades:**
- Layout profissional com dados de produção
- Informações completas do cliente
- Especificações técnicas do pedido (sentido de saída, tubete, etc)
- Tabela detalhada de itens
- Status e prioridade do pedido
- Referência ao orçamento de origem

**Como Acessar:**
1. Na lista de pedidos, clique em um pedido
2. Clique no botão "Gerar PDF"
3. Visualize ou faça download

---

## 🛠️ Componentes Técnicos Utilizados

### Dependências Adicionadas
```json
{
  "html2canvas": "^1.4.1",
  "jspdf": "^2.5.1"
}
```

### Arquivos Criados

#### Utilities
- `/lib/pdf-export.ts` - Funções de exportação para PDF com suporte a múltiplas páginas

#### Componentes
- `/components/pdf-order.tsx` - Componente de renderização de pedido em PDF
- `/components/pdf-quotation.tsx` - Componente de renderização de orçamento em PDF
- `/components/pdf-export-button.tsx` - Botão reutilizável para exportação de PDF

#### Páginas
- `/app/pedidos/[id]/pdf/page.tsx` - Página de visualização/download de PDF de pedido
- `/app/orcamentos/[id]/pdf/page.tsx` - Página de visualização/download de PDF de orçamento

#### Melhorias
- `/app/orcamentos/novo/page.tsx` - Auto-expansão de seção de recompra melhorada
- Novo ícone e visual mais atrativo para a seção de recompra

---

## 📊 Estrutura de Dados

### Cliente
- `id`: Identificador único
- `empresa`: Nome da empresa
- `contato`: Pessoa de contato
- `email`: Email para contato
- `telefone`: Telefone para contato
- `cnpj`: CNPJ/Inscrição (quando aplicável)

### Orçamento
- `id`: Identificador único
- `clienteId`: Referência ao cliente
- `dataEmissão`: Data de criação
- `dataValidade`: Data de expiração
- `status`: Pendente, Aprovado, Recusado
- `itens`: Lista de itens com descrição, quantidade, unidade, preço
- `desconto`: Valor de desconto aplicado
- `observações`: Notas gerais
- `condicoesPagamento`: Forma de pagamento
- `frete`: Tipo de frete
- `vendedor`: Responsável pela venda

### Pedido
- `id`: Identificador único
- `clienteId`: Referência ao cliente
- `orcamentoId`: Referência ao orçamento de origem
- `dataEmissão`: Data de criação
- `dataEntrega`: Data prevista de entrega
- `status`: Planejado, Em Produção, Pronto, Entregue
- `prioridade`: Normal, Alta
- `itens`: Lista com descrição, quantidade, preço
- `observações`: Notas de produção

---

## 🎨 Design de PDFs

### Paleta de Cores
- **Primária:** Azul (#1a365d)
- **Secundária:** Cinza claro (#f3f4f6)
- **Acentos:** Azul claro (#dbeafe)
- **Texto:** Preto/Cinza escuro (#111827)

### Tipografia
- **Título:** 32px, Bold
- **Subtítulo:** 24px, Bold
- **Seções:** 14px, Bold
- **Corpo:** 12px, Regular
- **Dados:** 12px, Mono (para valores)

---

## 🚀 Modo de Uso - Passo a Passo

### Criar Orçamento com Recompra
1. Vá para `Orçamentos` → `Novo Orçamento`
2. Selecione um cliente com histórico
3. Aguarde a seção de recompra expandir
4. Clique em itens anteriores para adicioná-los
5. Ajuste quantidades conforme necessário
6. Clique em "Salvar Orçamento"

### Exportar Orçamento para PDF
1. Vá para `Orçamentos`
2. Clique no orçamento desejado
3. Clique em "Gerar PDF"
4. Na página de PDF, escolha:
   - **Imprimir:** Para impressão física
   - **Download PDF:** Para enviar por email

### Exportar Pedido para PDF
1. Vá para `Pedidos`
2. Clique no pedido desejado
3. Clique em "Gerar PDF"
4. Utilize as mesmas opções de impressão/download

---

## 📋 Checklist de Implementação

- [x] Funcionalidade de recompra com auto-expansão
- [x] Visualização melhorada de itens de recompra
- [x] Sistema de geração de PDF para orçamentos
- [x] Sistema de geração de PDF para pedidos
- [x] Componentes reutilizáveis de PDF
- [x] Página dedicada para visualização de PDFs
- [x] Suporte a impressão direta
- [x] Download de arquivos PDF
- [x] Formatação profissional de documentos
- [x] Dependências instaladas (jspdf, html2canvas)

---

## 🔒 Considerações de Segurança

- PDFs são gerados no cliente (navegador)
- Nenhum dado é enviado para servidores de terceiros
- Todos os dados utilizam dados de mock (seguro para desenvolvimento)
- Pronto para integração com API backend segura

---

## 📱 Responsividade

- ✅ Rótulos e orçamentos: Otimizados para impressão
- ✅ PDFs: Formato A4 padrão
- ✅ Botões: Acessíveis em mobile
- ✅ Tabelas: Scroll horizontal se necessário

---

## 🔄 Próximas Sugestões de Melhorias

1. **Integração com Email:** Enviar PDFs automaticamente por email
2. **Assinatura Digital:** Adicionar campos de assinatura aos PDFs
3. **Histórico de Documentos:** Manter registro de PDFs gerados
4. **Customização de Logomark:** Permitir upload de logo da empresa
5. **Múltiplos Templates:** Diferentes layouts para diferentes tipos de documento
6. **Exportação em Batch:** Gerar múltiplos PDFs de uma vez
7. **Integração com Estoque:** Atualizar estoque automaticamente ao gerar pedido
8. **Relatórios:** Gerar relatórios de vendas, produção, faturamento em PDF

---

## 📞 Suporte

Para dúvidas ou problemas com as funcionalidades implementadas, consulte a seção de componentes em:
- `/components/pdf-*.tsx` para componentes de PDF
- `/lib/pdf-export.ts` para utilitários
- Páginas dedicadas em `/app/*/pdf/page.tsx`
