# Plano de Ação — Cobertura do Escopo (Anexo I)

> Avaliação em 2026-06-16, cruzando o Anexo I com o código atual.
> Legenda: ✅ pronto · 🟡 parcial · ⛔ não iniciado · 🚫 fora do escopo inicial (cláusula 8)

---

## 1. Módulo de Compras (seção 3) — **ATENDE o escopo**

| Item | Requisito | Status |
|---|---|---|
| 3.1 | Necessidade de compra (média × 3 − estoque, regra configurável) | ✅ CompraConfigEmpresa + calcularNecessidade |
| 3.2 | Revisar/ajustar/**aprovar** itens antes de enviar | 🟡 revisar/ajustar ok; **aprovação formal falta** |
| 3.3 | Link externo seguro por fornecedor (itens restritos) | ✅ token + portal/cotacao/[token] |
| 3.4 | Múltiplos fornecedores no mesmo item (competitivo) | ✅ |
| 3.5 | Resposta do fornecedor não editável após envio | ✅ status RESPONDIDA/BLOQUEADA |
| 3.6 | Painel comparativo (preços, última compra, tabela lab.) | 🟡 comparativo ok; "última compra" não destacada |
| 3.7 | Seleção de vencedores + pedido em PDF/Excel | 🟡 escolha + PDF ok; **Excel falta** |
| 3.8 | Importar tabelas de laboratório (EAN/código/nome) | ✅ importação + match |
| extra | Paginação/performance, stepper de status do pedido | ✅ (feito agora) |

**Conclusão:** pelos critérios 9.1, o módulo de Compras **está entregue** (fluxos principais usáveis). Faltam só refinamentos: **aprovação (3.2)**, **export Excel (3.7)** e **"última compra" no comparativo (3.6)**.

> Observação importante (cláusula 8.1): **dashboards/relatórios não previstos estão fora do escopo inicial**. O "Dashboard de Compras" (mockup aprovado) e o "Recebimento + baixa de estoque" são **evolução além do escopo contratual** — valiosos, mas opcionais. Recebimento, inclusive, não é citado na seção 3.

---

## 2. Cobertura geral dos módulos

| Módulo (Anexo I) | Status atual | Observação |
|---|---|---|
| **2. Comercial / Televendas** | 🟡 base existe | orçamentos, pedidos, clientes, produtos ✅. **Falta o coração: 2.1 entrada por lista colada (WhatsApp/texto) → cotação**. 2.5 indicador de crédito no pedido ⛔ |
| **3. Compras** | ✅ | ver acima |
| **4. Crédito / Cobrança** | ⛔ | não existe painel financeiro/cobrança. Há créditos de etiqueta (outra coisa) |
| **5. Estoque / Logística** | 🟡 | estoque/movimentação/import ✅. Falta indicação de ruptura (5.2) e priorização de separação (5.3) |
| **6. Licitações / Faturamento** | ⛔ | módulo já existe como permissão, sem telas. Controle de saldo de contrato/licitação ⛔ |
| **7. Promoções** | ⛔ | montagem de campanha + PDF/texto ⛔ |
| (base) Multitenancy, permissões, níveis | ✅ | feito nas fases anteriores |

---

## 3. Recomendação de próximo módulo

**Recomendado: Comercial / Televendas (seção 2).** Motivos:
- É a **prioridade nº 1** do escopo (cláusula 1.2).
- A base (orçamentos/produtos/clientes) **já existe** → entrega incremental, rápida.
- O item que falta — **2.1 colar lista do WhatsApp/texto → casar produtos → montar cotação** — é a feature de maior **uso diário** da maior equipe (televendas) e hoje não existe.
- Puxa naturalmente o **2.5 (indicador de crédito do cliente)**, criando a ponte para o módulo de Crédito/Cobrança (seção 4).

**Alternativas:**
- **Crédito / Cobrança (4):** alto valor financeiro (bloquear venda a inadimplente), mas depende de a CONTRATANTE fornecer base estruturada de títulos/pendências.
- **Licitações / Faturamento (6):** relevante para distribuidora, porém mais nichado e depende de dados de contratos.

---

## 4. Plano de ação proposto

### Fase A — Fechar lacunas do Compras (curto, opcional p/ 100% da seção 3)
1. Aprovação de itens/pedido (3.2) — status AGUARDANDO_APROVACAO + aprovadoPor + permissão `compras:approve`.
2. Export Excel do pedido/comparativo (3.7).
3. "Última compra" no comparativo (3.6).

### Fase B — Comercial / Televendas (próximo módulo)
1. **Entrada por lista (2.1):** tela onde o vendedor cola texto/lista do WhatsApp; parser separa itens e quantidades; casa com produtos (EAN/código/nome, reaproveitando o matcher de compras).
2. Montagem de cotação a partir dos itens casados → reusa o fluxo de orçamento existente; gera PDF/texto (2.3).
3. Indicador de crédito/pendência do cliente na tela (2.5) — exibe o que houver na base.
4. Acompanhamento de status da cotação (2.4) — já há status de orçamento; reforçar follow-up.

### Fase C — Crédito / Cobrança (seção 4)
1. Importação de base de títulos/pendências (Excel/CSV).
2. Painel de status financeiro do cliente (pendência, bloqueio, títulos em aberto).
3. Geração de texto auxiliar de cobrança (envio manual).

### (Opcional / evolução, fora do escopo inicial)
- Dashboard de Compras (mockup aprovado).
- Recebimento + baixa de estoque.
- Promoções (seção 7), Licitações/Faturamento (seção 6).

---

## 5. Decisões a confirmar
- [ ] Fechar as lacunas do Compras (Fase A) antes de trocar de módulo, ou seguir direto para o próximo?
- [ ] Próximo módulo: **Comercial/Televendas** (recomendado), Crédito/Cobrança ou Licitações/Faturamento?
- [ ] O Dashboard de Compras (fora do escopo) entra como evolução acordada ou fica de fora por ora?
