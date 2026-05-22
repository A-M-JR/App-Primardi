'use client';

import { useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { exportPdfFromElement } from '@/lib/pdf-export';
import { FileDown, Loader2 } from 'lucide-react';

interface PDFExportButtonProps extends ButtonProps {
  elementId: string;
  filename: string;
  label?: string;
  showIcon?: boolean;
}

export function PDFExportButton({
  elementId,
  filename,
  label = 'Download PDF',
  showIcon = true,
  ...props
}: PDFExportButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleExport = async () => {
    setIsLoading(true);
    try {
      await exportPdfFromElement(
        elementId,
        `${filename}_${new Date().toISOString().split('T')[0]}.pdf`
      );
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : showIcon ? (
        <FileDown className="w-4 h-4 mr-2" />
      ) : null}
      {label}
    </Button>
  );
}
