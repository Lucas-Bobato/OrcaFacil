import request from 'supertest';
import { criarApp } from '../src/app';
import { abrirBanco, migrar, type Db } from '../src/db/connection';

export const SEGREDO_TESTE = 'segredo-de-teste';

/** App com banco SQLite em memória, isolado por teste. */
export function criarContexto() {
  const db: Db = abrirBanco(':memory:');
  migrar(db);
  const app = criarApp({ db, jwtSecret: SEGREDO_TESTE });
  return { db, app, http: request(app) };
}

export type Contexto = ReturnType<typeof criarContexto>;

let contador = 0;

/** Cria uma conta e devolve o header de autorização. */
export async function criarConta(ctx: Contexto, email = `usuario${++contador}@teste.com`) {
  const res = await ctx.http.post('/api/auth/cadastro').send({ email, senha: 'senha1234' }).expect(201);
  return { Authorization: `Bearer ${res.body.token as string}` };
}

export const PERFIL = {
  nome: 'João da Silva',
  nomeEmpresa: 'João Pinturas',
  telefone: '(11) 98765-4321',
  email: 'joao@joaopinturas.com.br',
  documento: '11.222.333/0001-81',
};

/** Cria conta + perfil profissional. */
export async function criarContaComPerfil(ctx: Contexto) {
  const auth = await criarConta(ctx);
  await ctx.http.put('/api/perfil').set(auth).send(PERFIL).expect(201);
  return auth;
}

export const ITEM_PINTURA = { descricao: 'Pintura de parede', quantidade: 20, unidade: 'M2', valorUnitarioCentavos: 2500 };
export const ITEM_MASSA = { descricao: 'Massa corrida', quantidade: 1, unidade: 'VB', valorUnitarioCentavos: 30000 };

/** Cria orçamento com cliente "Maria Silva", os itens informados e prazo de 2 dias. */
export async function criarOrcamentoCompleto(
  ctx: Contexto,
  auth: Record<string, string>,
  itens: object[] = [ITEM_PINTURA, ITEM_MASSA],
) {
  const { body: o } = await ctx.http.post('/api/orcamentos').set(auth).send({}).expect(201);
  await ctx.http.put(`/api/orcamentos/${o.id}/cliente`).set(auth).send({ nome: 'Maria Silva' }).expect(200);
  for (const item of itens) await ctx.http.post(`/api/orcamentos/${o.id}/itens`).set(auth).send(item).expect(201);
  const { body } = await ctx.http.put(`/api/orcamentos/${o.id}`).set(auth).send({ prazoExecucaoDias: 2 }).expect(200);
  return body;
}

/** Lê o corpo binário de uma resposta (PDF) como Buffer. */
export const binario = (res: request.Request) =>
  res.buffer(true).parse((r, cb) => {
    const partes: Buffer[] = [];
    r.on('data', (c: Buffer) => partes.push(c));
    r.on('end', () => cb(null, Buffer.concat(partes)));
  });
