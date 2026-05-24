import jsPDF from "jspdf";
import type { Pedido, Cliente, Vendedor } from "./types";
import { getEmpresa } from "@/lib/actions/config";

const PRIMARY_GREEN = [6, 58, 31] as [number, number, number] // #063A1F
const ACCENT_GREEN = [0, 230, 118] as [number, number, number] // #00E676
const MUTED_GREEN = [240, 246, 243] as [number, number, number]
const TEXT_MAIN = [40, 40, 40] as [number, number, number]
const TEXT_MUTED = [100, 100, 100] as [number, number, number]
const BORDER_LIGHT = [220, 225, 220] as [number, number, number]
const WHITE = [255, 255, 255] as [number, number, number]

function formatCurrencyPDF(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDatePDF(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR");
}

function drawLine(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, color: [number, number, number] = BORDER_LIGHT, width = 0.3) {
  doc.setDrawColor(...color);
  doc.setLineWidth(width);
  doc.line(x1, y1, x2, y2);
}

function drawRect(doc: jsPDF, x: number, y: number, w: number, h: number, fillColor: [number, number, number]) {
  doc.setFillColor(...fillColor);
  doc.rect(x, y, w, h, "F");
}

async function getLogoBase64() {
  try {
    const res = await fetch('/logo_sem_fundo_primardi.png');
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (err) {
    console.error("Erro ao carregar logo:", err);
    return null;
  }
}

export async function gerarPDFPedido(pedido: Pedido, cliente: Cliente, vendedor?: Vendedor): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const empresaData = await getEmpresa();

  const pageW = 210;
  const pageH = 297;
  const margin = 12;
  const contentW = pageW - margin * 2;

  let y = margin;

  // ============================================================
  // CABEÇALHO (PREMIUM CLEAN)
  // ============================================================

  // Linha de acento sutil no topo
  doc.setFillColor(...PRIMARY_GREEN);
  doc.rect(0, 0, pageW, 6, "F");
  doc.setFillColor(...ACCENT_GREEN);
  doc.rect(0, 6, pageW, 1.5, "F");

  y = margin + 5;

  const logoBase64 = await getLogoBase64();

  // Logo / Nome da empresa (esquerda)
  let companyInfoX = margin;
  let companyInfoY = y + 16;

  if (logoBase64) {
    doc.addImage(logoBase64, "PNG", margin - 2, y - 8, 30, 30);
    companyInfoX = margin + 28;
    companyInfoY = y + 4;

    doc.setTextColor(...PRIMARY_GREEN);
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text(empresaData.nomeFantasia.toUpperCase(), companyInfoX, companyInfoY);
    companyInfoY += 6;
  } else {
    doc.setTextColor(...PRIMARY_GREEN);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text(empresaData.nomeFantasia.toUpperCase(), companyInfoX, y + 6);
  }

  doc.setTextColor(...TEXT_MUTED);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`${empresaData.razaoSocial}`, companyInfoX, companyInfoY);
  doc.text(`CNPJ: ${empresaData.cnpj}`, companyInfoX, companyInfoY + 4);
  
  const contactTel = vendedor?.telefone || empresaData.telefone;
  const contactEmail = vendedor?.email || empresaData.email;
  doc.text(`Contato: ${contactTel} | ${contactEmail}`, companyInfoX, companyInfoY + 8);

  // Informações do Documento (direita)
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MAIN);
  doc.text("DOCUMENTO DE CONFIRMAÇÃO", pageW - margin, y + 4, { align: "right" });

  doc.setFontSize(18);
  doc.setTextColor(...PRIMARY_GREEN);
  doc.text(pedido.numero, pageW - margin, y + 12, { align: "right" });

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`Emitido em: ${formatDatePDF(pedido.criadoEm)}`, pageW - margin, y + 17, { align: "right" });

  // Divisor Premium
  y += 26;
  drawLine(doc, margin, y, pageW - margin, y, BORDER_LIGHT, 0.5);
  y += 8;

  // ============================================================
  // BLOCO DE INFORMAÇÕES (CLIENTE & COMERCIAL)
  // ============================================================

  const midPage = pageW / 2;

  // CLiente
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("FATURAR PARA / DESTINATÁRIO:", margin, y);

  y += 5;
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MAIN);
  doc.text(cliente.razaoSocial, margin, y);

  y += 4;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_MUTED);
  doc.text(`CNPJ: ${cliente.cnpj} | IE: ${cliente.ie || "Isento"}`, margin, y);

  y += 4;
  doc.text(`${cliente.logradouro || ""}, ${cliente.numeroEnd || "S/N"} - ${cliente.bairro || ""}`, margin, y);

  y += 4;
  doc.text(`${cliente.cidade}/${cliente.estado} - CEP: ${cliente.cep}`, margin, y);

  if (pedido.nomeComprador) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text(`A/C: ${pedido.nomeComprador}`, margin, y);
  }

  // Bloco Comercial (Direita)
  let yRight = y - 21; // Rewind back up to align with Faturar Para
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("INFORMAÇÕES COMERCIAIS:", midPage + 10, yRight);

  yRight += 5;
  const colRightLabels = midPage + 10;
  const colRightValues = midPage + 40;

  const comerciais = [
    { label: "Vendedor Rsp.:", value: vendedor?.nome || "Não definido" },
    { label: "Pagamento:", value: pedido.formaPagamento?.nome || "A Combinar" },
    { label: "Prazo de Entrega:", value: pedido.prazoEntrega ? new Date(pedido.prazoEntrega).toLocaleDateString('pt-BR') : "A definir" },
    { label: "Termos de Frete:", value: `${pedido.tipoFrete || ""} - ${formatCurrencyPDF(pedido.valorFrete)}` },
  ];

  comerciais.forEach(c => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MUTED);
    doc.text(c.label, colRightLabels, yRight);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_MAIN);
    doc.text(c.value, colRightValues, yRight);
    yRight += 5;
  });

  // Align Y back exactly under the lowest point
  y = Math.max(y, yRight) + 8;
  drawLine(doc, margin, y, pageW - margin, y, BORDER_LIGHT, 0.5);
  y += 10;

  // ============================================================
  // TABELA DE ITENS (CLEAN E ELEGANTE)
  // ============================================================

  // Headers Background Faint
  drawRect(doc, margin, y, contentW, 8, MUTED_GREEN);

  doc.setTextColor(...PRIMARY_GREEN);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");

  // Colunas (Mais espaço pra descrição)
  const cols = {
    desc: { x: margin + 3, w: 90, align: "left" },
    quant: { x: margin + 95, w: 20, align: "center" },
    unid: { x: margin + 115, w: 15, align: "center" },
    punit: { x: margin + 130, w: 25, align: "right" },
    total: { x: margin + 183, w: 25, align: "right" }, // 183 is right edge minus padding
  };

  doc.text("DESCRIÇÃO DO PRODUTO", cols.desc.x, y + 5.5);
  doc.text("QUANTIDADE", cols.quant.x + cols.quant.w / 2, y + 5.5, { align: "center" });
  doc.text("UNIDADE", cols.unid.x + cols.unid.w / 2, y + 5.5, { align: "center" });
  doc.text("PREÇO UNIT.", cols.punit.x + cols.punit.w, y + 5.5, { align: "right" });
  doc.text("TOTAL", cols.total.x, y + 5.5, { align: "right" });

  y += 10;

  // Draw Items
  pedido.itens.forEach((item, idx) => {
    const descLines = doc.splitTextToSize(item.descricao, cols.desc.w);
    const obsLinesCount = item.observacao ? doc.splitTextToSize(`OBS: ${item.observacao}`, cols.desc.w - 2).length : 0;
    const rowH = Math.max(10, (descLines.length + obsLinesCount) * 4 + 7);

    // Nova página se não couber
    if (y + rowH > pageH - 50) {
      doc.addPage();
      y = margin;
      drawRect(doc, margin, y, contentW, 8, MUTED_GREEN);
      doc.setTextColor(...PRIMARY_GREEN);
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.text("DESCRIÇÃO DO PRODUTO", cols.desc.x, y + 5.5);
      doc.text("QUANTIDADE", cols.quant.x + cols.quant.w / 2, y + 5.5, { align: "center" });
      doc.text("UNIDADE", cols.unid.x + cols.unid.w / 2, y + 5.5, { align: "center" });
      doc.text("PREÇO UNIT.", cols.punit.x + cols.punit.w, y + 5.5, { align: "right" });
      doc.text("TOTAL", cols.total.x, y + 5.5, { align: "right" });
      y += 10;
    }

    doc.setTextColor(...TEXT_MAIN);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(descLines, cols.desc.x, y + 4);

    // Observação do Item
    if (item.observacao && item.observacao.trim() !== '') {
      const obsTop = y + 4 + (descLines.length * 4);
      const obsLines = doc.splitTextToSize(`OBS: ${item.observacao}`, cols.desc.w - 2);
      
      doc.setFont("helvetica", "bolditalic");
      doc.setFontSize(7.5);
      doc.setTextColor(180, 0, 0); // Vermelho destaque
      doc.text(obsLines, cols.desc.x + 1, obsTop);
    }

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_MUTED);
    doc.text(String(item.quantidade), cols.quant.x + cols.quant.w / 2, y + 4, { align: "center" });
    doc.text(item.unidade, cols.unid.x + cols.unid.w / 2, y + 4, { align: "center" });

    doc.text(formatCurrencyPDF(item.precoUnitario), cols.punit.x + cols.punit.w, y + 4, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_MAIN);
    doc.text(formatCurrencyPDF(item.total), cols.total.x, y + 4, { align: "right" });

    y += rowH;

    // Bottom border do item
    drawLine(doc, margin, y, pageW - margin, y, [240, 240, 240], 0.3);
    y += 2;
  });

  y += 4;

  // ============================================================
  // OBSERVAÇÕES E TOTAIS (RODAPÉ CLEAN)
  // ============================================================

  if (y + 40 > pageH - 20) {
    doc.addPage();
    y = margin;
  }

  // Bloco de Notas (Left) e Totais (Right)
  const leftW = contentW * 0.6;
  const obsText = ""; // Removido as observações de produção conforme solicitado

  // Bloco Totalizador e Assinaturas
  const footerY = y;

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_MUTED);
  doc.text("TOTAL DO PEDIDO:", pageW - margin - 35, footerY, { align: "right" });

  doc.setFontSize(16);
  doc.setTextColor(...PRIMARY_GREEN);
  doc.text(formatCurrencyPDF(pedido.totalGeral + (pedido.valorFrete || 0)), pageW - margin, footerY, { align: "right" });

  // Assinaturas minimalistas
  y += Math.max(30, obsText ? 20 : 0);

  if (y + 30 > pageH - 20) {
    doc.addPage();
    y = margin + 20;
  }

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...TEXT_MUTED);
  const disclaimer = "* Este documento certifica a formalização do pedido de produtos, atestando anuência com os termos comerciais estipulados acima.";
  const disLines = doc.splitTextToSize(disclaimer, contentW);
  doc.text(disLines, margin, y);

  y += 25;
  const sigW = 60;
  drawLine(doc, margin, y, margin + sigW, y, TEXT_MUTED, 0.3);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Representante Comercial", margin + (sigW / 2), y + 5, { align: "center" });

  drawLine(doc, pageW - margin - sigW, y, pageW - margin, y, TEXT_MUTED, 0.3);
  doc.text("Cliente (Aprovação)", pageW - margin - (sigW / 2), y + 5, { align: "center" });

  // ============================================================
  // RODAPÉ DA PÁGINA FIXO
  // ============================================================

  // Footer Banner Decorator
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFillColor(...MUTED_GREEN);
    doc.rect(0, pageH - 12, pageW, 12, "F");

    doc.setTextColor(...TEXT_MUTED);
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Primardi  |  Sistema de Gestão Comercial  |  Documento processado em ${new Date().toLocaleString("pt-BR")}`,
      margin,
      pageH - 5
    );
    doc.text(`Página ${i} de ${pageCount}`, pageW - margin, pageH - 5, { align: "right" });
  }

  // Salvar
  doc.save(`${pedido.numero}.pdf`);
}
