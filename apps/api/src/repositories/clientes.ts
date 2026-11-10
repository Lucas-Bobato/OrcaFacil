import type { Cliente, ClienteDados } from '@orcafacil/shared';
import type { Db } from '../db/connection';

interface ClienteRow {
  id: string;
  profissional_id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  criado_em: string;
  atualizado_em: string;
}

const mapear = (r: ClienteRow): Cliente => ({
  id: r.id,
  nome: r.nome,
  telefone: r.telefone,
  email: r.email,
  endereco: r.endereco,
  criadoEm: r.criado_em,
  atualizadoEm: r.atualizado_em,
});

export const clientesRepo = {
  listar(db: Db, profissionalId: string, busca?: string): Cliente[] {
    const rows = busca
      ? db
          .prepare(
            `SELECT * FROM cliente WHERE profissional_id = ? AND normalizar(nome) LIKE '%' || normalizar(?) || '%'
             ORDER BY nome COLLATE NOCASE`,
          )
          .all(profissionalId, busca)
      : db.prepare('SELECT * FROM cliente WHERE profissional_id = ? ORDER BY nome COLLATE NOCASE').all(profissionalId);
    return (rows as ClienteRow[]).map(mapear);
  },

  porId(db: Db, profissionalId: string, id: string): Cliente | undefined {
    const r = db.prepare('SELECT * FROM cliente WHERE id = ? AND profissional_id = ?').get(id, profissionalId) as
      | ClienteRow
      | undefined;
    return r && mapear(r);
  },

  inserir(db: Db, id: string, profissionalId: string, dados: ClienteDados, agora: string): void {
    db.prepare(
      `INSERT INTO cliente (id, profissional_id, nome, telefone, email, endereco, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, profissionalId, dados.nome, dados.telefone, dados.email, dados.endereco, agora, agora);
  },

  atualizar(db: Db, id: string, dados: ClienteDados, agora: string): void {
    db.prepare(
      'UPDATE cliente SET nome = ?, telefone = ?, email = ?, endereco = ?, atualizado_em = ? WHERE id = ?',
    ).run(dados.nome, dados.telefone, dados.email, dados.endereco, agora, id);
  },

  contarDaConta(db: Db, profissionalId: string): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM cliente WHERE profissional_id = ?').get(profissionalId) as { n: number }).n;
  },

  contarOrcamentos(db: Db, id: string): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM orcamento WHERE cliente_id = ?').get(id) as { n: number }).n;
  },

  excluir(db: Db, id: string): void {
    db.prepare('DELETE FROM cliente WHERE id = ?').run(id);
  },
};
