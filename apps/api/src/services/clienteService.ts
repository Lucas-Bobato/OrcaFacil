import { randomUUID } from 'node:crypto';
import { clienteSchema, type Cliente } from '@orcafacil/shared';
import type { Db } from '../db/connection';
import { AppError, naoEncontrado } from '../errors';
import { clientesRepo } from '../repositories/clientes';

export const clienteService = {
  listar(db: Db, profissionalId: string, busca?: string): Cliente[] {
    return clientesRepo.listar(db, profissionalId, busca?.trim() || undefined);
  },

  obter(db: Db, profissionalId: string, id: string): Cliente {
    const cliente = clientesRepo.porId(db, profissionalId, id);
    if (!cliente) throw naoEncontrado('Cliente');
    return cliente;
  },

  criar(db: Db, profissionalId: string, entrada: unknown): Cliente {
    const dados = clienteSchema.parse(entrada);
    const id = randomUUID();
    clientesRepo.inserir(db, id, profissionalId, dados, new Date().toISOString());
    return clientesRepo.porId(db, profissionalId, id)!;
  },

  atualizar(db: Db, profissionalId: string, id: string, entrada: unknown): Cliente {
    this.obter(db, profissionalId, id);
    const dados = clienteSchema.parse(entrada);
    clientesRepo.atualizar(db, id, dados, new Date().toISOString());
    return clientesRepo.porId(db, profissionalId, id)!;
  },

  /** Exclusão restrita: cliente com orçamentos não pode ser excluído (DER §5.2). */
  excluir(db: Db, profissionalId: string, id: string): void {
    this.obter(db, profissionalId, id);
    const quantidade = clientesRepo.contarOrcamentos(db, id);
    if (quantidade > 0) {
      throw new AppError(
        409,
        'CLIENTE_COM_ORCAMENTOS',
        `Este cliente possui ${quantidade} orçamento(s). Exclua os orçamentos antes de excluir o cliente.`,
      );
    }
    clientesRepo.excluir(db, id);
  },
};
