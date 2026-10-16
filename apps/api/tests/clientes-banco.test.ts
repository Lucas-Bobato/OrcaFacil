import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { formatarBRL } from '@orcafacil/shared';
import { montarDocumento } from '../src/pdf/gerarPdf';
import { criarContaComPerfil, criarContexto, criarOrcamentoCompleto, type Contexto } from './helpers';

let ctx: Contexto;
let auth: Record<string, string>;

beforeEach(async () => {
  ctx = criarContexto();
  auth = await criarContaComPerfil(ctx);
});

describe('Clientes (CRUD — RF02)', () => {
  it('cria, lista com busca, detalha, atualiza e exclui', async () => {
    const criado = await ctx.http.post('/api/clientes').set(auth).send({ nome: 'José Araújo', email: 'JOSE@EMAIL.COM' });
    expect(criado.status).toBe(201);
    expect(criado.body.email).toBe('jose@email.com');
    await ctx.http.post('/api/clientes').set(auth).send({ nome: 'Ana Lima' }).expect(201);

    const lista = await ctx.http.get('/api/clientes').set(auth);
    expect(lista.body.map((c: { nome: string }) => c.nome)).toEqual(['Ana Lima', 'José Araújo']);
    const busca = await ctx.http.get('/api/clientes?busca=araujo').set(auth);
    expect(busca.body).toHaveLength(1);

    const id = criado.body.id;
    expect((await ctx.http.get(`/api/clientes/${id}`).set(auth)).body.nome).toBe('José Araújo');
    const atualizado = await ctx.http.put(`/api/clientes/${id}`).set(auth).send({ nome: 'José A.', telefone: '1133334444' });
    expect(atualizado.body).toMatchObject({ nome: 'José A.', telefone: '1133334444', email: null });

    await ctx.http.delete(`/api/clientes/${id}`).set(auth).expect(204);
    expect((await ctx.http.get(`/api/clientes/${id}`).set(auth)).status).toBe(404);
  });

  it('valida campos', async () => {
    const res = await ctx.http.post('/api/clientes').set(auth).send({ nome: 'A', endereco: 'x'.repeat(201) });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.erro.campos)).toEqual(['nome', 'endereco']);
  });

  it('exclusão restrita: cliente com orçamentos → 409', async () => {
    const o = await criarOrcamentoCompleto(ctx, auth);
    const res = await ctx.http.delete(`/api/clientes/${o.cliente.id}`).set(auth);
    expect(res.status).toBe(409);
    expect(res.body.erro.codigo).toBe('CLIENTE_COM_ORCAMENTOS');
  });

  it('cria orçamento já vinculado a um cliente existente', async () => {
    const { body: cliente } = await ctx.http.post('/api/clientes').set(auth).send({ nome: 'Ana Lima' });
    const res = await ctx.http.post('/api/orcamentos').set(auth).send({ clienteId: cliente.id });
    expect(res.body.cliente.nome).toBe('Ana Lima');
    const invalido = await ctx.http.post('/api/orcamentos').set(auth).send({ clienteId: randomUUID() });
    expect(invalido.status).toBe(404);
  });
});

describe('PDF — conteúdo (RF10, CA06.3)', () => {
  it('lista os itens na mesma ordem e o total exato em BRL', () => {
    const itens = [
      { descricao: 'Primeiro', subtotalCentavos: 100000 },
      { descricao: 'Segundo', subtotalCentavos: 23400 },
      { descricao: 'Terceiro', subtotalCentavos: 56 },
    ].map((i, n) => ({
      ...i,
      id: String(n),
      orcamentoId: 'o',
      ordem: n + 1,
      quantidade: 1,
      unidade: 'UN' as const,
      valorUnitarioCentavos: i.subtotalCentavos,
    }));
    const doc = montarDocumento({
      numero: 'ORC-2026-0001',
      dataEmissao: '2026-10-08',
      profissional: {
        id: 'p',
        nome: 'João da Silva',
        nomeEmpresa: 'João Pinturas',
        documento: '11222333000181',
        telefone: '11987654321',
        email: 'joao@joaopinturas.com.br',
        criadoEm: '',
        atualizadoEm: '',
      },
      cliente: { id: 'c', nome: 'Maria Silva', telefone: null, email: null, endereco: 'Rua das Flores, 100', criadoEm: '', atualizadoEm: '' },
      itens,
      totalCentavos: 123456,
      prazoExecucaoDias: 2,
      validadeDias: 15,
      condicoesPagamento: '50% no início e 50% na conclusão.',
      observacoes: null,
    });
    const texto = JSON.stringify(doc.content);
    expect(texto.indexOf('Primeiro')).toBeLessThan(texto.indexOf('Segundo'));
    expect(texto.indexOf('Segundo')).toBeLessThan(texto.indexOf('Terceiro'));
    expect(texto).toContain(`"${formatarBRL(123456)}"`);
    expect(formatarBRL(123456)).toBe('R$ 1.234,56');
    expect(texto).toContain('JOÃO PINTURAS');
    expect(texto).toContain('CNPJ 11.222.333/0001-81');
    expect(texto).toContain('Nº ORC-2026-0001');
    expect(texto).toContain('Emissão 08/10/2026');
    expect(texto).toContain('Proposta válida até 23/10/2026.'); // RN06
    expect(texto).not.toContain('Observações'); // campo vazio não aparece
  });
});

