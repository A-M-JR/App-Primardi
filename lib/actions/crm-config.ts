"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import crypto from "crypto"
import { getRequesterContext } from "./users"

export async function getCRMConfig() {
  const { empresaId } = await getRequesterContext();

  const empresa = await prisma.empresa.findUnique({
    where: { id: empresaId },
    select: { apiToken: true }
  });

  const origens = await prisma.origemLead.findMany({
    where: { empresaId, ativo: true },
    orderBy: { nome: 'asc' }
  });

  const funil = await prisma.funilStatus.findMany({
    where: { empresaId, ativo: true },
    orderBy: { ordem: 'asc' }
  });

  return {
    apiToken: empresa?.apiToken || null,
    origens,
    funil
  };
}

export async function generateNewApiToken() {
  const { empresaId } = await getRequesterContext();
  const newToken = crypto.randomBytes(32).toString('hex');
  
  await prisma.empresa.update({
    where: { id: empresaId },
    data: { apiToken: newToken }
  });

  revalidatePath("/configuracoes");
  return newToken;
}

export async function saveFunnelStatus(statusList: any[]) {
  const { empresaId } = await getRequesterContext();

  await prisma.$transaction(async (tx) => {
    const incomingIds = statusList.map(s => s.id).filter(id => typeof id === 'number');
    
    // Inactivate ones that are no longer in the list and free their ordem
    let inactiveStatuses;
    if (incomingIds.length > 0) {
      inactiveStatuses = await tx.funilStatus.findMany({ where: { empresaId, id: { notIn: incomingIds } } });
    } else {
      inactiveStatuses = await tx.funilStatus.findMany({ where: { empresaId } });
    }

    for (const st of inactiveStatuses) {
      await tx.funilStatus.update({
        where: { id: st.id },
        data: { ativo: false, ordem: -st.id } // negative id guarantees uniqueness and gets it out of the way
      });
    }

    // Shift existing ordens out of the way to prevent @@unique([empresaId, ordem]) violation during swap
    if (incomingIds.length > 0) {
      const existing = await tx.funilStatus.findMany({ where: { empresaId, id: { in: incomingIds } } });
      for (const st of existing) {
        await tx.funilStatus.update({
          where: { id: st.id },
          data: { ordem: st.id + 1000000 }
        });
      }
    }

    // Upsert the ones in the list
    for (let i = 0; i < statusList.length; i++) {
      const s = statusList[i];
      if (typeof s.id === 'number') {
        // Find if name is used by another inactive status
        const existingName = await tx.funilStatus.findFirst({ where: { empresaId, nome: s.nome, id: { not: s.id } } });
        if (existingName) {
           await tx.funilStatus.update({ where: { id: existingName.id }, data: { nome: `${s.nome} (Inativo ${existingName.id})` } });
        }

        await tx.funilStatus.update({
          where: { id: s.id },
          data: { nome: s.nome, cor: s.cor, ordem: i + 1, ativo: true }
        });
      } else {
        // check if name exists
        const existingName = await tx.funilStatus.findFirst({ where: { empresaId, nome: s.nome } });
        if (existingName) {
          await tx.funilStatus.update({
            where: { id: existingName.id },
            data: { cor: s.cor, ordem: i + 1, ativo: true }
          });
          // Fix local id for return
          s.id = existingName.id;
        } else {
          await tx.funilStatus.create({
            data: { empresaId, nome: s.nome, cor: s.cor, ordem: i + 1, ativo: true }
          });
        }
      }
    }
  }).catch((err) => {
    console.error("Erro Prisma Transaction Funil:", err);
    throw new Error("Erro ao salvar. Verifique se existem nomes duplicados nas etapas.");
  });

  revalidatePath("/configuracoes");
  revalidatePath("/leads");
  return { success: true };
}

export async function saveOrigins(originsList: any[]) {
  const { empresaId } = await getRequesterContext();

  await prisma.$transaction(async (tx) => {
    const incomingIds = originsList.map(o => o.id).filter(id => typeof id === 'number');
    
    if (incomingIds.length > 0) {
      await tx.origemLead.updateMany({
        where: { empresaId, id: { notIn: incomingIds } },
        data: { ativo: false }
      });
    } else {
      await tx.origemLead.updateMany({
        where: { empresaId },
        data: { ativo: false }
      });
    }

    for (const o of originsList) {
      if (typeof o.id === 'number') {
         const existingName = await tx.origemLead.findFirst({ where: { empresaId, nome: o.nome, id: { not: o.id } } });
         if (existingName) {
            await tx.origemLead.update({ where: { id: existingName.id }, data: { nome: `${o.nome} (Inativo ${existingName.id})` } });
         }

        await tx.origemLead.update({
          where: { id: o.id },
          data: { nome: o.nome, ativo: true }
        });
      } else {
        const existingName = await tx.origemLead.findFirst({ where: { empresaId, nome: o.nome } });
        if (existingName) {
          await tx.origemLead.update({
            where: { id: existingName.id },
            data: { ativo: true }
          });
        } else {
          await tx.origemLead.create({
            data: { empresaId, nome: o.nome, ativo: true }
          });
        }
      }
    }
  }).catch((err) => {
    console.error("Erro Prisma Transaction Origens:", err);
    throw new Error("Erro ao salvar. Verifique se existem origens duplicadas.");
  });

  revalidatePath("/configuracoes");
  return { success: true };
}
