import { UserRole, NivelAcesso } from '@prisma/client'
import { prisma } from '../lib/prisma'

const MODULOS_PADRAO = ['comercial', 'crm', 'compras', 'estoque', 'cobranca', 'licitacoes', 'faturamento', 'promocoes', 'chamados']

async function main() {
  console.log('Iniciando seed do banco de dados (White Label SaaS)...')

  // 1. Criar Empresa Padrão (Tenant)
  const empresa = await prisma.empresa.upsert({
    where: { cnpj: '00000000000000' },
    update: { modulosAtivos: MODULOS_PADRAO },
    create: {
      modulosAtivos: MODULOS_PADRAO,
      razaoSocial: 'Primardi Tecnologias (Padrão)',
      nomeFantasia: 'Primardi',
      cnpj: '00000000000000',
      email: 'contato@primardi.com.br',
      telefone: '(11) 99999-9999',
      logradouro: 'Rua das Flores',
      numero: '100',
      bairro: 'Centro',
      cidade: 'São Paulo',
      estado: 'SP',
      cep: '00000-000',
      corPrimaria: '#1E3A8A', // Blue
      corSidebar: '#0F172A', // Slate
    }
  })
  console.log('✅ Empresa criada/verificada:', empresa.razaoSocial)

  // 2. Criar Vendedor Padrão
  const vendedor = await prisma.vendedor.upsert({
    where: { empresaId_email: { empresaId: empresa.id, email: 'vendedor@primardi.com.br' } },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: 'Vendedor Teste',
      email: 'vendedor@primardi.com.br',
      telefone: '(11) 99999-9999',
      comissao: 5.0,
      regiao: 'São Paulo',
      ativo: true
    }
  })
  console.log('✅ Vendedor criado/verificado:', vendedor.nome)

  // 3. Criar Usuário Admin
  // (Nota: em produção, a senha deve estar hashada. A função saveUser nas actions faz isso)
  const adminHash = await import('bcryptjs').then(mod => (mod.default || mod).hashSync('admin', 10))
  const admin = await prisma.user.upsert({
    where: { email: 'admin@primardi.com.br' },
    update: { nivelAcesso: NivelAcesso.MASTER, senha: adminHash, ativo: true },
    create: {
      nome: 'Administrador',
      email: 'admin@primardi.com.br',
      senha: adminHash,
      nivelAcesso: NivelAcesso.MASTER,
      ativo: true
    }
  })
  console.log('✅ Admin criado/verificado:', admin.email)

  // Membership do admin (MASTER → GERENTE na empresa)
  await prisma.userEmpresa.upsert({
    where: { userId_empresaId: { userId: admin.id, empresaId: empresa.id } },
    update: {},
    create: { userId: admin.id, empresaId: empresa.id, role: UserRole.GERENTE, permissoes: {}, ativo: true },
  })

  // 4. Criar Usuário Vendedor
  const vendHash = await import('bcryptjs').then(mod => (mod.default || mod).hashSync('123', 10))
  const userVend = await prisma.user.upsert({
    where: { email: 'vendedor@primardi.com.br' },
    update: { senha: vendHash, ativo: true },
    create: {
      nome: 'Vendedor Teste',
      email: 'vendedor@primardi.com.br',
      senha: vendHash,
      nivelAcesso: NivelAcesso.PADRAO,
      ativo: true
    }
  })
  console.log('✅ Usuário Vendedor criado/verificado:', userVend.email)

  // Membership do vendedor (OPERADOR com vendedorId vinculado)
  await prisma.userEmpresa.upsert({
    where: { userId_empresaId: { userId: userVend.id, empresaId: empresa.id } },
    update: {},
    create: {
      userId: userVend.id,
      empresaId: empresa.id,
      role: UserRole.OPERADOR,
      vendedorId: vendedor.id,
      permissoes: Object.fromEntries(MODULOS_PADRAO.map((m) => [m, ['view', 'edit']])),
      ativo: true,
    },
  })

  console.log('🚀 Seed concluído com sucesso!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
