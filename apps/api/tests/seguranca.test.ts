import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { criarConta, criarContaComPerfil, criarContexto, criarOrcamentoCompleto, ITEM_MASSA, SEGREDO_TESTE, type Contexto } from './helpers';

/**
 * Regressão da auditoria de segurança (docs/08-seguranca.md).
 * Cada bloco cita o achado que protege.
 */

const SENHA = 'senha1234';
const LITERAL_ANTIGO = 'segredo-de-desenvolvimento-troque-em-producao';

async function loginErrado(ctx: Contexto, email: string, senha = 'senha-errada') {
  return ctx.http.post('/api/auth/login').send({ email, senha });
}

function idDoToken(auth: Record<string, string>) {
  return (jwt.decode(auth.Authorization.replace('Bearer ', '')) as jwt.JwtPayload).sub as string;
}

describe('S1 — segredo JWT', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  async function carregarConfig(env: Record<string, string | undefined>) {
    vi.resetModules();
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
    return (await import('../src/config')).config;
  }

  it('fora de produção e sem JWT_SECRET não usa um valor commitado', async () => {
    const config = await carregarConfig({ NODE_ENV: 'test', JWT_SECRET: undefined });
    expect(config.jwtSecret).not.toBe(LITERAL_ANTIGO);
    expect(config.jwtSecret.length).toBeGreaterThanOrEqual(32);
  });

  it('o placeholder do .env.example nunca vira segredo, nem fora de produção', async () => {
    const config = await carregarConfig({ NODE_ENV: 'test', JWT_SECRET: 'troque-este-segredo' });
    expect(config.jwtSecret).not.toBe('troque-este-segredo');
  });

  it('em produção recusa ausente, placeholder e curto, e aceita um segredo forte', async () => {
    await expect(carregarConfig({ NODE_ENV: 'production', JWT_SECRET: undefined })).rejects.toThrow(/JWT_SECRET/);
    await expect(carregarConfig({ NODE_ENV: 'production', JWT_SECRET: 'troque-este-segredo' })).rejects.toThrow(/JWT_SECRET/);
    await expect(carregarConfig({ NODE_ENV: 'production', JWT_SECRET: 'curto' })).rejects.toThrow(/JWT_SECRET/);
    const forte = 'k'.repeat(16) + 'Z9'.repeat(16);
    expect((await carregarConfig({ NODE_ENV: 'production', JWT_SECRET: forte })).jwtSecret).toBe(forte);
  });

  it('recusa token sem expiração e de outro algoritmo, mesmo com o segredo certo', async () => {
    const ctx = criarContexto();
    const auth = await criarConta(ctx);
    const sub = idDoToken(auth);
    const semExp = jwt.sign({ v: 0 }, SEGREDO_TESTE, { subject: sub });
    const hs384 = jwt.sign({ v: 0 }, SEGREDO_TESTE, { subject: sub, algorithm: 'HS384', expiresIn: '1h' });
    for (const token of [semExp, hs384]) {
      const res = await ctx.http.get('/api/auth/me').set({ Authorization: `Bearer ${token}` });
      expect(res.status).toBe(401);
    }
  });
});

describe('S2 — revogação de sessão', () => {
  it('logout invalida no servidor o token já emitido', async () => {
    const ctx = criarContexto();
    const auth = await criarConta(ctx);
    expect((await ctx.http.get('/api/auth/me').set(auth)).status).toBe(200);
    await ctx.http.post('/api/auth/logout').set(auth).expect(204);
    const depois = await ctx.http.get('/api/auth/me').set(auth);
    expect(depois.status).toBe(401);
    expect(depois.body.erro.codigo).toBe('SESSAO_INVALIDA');
  });

  it('trocar a senha exige a atual, revoga tokens antigos e a senha nova passa a valer', async () => {
    const ctx = criarContexto();
    const auth = await criarConta(ctx, 'troca@teste.com');
    const errada = await ctx.http.post('/api/auth/senha').set(auth).send({ senhaAtual: 'nao-e-essa', novaSenha: 'novaSenha123' });
    expect(errada.status).toBe(403);
    expect(errada.body.erro.codigo).toBe('SENHA_INCORRETA');

    const ok = await ctx.http.post('/api/auth/senha').set(auth).send({ senhaAtual: SENHA, novaSenha: 'novaSenha123' });
    expect(ok.status).toBe(200);
    expect((await ctx.http.get('/api/auth/me').set(auth)).status).toBe(401);
    expect((await ctx.http.get('/api/auth/me').set({ Authorization: `Bearer ${ok.body.token}` })).status).toBe(200);

    expect((await loginErrado(ctx, 'troca@teste.com', SENHA)).status).toBe(401);
    expect((await ctx.http.post('/api/auth/login').send({ email: 'troca@teste.com', senha: 'novaSenha123' })).status).toBe(200);
  });
});

