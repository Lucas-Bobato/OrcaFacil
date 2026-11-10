import { beforeEach, describe, expect, it } from 'vitest';
import {
  binario,
  criarConta,
  criarContaComPerfil,
  criarContexto,
  criarOrcamentoCompleto,
  ITEM_MASSA,
  ITEM_PINTURA,
  PERFIL,
  type Contexto,
} from './helpers';

let ctx: Contexto;
let auth: Record<string, string>;
const ano = new Date().getFullYear();

beforeEach(async () => {
  ctx = criarContexto();
  auth = await criarContaComPerfil(ctx);
});

const novo = async () => (await ctx.http.post('/api/orcamentos').set(auth).send({}).expect(201)).body;

describe('Criação e numeração (RF03, RN07)', () => {
  it('cria rascunho com número sequencial ORC-AAAA-NNNN e validade padrão de 15 dias (CA05.3)', async () => {
    const a = await novo();
    const b = await novo();
    expect(a).toMatchObject({
      numero: `ORC-${ano}-0001`,
      status: 'RASCUNHO',
      validadeDias: 15,
      totalCentavos: 0,
      etapaAtual: 'PREENCHER',
      itens: [],
      cliente: null,
      dataEmissao: null,
    });
    expect(b.numero).toBe(`ORC-${ano}-0002`);
  });

  it('não reutiliza números após exclusão', async () => {
    await novo();
    const b = await novo();
    await ctx.http.delete(`/api/orcamentos/${b.id}`).set(auth).expect(204);
    expect((await novo()).numero).toBe(`ORC-${ano}-0003`);
  });

  it('a numeração é independente por usuário', async () => {
    await novo();
    const outro = await criarConta(ctx);
    await ctx.http.put('/api/perfil').set(outro).send(PERFIL).expect(201);
    const res = await ctx.http.post('/api/orcamentos').set(outro).send({});
    expect(res.body.numero).toBe(`ORC-${ano}-0001`);
  });
});

describe('01 Preencher — cliente (US02)', () => {
  it('CA02.1 — define o cliente do orçamento', async () => {
    const o = await novo();
    const res = await ctx.http
      .put(`/api/orcamentos/${o.id}/cliente`)
      .set(auth)
      .send({ nome: 'Maria Silva', telefone: '(11) 91234-5678', endereco: 'Rua das Flores, 100' });
    expect(res.status).toBe(200);
    expect(res.body.cliente).toMatchObject({ nome: 'Maria Silva', telefone: '11912345678' });
    expect(res.body.clienteNome).toBe('Maria Silva');
    // Atualizar mantém o mesmo cliente
    const res2 = await ctx.http.put(`/api/orcamentos/${o.id}/cliente`).set(auth).send({ nome: 'Maria S. Silva' });
    expect(res2.body.cliente.id).toBe(res.body.cliente.id);
  });

  it('CA02.2 / CA02.3 — nome ausente e telefone inválido', async () => {
    const o = await novo();
    const res = await ctx.http.put(`/api/orcamentos/${o.id}/cliente`).set(auth).send({ nome: '', telefone: '1199' });
    expect(res.status).toBe(400);
    expect(res.body.erro.campos).toEqual({ nome: 'Informe o nome do cliente', telefone: 'Telefone inválido' });
  });
});

