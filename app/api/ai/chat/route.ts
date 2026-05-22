/**
 * =============================================
 *  MÓDULO IA — API Route (Proxy Backend)
 * =============================================
 * 
 * Endpoint POST /api/ai/chat
 * 
 * Proxy seguro entre o frontend e os provedores de IA.
 * A chave API nunca fica exposta no client-side.
 * 
 * Provedores suportados:
 *  - gpt-4o-mini  → OpenAI API
 *  - gemini-flash → Google Generative AI API
 * 
 * Estratégias de economia de tokens:
 *  - max_tokens limitado (500)
 *  - temperature baixa (0.3) → respostas mais diretas
 *  - Histórico truncado no frontend (últimas 6 msgs)
 */

import { NextRequest, NextResponse } from "next/server"
import { getAIContextSummary } from "@/lib/ai-data-context"

interface ChatMessage {
    role: "user" | "assistant" | "system"
    content: string
}

interface ChatRequestBody {
    messages: ChatMessage[]
    provider: "gpt-4o-mini" | "gemini-flash" | "abacus-route"
    apiKey: string
    systemPrompt: string
    includeTools?: boolean // Novo flag para ativar ferramentas
    image?: string | null // Imagem em Base64
    vendedorId?: number // Opcional: ID do vendedor para contextualizar
}

