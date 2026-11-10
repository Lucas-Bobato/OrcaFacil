import { beforeEach, describe, expect, it } from 'vitest';
import { binario, criarConta, criarContaComPerfil, criarContexto, criarOrcamentoCompleto, PERFIL, type Contexto } from './helpers';

let ctx: Contexto;
beforeEach(() => {
  ctx = criarContexto();
});

describe('Conta (cadastro e login)', () => {
  it('cadastra e devolve token + usuário sem a senha', async () => {
    const res = await ctx.http.post('/api/auth/cadastro').send({ email: 'Joao@Teste.com', senha: 'senha1234' });
    expect(res.status).toBe(201);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.usuario).toEqual({ id: expect.any(String), email: 'joao@teste.com', criadoEm: expect.any(String) });
    expect(JSON.stringify(res.body)).not.toContain('senha');
  });

  it('valida e-mail e senha (400 com mensagens por campo)', async () => {
    const res = await ctx.http.post('/api/auth/cadastro').send({ email: 'x', senha: '1' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatchObject({
      codigo: 'VALIDACAO',
      campos: { email: 'E-mail inválido', senha: 'A senha deve ter pelo menos 8 caracteres' },
    });
  });

  it('não permite e-mail repetido (409)', async () => {
    await criarConta(ctx, 'repetido@teste.com');
    const res = await ctx.http.post('/api/auth/cadastro').send({ email: 'REPETIDO@teste.com', senha: 'senha1234' });
    expect(res.status).toBe(409);
    expect(res.body.erro.codigo).toBe('EMAIL_EM_USO');
  });

  it('login com senha correta e incorreta', async () => {
    await criarConta(ctx, 'login@teste.com');
    const ok = await ctx.http.post('/api/auth/login').send({ email: 'login@teste.com', senha: 'senha1234' });
    expect(ok.status).toBe(200);
    const me = await ctx.http.get('/api/auth/me').set({ Authorization: `Bearer ${ok.body.token}` });
    expect(me.body.email).toBe('login@teste.com');

    const errado = await ctx.http.post('/api/auth/login').send({ email: 'login@teste.com', senha: 'outrasenha' });
    expect(errado.status).toBe(401);
    expect(errado.body.erro).toEqual({ codigo: 'CREDENCIAIS_INVALIDAS', mensagem: 'E-mail ou senha incorretos' });
  });

  it('rotas protegidas exigem token válido', async () => {
    expect((await ctx.http.get('/api/perfil')).body.erro.codigo).toBe('NAO_AUTENTICADO');
    const res = await ctx.http.get('/api/perfil').set({ Authorization: 'Bearer token-falso' });
    expect(res.status).toBe(401);
    expect(res.body.erro.codigo).toBe('SESSAO_INVALIDA');
  });

  it('RNF21 — apagar a conta remove 100% dos dados do usuário', async () => {
    const auth = await criarContaComPerfil(ctx);
    const o = await criarOrcamentoCompleto(ctx, auth);
    await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth).expect(200);

    await ctx.http.delete('/api/conta').set(auth).send({ senha: 'senha1234' }).expect(204);

    for (const tabela of ['usuario', 'profissional', 'cliente', 'orcamento', 'item_servico', 'documento_pdf', 'sequencia_numeracao']) {
      const { n } = ctx.db.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).get() as { n: number };
      expect(n, tabela).toBe(0);
    }
    expect((await ctx.http.get('/api/auth/me').set(auth)).status).toBe(401);
  });
});

describe('Perfil profissional (US01)', () => {
  it('CA01.1 — sem perfil: GET /perfil = 404 e criar orçamento é bloqueado', async () => {
    const auth = await criarConta(ctx);
    expect((await ctx.http.get('/api/perfil').set(auth)).body.erro.codigo).toBe('PERFIL_NAO_CADASTRADO');
    const res = await ctx.http.post('/api/orcamentos').set(auth).send({});
    expect(res.status).toBe(409);
    expect(res.body.erro.codigo).toBe('PERFIL_NAO_CADASTRADO');
  });

  it('CA01.2 — salva o perfil e ele permanece (dados normalizados)', async () => {
    const auth = await criarConta(ctx);
    const criado = await ctx.http.put('/api/perfil').set(auth).send(PERFIL);
    expect(criado.status).toBe(201);
    const res = await ctx.http.get('/api/perfil').set(auth);
    expect(res.body).toMatchObject({
      nome: 'João da Silva',
      nomeEmpresa: 'João Pinturas',
      telefone: '11987654321',
      documento: '11222333000181',
    });
    const editado = await ctx.http.put('/api/perfil').set(auth).send({ ...PERFIL, nome: 'João S.' });
    expect(editado.status).toBe(200);
    expect(editado.body.nome).toBe('João S.');
  });

  it('CA01.3 — sem nome e sem empresa não salva', async () => {
    const auth = await criarConta(ctx);
    const res = await ctx.http.put('/api/perfil').set(auth).send({ telefone: '11987654321' });
    expect(res.status).toBe(400);
    expect(res.body.erro.campos).toEqual({ nome: 'Informe seu nome ou o nome da empresa' });
    expect((await ctx.http.get('/api/perfil').set(auth)).status).toBe(404);
  });

  it('RN11 — alterar o perfil não altera PDFs já gerados', async () => {
    const auth = await criarContaComPerfil(ctx);
    const o = await criarOrcamentoCompleto(ctx, auth);
    await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth).expect(200);
    const antes = await binario(ctx.http.get(`/api/orcamentos/${o.id}/pdf`).set(auth));

    await ctx.http.put('/api/perfil').set(auth).send({ ...PERFIL, nomeEmpresa: 'Outra Empresa' }).expect(200);
    const depois = await binario(ctx.http.get(`/api/orcamentos/${o.id}/pdf`).set(auth));
    expect(Buffer.compare(antes.body, depois.body)).toBe(0);
  });
});
