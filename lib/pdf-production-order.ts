import jsPDF from "jspdf";
import type { Pedido, Cliente, Vendedor } from "./types";
import { produtos } from "./mock-data";

// Helper Colors
const PRETO = [0, 0, 0] as [number, number, number];
const CINZA_BORDA = [100, 100, 100] as [number, number, number];
const VERMELHO_DESTAQUE = [220, 38, 38] as [number, number, number];

function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit"
    });
}

function drawLine(doc: jsPDF, x1: number, y1: number, x2: number, y2: number, color = CINZA_BORDA, width = 0.3) {
    doc.setDrawColor(...color);
    doc.setLineWidth(width);
    doc.line(x1, y1, x2, y2);
}

function drawBox(doc: jsPDF, x: number, y: number, w: number, h: number, label?: string, value?: string, isRedLabel = false) {
    doc.setDrawColor(...CINZA_BORDA);
    doc.setLineWidth(0.3);
    doc.rect(x, y, w, h);

    if (label) {
        doc.setTextColor(isRedLabel ? VERMELHO_DESTAQUE[0] : PRETO[0], isRedLabel ? VERMELHO_DESTAQUE[1] : PRETO[1], isRedLabel ? VERMELHO_DESTAQUE[2] : PRETO[2]);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.text(label, x + 1, y + 3);
    }

    if (value) {
        doc.setTextColor(...PRETO);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(value, x + 2, y + h - 2);
    }
}

function drawCheckbox(doc: jsPDF, x: number, y: number, label: string, checked = false) {
    doc.setDrawColor(...PRETO);
    doc.setLineWidth(0.3);
    doc.rect(x, y, 3, 3);
    if (checked) {
        doc.text("X", x + 0.5, y + 2.5);
    }

    doc.setTextColor(...PRETO);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(label, x + 4, y + 2.5);
}

