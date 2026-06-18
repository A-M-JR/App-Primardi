import { getRequesterContext, type RequesterContext } from "@/lib/actions/users"
import { can, type ModuloId, type Acao, type AccessContext } from "@/lib/modules"

/**
 * Garante que o solicitante pode executar `acao` no `modulo`.
 * Reaproveita as regras de `can()` (módulo ativo + nível/role/permissões).
 */
export async function assertAcesso(modulo: ModuloId, acao: Acao = "view"): Promise<RequesterContext> {
  const ctx = await getRequesterContext()
  if (!can(ctx as unknown as AccessContext, modulo, acao)) {
    throw new Error("Sem permissão para esta ação.")
  }
  return ctx
}