describe('02 Detalhar — itens (US03, US04)', () => {
  it('CA03.1 / CA03.2 — subtotal e total recalculado', async () => {
    const o = await novo();
    const r1 = await ctx.http.post(`/api/orcamentos/${o.id}/itens`).set(auth).send(ITEM_PINTURA);
    expect(r1.status).toBe(201);
    expect(r1.body.itens[0]).toMatchObject({ ordem: 1, subtotalCentavos: 50000 });
    expect(r1.body.totalCentavos).toBe(50000);
    const r2 = await ctx.http.post(`/api/orcamentos/${o.id}/itens`).set(auth).send(ITEM_MASSA);
    expect(r2.body.totalCentavos).toBe(80000);
  });

  it('CA03.3 — valor zerado não é adicionado', async () => {
    const o = await novo();
    const res = await ctx.http.post(`/api/orcamentos/${o.id}/itens`).set(auth).send({ ...ITEM_PINTURA, valorUnitarioCentavos: 0 });
    expect(res.status).toBe(400);
    expect(res.body.erro.campos.valorUnitarioCentavos).toBe('O valor deve ser maior que R$ 0,00');
    expect((await ctx.http.get(`/api/orcamentos/${o.id}`).set(auth)).body.itens).toHaveLength(0);
  });

  it('CA03.5 / RN09 — limite de 50 itens', async () => {
    const o = await novo();
    for (let i = 0; i < 50; i++) {
      await ctx.http.post(`/api/orcamentos/${o.id}/itens`).set(auth).send(ITEM_MASSA).expect(201);
    }
    const res = await ctx.http.post(`/api/orcamentos/${o.id}/itens`).set(auth).send(ITEM_MASSA);
    expect(res.status).toBe(422);
    expect(res.body.erro).toEqual({ codigo: 'LIMITE_ITENS', mensagem: 'Limite de 50 itens atingido' });
  });

  it('CA04.1 — editar quantidade recalcula subtotal e total', async () => {
    const o = await criarOrcamentoCompleto(ctx, auth);
    const pintura = o.itens[0];
    const res = await ctx.http
      .put(`/api/orcamentos/${o.id}/itens/${pintura.id}`)
      .set(auth)
      .send({ ...ITEM_PINTURA, quantidade: 30 });
    expect(res.body.itens[0].subtotalCentavos).toBe(75000);
    expect(res.body.totalCentavos).toBe(105000);
  });

  it('CA04.2 / CA04.3 — remover e desfazer na mesma posição', async () => {
    const o = await criarOrcamentoCompleto(ctx, auth, [ITEM_PINTURA, ITEM_MASSA, { ...ITEM_MASSA, descricao: 'Lixamento' }]);
    const removido = o.itens[1];
    const apos = await ctx.http.delete(`/api/orcamentos/${o.id}/itens/${removido.id}`).set(auth);
    expect(apos.body.itens.map((i: { descricao: string; ordem: number }) => [i.ordem, i.descricao])).toEqual([
      [1, 'Pintura de parede'],
      [2, 'Lixamento'],
    ]);
    expect(apos.body.totalCentavos).toBe(80000);

    const desfeito = await ctx.http
      .post(`/api/orcamentos/${o.id}/itens`)
      .set(auth)
      .send({ ...ITEM_MASSA, ordem: removido.ordem });
    expect(desfeito.body.itens.map((i: { descricao: string }) => i.descricao)).toEqual([
      'Pintura de parede',
      'Massa corrida',
      'Lixamento',
    ]);
    expect(desfeito.body.totalCentavos).toBe(110000);
  });

  it('RN02 — total não pode ser informado manualmente', async () => {
    const o = await novo();
    const res = await ctx.http.put(`/api/orcamentos/${o.id}`).set(auth).send({ totalCentavos: 1 });
    expect(res.status).toBe(400);
  });

  it('item inexistente → 404', async () => {
    const o = await novo();
    const res = await ctx.http.delete(`/api/orcamentos/${o.id}/itens/00000000-0000-4000-8000-000000000000`).set(auth);
    expect(res.status).toBe(404);
    expect(res.body.erro.codigo).toBe('ITEM_NAO_ENCONTRADO');
  });
});

describe('03 Revisar — condições (US05)', () => {
  it('CA05.1 / CA05.2 — prazo entre 1 e 365 dias', async () => {
    const o = await novo();
    const ok = await ctx.http.put(`/api/orcamentos/${o.id}`).set(auth).send({ prazoExecucaoDias: 2 });
    expect(ok.body.prazoExecucaoDias).toBe(2);
    for (const prazo of [0, 366]) {
      const res = await ctx.http.put(`/api/orcamentos/${o.id}`).set(auth).send({ prazoExecucaoDias: prazo });
      expect(res.status).toBe(400);
      expect(res.body.erro.campos.prazoExecucaoDias).toBe('Informe um prazo entre 1 e 365 dias');
    }
  });

  it('salva pagamento, validade e observações', async () => {
    const o = await novo();
    const res = await ctx.http.put(`/api/orcamentos/${o.id}`).set(auth).send({
      validadeDias: 30,
      condicoesPagamento: '50% no início e 50% na conclusão.',
      observacoes: 'Materiais por conta do cliente.',
    });
    expect(res.body).toMatchObject({ validadeDias: 30, observacoes: 'Materiais por conta do cliente.' });
  });

  it('CA08.3 — guarda a etapa em que o usuário parou', async () => {
    const o = await novo();
    await ctx.http.put(`/api/orcamentos/${o.id}`).set(auth).send({ etapaAtual: 'DETALHAR' }).expect(200);
    expect((await ctx.http.get(`/api/orcamentos/${o.id}`).set(auth)).body.etapaAtual).toBe('DETALHAR');
  });
});