export async function gerarOPPDF(pedido: Pedido, cliente: Cliente, vendedor?: Vendedor): Promise<void> {
    // A4 paper
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

    const pageW = 210;
    const pageH = 297;
    const mx = 10; // Margem X
    const w = pageW - mx * 2; // Largura Util  (190)

    pedido.itens.forEach((item, index) => {
        if (index > 0) {
            doc.addPage();
        }

        let y = 10;

        const produto = item.produtoId ? produtos.find(e => e.id === item.produtoId) : null;

        // ==============================================
        // HEADER DA OP
        // ==============================================
        const opDate = formatDate(pedido.criadoEm); // Ex: 03 / 02 / 26

        // Data e Pasta
        drawBox(doc, mx, y, 40, 8);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text("DATA: " + opDate, mx + 2, y + 5);

        // Pasta (Mock info)
        drawBox(doc, mx + 40, y, 35, 8);
        doc.text("CÓDIGO: " + (produto?.codigo || "N/D"), mx + 42, y + 5);

        // OC Cliente
        drawBox(doc, mx + 75, y, 40, 8);
        doc.text("OC CLIENTE: " + (pedido.ocCliente || ""), mx + 77, y + 5);

        // Representante
        drawBox(doc, mx + 115, y, w - 115, 8);
        doc.text("REPRESENTANTE:", mx + 117, y + 5);
        doc.setTextColor(...VERMELHO_DESTAQUE);
        doc.text(vendedor ? vendedor.nome.toUpperCase() : "", mx + 145, y + 5);
        doc.setTextColor(...PRETO);

        y += 8;

        // Nome Fantasia (Usando Razaão social do cliente por enquanto)
        drawBox(doc, mx, y, w, 8);
        doc.text("NOME FANTASIA:", mx + 2, y + 5);
        doc.setTextColor(...VERMELHO_DESTAQUE);
        doc.setFontSize(9);
        doc.text(cliente.razaoSocial.toUpperCase(), mx + 30, y + 5);
        doc.setTextColor(...PRETO);

        y += 8;

        // Cliente / Razao Social
        drawBox(doc, mx, y, w, 8);
        doc.text("CLIENTE / RAZÃO SOCIAL:", mx + 2, y + 5);
        doc.setTextColor(...VERMELHO_DESTAQUE);
        doc.setFontSize(9);
        doc.text(cliente.razaoSocial.toUpperCase(), mx + 45, y + 5);
        doc.setTextColor(...PRETO);

        y += 8;

        // Linha de Checkboxes de Repetição
        drawBox(doc, mx, y, w, 6);
        // Simulação de checkboxes (Neste escopo, é uma ficha comum para anotar ou mockar)
        drawCheckbox(doc, mx + 25, y + 1.5, "REPETIÇÃO EXATA", false);
        drawCheckbox(doc, mx + 75, y + 1.5, "REPETIÇÃO COM ALTERAÇÃO", true); // Simulação Red para destaque na marcação
        doc.setFillColor(...VERMELHO_DESTAQUE);
        doc.rect(mx + 75, y + 1.5, 3, 3, "F");
        doc.setTextColor(...PRETO);
        drawCheckbox(doc, mx + 135, y + 1.5, "NOVO", false);
        drawCheckbox(doc, mx + 155, y + 1.5, "RETRABALHO", false);

        y += 6;

        // ==============================================
        // INFO TÉCNICAS (GRID CENTRAL SUPERIOR)
        // ==============================================

        // Quantidade (esq superior)
        const qH = 10;
        drawBox(doc, mx, y, 65, qH, "QUANTIDADE:", `${item.quantidade} ${item.unidade}`, true);

        // Cores
        drawBox(doc, mx + 65, y, 40, qH * 2 + 10, "CATEGORIA:");
        const coresText = "Geral";
        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.text(coresText, mx + 67, y + 8);
        // Simulação de cores antigas...
        doc.setFillColor(...PRETO);
        doc.rect(mx + 67, y + 15, 3, 3, "F");
        doc.text("PRETO", mx + 72, y + 17.5);

        // Aplicacoes
        drawBox(doc, mx + 105, y, 45, qH * 2 + 10, "UNIDADE:");
        const hasUV = false;
        const hasColdStamp = false;
        drawCheckbox(doc, mx + 107, y + 5, "PADRÃO", true);
        drawCheckbox(doc, mx + 107, y + 10, "FRACIONADO", false);

        // Data Entrega e PCP
        drawBox(doc, mx + 150, y, w - 150, qH + 5, "DATA DE ENTREGA:");
        doc.setFontSize(9);
        doc.text(pedido.prazoEntrega ? new Date(pedido.prazoEntrega).toLocaleDateString('pt-BR') : "N/D", mx + 152, y + 11);

        drawBox(doc, mx + 150, y + qH + 5, w - 150, qH + 5, "PCP:");

        y += qH;

        // Medida e Faca
        const medida = "N/D";
        const faca = produto ? produto.codigo : "N/D";
        drawBox(doc, mx, y, 35, 10, "EAN:", produto?.ean || "N/D", true);
        drawBox(doc, mx + 35, y, 30, 10, "CÓDIGO:", faca, true);

        y += 10;

        // ITENS / UNIDADES
        const qtdRolo = "N/D";
        drawBox(doc, mx, y, 35, 10, "QTD EMBALAGEM:", qtdRolo, false);
        // METRAGEM
        const metragem = "N/D";
        drawBox(doc, mx + 35, y, 30, 10, "ESTOQUE ATUAL:", String(produto?.estoque || 0));

        // APROVACAO VENDEDOR/CLIENTE (abaixo de pcp)
        drawBox(doc, mx + 150, y, w - 150, 10, "APROVAÇÃO VENDEDOR/CLIENTE");

        y += 10;

        // TUBETE
        const tubete = "N/D";
        drawBox(doc, mx, y, w, 8);
        doc.text("EMBALAGEM:", mx + 2, y + 5);
        doc.setFontSize(10);
        doc.setTextColor(...VERMELHO_DESTAQUE);
        doc.text(tubete, mx + 15, y + 5);
        doc.setTextColor(...PRETO);

        y += 8;

        // MATERIAL
        const material = "N/D";
        drawBox(doc, mx, y, w, 8);
        doc.setFontSize(8);
        doc.text("FORNECEDOR:", mx + 2, y + 5);
        doc.setFontSize(10);
        doc.setTextColor(...VERMELHO_DESTAQUE);
        doc.text(material, mx + 20, y + 5);
        doc.setTextColor(...PRETO);

        y += 8;

        // ==============================================
        // ORIENTAÇÃO E ARTE (MOCK ÁREA)
        // ==============================================
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.text("Orientação correta de rebobinagem", mx, y + 4);

        y += 6;

        const arteHeight = 110;

        // Caixa lateral Rebobinagem (Esquerda)
        drawBox(doc, mx, y, 40, arteHeight);
        // Simulation text for rebobinagem
        const rY = y + 5;
        doc.setFontSize(6);
        doc.setFont("helvetica", "normal");
        doc.text("Ext 0º", mx + 5, rY); drawCheckbox(doc, mx + 15, rY - 2, "", false);
        doc.text("Ext 90º", mx + 5, rY + 15); drawCheckbox(doc, mx + 15, rY + 13, "", false);
        doc.text("Ext 180º", mx + 5, rY + 30); drawCheckbox(doc, mx + 15, rY + 28, "", false);
        doc.text("Ext 270º", mx + 5, rY + 45); drawCheckbox(doc, mx + 15, rY + 43, "", false);

        doc.text("Int 0º", mx + 5, rY + 60); drawCheckbox(doc, mx + 15, rY + 58, "", false);
        doc.text("Int 90º", mx + 5, rY + 75); drawCheckbox(doc, mx + 15, rY + 73, "", false);
        doc.text("Int 180º", mx + 5, rY + 90); drawCheckbox(doc, mx + 15, rY + 88, "", false);
        doc.text("Int 270º", mx + 5, rY + 105); drawCheckbox(doc, mx + 15, rY + 103, "", false);

        // Caixa da Imagem Central e Info Nutricional (Direita)
        drawBox(doc, mx + 45, y, w - 45, arteHeight);
        // Caixa central info do produto
        doc.setFontSize(15);
        doc.setTextColor(200, 200, 200);
        doc.text("[ ÁREA REPARADA PARA MOCKUP DE ARTE ]", mx + 55, y + 50);
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(10);
        doc.text("Produto: " + item.descricao, mx + 50, y + 60);

        if (item.observacao) {
            doc.setFontSize(9);
            doc.setTextColor(...VERMELHO_DESTAQUE);
            doc.text("Observação do Item: " + item.observacao, mx + 50, y + 70);
            doc.setTextColor(...PRETO);
        }

        y += arteHeight;

        // ==============================================
        // OBSERVAÇÕES E RODAPÉ (ASSINATURAS)
        // ==============================================

        // Caixa de Observações
        const obsY = y;
        drawBox(doc, mx, obsY, w, 40, "Observações:");
        // Linhas para escrever na obs
        for (let i = 0; i < 6; i++) {
            drawLine(doc, mx + 2, obsY + 10 + (i * 5), mx + w - 2, obsY + 10 + (i * 5), [200, 200, 200]);
        }

        // Preencher algumas obs do sistema
        if (pedido.observacoesGerais) {
            doc.setFontSize(8);
            doc.text(pedido.observacoesGerais, mx + 2, obsY + 8);
        }

        y += 40;

        // Assinaturas base (Fornecedor, Impressor, etc)
        const sigH = 15;
        const colSize = w / 3;

        // Row 1
        drawBox(doc, mx, y, colSize, sigH, "FORNECEDOR:");
        drawBox(doc, mx + colSize, y, colSize, sigH, "IMPRESSOR:");
        drawBox(doc, mx + colSize * 2, y, colSize, sigH, "REBOBINADOR:");

        y += sigH;

        // Row 2
        drawBox(doc, mx, y, colSize, 12, "Nº LOTE:");

        drawBox(doc, mx + colSize, y, colSize, 12);
        doc.setFontSize(6);
        doc.text("ARTE", mx + colSize + 2, y + 3);
        doc.text("ENTRADA: ____ / ____", mx + colSize + 2, y + 8);
        doc.text("SAÍDA: ____ / ____", mx + colSize + colSize / 2, y + 8);

        drawBox(doc, mx + colSize * 2, y, colSize, 12);
        doc.text("PCP", mx + colSize * 2 + 2, y + 3);
        doc.text("ENTRADA: ____ / ____", mx + colSize * 2 + 2, y + 8);
        doc.text("SAÍDA: ____ / ____", mx + colSize * 2 + colSize / 2, y + 8);

        y += 12;

        // Row 3
        drawBox(doc, mx, y, colSize, 12, "Nº NOTA FISCAL:");

        drawBox(doc, mx + colSize, y, colSize, 12);
        doc.text("ASS.:", mx + colSize + 2, y + 8);

        drawBox(doc, mx + colSize * 2, y, colSize, 12);
        doc.text("ASS.:", mx + colSize * 2 + 2, y + 8);

        doc.text("EXPEDIÇÃO", mx + colSize * 2 + 15, y - 10);
        doc.text("ENTRADA: ____ / ____", mx + colSize * 2 + 15, y - 5);
        doc.text("SAÍDA: ____ / ____", mx + colSize * 2 + 40, y - 5);
        // As in picture, roughly simulating fields

    }); // Fim do ForEach (uma página por item)

    // Salvar PDF
    doc.save(`OP_${pedido.numero}.pdf`);
}
