import type { Usuario } from '@orcafacil/shared';
import type { Db } from '../db/connection';

interface UsuarioRow {
  id: string;
  email: string;
  senha_hash: string;
  token_versao: number;
  criado_em: string;
}

export interface UsuarioComSenha extends Usuario {
  senhaHash: string;
  tokenVersao: number;
}

const mapear = (r: UsuarioRow): UsuarioComSenha => ({
  id: r.id,
  email: r.email,
  senhaHash: r.senha_hash,
  tokenVersao: r.token_versao,
  criadoEm: r.criado_em,
});

export const usuariosRepo = {
  porEmail(db: Db, email: string): UsuarioComSenha | undefined {
    const r = db.prepare('SELECT * FROM usuario WHERE email = ?').get(email) as UsuarioRow | undefined;
    return r && mapear(r);
  },

  porId(db: Db, id: string): UsuarioComSenha | undefined {
    const r = db.prepare('SELECT * FROM usuario WHERE id = ?').get(id) as UsuarioRow | undefined;
    return r && mapear(r);
  },

  inserir(db: Db, u: Omit<UsuarioComSenha, 'tokenVersao'>): void {
    db.prepare('INSERT INTO usuario (id, email, senha_hash, criado_em) VALUES (?, ?, ?, ?)').run(
      u.id,
      u.email,
      u.senhaHash,
      u.criadoEm,
    );
  },

  /** Invalida todos os tokens já emitidos da conta. */
  revogarTokens(db: Db, id: string): void {
    db.prepare('UPDATE usuario SET token_versao = token_versao + 1 WHERE id = ?').run(id);
  },

  alterarSenha(db: Db, id: string, senhaHash: string): void {
    db.prepare('UPDATE usuario SET senha_hash = ?, token_versao = token_versao + 1 WHERE id = ?').run(senhaHash, id);
  },

  /**
   * Remove o usuário e, em cascata, perfil, clientes, orçamentos, itens e PDFs (RNF21).
   * Com `secure_delete` as páginas são zeradas; o checkpoint tira as cópias antigas do WAL.
   */
  excluir(db: Db, id: string): void {
    db.prepare('DELETE FROM usuario WHERE id = ?').run(id);
    db.pragma('wal_checkpoint(TRUNCATE)');
  },
};
