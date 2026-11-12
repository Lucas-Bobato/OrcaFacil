import type { PerfilDados, Profissional } from '@orcafacil/shared';
import type { Db } from '../db/connection';

interface ProfissionalRow {
  id: string;
  usuario_id: string;
  nome: string | null;
  nome_empresa: string | null;
  documento: string | null;
  telefone: string;
  email: string | null;
  criado_em: string;
  atualizado_em: string;
}

const mapear = (r: ProfissionalRow): Profissional => ({
  id: r.id,
  nome: r.nome,
  nomeEmpresa: r.nome_empresa,
  documento: r.documento,
  telefone: r.telefone,
  email: r.email,
  criadoEm: r.criado_em,
  atualizadoEm: r.atualizado_em,
});

export const profissionaisRepo = {
  porUsuario(db: Db, usuarioId: string): Profissional | undefined {
    const r = db.prepare('SELECT * FROM profissional WHERE usuario_id = ?').get(usuarioId) as
      | ProfissionalRow
      | undefined;
    return r && mapear(r);
  },

  porId(db: Db, id: string): Profissional | undefined {
    const r = db.prepare('SELECT * FROM profissional WHERE id = ?').get(id) as ProfissionalRow | undefined;
    return r && mapear(r);
  },

  inserir(db: Db, id: string, usuarioId: string, dados: PerfilDados, agora: string): void {
    db.prepare(
      `INSERT INTO profissional (id, usuario_id, nome, nome_empresa, documento, telefone, email, criado_em, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(id, usuarioId, dados.nome, dados.nomeEmpresa, dados.documento, dados.telefone, dados.email, agora, agora);
  },

  atualizar(db: Db, id: string, dados: PerfilDados, agora: string): void {
    db.prepare(
      `UPDATE profissional SET nome = ?, nome_empresa = ?, documento = ?, telefone = ?, email = ?, atualizado_em = ?
       WHERE id = ?`,
    ).run(dados.nome, dados.nomeEmpresa, dados.documento, dados.telefone, dados.email, agora, id);
  },
};