describe('S3 — limite de tentativas de login', () => {
  it('bloqueia com 429 após as falhas, mesmo com a senha certa, e não afeta outra conta', async () => {
    const ctx = criarContexto({ limites: { falhasLoginPorContaEIp: 3 } });
    await criarConta(ctx, 'alvo@teste.com');
    await criarConta(ctx, 'outra@teste.com');
    for (let i = 0; i < 3; i++) expect((await loginErrado(ctx, 'alvo@teste.com')).status).toBe(401);

    const bloqueado = await ctx.http.post('/api/auth/login').send({ email: 'alvo@teste.com', senha: SENHA });
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.erro.codigo).toBe('MUITAS_TENTATIVAS');
    expect(Number(bloqueado.headers['retry-after'])).toBeGreaterThan(0);

    expect((await ctx.http.post('/api/auth/login').send({ email: 'outra@teste.com', senha: SENHA })).status).toBe(200);
  });

  it('login bem-sucedido zera as falhas daquela conta naquele IP', async () => {
    const ctx = criarContexto({ limites: { falhasLoginPorContaEIp: 3 } });
    await criarConta(ctx, 'alvo@teste.com');
    for (let rodada = 0; rodada < 2; rodada++) {
      for (let i = 0; i < 2; i++) expect((await loginErrado(ctx, 'alvo@teste.com')).status).toBe(401);
      expect((await ctx.http.post('/api/auth/login').send({ email: 'alvo@teste.com', senha: SENHA })).status).toBe(200);
    }
  });

  it('há teto por conta, somado entre IPs, contra adivinhação distribuída', async () => {
    const ctx = criarContexto({ limites: { falhasLoginPorConta: 2 }, trustProxy: 1 });
    await criarConta(ctx, 'alvo@teste.com');
    for (const ip of ['198.51.100.1', '198.51.100.2']) {
      const res = await ctx.http.post('/api/auth/login').set('X-Forwarded-For', ip).send({ email: 'alvo@teste.com', senha: 'errada123' });
      expect(res.status).toBe(401);
    }
    const res = await ctx.http.post('/api/auth/login').set('X-Forwarded-For', '198.51.100.3').send({ email: 'alvo@teste.com', senha: 'errada123' });
    expect(res.status).toBe(429);
  });

  it('e-mail com caixa ou espaços diferentes conta para a mesma conta', async () => {
    const ctx = criarContexto({ limites: { falhasLoginPorContaEIp: 2 } });
    await criarConta(ctx, 'alvo@teste.com');
    expect((await loginErrado(ctx, 'ALVO@teste.com')).status).toBe(401);
    expect((await loginErrado(ctx, '  alvo@teste.com ')).status).toBe(401);
    expect((await loginErrado(ctx, 'alvo@teste.com')).status).toBe(429);
  });
});

describe('S4 — custo de autenticação por IP', () => {
  it('limita cadastros por IP', async () => {
    const ctx = criarContexto({ limites: { cadastrosPorIp: 2 } });
    await criarConta(ctx);
    await criarConta(ctx);
    const res = await ctx.http.post('/api/auth/cadastro').send({ email: 'terceira@teste.com', senha: SENHA });
    expect(res.status).toBe(429);
    expect(res.body.erro.codigo).toBe('MUITAS_TENTATIVAS');
  });

  it('limita requisições de autenticação por IP, para qualquer e-mail', async () => {
    const ctx = criarContexto({ limites: { autenticacaoPorIp: 2 } });
    expect((await loginErrado(ctx, 'a@teste.com')).status).toBe(401);
    expect((await loginErrado(ctx, 'b@teste.com')).status).toBe(401);
    expect((await loginErrado(ctx, 'c@teste.com')).status).toBe(429);
  });
});

describe('S5 — retenção de PDFs', () => {
  it('reemitir mantém só o PDF vigente no banco', async () => {
    const ctx = criarContexto();
    const auth = await criarContaComPerfil(ctx);
    const o = await criarOrcamentoCompleto(ctx, auth);
    for (let i = 0; i < 3; i++) await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth).expect(200);
    const { n } = ctx.db.prepare('SELECT COUNT(*) AS n FROM documento_pdf WHERE orcamento_id = ?').get(o.id) as { n: number };
    expect(n).toBe(1);
    expect((await ctx.http.get(`/api/orcamentos/${o.id}/pdf`).set(auth)).status).toBe(200);
  });
});

