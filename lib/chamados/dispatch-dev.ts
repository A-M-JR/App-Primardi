/**
 * Despacho de chamado para os DESENVOLVEDORES da plataforma via endpoint externo.
 *
 * STUB — aguardando os parâmetros do endpoint. Quando definido, configure a env
 * `CHAMADO_DEV_ENDPOINT` (e opcionalmente `CHAMADO_DEV_TOKEN`) e ajuste o corpo
 * conforme o contrato da API de destino.
 */

export interface ChamadoDevPayload {
  numero: string
  titulo: string
  descricao: string
  prioridade: string
  categoria?: string | null
  empresa: string
  solicitante: string
}

export interface DispatchResult {
  ok: boolean
  refExterna?: string | null
  mensagem: string
}

export async function despacharChamadoDev(payload: ChamadoDevPayload): Promise<DispatchResult> {
  const endpoint = process.env.CHAMADO_DEV_ENDPOINT
  if (!endpoint) {
    return { ok: false, mensagem: "Endpoint dos desenvolvedores ainda não configurado (CHAMADO_DEV_ENDPOINT)." }
  }

  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 15000)
  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CHAMADO_DEV_TOKEN ? { Authorization: `Bearer ${process.env.CHAMADO_DEV_TOKEN}` } : {}),
      },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    })
    clearTimeout(t)
    if (!resp.ok) return { ok: false, mensagem: `Endpoint retornou ${resp.status}.` }
    // Ajustar conforme o retorno real do endpoint (ex.: { protocolo }).
    const data = await resp.json().catch(() => ({}))
    return { ok: true, refExterna: data?.refExterna ?? data?.protocolo ?? null, mensagem: "Chamado enviado aos desenvolvedores." }
  } catch {
    clearTimeout(t)
    return { ok: false, mensagem: "Falha ao contatar o endpoint dos desenvolvedores." }
  }
}
