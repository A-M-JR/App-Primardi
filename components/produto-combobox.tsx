"use client"

import { useState, useEffect } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Button } from "@/components/ui/button"
import { ChevronDown, Loader2, Search } from "lucide-react"
import { buscarProdutosTermo, type ProdutoMatch } from "@/lib/actions/televendas"

const brl = (n: number) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

interface ProdutoComboboxProps {
  onSelect: (produto: ProdutoMatch) => void
  initialQuery?: string
  placeholder?: string
  triggerLabel?: string
  clienteId?: number
  somenteVisiveis?: boolean
}

/**
 * Combobox (estilo select2) com busca no servidor por código ou nome.
 * Só consulta após 3 caracteres (debounce). Reaproveitável onde precisar
 * achar um produto digitando.
 */
export function ProdutoCombobox({
  onSelect,
  initialQuery = "",
  placeholder = "Buscar produto (cód ou nome)...",
  triggerLabel = "Buscar no sistema...",
  clienteId,
  somenteVisiveis,
}: ProdutoComboboxProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<ProdutoMatch[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        setResults(await buscarProdutosTermo(q, { clienteId, somenteVisiveis }))
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [query, clienteId, somenteVisiveis])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-9 justify-between font-normal text-muted-foreground"
        >
          <span className="inline-flex items-center gap-2 truncate">
            <Search className="size-3.5 shrink-0" /> {triggerLabel}
          </span>
          <ChevronDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            {query.trim().length < 3 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Digite ao menos 3 caracteres…</div>
            ) : loading ? (
              <div className="py-6 flex items-center justify-center text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
              </div>
            ) : results.length === 0 ? (
              <CommandEmpty>Nenhum produto encontrado.</CommandEmpty>
            ) : (
              <CommandGroup>
                {results.map((p) => (
                  <CommandItem
                    key={p.id}
                    value={String(p.id)}
                    onSelect={() => {
                      onSelect(p)
                      setOpen(false)
                    }}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm">
                        <span className="font-mono text-xs text-muted-foreground">{p.codigo}</span> {p.nome}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        est {p.estoque} · {brl(p.precoBase)}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