describe('S6 — geração de PDF', () => {
  it('limita emissões por conta sem afetar outra conta', async () => {
    const ctx = criarContexto({ limites: { emissoesPorConta: 2 } });
    const auth = await criarContaComPerfil(ctx);
    const o = await criarOrcamentoCompleto(ctx, auth);
    await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth).expect(200);
    await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth).expect(200);
    const bloqueado = await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth);
    expect(bloqueado.status).toBe(429);
    expect(bloqueado.body.erro.codigo).toBe('MUITAS_TENTATIVAS');

    const outra = await criarContaComPerfil(ctx);
    const p = await criarOrcamentoCompleto(ctx, outra);
    await ctx.http.post(`/api/orcamentos/${p.id}/emitir`).set(outra).expect(200);
  });
});

describe('S7 — cota de linhas por conta', () => {
  it('recusa clientes acima da cota, também pelo atalho do orçamento', async () => {
    const ctx = criarContexto({ limites: { clientesPorConta: 1 } });
    const auth = await criarContaComPerfil(ctx);
    await ctx.http.post('/api/clientes').set(auth).send({ nome: 'Primeiro' }).expect(201);
    const direto = await ctx.http.post('/api/clientes').set(auth).send({ nome: 'Segundo' });
    expect(direto.status).toBe(422);
    expect(direto.body.erro.codigo).toBe('LIMITE_CONTA');

    const { body: o } = await ctx.http.post('/api/orcamentos').set(auth).send({}).expect(201);
    const atalho = await ctx.http.put(`/api/orcamentos/${o.id}/cliente`).set(auth).send({ nome: 'Terceiro' });
    expect(atalho.status).toBe(422);
    expect(atalho.body.erro.codigo).toBe('LIMITE_CONTA');
  });

  it('recusa orçamentos acima da cota, também ao duplicar', async () => {
    const ctx = criarContexto({ limites: { orcamentosPorConta: 1 } });
    const auth = await criarContaComPerfil(ctx);
    const { body: o } = await ctx.http.post('/api/orcamentos').set(auth).send({}).expect(201);
    const novo = await ctx.http.post('/api/orcamentos').set(auth).send({});
    expect(novo.status).toBe(422);
    expect(novo.body.erro.codigo).toBe('LIMITE_CONTA');
    const copia = await ctx.http.post(`/api/orcamentos/${o.id}/duplicar`).set(auth);
    expect(copia.status).toBe(422);
    expect(copia.body.erro.codigo).toBe('LIMITE_CONTA');
  });

  it('a cota de uma conta não afeta outra', async () => {
    const ctx = criarContexto({ limites: { clientesPorConta: 1 } });
    const a = await criarContaComPerfil(ctx);
    const b = await criarContaComPerfil(ctx);
    await ctx.http.post('/api/clientes').set(a).send({ nome: 'De A' }).expect(201);
    await ctx.http.post('/api/clientes').set(b).send({ nome: 'De B' }).expect(201);
  });
});

describe('S9 — exclusão de conta exige a senha', () => {
  it('sem senha ou com senha errada não apaga; com a senha correta apaga', async () => {
    const ctx = criarContexto();
    const auth = await criarContaComPerfil(ctx);
    expect((await ctx.http.delete('/api/conta').set(auth)).status).toBe(400);
    const errada = await ctx.http.delete('/api/conta').set(auth).send({ senha: 'nao-e-essa' });
    expect(errada.status).toBe(403);
    expect(errada.body.erro.codigo).toBe('SENHA_INCORRETA');
    expect((await ctx.http.get('/api/auth/me').set(auth)).status).toBe(200);

    await ctx.http.delete('/api/conta').set(auth).send({ senha: SENHA }).expect(204);
    expect((await ctx.http.get('/api/auth/me').set(auth)).status).toBe(401);
  });

  it('tentativas de senha na exclusão também são limitadas', async () => {
    const ctx = criarContexto({ limites: { falhasLoginPorContaEIp: 2 } });
    const auth = await criarContaComPerfil(ctx);
    for (let i = 0; i < 2; i++) expect((await ctx.http.delete('/api/conta').set(auth).send({ senha: 'nao-e-essa' })).status).toBe(403);
    expect((await ctx.http.delete('/api/conta').set(auth).send({ senha: SENHA })).status).toBe(429);
  });
});

