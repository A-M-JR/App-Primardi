import { NextRequest, NextResponse } from "next/server"
import { getRequesterContext } from "@/lib/actions/users"
// import { prisma } from "@/lib/prisma"

/**
 * GET /api/ai/config
 * Retorna a configuração global de IA do banco de dados.
 * Se não existir, cria o registro inicial (singleton).
 */
export async function GET() {
    try {
        try {
            await getRequesterContext()
        } catch {
            return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
        }
        /* Comentado até banco ser conectado
        let config = await prisma.aIConfig.findUnique({
            where: { id: "singleton" }
        })
        */

        // Mock Response (Mantendo persistente para o usuário durante o teste)
        const config = {
            id: "singleton",
            provider: "gemini-flash",
            apiKey: process.env.GEMINI_API_KEY || "",
            systemPrompt: `Você é o Assistente Especialista da Primardi, responsável por auxiliar na gestão comercial de produtos. Pode realizar integrações ao vivo com o Banco de Dados.

Sua personalidade: Profissional, eficiente e focado em resultados.

DIRETRIZES DE COMPORTAMENTO:
1. ESCOPO RESTRITO: Você só pode responder sobre temas da Primardi (Pedidos, Orçamentos, Clientes, CRM, Gestão de Produtos). Se o usuário perguntar sobre outros temas (receitas, notícias, programação geral), recuse educadamente.
2. AÇÕES DE BANCO: Você possui ferramentas nativas para consultar e navegar pelo banco de dados:
   - 'consultar_clientes': Busca base de clientes reais por CNPJ ou nome.
   - 'consultar_orcamentos': Verifica os últimos orçamentos ou procura um específico.
   - 'consultar_pedidos': Checa status e andamento de pedidos.
   - 'inserir_cliente': Realiza o cadastro silêncioso e oficial de um novo cliente após obter os dados essenciais (Nome, CNPJ).
   - Continue oferecendo as ferramentas antigas ('gerar_orcamento', 'abrir_pedido', 'buscar_cnpj') para atalhos de tela.
3. VISÃO (IMAGES): Se o usuário enviar uma imagem, analise como se fosse uma imagem ou foto de produto. Verifique características, código e descrição.
4. TONS E VALORES: Sempre use R$ para moedas e o formato brasileiro para datas.
5. CONTEXTO DE NEGÓCIO: Lembre-se que a Primardi lida com 'Estoque', 'Preço Base', 'Categorias' e 'Fornecedores'.`,
            monthlyLimit: 500
        }

        return NextResponse.json(config)
    } catch (error) {
        return NextResponse.json({ error: "Erro ao buscar configurações de IA" }, { status: 500 })
    }
}

/**
 * POST /api/ai/config
 * Atualiza as configurações de IA.
 */
export async function POST(request: NextRequest) {
    try {
        try {
            await getRequesterContext()
        } catch {
            return NextResponse.json({ error: "Não autenticado." }, { status: 401 })
        }
        const body = await request.json()
        // No mock, apenas retornamos o que recebemos como se estivesse salvo
        return NextResponse.json(body)
    } catch (error) {
        return NextResponse.json({ error: "Erro ao salvar configurações de IA" }, { status: 500 })
    }
}
