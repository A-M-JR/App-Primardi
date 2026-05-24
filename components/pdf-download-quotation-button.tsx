'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileDown, Loader2 } from 'lucide-react'
import jsPDF from 'jspdf'
import { Orcamento, Cliente, Vendedor } from '@/lib/types'
import { getEmpresa } from '@/lib/actions/config'

interface PDFDownloadQuotationButtonProps {
  orcamento: Orcamento
  cliente: Cliente
  vendedor?: Vendedor
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg'
}

const PRIMARY_GREEN = [6, 58, 31] as [number, number, number] // #063A1F
const ACCENT_GREEN = [0, 230, 118] as [number, number, number] // #00E676
const MUTED_GREEN = [240, 246, 243] as [number, number, number]
const TEXT_MAIN = [40, 40, 40] as [number, number, number]
const TEXT_MUTED = [100, 100, 100] as [number, number, number]
const BORDER_LIGHT = [220, 225, 220] as [number, number, number]
const WHITE = [255, 255, 255] as [number, number, number]

function formatCurrencyPDF(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function formatDatePDF(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('pt-BR')
}

function drawLine(
  doc: jsPDF,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: [number, number, number] = BORDER_LIGHT,
  width = 0.3
) {
  doc.setDrawColor(...color)
  doc.setLineWidth(width)
  doc.line(x1, y1, x2, y2)
}

function drawRect(doc: jsPDF, x: number, y: number, w: number, h: number, fillColor: [number, number, number]) {
  doc.setFillColor(...fillColor)
  doc.rect(x, y, w, h, 'F')
}

async function getLogoBase64() {
  try {
    const res = await fetch('/logo_sem_fundo_primardi.png')
    const blob = await res.blob()
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch (err) {
    return null
  }
}

export function PDFDownloadQuotationButton({
  orcamento,
  cliente,
  vendedor,
  variant = 'default',
  size = 'default',
}: PDFDownloadQuotationButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const generatePDF = async () => {
    setIsLoading(true)
    try {
      const empresaData = await getEmpresa();
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
      const pageW = 210
      const pageH = 297
      const margin = 12
      const contentW = pageW - margin * 2

      let y = margin

      // ============================================================
      // CABEÇALHO (PREMIUM CLEAN)
      // ============================================================

      // Linha de acento sutil no topo
      doc.setFillColor(...PRIMARY_GREEN)
      doc.rect(0, 0, pageW, 6, 'F')
      doc.setFillColor(...ACCENT_GREEN)
      doc.rect(0, 6, pageW, 1.5, 'F')

      y = margin + 5

      const logoBase64 = await getLogoBase64()

      // Logo / Nome da empresa (esquerda)
      let companyInfoX = margin
      let companyInfoY = y + 16

      if (logoBase64) {
        // Logo colocada de forma isolada e o texto alinhado ao lado dela
        doc.addImage(logoBase64, "PNG", margin - 2, y - 8, 30, 30)
        companyInfoX = margin + 28
        companyInfoY = y + 4
        
        doc.setTextColor(...PRIMARY_GREEN)
        doc.setFontSize(16)
        doc.setFont('helvetica', 'bold')
        doc.text(empresaData.nomeFantasia.toUpperCase(), companyInfoX, companyInfoY)
        companyInfoY += 6
      } else {
        doc.setTextColor(...PRIMARY_GREEN)
        doc.setFontSize(24)
        doc.setFont('helvetica', 'bold')
        doc.text(empresaData.nomeFantasia.toUpperCase(), companyInfoX, y + 6)
      }

      doc.setTextColor(...TEXT_MUTED)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.text(`${empresaData.razaoSocial}`, companyInfoX, companyInfoY)
      doc.text(`CNPJ: ${empresaData.cnpj}`, companyInfoX, companyInfoY + 4)
      
      const contactTel = vendedor?.telefone || empresaData.telefone
      const contactEmail = vendedor?.email || empresaData.email
      doc.text(`Contato: ${contactTel} | ${contactEmail}`, companyInfoX, companyInfoY + 8)

      // Informações do Documento (direita)
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...TEXT_MAIN)
      doc.text('ORÇAMENTO COMERCIAL', pageW - margin, y + 4, { align: 'right' })

      doc.setFontSize(18)
      doc.setTextColor(...PRIMARY_GREEN)
      doc.text(orcamento.numero, pageW - margin, y + 12, { align: 'right' })

      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...TEXT_MUTED)
      doc.text(`Emitido em: ${formatDatePDF(orcamento.criadoEm)}`, pageW - margin, y + 17, { align: 'right' })

      // Divisor Premium
      y += 26
      drawLine(doc, margin, y, pageW - margin, y, BORDER_LIGHT, 0.5)
      y += 8

      // ============================================================
      // BLOCO DE INFORMAÇÕES (CLIENTE & COMERCIAL)
      // ============================================================

      const midPage = pageW / 2

      // Cliente
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...TEXT_MUTED)
      doc.text('PROPONENTE / CLIENTE:', margin, y)

      y += 5
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...TEXT_MAIN)
      doc.text(cliente.razaoSocial, margin, y)

      y += 4
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...TEXT_MUTED)
      doc.text(`CNPJ: ${cliente.cnpj} | IE: ${cliente.ie || 'Isento'}`, margin, y)

      y += 4
      const enderecoFormatado = `${cliente.logradouro || ''}, ${cliente.numeroEnd || 'S/N'} ${cliente.bairro ? '- ' + cliente.bairro : ''}`.trim()
      doc.text(enderecoFormatado || 'Endereço não informado', margin, y)

      y += 4
      doc.text(`${cliente.cidade}/${cliente.estado} - CEP: ${cliente.cep}`, margin, y)

      // Bloco Comercial (Direita)
      let yRight = y - 17 // Rewind back up
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...TEXT_MUTED)
      doc.text('INFORMAÇÕES COMERCIAIS:', midPage + 10, yRight)

      yRight += 5
      const colRightLabels = midPage + 10
      const colRightValues = midPage + 40

      const comerciais = [
        { label: 'Vendedor Responsável:', value: vendedor?.nome || 'N/D' },
        { label: 'Validade da Proposta:', value: '15 Dias Corridos' },
        { label: 'Forma de Pagamento:', value: orcamento.formaPagamentoObj?.nome || 'Conforme Notas' },
      ]

      comerciais.forEach(c => {
        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...TEXT_MUTED)
        doc.text(c.label, colRightLabels, yRight)

        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...TEXT_MAIN)
        doc.text(c.value, colRightValues, yRight)
        yRight += 5
      })

      // Align Y back exactly under the lowest point
      y = Math.max(y, yRight) + 8
      drawLine(doc, margin, y, pageW - margin, y, BORDER_LIGHT, 0.5)
      y += 10

      // ============================================================
      // TABELA DE ITENS (CLEAN E ELEGANTE)
      // ============================================================

      // Headers Background Faint
      drawRect(doc, margin, y, contentW, 8, MUTED_GREEN)

      doc.setTextColor(...PRIMARY_GREEN)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'bold')

      const cols = {
        desc: { x: margin + 3, w: 90, align: 'left' },
        quant: { x: margin + 95, w: 20, align: 'center' },
        unid: { x: margin + 115, w: 15, align: 'center' },
        punit: { x: margin + 130, w: 25, align: 'right' },
        total: { x: margin + 183, w: 25, align: 'right' },
      }

      doc.text('DESCRIÇÃO DO PRODUTO', cols.desc.x, y + 5.5)
      doc.text('QUANTIDADE', cols.quant.x + cols.quant.w / 2, y + 5.5, { align: 'center' })
      doc.text('UNIDADE', cols.unid.x + cols.unid.w / 2, y + 5.5, { align: 'center' })
      doc.text('PREÇO UNIT.', cols.punit.x + cols.punit.w, y + 5.5, { align: 'right' })
      doc.text('TOTAL', cols.total.x, y + 5.5, { align: 'right' })

      y += 10

      orcamento.itens.forEach((item, idx) => {
        const descLines = doc.splitTextToSize(item.descricao, cols.desc.w)
        const obsLinesCount = item.observacao ? doc.splitTextToSize(`OBS: ${item.observacao}`, cols.desc.w - 2).length : 0
        const rowH = Math.max(10, (descLines.length + obsLinesCount) * 4 + 7)

        if (y + rowH > pageH - 50) {
          doc.addPage()
          y = margin
          drawRect(doc, margin, y, contentW, 8, MUTED_GREEN)
          doc.setTextColor(...PRIMARY_GREEN)
          doc.setFontSize(7)
          doc.setFont('helvetica', 'bold')
          doc.text('DESCRIÇÃO DO PRODUTO', cols.desc.x, y + 5.5)
          doc.text('QUANTIDADE', cols.quant.x + cols.quant.w / 2, y + 5.5, { align: 'center' })
          doc.text('UNIDADE', cols.unid.x + cols.unid.w / 2, y + 5.5, { align: 'center' })
          doc.text('PREÇO UNIT.', cols.punit.x + cols.punit.w, y + 5.5, { align: 'right' })
          doc.text('TOTAL', cols.total.x, y + 5.5, { align: 'right' })
          y += 10
        }

        doc.setTextColor(...TEXT_MAIN)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8)
        doc.text(descLines, cols.desc.x, y + 4)

        // Observação do Item - Destacada com fundo sutil ou borda
        if (item.observacao && item.observacao.trim() !== '') {
          const obsTop = y + 4 + (descLines.length * 4)
          const obsLines = doc.splitTextToSize(`OBS: ${item.observacao}`, cols.desc.w - 2)
          
          doc.setFont('helvetica', 'bolditalic')
          doc.setFontSize(7.5)
          doc.setTextColor(180, 0, 0) // Vermelho escuro para destaque
          doc.text(obsLines, cols.desc.x + 1, obsTop)
        }

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...TEXT_MUTED)
        doc.text(String(item.quantidade), cols.quant.x + cols.quant.w / 2, y + 4, { align: 'center' })
        doc.text(item.unidade, cols.unid.x + cols.unid.w / 2, y + 4, { align: 'center' })

        doc.text(formatCurrencyPDF(item.precoUnitario), cols.punit.x + cols.punit.w, y + 4, { align: 'right' })

        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...TEXT_MAIN)
        doc.text(formatCurrencyPDF(item.total), cols.total.x, y + 4, { align: 'right' })

        y += rowH

        drawLine(doc, margin, y, pageW - margin, y, [240, 240, 240], 0.3)
        y += 2
      })

      y += 4

      // ============================================================
      // OBSERVAÇÕES E TOTAIS (RODAPÉ CLEAN)
      // ============================================================
      if (y + 40 > pageH - 20) {
        doc.addPage()
        y = margin
      }

      // Bloco de Notas (Left) e Totais (Right)
      const leftW = contentW * 0.6
      const obsText = orcamento.observacoes || ''

      if (obsText) {
        doc.setFontSize(7)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...TEXT_MUTED)
        doc.text('OBSERVAÇÕES IMPORTANTES:', margin, y)

        doc.setFontSize(8)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(...TEXT_MAIN)
        const obsLines = doc.splitTextToSize(`Notas Adicionais: ${obsText}`, leftW)
        doc.text(obsLines, margin, y + 5)
      }

      // Bloco Totalizador
      const footerY = y
      doc.setFontSize(10)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...TEXT_MUTED)
      doc.text('TOTAL DO ORÇAMENTO:', pageW - margin - 45, footerY + 5, { align: 'right' })

      drawRect(doc, pageW - margin - 40, footerY - 1, 40, 9, MUTED_GREEN)
      doc.setFontSize(14)
      doc.setTextColor(...PRIMARY_GREEN)
      doc.text(formatCurrencyPDF(orcamento.totalGeral), pageW - margin - 2, footerY + 5, { align: 'right' })

      // ============================================================
      // RODAPÉ FIXO
      // ============================================================
      const pageCount = (doc as any).internal.getNumberOfPages()
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i)
        doc.setFillColor(...MUTED_GREEN)
        doc.rect(0, pageH - 12, pageW, 12, 'F')

        doc.setTextColor(...TEXT_MUTED)
        doc.setFontSize(6)
        doc.setFont('helvetica', 'normal')
        doc.text(
          `Primardi  |  Sistema de Gestão Comercial  |  Documento processado em ${new Date().toLocaleString('pt-BR')}`,
          margin,
          pageH - 5
        )
        doc.text(`Página ${i} de ${pageCount}`, pageW - margin, pageH - 5, { align: 'right' })
      }

      doc.save(`${orcamento.numero}.pdf`)
    } catch (error) {
      console.error('[v0] Erro ao gerar PDF:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button variant={variant} size={size} onClick={generatePDF} disabled={isLoading}>
      {isLoading ? (
        <Loader2 className="size-4 mr-2 animate-spin" />
      ) : (
        <FileDown className="size-4 mr-2" />
      )}
      {isLoading ? 'Gerando...' : 'PDF'}
    </Button>
  )
}
