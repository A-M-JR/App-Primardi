const { Pool } = require('pg');
require('dotenv').config();

async function debug() {
  const connectionString = process.env.DB_URL_OFFICIAL || process.env.DATABASE_URL;
  const pool = new Pool({ connectionString });
  
  try {
    const res = await pool.query(`
      SELECT p.id, p.numero, p."vendedorId", p."formaPagamento", p."totalGeral", 
             fp.nome as forma_nome, fp."quantidadeParcelas"
      FROM "Pedido" p
      LEFT JOIN "FormaPagamento" fp ON p."formaPagamentoId" = fp.id
      WHERE p.numero = 'PED-2026-0016'
    `);
    
    console.log('--- FORMA DE PAGAMENTO DO PEDIDO ---');
    console.log(JSON.stringify(res.rows[0], null, 2));
    
    const statuses = await pool.query('SELECT id, nome FROM "Status" WHERE modulo = \'pedido\'');
    console.log('--- STATUS DISPONÍVEIS ---');
    console.log(JSON.stringify(statuses.rows, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

debug();