describe('04 Gerar PDF (US06, US07, RN10)', () => {
  it('CA06.2 — emissão bloqueada lista as pendências (RN01)', async () => {
    const o = await novo();
    expect(o.pendencias).toEqual([
      'Informe o nome do cliente',
      'Adicione ao menos um item com valor maior que R$ 0,00',
      'Informe um prazo entre 1 e 365 dias',
    ]);
    const res = await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth);
    expect(res.status).toBe(422);
    expect(res.body.erro).toMatchObject({ codigo: 'EMISSAO_BLOQUEADA', pendencias: o.pendencias });
  });

  it('CA06.1 — gera o PDF, marca como Emitido e define a data de emissão (RN13)', async () => {
    const o = await criarOrcamentoCompleto(ctx, auth);
    expect(o.pendencias).toEqual([]);
    const res = await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('EMITIDO');
    expect(res.body.dataEmissao).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.documentoAtual).toMatchObject({
      nomeArquivo: `Orcamento_ORC-${ano}-0001_Maria-Silva.pdf`,
      hashSha256: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    expect(res.body.documentoAtual.tamanhoBytes).toBeLessThan(500 * 1024); // RNF06
  });

  it('CA07.1 — download com nome Orcamento_<numero>_<cliente>.pdf (RN12)', async () => {
    const o = await criarOrcamentoCompleto(ctx, auth);
    await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth).expect(200);
    const res = await binario(ctx.http.get(`/api/orcamentos/${o.id}/pdf`).set(auth));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="Orcamento_ORC-${ano}-0001_Maria-Silva.pdf"`);
    expect(res.body.subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('PDF ainda não gerado → 404', async () => {
    const o = await novo();
    const res = await ctx.http.get(`/api/orcamentos/${o.id}/pdf`).set(auth);
    expect(res.status).toBe(404);
    expect(res.body.erro.codigo).toBe('PDF_NAO_ENCONTRADO');
  });

  it('RN10 — editar um emitido volta para Rascunho e mantém o PDF anterior', async () => {
    const o = await criarOrcamentoCompleto(ctx, auth);
    await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth).expect(200);

    // Mudar só a etapa não é edição de conteúdo
    const etapa = await ctx.http.put(`/api/orcamentos/${o.id}`).set(auth).send({ etapaAtual: 'DETALHAR' });
    expect(etapa.body.status).toBe('EMITIDO');
    // Salvar os mesmos valores também não
    const igual = await ctx.http.put(`/api/orcamentos/${o.id}`).set(auth).send({ prazoExecucaoDias: 2 });
    expect(igual.body.status).toBe('EMITIDO');

    const editado = await ctx.http.put(`/api/orcamentos/${o.id}`).set(auth).send({ prazoExecucaoDias: 10 });
    expect(editado.body.status).toBe('RASCUNHO');
    expect(editado.body.documentoAtual).not.toBeNull();
    expect((await ctx.http.get(`/api/orcamentos/${o.id}/pdf`).set(auth)).status).toBe(200);

    // Reemitir gera um novo documento vigente, que substitui o anterior
    const reemitido = await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth);
    expect(reemitido.body.status).toBe('EMITIDO');
    const { n } = ctx.db.prepare('SELECT COUNT(*) AS n FROM documento_pdf WHERE orcamento_id = ?').get(o.id) as { n: number };
    expect(n).toBe(1);
  });

  it('RN10 — adicionar item ou alterar o cliente de um emitido também volta para Rascunho', async () => {
    const o = await criarOrcamentoCompleto(ctx, auth);
    await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth).expect(200);
    const comItem = await ctx.http.post(`/api/orcamentos/${o.id}/itens`).set(auth).send(ITEM_MASSA);
    expect(comItem.body.status).toBe('RASCUNHO');

    await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth).expect(200);
    const mesmoCliente = await ctx.http.put(`/api/orcamentos/${o.id}/cliente`).set(auth).send({ nome: 'Maria Silva' });
    expect(mesmoCliente.body.status).toBe('EMITIDO');
    const outroCliente = await ctx.http.put(`/api/orcamentos/${o.id}/cliente`).set(auth).send({ nome: 'Maria Souza' });
    expect(outroCliente.body.status).toBe('RASCUNHO');
  });
});

describe('Meus orçamentos (US08)', () => {
  it('CA08.1 — lista do mais recente para o mais antigo com número, cliente, total e status', async () => {
    const a = await criarOrcamentoCompleto(ctx, auth);
    const b = await novo();
    const res = await ctx.http.get('/api/orcamentos').set(auth);
    expect(res.body.map((o: { id: string }) => o.id)).toEqual([b.id, a.id]);
    expect(res.body[1]).toMatchObject({ numero: a.numero, clienteNome: 'Maria Silva', totalCentavos: 80000, status: 'RASCUNHO' });
  });

  it('CA08.2 — busca por cliente ignora maiúsculas e acentos', async () => {
    await criarOrcamentoCompleto(ctx, auth);
    const outro = await novo();
    await ctx.http.put(`/api/orcamentos/${outro.id}/cliente`).set(auth).send({ nome: 'Carlos Souza' });
    const res = await ctx.http.get('/api/orcamentos?busca=MÁRIA').set(auth);
    expect(res.body.map((o: { clienteNome: string }) => o.clienteNome)).toEqual(['Maria Silva']);
  });

  it('filtra por status e valida o filtro', async () => {
    const o = await criarOrcamentoCompleto(ctx, auth);
    await novo();
    await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth).expect(200);
    expect((await ctx.http.get('/api/orcamentos?status=EMITIDO').set(auth)).body).toHaveLength(1);
    expect((await ctx.http.get('/api/orcamentos?status=X').set(auth)).status).toBe(400);
  });

  it('CA08.4 — duplicar cria rascunho com novo número, mesmos itens e condições e cliente em branco', async () => {
    const o = await criarOrcamentoCompleto(ctx, auth);
    await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth).expect(200);
    const res = await ctx.http.post(`/api/orcamentos/${o.id}/duplicar`).set(auth);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      numero: `ORC-${ano}-0002`,
      status: 'RASCUNHO',
      cliente: null,
      prazoExecucaoDias: 2,
      totalCentavos: 80000,
      documentoAtual: null,
      etapaAtual: 'PREENCHER',
    });
    expect(res.body.itens.map((i: { descricao: string }) => i.descricao)).toEqual(['Pintura de parede', 'Massa corrida']);
    expect(res.body.itens[0].id).not.toBe(o.itens[0].id);
  });

  it('CA08.5 — excluir remove orçamento, itens e PDFs', async () => {
    const o = await criarOrcamentoCompleto(ctx, auth);
    await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth).expect(200);
    await ctx.http.delete(`/api/orcamentos/${o.id}`).set(auth).expect(204);
    expect((await ctx.http.get(`/api/orcamentos/${o.id}`).set(auth)).status).toBe(404);
    for (const tabela of ['item_servico', 'documento_pdf']) {
      const { n } = ctx.db.prepare(`SELECT COUNT(*) AS n FROM ${tabela}`).get() as { n: number };
      expect(n).toBe(0);
    }
  });

  it('dados de outro usuário não são acessíveis (404)', async () => {
    const o = await criarOrcamentoCompleto(ctx, auth);
    const intruso = await criarConta(ctx);
    await ctx.http.put('/api/perfil').set(intruso).send(PERFIL).expect(201);
    expect((await ctx.http.get(`/api/orcamentos/${o.id}`).set(intruso)).status).toBe(404);
    expect((await ctx.http.delete(`/api/orcamentos/${o.id}`).set(intruso)).status).toBe(404);
    expect((await ctx.http.get('/api/orcamentos').set(intruso)).body).toEqual([]);
  });

  it('mesmos dados acessíveis em outra sessão (outro navegador)', async () => {
    const o = await criarOrcamentoCompleto(ctx, auth);
    const { body: me } = await ctx.http.get('/api/auth/me').set(auth);
    const login = await ctx.http.post('/api/auth/login').send({ email: me.email, senha: 'senha1234' });
    const outraSessao = { Authorization: `Bearer ${login.body.token}` };
    const res = await ctx.http.get('/api/orcamentos').set(outraSessao);
    expect(res.body.map((x: { id: string }) => x.id)).toEqual([o.id]);
  });
});

describe('Tratamento de erros', () => {
  it('JSON malformado → 400 JSON_INVALIDO', async () => {
    const res = await ctx.http.post('/api/auth/login').set('Content-Type', 'application/json').send('{"email":');
    expect(res.status).toBe(400);
    expect(res.body.erro.codigo).toBe('JSON_INVALIDO');
  });

  it('rota inexistente → 404 ROTA_NAO_ENCONTRADA', async () => {
    const res = await ctx.http.get('/api/nao-existe');
    expect(res.status).toBe(404);
    expect(res.body.erro.codigo).toBe('ROTA_NAO_ENCONTRADA');
  });

  it('orçamento inexistente → 404 ORCAMENTO_NAO_ENCONTRADO', async () => {
    const res = await ctx.http.get('/api/orcamentos/abc').set(auth);
    expect(res.body.erro).toEqual({ codigo: 'ORCAMENTO_NAO_ENCONTRADO', mensagem: 'Orçamento não encontrado' });
  });

  it('documentação OpenAPI disponível', async () => {
    const res = await ctx.http.get('/api/openapi.json');
    expect(res.body.openapi).toBe('3.0.3');
    expect(Object.keys(res.body.paths)).toContain('/orcamentos/{id}/emitir');
  });
});
