'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Printer, Loader2 } from 'lucide-react'
import { gerarOPPDF } from '@/lib/pdf-production-order'
import { Pedido, Cliente, Vendedor } from '@/lib/types'

interface PDFProductionOrderButtonProps {
    pedido: Pedido
    cliente: Cliente
    vendedor?: Vendedor
    variant?: 'default' | 'outline' | 'ghost' | 'secondary'
    size?: 'default' | 'sm' | 'lg'
}

export function PDFProductionOrderButton({
    pedido,
    cliente,
    vendedor,
    variant = 'secondary',
    size = 'default',
}: PDFProductionOrderButtonProps) {
    const [isLoading, setIsLoading] = useState(false)

    const handleDownload = async () => {
        setIsLoading(true)
        try {
            await gerarOPPDF(pedido, cliente, vendedor)
        } catch (error) {
            console.error('[v0] Erro ao gerar OP PDF:', error)
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
            className={variant === 'secondary' ? "bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200" : ""}
        >
            {isLoading ? (
                <Loader2 className="size-4 mr-2 animate-spin" />
            ) : (
                <Printer className="size-4 mr-2" />
            )}
            {isLoading ? 'Gerando...' : 'Imprimir O.P.'}
        </Button>
    )
}
