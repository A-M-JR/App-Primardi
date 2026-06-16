-- CreateIndex
CREATE INDEX "crm_produtos_empresaId_nome_idx" ON "crm_produtos"("empresaId", "nome");

-- CreateIndex
CREATE INDEX "crm_produtos_ean_idx" ON "crm_produtos"("ean");