describe('S10 — descoberta de contas pelo login', () => {
  let compare: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    compare = vi.spyOn(bcrypt, 'compare');
  });
  afterEach(() => {
    compare.mockRestore();
  });

  it('e-mail inexistente também passa pela comparação de hash, com a mesma resposta', async () => {
    const ctx = criarContexto();
    await criarConta(ctx, 'existe@teste.com');
    compare.mockClear();
    const inexistente = await loginErrado(ctx, 'nao-existe@teste.com');
    expect(compare).toHaveBeenCalledTimes(1);
    const existente = await loginErrado(ctx, 'existe@teste.com');
    expect(compare).toHaveBeenCalledTimes(2);
    expect(inexistente.status).toBe(existente.status);
    expect(inexistente.body).toEqual(existente.body);
  });
});

describe('Endurecimento', () => {
  it('respostas JSON privadas não ficam em cache', async () => {
    const ctx = criarContexto();
    const auth = await criarContaComPerfil(ctx);
    for (const rota of ['/api/auth/me', '/api/perfil', '/api/orcamentos', '/api/clientes']) {
      expect((await ctx.http.get(rota).set(auth)).headers['cache-control'], rota).toBe('no-store');
    }
  });

  it('senha é limitada a 72 bytes, o que o bcrypt de fato considera', async () => {
    const ctx = criarContexto();
    const res = await ctx.http.post('/api/auth/cadastro').send({ email: 'multi@teste.com', senha: 'é'.repeat(40) });
    expect(res.status).toBe(400);
    expect(res.body.erro.campos.senha).toBeTruthy();
  });

  it('login recusa e-mail e senha longos antes de qualquer hash', async () => {
    const ctx = criarContexto();
    expect((await loginErrado(ctx, 'a@teste.com', 'x'.repeat(5000))).status).toBe(400);
  });

  it('secure_delete fica ligado para apagar dados de fato', () => {
    const ctx = criarContexto();
    expect(ctx.db.pragma('secure_delete', { simple: true })).toBe(1);
  });
});

describe('Isolamento entre contas (lacuna de teste apontada pela auditoria)', () => {
  it('outra conta recebe 404 em clientes, itens, emissão, duplicação e PDF', async () => {
    const ctx = criarContexto();
    const dono = await criarContaComPerfil(ctx);
    const intruso = await criarContaComPerfil(ctx);
    const { body: cliente } = await ctx.http.post('/api/clientes').set(dono).send({ nome: 'Só do dono' }).expect(201);
    const o = await criarOrcamentoCompleto(ctx, dono);
    await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(dono).expect(200);
    const itemId = o.itens[0].id as string;

    const tentativas = [
      () => ctx.http.get(`/api/clientes/${cliente.id}`),
      () => ctx.http.put(`/api/clientes/${cliente.id}`).send({ nome: 'Invadido' }),
      () => ctx.http.delete(`/api/clientes/${cliente.id}`),
      () => ctx.http.put(`/api/orcamentos/${o.id}`).send({ prazoExecucaoDias: 9 }),
      () => ctx.http.put(`/api/orcamentos/${o.id}/cliente`).send({ nome: 'Invadido' }),
      () => ctx.http.post(`/api/orcamentos/${o.id}/itens`).send(ITEM_MASSA),
      () => ctx.http.put(`/api/orcamentos/${o.id}/itens/${itemId}`).send(ITEM_MASSA),
      () => ctx.http.delete(`/api/orcamentos/${o.id}/itens/${itemId}`),
      () => ctx.http.post(`/api/orcamentos/${o.id}/duplicar`),
      () => ctx.http.post(`/api/orcamentos/${o.id}/emitir`),
      () => ctx.http.get(`/api/orcamentos/${o.id}/pdf`),
    ];
    for (const tentar of tentativas) expect((await tentar().set(intruso)).status).toBe(404);

    // clienteId e itemId de outra conta dentro de recursos do próprio intruso
    const { body: meu } = await ctx.http.post('/api/orcamentos').set(intruso).send({}).expect(201);
    expect((await ctx.http.put(`/api/orcamentos/${meu.id}`).set(intruso).send({ clienteId: cliente.id })).status).toBe(404);
    expect((await ctx.http.post('/api/orcamentos').set(intruso).send({ clienteId: cliente.id })).status).toBe(404);
    expect((await ctx.http.delete(`/api/orcamentos/${meu.id}/itens/${itemId}`).set(intruso)).status).toBe(404);
  });
});
