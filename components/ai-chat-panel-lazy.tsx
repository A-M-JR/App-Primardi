"use client"

import dynamic from "next/dynamic"

/**
 * Carrega o painel de IA sob demanda (chunk separado), tirando-o do bundle
 * inicial de TODA página. Não bloqueia o 1º paint; o botão flutuante aparece
 * assim que o chunk hidrata. `ssr: false` é válido aqui por ser client component.
 */
const AIChatPanel = dynamic(
  () => import("./ai-chat-panel").then((m) => m.AIChatPanel),
  { ssr: false },
)

export function AIChatPanelLazy() {
  return <AIChatPanel />
}
