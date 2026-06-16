-- CreateEnum
CREATE TYPE "crm_status_estoque_importacao" AS ENUM ('PROCESSANDO', 'CONCLUIDA', 'ERRO');

-- CreateEnum
CREATE TYPE "crm_status_estoque_importacao_linha" AS ENUM ('OK', 'ERRO', 'IGNORADA');

-- AlterTable
ALTER TABLE "crm_produtos" ADD COLUMN     "curva" TEXT,
ADD COLUMN     "ufo" TEXT,
ADD COLUMN     "mediaConsumo" DOUBLE PRECISION,
ADD COLUMN     "consumoMensal" JSONB,
ADD COLUMN     "estoqueAte" TEXT,
ADD COLUMN     "ultimaEntrada" TIMESTAMP(3),
ADD COLUMN     "quantidadePedido" DOUBLE PRECISION,
ADD COLUMN     "sugestaoCompra" DOUBLE PRECISION,
ADD COLUMN     "compra" DOUBLE PRECISION,
ADD COLUMN     "bloqCompra" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "crm_estoque_importacoes" (
    "id" SERIAL NOT NULL,
    "empresaId" INTEGER NOT NULL,
    "nomeArquivo" TEXT NOT NULL,
    "hashArquivo" TEXT,
    "status" "crm_status_estoque_importacao" NOT NULL DEFAULT 'PROCESSANDO',
    "totalLinhas" INTEGER NOT NULL DEFAULT 0,
    "linhasOk" INTEGER NOT NULL DEFAULT 0,
    "linhasErro" INTEGER NOT NULL DEFAULT 0,
    "linhasCriadas" INTEGER NOT NULL DEFAULT 0,
    "linhasAtualizadas" INTEGER NOT NULL DEFAULT 0,
    "mensagemErro" TEXT,
    "importadoPorUserId" INTEGER NOT NULL,
    "processadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crm_estoque_importacoes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_estoque_importacao_linhas" (
    "id" SERIAL NOT NULL,
    "importacaoId" INTEGER NOT NULL,
    "numeroLinha" INTEGER NOT NULL,
    "status" "crm_status_estoque_importacao_linha" NOT NULL DEFAULT 'OK',
    "dadosOriginais" JSONB NOT NULL,
    "codigo" TEXT,
    "descricao" TEXT,
    "curva" TEXT,
    "preco" DOUBLE PRECISION,
    "ufo" TEXT,
    "estoque" DOUBLE PRECISION,
    "mediaConsumo" DOUBLE PRECISION,
    "consumoMensal" JSONB,
    "ean" TEXT,
    "estoqueAte" TEXT,
    "ultimaEntrada" TIMESTAMP(3),
    "quantidade" DOUBLE PRECISION,
    "sugestao" DOUBLE PRECISION,
    "compra" DOUBLE PRECISION,
    "bloqCompra" BOOLEAN,
    "produtoId" INTEGER,
    "estoqueAntes" DOUBLE PRECISION,
    "estoqueDepois" DOUBLE PRECISION,
    "erroMensagem" TEXT,

    CONSTRAINT "crm_estoque_importacao_linhas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_estoque_importacoes_empresaId_criadoEm_idx" ON "crm_estoque_importacoes"("empresaId", "criadoEm");

-- CreateIndex
CREATE INDEX "crm_estoque_importacao_linhas_importacaoId_status_idx" ON "crm_estoque_importacao_linhas"("importacaoId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "crm_estoque_importacao_linhas_importacaoId_numeroLinha_key" ON "crm_estoque_importacao_linhas"("importacaoId", "numeroLinha");

-- AddForeignKey
ALTER TABLE "crm_estoque_importacoes" ADD CONSTRAINT "crm_estoque_importacoes_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "crm_empresas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_estoque_importacao_linhas" ADD CONSTRAINT "crm_estoque_importacao_linhas_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "crm_estoque_importacoes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "crm_estoque_importacao_linhas" ADD CONSTRAINT "crm_estoque_importacao_linhas_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "crm_produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
