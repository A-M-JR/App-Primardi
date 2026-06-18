"use client"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Building2 } from "lucide-react"

/**
 * Seletor de empresa ativa. Aparece só quando o usuário tem acesso a mais de
 * uma empresa (MASTER/TI veem todas; demais, as dos seus memberships).
 * A troca renova o cookie de sessão (server-side) e recarrega o contexto.
 */
export function EmpresaSelector() {
  const { empresas, empresaAtivaId, trocarEmpresa } = useAuth()
  const [trocando, setTrocando] = useState(false)

  if (!empresas || empresas.length <= 1) return null

  const handleChange = async (value: string) => {
    const id = Number(value)
    if (id === empresaAtivaId) return
    setTrocando(true)
    try {
      await trocarEmpresa(id)
    } finally {
      setTrocando(false)
    }
  }

  return (
    <Select
      value={empresaAtivaId?.toString() ?? ""}
      onValueChange={handleChange}
      disabled={trocando}
    >
      <SelectTrigger className="w-full h-9 text-xs">
        <Building2 className="size-3.5 mr-1.5 shrink-0 text-primary" />
        <SelectValue placeholder="Selecione a empresa" />
      </SelectTrigger>
      <SelectContent>
        {empresas.map((e) => (
          <SelectItem key={e.id} value={e.id.toString()}>
            {e.nomeFantasia}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
