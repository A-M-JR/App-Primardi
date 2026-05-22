'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileDown, Loader2 } from 'lucide-react'
import { gerarPDFPedido } from '@/lib/pdf-generator'
import { Pedido, Cliente, Vendedor } from '@/lib/types'

interface PDFDownloadButtonProps {
  pedido: Pedido
  cliente: Cliente
  vendedor?: Vendedor
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}

export function PDFDownloadButton({
  pedido,
  cliente,
  vendedor,
  variant = 'default',
  size = 'default',
}: PDFDownloadButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDownload = async () => {
    setIsLoading(true)
    try {
      await gerarPDFPedido(pedido, cliente, vendedor)
    } catch (error) {
      console.error('[v0] Erro ao gerar PDF:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleDownload}
      disabled={isLoading}
    >
      {isLoading ? (
        <Loader2 className="size-4 mr-2 animate-spin" />
      ) : (
        <FileDown className="size-4 mr-2" />
      )}
      {isLoading ? 'Gerando...' : 'Baixar PDF'}
    </Button>
  )
}
