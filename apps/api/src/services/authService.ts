import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cadastroSchema, loginSchema, type SessaoResposta, type Usuario } from '@orcafacil/shared';
import type { Db } from '../db/connection';
import { AppError } from '../errors';
import { usuariosRepo } from '../repositories/usuarios';

export interface OpcoesToken {
  segredo: string;
  expiraEm: string;
}

const publico = ({ id, email, criadoEm }: Usuario): Usuario => ({ id, email, criadoEm });

function emitirToken(usuarioId: string, opcoes: OpcoesToken): string {
  return jwt.sign({}, opcoes.segredo, {
    subject: usuarioId,
    expiresIn: opcoes.expiraEm as jwt.SignOptions['expiresIn'],
  });
}

export const authService = {
  async cadastrar(db: Db, entrada: unknown, opcoes: OpcoesToken): Promise<SessaoResposta> {
    const { email, senha } = cadastroSchema.parse(entrada);
    if (usuariosRepo.porEmail(db, email)) {
      throw new AppError(409, 'EMAIL_EM_USO', 'Já existe uma conta com este e-mail', {
        campos: { email: 'Já existe uma conta com este e-mail' },
      });
    }
    const usuario = { id: randomUUID(), email, senhaHash: await bcrypt.hash(senha, 10), criadoEm: new Date().toISOString() };
    usuariosRepo.inserir(db, usuario);
    return { token: emitirToken(usuario.id, opcoes), usuario: publico(usuario) };
  },

  async entrar(db: Db, entrada: unknown, opcoes: OpcoesToken): Promise<SessaoResposta> {
    const { email, senha } = loginSchema.parse(entrada);
    const usuario = usuariosRepo.porEmail(db, email);
    // Mesma mensagem para e-mail inexistente e senha errada (não revela contas existentes).
    if (!usuario || !(await bcrypt.compare(senha, usuario.senhaHash))) {
      throw new AppError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos');
    }
    return { token: emitirToken(usuario.id, opcoes), usuario: publico(usuario) };
  },

  /** Valida o token e retorna o usuário; lança 401 se inválido, expirado ou de conta excluída. */
  verificar(db: Db, token: string, segredo: string): Usuario {
    let usuarioId: string | undefined;
    try {
      usuarioId = (jwt.verify(token, segredo) as jwt.JwtPayload).sub;
    } catch {
      throw new AppError(401, 'SESSAO_INVALIDA', 'Sua sessão expirou. Entre novamente.');
    }
    const usuario = usuarioId ? usuariosRepo.porId(db, usuarioId) : undefined;
    if (!usuario) throw new AppError(401, 'SESSAO_INVALIDA', 'Sua sessão expirou. Entre novamente.');
    return publico(usuario);
  },

  /** RNF21 — "Apagar todos os meus dados": remove a conta e tudo o que pertence a ela. */
  excluirConta(db: Db, usuarioId: string): void {
    usuariosRepo.excluir(db, usuarioId);
  },
};
