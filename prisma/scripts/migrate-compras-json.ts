/**
 * Migra dados das tabelas legadas de Compras para colunas JSON.
 * Executar ANTES de `prisma db push` com o schema simplificado:
 *   npx tsx prisma/scripts/migrate-compras-json.ts
 */
import "dotenv/config"
import { PrismaClient } from "@prisma/client"
import { Pool } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"

const pool = new Pool({ connectionString: process.env.DB_URL_OFFICIAL || process.env.DATABASE_URL })
const adapter = new PrismaPg(pool as never)
const prisma = new PrismaClient({ adapter })

async function tableExists(name: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${name}
    ) AS exists
  `
  return rows[0]?.exists ?? false
}

async function migrateImportConfig() {
  if (!(await tableExists("crm_fornecedor_import_configs"))) return
  const configs = await prisma.$queryRaw<
    {
      fornecedor_id: number
      tipo_arquivo: string
      nome_aba: string | null
      linha_cabecalho: number
      linha_inicio_dados: number
      delimitador_csv: string | null
      encoding: string | null
    }[]
  >`SELECT fornecedor_id, tipo_arquivo, nome_aba, linha_cabecalho, linha_inicio_dados, delimitador_csv, encoding
    FROM crm_fornecedor_import_configs`

  for (const cfg of configs) {
    const campos = await prisma.$queryRaw<
      { campo: string; coluna: string; obrigatorio: boolean; transformacao: string | null }[]
    >`SELECT campo, coluna, obrigatorio, transformacao FROM crm_fornecedor_import_campos
      WHERE config_id = (SELECT id FROM crm_fornecedor_import_configs WHERE fornecedor_id = ${cfg.fornecedor_id})`

    const importConfig = {
      tipoArquivo: cfg.tipo_arquivo,
      nomeAba: cfg.nome_aba,
      linhaCabecalho: cfg.linha_cabecalho,
      linhaInicioDados: cfg.linha_inicio_dados,
      delimitadorCsv: cfg.delimitador_csv,
      encoding: cfg.encoding,
      ativo: true,
      campos: campos.map((c) => ({
        campo: c.campo,
        coluna: c.coluna,
        obrigatorio: c.obrigatorio,
        transformacao: c.transformacao,
      })),
    }

    await prisma.$executeRaw`
      UPDATE crm_fornecedores SET import_config = ${JSON.stringify(importConfig)}::jsonb
      WHERE id = ${cfg.fornecedor_id}
    `
  }
  console.log(`importConfig: ${configs.length} fornecedores`)
}

async function migrateImportacaoLinhas() {
  if (!(await tableExists("crm_fornecedor_importacao_linhas"))) return
  const importacoes = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM crm_fornecedor_importacoes`

  for (const imp of importacoes) {
    const linhas = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT numero_linha AS "numeroLinha", status, dados_originais AS "dadosOriginais",
        codigo_fornecedor AS "codigoFornecedor", ean, descricao, preco,
        estoque_fornecedor AS "estoqueFornecedor", multiplo, embalagem, observacao,
        laboratorio, produto_id AS "produtoId", erro_mensagem AS "erroMensagem",
        match_tipo AS "matchTipo"
      FROM crm_fornecedor_importacao_linhas WHERE importacao_id = ${imp.id}
      ORDER BY numero_linha`

    await prisma.$executeRaw`
      UPDATE crm_fornecedor_importacoes SET linhas = ${JSON.stringify(linhas)}::jsonb
      WHERE id = ${imp.id}
    `
  }
  console.log(`importacaoLinhas: ${importacoes.length} importações`)
}

async function migratePrecosFornecedor() {
  if (!(await tableExists("crm_fornecedor_preco_atual"))) return
  const precos = await prisma.$queryRaw<
    {
      produto_id: number
      fornecedor_id: number
      preco: number
      estoque_fornecedor: number | null
      multiplo: number | null
      embalagem: string | null
      laboratorio: string | null
    }[]
  >`SELECT produto_id, fornecedor_id, preco, estoque_fornecedor, multiplo, embalagem, laboratorio
    FROM crm_fornecedor_preco_atual`

  const porProduto = new Map<number, Record<string, unknown>>()
  for (const p of precos) {
    const map = porProduto.get(p.produto_id) ?? {}
    map[String(p.fornecedor_id)] = {
      preco: p.preco,
      estoqueFornecedor: p.estoque_fornecedor,
      multiplo: p.multiplo,
      embalagem: p.embalagem,
      laboratorio: p.laboratorio,
      atualizadoEm: new Date().toISOString(),
    }
    porProduto.set(p.produto_id, map)
  }

  for (const [produtoId, precosJson] of porProduto) {
    await prisma.$executeRaw`
      UPDATE crm_produtos SET precos_fornecedor = ${JSON.stringify(precosJson)}::jsonb
      WHERE id = ${produtoId}
    `
  }
  console.log(`precosFornecedor: ${porProduto.size} produtos`)
}

async function migrateEstoqueLinhas() {
  if (!(await tableExists("crm_estoque_importacao_linhas"))) return
  const importacoes = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM crm_estoque_importacoes`

  for (const imp of importacoes) {
    const linhas = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT numero_linha AS "numeroLinha", status, dados_originais AS "dadosOriginais",
        codigo, descricao, curva, preco, ufo, estoque, media_consumo AS "mediaConsumo",
        consumo_mensal AS "consumoMensal", ean, estoque_ate AS "estoqueAte",
        ultima_entrada AS "ultimaEntrada", quantidade, sugestao, compra, bloq_compra AS "bloqCompra",
        produto_id AS "produtoId", estoque_antes AS "estoqueAntes", estoque_depois AS "estoqueDepois",
        erro_mensagem AS "erroMensagem"
      FROM crm_estoque_importacao_linhas WHERE importacao_id = ${imp.id}
      ORDER BY numero_linha`

    await prisma.$executeRaw`
      UPDATE crm_estoque_importacoes SET linhas = ${JSON.stringify(linhas)}::jsonb
      WHERE id = ${imp.id}
    `
  }
  console.log(`estoqueLinhas: ${importacoes.length} importações`)
}

async function migratePlanejamentoImportacoes() {
  if (!(await tableExists("crm_planejamento_compra_importacoes"))) return
  const planejamentos = await prisma.$queryRaw<{ planejamento_id: number; importacao_id: number }[]>`
    SELECT planejamento_id, importacao_id FROM crm_planejamento_compra_importacoes`

  const porPlan = new Map<number, number[]>()
  for (const row of planejamentos) {
    const list = porPlan.get(row.planejamento_id) ?? []
    list.push(row.importacao_id)
    porPlan.set(row.planejamento_id, list)
  }

  for (const [planId, ids] of porPlan) {
    await prisma.$executeRaw`
      UPDATE crm_planejamento_compra SET importacao_ids = ${ids}
      WHERE id = ${planId}
    `
  }
  console.log(`planejamentoImportacoes: ${porPlan.size} planejamentos`)
}

async function migrateCotacaoRespostas() {
  if (!(await tableExists("crm_cotacao_compra_resposta_itens"))) return
  const fornecedores = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM crm_cotacao_compra_fornecedores`

  for (const cf of fornecedores) {
    const respostas = await prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT cotacao_item_id AS "cotacaoItemId", preco_unitario AS "precoUnitario",
        prazo_entrega_dias AS "prazoEntregaDias", quantidade_disponivel AS "quantidadeDisponivel",
        observacao, bloqueado, respondido_em AS "respondidoEm"
      FROM crm_cotacao_compra_resposta_itens WHERE cotacao_fornecedor_id = ${cf.id}`

    await prisma.$executeRaw`
      UPDATE crm_cotacao_compra_fornecedores SET respostas = ${JSON.stringify(respostas)}::jsonb
      WHERE id = ${cf.id}
    `
  }
  console.log(`cotacaoRespostas: ${fornecedores.length} fornecedores`)
}

async function main() {
  console.log("Iniciando migração Compras → JSON...")
  await migrateImportConfig()
  await migrateImportacaoLinhas()
  await migratePrecosFornecedor()
  await migrateEstoqueLinhas()
  await migratePlanejamentoImportacoes()
  await migrateCotacaoRespostas()
  console.log("Migração concluída.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
