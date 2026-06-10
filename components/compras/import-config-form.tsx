"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"
import {
  getFornecedorImportConfig,
  saveFornecedorImportConfig,
  getCamposImportacaoDisponiveis,
} from "@/lib/actions/compras/import-config"
import { useAuth } from "@/lib/auth-context"
import { Plus, Trash2 } from "lucide-react"
import type { CampoImportacaoFornecedor, TipoArquivoImportacao } from "@prisma/client"

type Props = { fornecedorId: number; fornecedorNome: string }

export function ImportConfigForm({ fornecedorId, fornecedorNome }: Props) {
  const { currentUser } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [camposDisponiveis, setCamposDisponiveis] = useState<{ value: CampoImportacaoFornecedor; label: string }[]>([])
  const [tipoArquivo, setTipoArquivo] = useState<TipoArquivoImportacao>("XLSX")
  const [nomeAba, setNomeAba] = useState("")
  const [linhaCabecalho, setLinhaCabecalho] = useState(1)
  const [linhaInicioDados, setLinhaInicioDados] = useState(2)
  const [delimitadorCsv, setDelimitadorCsv] = useState(";")
  const [campos, setCampos] = useState<
    { campo: CampoImportacaoFornecedor; coluna: string; obrigatorio: boolean }[]
  >([
    { campo: "CODIGO_FORNECEDOR", coluna: "A", obrigatorio: false },
    { campo: "EAN", coluna: "B", obrigatorio: false },
    { campo: "DESCRICAO", coluna: "C", obrigatorio: false },
    { campo: "PRECO", coluna: "D", obrigatorio: true },
  ])

  useEffect(() => {
    async function load() {
      const [disp, config] = await Promise.all([
        getCamposImportacaoDisponiveis(),
        getFornecedorImportConfig(fornecedorId, currentUser?.id),
      ])
      setCamposDisponiveis(disp)
      if (config) {
        setTipoArquivo(config.tipoArquivo)
        setNomeAba(config.nomeAba || "")
        setLinhaCabecalho(config.linhaCabecalho)
        setLinhaInicioDados(config.linhaInicioDados)
        setDelimitadorCsv(config.delimitadorCsv || ";")
        if (config.campos.length) {
          setCampos(
            config.campos.map((c) => ({
              campo: c.campo,
              coluna: c.coluna,
              obrigatorio: c.obrigatorio,
            }))
          )
        }
      }
      setLoading(false)
    }
    load()
  }, [fornecedorId, currentUser?.id])

  async function handleSave() {
    setSaving(true)
    try {
      await saveFornecedorImportConfig(
        {
          fornecedorId,
          tipoArquivo,
          nomeAba: nomeAba || null,
          linhaCabecalho,
          linhaInicioDados,
          delimitadorCsv: tipoArquivo === "CSV" ? delimitadorCsv : null,
          campos,
        },
        currentUser?.id
      )
      toast.success("Configuração salva.")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-muted-foreground">Carregando...</p>

  return (
    <Card>
      <CardHeader>
        <CardTitle>Config. Importação — {fornecedorNome}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Tipo de arquivo</Label>
            <Select value={tipoArquivo} onValueChange={(v) => setTipoArquivo(v as TipoArquivoImportacao)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="XLSX">XLSX</SelectItem>
                <SelectItem value="XLS">XLS</SelectItem>
                <SelectItem value="CSV">CSV</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {tipoArquivo !== "CSV" && (
            <div>
              <Label>Nome da aba</Label>
              <Input value={nomeAba} onChange={(e) => setNomeAba(e.target.value)} placeholder="Plan1" />
            </div>
          )}
          {tipoArquivo === "CSV" && (
            <div>
              <Label>Delimitador</Label>
              <Input value={delimitadorCsv} onChange={(e) => setDelimitadorCsv(e.target.value)} />
            </div>
          )}
          <div>
            <Label>Linha cabeçalho</Label>
            <Input type="number" value={linhaCabecalho} onChange={(e) => setLinhaCabecalho(+e.target.value)} />
          </div>
          <div>
            <Label>Linha início dados</Label>
            <Input type="number" value={linhaInicioDados} onChange={(e) => setLinhaInicioDados(+e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Mapeamento de colunas</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setCampos([...campos, { campo: "DESCRICAO", coluna: "", obrigatorio: false }])
              }
            >
              <Plus className="size-4 mr-1" /> Campo
            </Button>
          </div>
          {campos.map((c, idx) => (
            <div key={idx} className="flex gap-2 items-end">
              <div className="flex-1">
                <Select
                  value={c.campo}
                  onValueChange={(v) => {
                    const n = [...campos]
                    n[idx].campo = v as CampoImportacaoFornecedor
                    setCampos(n)
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {camposDisponiveis.map((cd) => (
                      <SelectItem key={cd.value} value={cd.value}>{cd.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Input
                  placeholder="Coluna (A, 0, Nome)"
                  value={c.coluna}
                  onChange={(e) => {
                    const n = [...campos]
                    n[idx].coluna = e.target.value
                    setCampos(n)
                  }}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setCampos(campos.filter((_, i) => i !== idx))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Salvando..." : "Salvar configuração"}
        </Button>
      </CardContent>
    </Card>
  )
}
