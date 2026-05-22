'use client';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PDFQuotation } from '@/components/pdf-quotation';
import { exportPdfFromElement } from '@/lib/pdf-export';
import { getOrcamentoById } from '@/lib/actions/orcamentos';
import { FileDown, ArrowLeft, Loader2 } from 'lucide-react';

interface PDFPageProps {
  params: Promise<{ id: string }>;
}

export default function QuotationPDFPage({ params }: PDFPageProps) {
  const [orcamento, setOrcamento] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    params.then(({ id }) => {
      getOrcamentoById(Number(id)).then(data => {
        if (data) {
          setOrcamento(data);
          setCliente(data.cliente);
        }
        setLoadingData(false);
      }).catch(() => setLoadingData(false));
    });
  }, [params]);

  const handleDownloadPDF = async () => {
    setIsLoading(true);
    try {
      await exportPdfFromElement(
        'pdf-content',
        `Orcamento_${orcamento?.id}_${new Date().toISOString().split('T')[0]}.pdf`
      );
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!orcamento || !cliente) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <p className="text-lg text-muted-foreground">Orçamento não encontrado</p>
        <Link href="/orcamentos">
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar aos Orçamentos
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Toolbar */}
      <div className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between p-4 max-w-7xl mx-auto">
          <Link href={`/orcamentos/${orcamento.id}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
          </Link>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
            >
              Imprimir
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadPDF}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <FileDown className="w-4 h-4 mr-2" />
              )}
              Download PDF
            </Button>
          </div>
        </div>
      </div>

      {/* PDF Content */}
      <div className="py-8">
        <div className="max-w-4xl mx-auto">
          <PDFQuotation orcamento={orcamento} cliente={cliente} />
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            background: white;
          }
          .sticky {
            display: none;
          }
          #pdf-content {
            padding: 0;
            min-height: auto;
            box-shadow: none;
            border: none;
          }
          .max-w-4xl {
            max-width: 100%;
          }
          .py-8 {
            padding: 0;
          }
        }
      `}</style>
    </div>
  );
}
