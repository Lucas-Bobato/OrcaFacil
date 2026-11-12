import { randomUUID } from 'node:crypto';
import { perfilSchema, type Profissional } from '@orcafacil/shared';
import type { Db } from '../db/connection';
import { AppError } from '../errors';
import { profissionaisRepo } from '../repositories/profissionais';

export const perfilService = {
  obter(db: Db, usuarioId: string): Profissional {
    const perfil = profissionaisRepo.porUsuario(db, usuarioId);
    if (!perfil) throw new AppError(404, 'PERFIL_NAO_CADASTRADO', 'Cadastre seu perfil profissional');
    return perfil;
  },

  /**
   * Cria ou atualiza o perfil (RF01). Alterações valem para os próximos PDFs;
   * PDFs já gerados são snapshots e não mudam (RN11).
   */
  salvar(db: Db, usuarioId: string, entrada: unknown): { perfil: Profissional; criado: boolean } {
    const dados = perfilSchema.parse(entrada);
    const agora = new Date().toISOString();
    const existente = profissionaisRepo.porUsuario(db, usuarioId);
    if (existente) {
      profissionaisRepo.atualizar(db, existente.id, dados, agora);
    } else {
      profissionaisRepo.inserir(db, randomUUID(), usuarioId, dados, agora);
    }
    return { perfil: profissionaisRepo.porUsuario(db, usuarioId)!, criado: !existente };
  },

  /** Garante que existe perfil antes de criar clientes/orçamentos (CA01.1). */
  exigir(db: Db, usuarioId: string): Profissional {
    const perfil = profissionaisRepo.porUsuario(db, usuarioId);
    if (!perfil) {
      throw new AppError(409, 'PERFIL_NAO_CADASTRADO', 'Cadastre seu perfil antes de criar orçamentos');
    }
    return perfil;
  },
};