describe('Banco de dados — restrições de integridade (DER)', () => {
  const agora = new Date().toISOString();

  it('PROFISSIONAL exige nome ou nome da empresa (CHECK)', () => {
    const usuario = randomUUID();
    ctx.db.prepare('INSERT INTO usuario VALUES (?, ?, ?, ?)').run(usuario, 'x@y.com', 'h', agora);
    expect(() =>
      ctx.db
        .prepare('INSERT INTO profissional (id, usuario_id, telefone, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?)')
        .run(randomUUID(), usuario, '11987654321', agora, agora),
    ).toThrow(/CHECK constraint failed/);
  });

  it('chaves estrangeiras são verificadas', () => {
    expect(() =>
      ctx.db
        .prepare('INSERT INTO cliente (id, profissional_id, nome, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?)')
        .run(randomUUID(), 'inexistente', 'Maria', agora, agora),
    ).toThrow(/FOREIGN KEY constraint failed/);
  });

  it('ITEM_SERVICO: ordem única por orçamento e valores de RN04', async () => {
    const o = await criarOrcamentoCompleto(ctx, auth);
    const inserir = (ordem: number, valor: number) =>
      ctx.db
        .prepare(
          `INSERT INTO item_servico (id, orcamento_id, ordem, descricao, quantidade, unidade, valor_unitario_centavos, subtotal_centavos)
           VALUES (?, ?, ?, 'Teste', 1, 'UN', ?, ?)`,
        )
        .run(randomUUID(), o.id, ordem, valor, valor);
    expect(() => inserir(1, 100)).toThrow(/UNIQUE constraint failed/);
    expect(() => inserir(51, 100)).toThrow(/CHECK constraint failed/);
    expect(() => inserir(3, 0)).toThrow(/CHECK constraint failed/);
  });

  it('ORCAMENTO emitido exige cliente, prazo e data de emissão (CHECK)', async () => {
    const { body: o } = await ctx.http.post('/api/orcamentos').set(auth).send({});
    expect(() => ctx.db.prepare(`UPDATE orcamento SET status = 'EMITIDO' WHERE id = ?`).run(o.id)).toThrow(
      /CHECK constraint failed/,
    );
  });

  it('cliente com orçamento não pode ser apagado direto no banco', async () => {
    const o = await criarOrcamentoCompleto(ctx, auth);
    expect(() => ctx.db.prepare('DELETE FROM cliente WHERE id = ?').run(o.cliente.id)).toThrow(/FOREIGN KEY/);
  });

  it('RN07 — trigger impede decrementar a sequência', async () => {
    await ctx.http.post('/api/orcamentos').set(auth).send({});
    expect(() => ctx.db.prepare('UPDATE sequencia_numeracao SET ultimo_numero = 0').run()).toThrow(/RN07/);
  });

  it('índices definidos no DER existem', () => {
    const indices = (ctx.db.prepare(`SELECT name FROM sqlite_master WHERE type = 'index' AND name LIKE 'idx_%'`).all() as { name: string }[]).map(
      (i) => i.name,
    );
    expect(indices).toEqual(
      expect.arrayContaining([
        'idx_cliente_profissional_nome',
        'idx_orcamento_profissional_atualizado',
        'idx_orcamento_cliente',
        'idx_documento_orcamento',
      ]),
    );
  });
});
