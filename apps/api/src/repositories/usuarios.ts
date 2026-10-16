import type { Usuario } from '@orcafacil/shared';
import type { Db } from '../db/connection';

interface UsuarioRow {
  id: string;
  email: string;
  senha_hash: string;
  criado_em: string;
}

export interface UsuarioComSenha extends Usuario {
  senhaHash: string;
}

const mapear = (r: UsuarioRow): UsuarioComSenha => ({
  id: r.id,
  email: r.email,
  senhaHash: r.senha_hash,
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

  inserir(db: Db, u: UsuarioComSenha): void {
    db.prepare('INSERT INTO usuario (id, email, senha_hash, criado_em) VALUES (?, ?, ?, ?)').run(
      u.id,
      u.email,
      u.senhaHash,
      u.criadoEm,
    );
  },

  /** Remove o usuário e, em cascata, perfil, clientes, orçamentos, itens e PDFs (RNF21). */
  excluir(db: Db, id: string): void {
    db.prepare('DELETE FROM usuario WHERE id = ?').run(id);
  },
};