// ── Definição das Ferramentas (Tools) ───────────────────────
const AI_TOOLS = [
    {
        type: "function",
        function: {
            name: "gerar_orcamento",
            description: "Prepara a criação de um novo orçamento para um cliente.",
            parameters: {
                type: "object",
                properties: {
                    cliente: { type: "string", description: "Nome ou CNPJ do cliente" },
                    itens: { type: "string", description: "Nome do produto (não inclua a quantidade aqui)" },
                    quantidade: { type: "number", description: "A quantidade numérica solicitada (ex: 10, 500, 1000)" },
                    unidade: { type: "string", description: "A unidade de medida (ex: un, mil, rolos)" },
                    observacoes: { type: "string", description: "Detalhes técnicos ou observações" }
                },
                required: ["cliente"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "abrir_pedido",
            description: "Prepara a abertura de um pedido a partir de um orçamento ou demanda direta.",
            parameters: {
                type: "object",
                properties: {
                    cliente: { type: "string", description: "Nome ou CNPJ do cliente" },
                    valor_total: { type: "number", description: "Valor total do pedido" },
                    prazo_entrega: { type: "string", description: "Prazo ou data de entrega" }
                },
                required: ["cliente"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "buscar_cnpj",
            description: "Busca dados cadastrais de uma empresa através do CNPJ.",
            parameters: {
                type: "object",
                properties: {
                    cnpj: { type: "string", description: "O número do CNPJ (apenas números ou formatado)" }
                },
                required: ["cnpj"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "cadastrar_cliente",
            description: "Abre o formulário para cadastrar um novo cliente. Se tiver o CNPJ, os outros dados serão preenchidos automaticamente na tela.",
            parameters: {
                type: "object",
                properties: {
                    razao_social: { type: "string", description: "Razão Social ou Nome Fantasia" },
                    cnpj: { type: "string", description: "CNPJ (apenas números ou formatado)" },
                    email: { type: "string", description: "E-mail corporativo" },
                    telefone: { type: "string", description: "Telefone de contato" },
                    cep: { type: "string", description: "CEP" },
                    endereco: { type: "string", description: "Logradouro / Rua" },
                    numero: { type: "string", description: "Número" },
                    cidade: { type: "string", description: "Cidade" },
                    estado: { type: "string", description: "UF (2 letras)" }
                },
                required: ["cnpj"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "analisar_desempenho",
            description: "Obtém uma análise detalhada do desempenho de vendas, ranking de vendedores e métricas financeiras.",
            parameters: {
                type: "object",
                properties: {
                    periodo: { type: "string", description: "Período da análise (ex: este mês, últimos 30 dias, 2024)" },
                    vendedor_id: { type: "string", description: "Opcional: ID de um vendedor específico para filtrar" }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "consultar_clientes",
            description: "Busca a base oficial de clientes no banco de dados. Pode ser por nome ou buscar todos.",
            parameters: {
                type: "object",
                properties: {
                    termo: { type: "string", description: "Opcional: Nome ou razão social para filtrar" }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "inserir_cliente",
            description: "Cadastra oficialmente um novo cliente no banco e retorna sucesso.",
            parameters: {
                type: "object",
                properties: {
                    razao_social: { type: "string", description: "Razão social do cliente" },
                    cnpj: { type: "string", description: "Número de CNPJ" },
                    email: { type: "string", description: "Email (se houver, vazio senao)" },
                    telefone: { type: "string", description: "Telefone de contato (se houver)" }
                },
                required: ["razao_social", "cnpj"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "consultar_pedidos",
            description: "Busca os últimos pedidos e suas aprovações no banco.",
            parameters: {
                type: "object",
                properties: {
                    status: { type: "string", description: "Filtrar (ex: APROVADO, EM_PRODUCAO, CONCLUIDO)" }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "consultar_orcamentos",
            description: "Consulta as emissões de orçamentos recentes no sistema.",
            parameters: {
                type: "object",
                properties: {
                    id: { type: "string", description: "Opcional" }
                }
            }
        }
    },
    {
        type: "function",
        function: {
            name: "consultar_catalogo",
            description: "Busca no catálogo geral de produtos e insumos.",
            parameters: {
                type: "object",
                properties: {
                    termo: { type: "string", description: "Termo de busca (ex: BOPP, 110x95, Couché)" }
                }
            }
        }
    }
]

// ── Utilitários de Tradução de Erros ────────────────────────
function translateAIError(msg: string): string {
    const lower = msg.toLowerCase()

    if (lower.includes("high demand") || lower.includes("overloaded") || lower.includes("service unavailable")) {
        return "O assistente está com alta demanda no momento devido ao Plano Gratuito. Por favor, aguarde cerca de 30 a 60 segundos e tente novamente."
    }

    if (lower.includes("quota exceeded") || lower.includes("rate limit")) {
        return "Você atingiu o limite de velocidade de mensagens do Plano Gratuito. Por favor, aguarde um instante e tente novamente."
    }

    if (lower.includes("safety") || lower.includes("blocked")) {
        return "Esta mensagem foi filtrada pelos protocolos de segurança da IA. Tente reformular sua pergunta."
    }

    if (lower.includes("invalid api key") || lower.includes("unauthorized")) {
        return "A chave API configurada é inválida ou expirou. Verifique as configurações do Módulo IA."
    }

    return `Erro na IA: ${msg}`
}

// ── Handler POST ────────────────────────────────────────────
export async function POST(request: NextRequest) {
    try {
        const body: ChatRequestBody = await request.json()
        const { messages, provider, apiKey, systemPrompt, vendedorId } = body

        if (!apiKey || !provider || !messages?.length) {
            // console.error("[Módulo IA] Requisição inválida")
            return NextResponse.json(
                { error: "Configuração incompleta. Verifique a chave API e o provedor nas configurações do Módulo IA." },
                { status: 400 }
            )
        }

        // Monta o prompt combinando configuração básica com contexto live
        const contextSummary = await getAIContextSummary(vendedorId)
        // Invertendo a ordem: Instruções do usuário por último para terem mais peso
        const fullSystemPrompt = contextSummary + "\n\n" + systemPrompt

        // Normalização do provedor para caso exista resquício no banco de dados
        let normProvider = provider as string;
        if (normProvider === "gpt-4" || normProvider === "gpt-4o") normProvider = "gpt-4o-mini";
        if (normProvider === "gemini") normProvider = "gemini-flash";

        // Roteamento por provedor
        if (normProvider === "gpt-4o-mini") {
            return await handleOpenAI(messages, apiKey, fullSystemPrompt, body.includeTools, body.image)
        } else if (normProvider === "gemini-flash") {
            return await handleGemini(messages, apiKey, fullSystemPrompt, body.includeTools, body.image)
        } else if (normProvider === "abacus-route") {
            return await handleAbacus(messages, apiKey, fullSystemPrompt, body.includeTools, body.image)
        }

        return NextResponse.json({ error: `Provedor de IA não reconhecido: '${provider}'` }, { status: 400 })
    } catch (error) {
        // console.error("[Módulo IA] Erro na API Route")
        return NextResponse.json(
            { error: "Ocorreu um erro interno na comunicação com o assistente. Tente novamente em instantes." },
            { status: 500 }
        )
    }
}

// ── OpenAI (GPT-4o-mini) ────────────────────────────────────
async function handleOpenAI(messages: ChatMessage[], apiKey: string, systemPrompt: string, includeTools?: boolean, image?: string | null) {
    const lastMsg = messages[messages.length - 1]
    const otherMsgs = messages.slice(0, -1)

    const openaiMessages: any[] = [
        { role: "system", content: systemPrompt },
        ...otherMsgs.map(m => ({ role: m.role, content: m.content })),
    ]

    // Formata a última mensagem (que pode conter a imagem)
    if (image) {
        openaiMessages.push({
            role: "user",
            content: [
                { type: "text", text: lastMsg.content },
                { type: "image_url", image_url: { url: image } }
            ]
        })
    } else {
        openaiMessages.push({ role: lastMsg.role, content: lastMsg.content })
    }

    const body: any = {
        model: "gpt-4o-mini",
        messages: openaiMessages,
        max_tokens: 500,
        temperature: 0.3,
    }

    if (includeTools) {
        body.tools = AI_TOOLS
        body.tool_choice = "auto"
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const rawError = errorData?.error?.message || `Erro ${response.status}`
        return NextResponse.json({ error: translateAIError(rawError) }, { status: response.status })
    }

    const data = await response.json()
    const message = data.choices?.[0]?.message
    const reply = message?.content || ""
    const toolCalls = message?.tool_calls
    const tokensUsed = data.usage?.total_tokens || 0

    return NextResponse.json({ reply, toolCalls, tokensUsed })
}

// ── Google Gemini Flash ─────────────────────────────────────
async function handleGemini(messages: ChatMessage[], apiKey: string, systemPrompt: string, includeTools?: boolean, image?: string | null) {
    // Na v1beta, usamos o modelo 'latest' que é mais estável para ferramentas e instruções.
    const body: any = {
        system_instruction: {
            parts: [{ text: systemPrompt }],
        },
        contents: messages.map((m, idx) => {
            const isLast = idx === messages.length - 1
            const parts: any[] = [{ text: m.content }]

            if (isLast && image) {
                const [mimeData, base64Data] = image.split(",")
                const mimeType = mimeData.match(/:(.*?);/)?.[1] || "image/jpeg"
                parts.push({
                    inline_data: {
                        mime_type: mimeType,
                        data: base64Data
                    }
                })
            }

            return {
                role: m.role === "assistant" ? "model" : "user",
                parts
            }
        }),
        generationConfig: {
            maxOutputTokens: 500,
            temperature: 0.3,
        },
    }

    if (includeTools) {
        // Converte o formato do OpenAI para o formato do Gemini
        body.tools = [
            {
                function_declarations: AI_TOOLS.map(t => ({
                    name: t.function.name,
                    description: t.function.description,
                    parameters: t.function.parameters
                }))
            }
        ]
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
        }
    )

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const rawError = errorData?.error?.message || `Erro ${response.status}`
        return NextResponse.json({ error: translateAIError(rawError) }, { status: response.status })
    }

    const data = await response.json()
    const candidate = data.candidates?.[0]
    const reply = candidate?.content?.parts?.find((p: any) => p.text)?.text || ""
    const toolCallsRaw = candidate?.content?.parts?.filter((p: any) => p.functionCall)

    // Normaliza toolCalls do Gemini para o formato OpenAI-like para o frontend
    const toolCalls = toolCallsRaw?.map((tc: any) => ({
        id: tc.functionCall.name + "_" + Date.now(),
        type: "function",
        function: {
            name: tc.functionCall.name,
            arguments: JSON.stringify(tc.functionCall.args)
        }
    }))

    const tokensUsed = data.usageMetadata?.totalTokenCount || 0

    return NextResponse.json({ reply, toolCalls, tokensUsed })
}

// ── Abacus AI (RouteLLM) ────────────────────────────────────
async function handleAbacus(messages: ChatMessage[], apiKey: string, systemPrompt: string, includeTools?: boolean, image?: string | null) {
    const lastMsg = messages[messages.length - 1]
    const otherMsgs = messages.slice(0, -1)

    const abacusMessages: any[] = [
        { role: "system", content: systemPrompt },
        ...otherMsgs.map(m => ({ role: m.role, content: m.content })),
    ]

    // Formata a última mensagem
    if (image) {
        abacusMessages.push({
            role: "user",
            content: [
                { type: "text", text: lastMsg.content },
                { type: "image_url", image_url: { url: image } }
            ]
        })
    } else {
        abacusMessages.push({ role: lastMsg.role, content: lastMsg.content })
    }

    const body: any = {
        model: "route-llm", // Usando o modelo padrão do RouteLLM
        messages: abacusMessages,
        max_tokens: 500,
        temperature: 0.3,
    }

    if (includeTools) {
        body.tools = AI_TOOLS
        body.tool_choice = "auto"
    }

    const response = await fetch("https://routellm.abacus.ai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
    })

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const rawError = errorData?.error?.message || `Erro ${response.status}`
        return NextResponse.json({ error: translateAIError(rawError) }, { status: response.status })
    }

    const data = await response.json()
    const message = data.choices?.[0]?.message
    const reply = message?.content || ""
    const toolCalls = message?.tool_calls
    const tokensUsed = data.usage?.total_tokens || 0

    return NextResponse.json({ reply, toolCalls, tokensUsed })
}
