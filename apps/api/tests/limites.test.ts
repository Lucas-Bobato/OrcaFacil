import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { abrirBanco, migrar } from '../src/db/connection';
import { tratarErros } from '../src/middleware/error';
import { JanelaFixa, limitarConcorrencia } from '../src/middleware/limites';
import { criarContaComPerfil, criarContexto, criarOrcamentoCompleto } from './helpers';

describe('JanelaFixa', () => {
  it('conta até o máximo e libera quando a janela termina', () => {
    let agora = 1000;
    const janela = new JanelaFixa(2, 60_000, () => agora);
    expect(janela.consumir('a')).toBe(true);
    expect(janela.consumir('a')).toBe(true);
    expect(janela.consumir('a')).toBe(false);
    expect(janela.consumir('b')).toBe(true);
    expect(janela.segundosRestantes('a')).toBe(60);
    agora += 60_000;
    expect(janela.consumir('a')).toBe(true);
  });

  it('devolver reabre uma vaga; limpar zera a chave', () => {
    const janela = new JanelaFixa(1, 60_000);
    janela.consumir('a');
    janela.devolver('a');
    expect(janela.consumir('a')).toBe(true);
    janela.limpar('a');
    expect(janela.consumir('a')).toBe(true);
  });

  it('remove chaves expiradas quando o mapa cresce demais', () => {
    let agora = 0;
    const janela = new JanelaFixa(1, 10, () => agora);
    for (let i = 0; i <= 50_001; i++) janela.consumir(`k${i}`);
    agora = 100;
    janela.consumir('nova');
    expect((janela as unknown as { contagens: Map<string, unknown> }).contagens.size).toBe(1);
  });
});

describe('limitarConcorrencia', () => {
  it('recusa com 503 acima do máximo e libera a vaga ao terminar', async () => {
    let liberar = () => {};
    const segurar = new Promise<void>((r) => {
      liberar = r;
    });
    const app = express();
    app.get('/lento', limitarConcorrencia(1), async (_req, res) => {
      await segurar;
      res.json({ ok: true });
    });
    app.use(tratarErros);
    const servidor = app.listen(0, '127.0.0.1');
    await new Promise((r) => servidor.once('listening', r));
    try {
      const http = request(servidor);
      const primeira = http.get('/lento').then((r) => r);
      await new Promise((r) => setTimeout(r, 100)); // a primeira já ocupa a vaga
      const segunda = await http.get('/lento');
      expect(segunda.status).toBe(503);
      expect(segunda.body.erro.codigo).toBe('SERVIDOR_OCUPADO');
      expect(segunda.headers['retry-after']).toBe('1');

      liberar();
      expect((await primeira).status).toBe(200);
      await new Promise((r) => setTimeout(r, 50));
      expect((await http.get('/lento')).status).toBe(200);
    } finally {
      servidor.close();
    }
  });
});

describe('S11 — corpo comprimido (GHSA-27r3-jxmh-p828)', () => {
  it('recusa corpo gzip, inclusive com bytes extras, sem derrubar a API', async () => {
    const ctx = criarContexto();
    const corpo = Buffer.concat([gzipSync(JSON.stringify({ email: 'a@b.com', senha: 'x' })), Buffer.from('bytes-extras')]);
    const res = await ctx.http
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .set('Content-Encoding', 'gzip')
      .send(corpo);
    expect(res.status).toBe(415);
    expect((await ctx.http.get('/api/health')).status).toBe(200);
  });
});

describe('Migração 002 em um banco já existente', () => {
  it('mantém a conta e só o PDF mais recente de cada orçamento', () => {
    const db = abrirBanco(':memory:');
    const pasta = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/db/migrations');
    db.exec(fs.readFileSync(path.join(pasta, '001_inicial.sql'), 'utf8'));
    db.exec('CREATE TABLE schema_migrations (nome TEXT PRIMARY KEY, aplicada_em TEXT NOT NULL)');
    db.prepare('INSERT INTO schema_migrations VALUES (?, ?)').run('001_inicial.sql', '2026-01-01');

    const agora = '2026-01-01T00:00:00.000Z';
    db.prepare('INSERT INTO usuario (id, email, senha_hash, criado_em) VALUES (?, ?, ?, ?)').run('u1', 'a@b.com', 'h', agora);
    db.prepare(
      'INSERT INTO profissional (id, usuario_id, nome, telefone, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('p1', 'u1', 'Nome', '11987654321', agora, agora);
    for (const o of ['o1', 'o2']) {
      db.prepare(
        `INSERT INTO orcamento (id, numero, profissional_id, validade_dias, total_centavos, criado_em, atualizado_em)
         VALUES (?, ?, 'p1', 15, 0, ?, ?)`,
      ).run(o, o === 'o1' ? 'ORC-2026-0001' : 'ORC-2026-0002', agora, agora);
    }
    const pdf = db.prepare(
      `INSERT INTO documento_pdf (id, orcamento_id, nome_arquivo, tamanho_bytes, hash_sha256, conteudo, gerado_em)
       VALUES (?, ?, 'a.pdf', 1, ?, x'00', ?)`,
    );
    pdf.run('d1-velho', 'o1', 'a'.repeat(64), '2026-01-01T00:00:00.000Z');
    pdf.run('d1-novo', 'o1', 'b'.repeat(64), '2026-02-01T00:00:00.000Z');
    pdf.run('d2-unico', 'o2', 'c'.repeat(64), '2026-01-15T00:00:00.000Z');

    expect(migrar(db)).toEqual(['002_seguranca.sql']);

    const restantes = (db.prepare('SELECT id FROM documento_pdf ORDER BY id').all() as { id: string }[]).map((r) => r.id);
    expect(restantes).toEqual(['d1-novo', 'd2-unico']);
    expect(db.prepare('SELECT email, token_versao FROM usuario').get()).toEqual({ email: 'a@b.com', token_versao: 0 });
  });
});

describe('S5 — orçamento de armazenamento', () => {
  it('recusa a emissão quando os PDFs da conta passariam do limite', async () => {
    const ctx = criarContexto({ limites: { bytesPdfPorConta: 1 } });
    const auth = await criarContaComPerfil(ctx);
    const o = await criarOrcamentoCompleto(ctx, auth);
    const res = await ctx.http.post(`/api/orcamentos/${o.id}/emitir`).set(auth);
    expect(res.status).toBe(422);
    expect(res.body.erro.codigo).toBe('LIMITE_CONTA');
    const { n } = ctx.db.prepare('SELECT COUNT(*) AS n FROM documento_pdf').get() as { n: number };
    expect(n).toBe(0);
  });
});
