import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  alterarSenhaSchema,
  cadastroSchema,
  excluirContaSchema,
  loginSchema,
  type SessaoResposta,
  type Usuario,
} from '@orcafacil/shared';
import type { Db } from '../db/connection';
import { AppError } from '../errors';
import { usuariosRepo, type UsuarioComSenha } from '../repositories/usuarios';

export interface OpcoesToken {
  segredo: string;
  expiraEm: string;
}

const CUSTO_BCRYPT = 10;
const ALGORITMO_JWT = 'HS256';

/** Comparado quando o e-mail não existe, para o login levar o mesmo tempo nos dois casos. */
const HASH_FICTICIO = bcrypt.hashSync(randomUUID(), CUSTO_BCRYPT);

const publico = ({ id, email, criadoEm }: Usuario): Usuario => ({ id, email, criadoEm });

function emitirToken(usuarioId: string, versao: number, opcoes: OpcoesToken): string {
  return jwt.sign({ v: versao }, opcoes.segredo, {
    subject: usuarioId,
    algorithm: ALGORITMO_JWT,
    expiresIn: opcoes.expiraEm as jwt.SignOptions['expiresIn'],
  });
}

const sessaoInvalida = () => new AppError(401, 'SESSAO_INVALIDA', 'Sua sessão expirou. Entre novamente.');

/** Confere a senha da conta da sessão; `campo` é o campo do formulário que recebe o erro. */
async function exigirSenhaAtual(db: Db, usuarioId: string, senha: string, campo: string): Promise<UsuarioComSenha> {
  const usuario = usuariosRepo.porId(db, usuarioId);
  if (!usuario) throw sessaoInvalida();
  if (!(await bcrypt.compare(senha, usuario.senhaHash))) {
    throw new AppError(403, 'SENHA_INCORRETA', 'Senha incorreta', { campos: { [campo]: 'Senha incorreta' } });
  }
  return usuario;
}

export const authService = {
  async cadastrar(db: Db, entrada: unknown, opcoes: OpcoesToken): Promise<SessaoResposta> {
    const { email, senha } = cadastroSchema.parse(entrada);
    if (usuariosRepo.porEmail(db, email)) {
      throw new AppError(409, 'EMAIL_EM_USO', 'Já existe uma conta com este e-mail', {
        campos: { email: 'Já existe uma conta com este e-mail' },
      });
    }
    const usuario = {
      id: randomUUID(),
      email,
      senhaHash: await bcrypt.hash(senha, CUSTO_BCRYPT),
      criadoEm: new Date().toISOString(),
    };
    usuariosRepo.inserir(db, usuario);
    return { token: emitirToken(usuario.id, 0, opcoes), usuario: publico(usuario) };
  },

  async entrar(db: Db, entrada: unknown, opcoes: OpcoesToken): Promise<SessaoResposta> {
    const { email, senha } = loginSchema.parse(entrada);
    const usuario = usuariosRepo.porEmail(db, email);
    // Mesma mensagem e mesmo trabalho para e-mail inexistente e senha errada (não revela contas existentes).
    const senhaConfere = await bcrypt.compare(senha, usuario?.senhaHash ?? HASH_FICTICIO);
    if (!usuario || !senhaConfere) {
      throw new AppError(401, 'CREDENCIAIS_INVALIDAS', 'E-mail ou senha incorretos');
    }
    return { token: emitirToken(usuario.id, usuario.tokenVersao, opcoes), usuario: publico(usuario) };
  },

  /** Valida o token e retorna o usuário; lança 401 se inválido, expirado, revogado ou de conta excluída. */
  verificar(db: Db, token: string, segredo: string): Usuario {
    let dados: jwt.JwtPayload;
    try {
      dados = jwt.verify(token, segredo, { algorithms: [ALGORITMO_JWT] }) as jwt.JwtPayload;
    } catch {
      throw sessaoInvalida();
    }
    // `jwt.verify` aceita token sem `exp`; todo token legítimo tem validade.
    if (!dados.sub || typeof dados.exp !== 'number') throw sessaoInvalida();
    const usuario = usuariosRepo.porId(db, dados.sub);
    if (!usuario || dados.v !== usuario.tokenVersao) throw sessaoInvalida();
    return publico(usuario);
  },

  /** Encerra a sessão no servidor: invalida todos os tokens da conta, em todos os aparelhos. */
  sair(db: Db, usuarioId: string): void {
    usuariosRepo.revogarTokens(db, usuarioId);
  },

  /** Troca a senha, derruba as outras sessões e devolve um token novo para a sessão atual. */
  async alterarSenha(db: Db, usuarioId: string, entrada: unknown, opcoes: OpcoesToken): Promise<SessaoResposta> {
    const { senhaAtual, novaSenha } = alterarSenhaSchema.parse(entrada);
    await exigirSenhaAtual(db, usuarioId, senhaAtual, 'senhaAtual');
    usuariosRepo.alterarSenha(db, usuarioId, await bcrypt.hash(novaSenha, CUSTO_BCRYPT));
    const atualizado = usuariosRepo.porId(db, usuarioId)!;
    return { token: emitirToken(usuarioId, atualizado.tokenVersao, opcoes), usuario: publico(atualizado) };
  },

  /** RNF21 — "Apagar todos os meus dados": confirma a senha e remove a conta e tudo o que pertence a ela. */
  async excluirConta(db: Db, usuarioId: string, entrada: unknown): Promise<void> {
    const { senha } = excluirContaSchema.parse(entrada);
    await exigirSenhaAtual(db, usuarioId, senha, 'senha');
    usuariosRepo.excluir(db, usuarioId);
  },
};
