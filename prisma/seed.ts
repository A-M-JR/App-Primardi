import { UserRole } from '@prisma/client'
import { prisma } from '../lib/prisma'

async function main() {
  console.log('Iniciando seed do banco de dados (White Label SaaS)...')

  // 1. Criar Empresa Padrão (Tenant)
  const empresa = await prisma.empresa.upsert({
    where: { cnpj: '00000000000000' },
    update: {},
    create: {
      razaoSocial: 'Newflexo Tecnologias (Padrão)',
      nomeFantasia: 'Newflexo',
      cnpj: '00000000000000',
      email: 'contato@newflexo.com.br',
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
    where: { empresaId_email: { empresaId: empresa.id, email: 'vendedor@newflexo.com.br' } },
    update: {},
    create: {
      empresaId: empresa.id,
      nome: 'Vendedor Teste',
      email: 'vendedor@newflexo.com.br',
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
    where: { empresaId_email: { empresaId: empresa.id, email: 'admin@newflexo.com.br' } },
    update: { role: UserRole.ADMIN, empresaId: empresa.id, senha: adminHash, ativo: true },
    create: {
      empresaId: empresa.id,
      nome: 'Administrador',
      email: 'admin@newflexo.com.br',
      senha: adminHash,
      role: UserRole.ADMIN,
      ativo: true
    }
  })
  console.log('✅ Admin criado/verificado:', admin.email)

  // 4. Criar Usuário Vendedor
  const vendHash = await import('bcryptjs').then(mod => (mod.default || mod).hashSync('123', 10))
  const userVend = await prisma.user.upsert({
    where: { empresaId_email: { empresaId: empresa.id, email: 'vendedor@newflexo.com.br' } },
    update: { role: UserRole.VENDEDOR, empresaId: empresa.id, senha: vendHash, ativo: true },
    create: {
      empresaId: empresa.id,
      nome: 'Vendedor Teste',
      email: 'vendedor@newflexo.com.br',
      senha: vendHash,
      role: UserRole.VENDEDOR,
      vendedorId: vendedor.id,
      ativo: true
    }
  })
  console.log('✅ Usuário Vendedor criado/verificado:', userVend.email)

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
