import type { DocumentoPdfResumo, Etapa, ItemDados, ItemServico, OrcamentoResumo, Status } from '@orcafacil/shared';
import type { Db } from '../db/connection';

// ------------------------------------------------------------------ Orçamento

interface OrcamentoRow {
  id: string;
  numero: string;
  profissional_id: string;
  cliente_id: string | null;
  status: Status;
  prazo_execucao_dias: number | null;
  validade_dias: number;
  condicoes_pagamento: string | null;
  observacoes: string | null;
  total_centavos: number;
  etapa_atual: Etapa;
  data_emissao: string | null;
  criado_em: string;
  atualizado_em: string;
  cliente_nome: string | null;
  possui_pdf: number;
}

export interface OrcamentoRegistro extends OrcamentoResumo {
  profissionalId: string;
  prazoExecucaoDias: number | null;
  validadeDias: number;
  condicoesPagamento: string | null;
  observacoes: string | null;
}

const SELECT_ORCAMENTO = `
  SELECT o.*, c.nome AS cliente_nome,
         EXISTS (SELECT 1 FROM documento_pdf d WHERE d.orcamento_id = o.id) AS possui_pdf
  FROM orcamento o
  LEFT JOIN cliente c ON c.id = o.cliente_id`;

const mapearOrcamento = (r: OrcamentoRow): OrcamentoRegistro => ({
  id: r.id,
  numero: r.numero,
  profissionalId: r.profissional_id,
  clienteId: r.cliente_id,
  clienteNome: r.cliente_nome,
  status: r.status,
  prazoExecucaoDias: r.prazo_execucao_dias,
  validadeDias: r.validade_dias,
  condicoesPagamento: r.condicoes_pagamento,
  observacoes: r.observacoes,
  totalCentavos: r.total_centavos,
  etapaAtual: r.etapa_atual,
  dataEmissao: r.data_emissao,
  possuiPdf: r.possui_pdf === 1,
  criadoEm: r.criado_em,
  atualizadoEm: r.atualizado_em,
});

export const paraResumo = (o: OrcamentoRegistro): OrcamentoResumo => ({
  id: o.id,
  numero: o.numero,
  status: o.status,
  clienteId: o.clienteId,
  clienteNome: o.clienteNome,
  totalCentavos: o.totalCentavos,
  etapaAtual: o.etapaAtual,
  dataEmissao: o.dataEmissao,
  possuiPdf: o.possuiPdf,
  criadoEm: o.criadoEm,
  atualizadoEm: o.atualizadoEm,
});

export interface NovoOrcamento {
  id: string;
  numero: string;
  profissionalId: string;
  clienteId: string | null;
  prazoExecucaoDias: number | null;
  validadeDias: number;
  condicoesPagamento: string | null;
  observacoes: string | null;
  totalCentavos: number;
  agora: string;
}

/** Campos editáveis pelo usuário (coluna SQL correspondente). */
const COLUNAS_EDITAVEIS = {
  clienteId: 'cliente_id',
  prazoExecucaoDias: 'prazo_execucao_dias',
  validadeDias: 'validade_dias',
  condicoesPagamento: 'condicoes_pagamento',
  observacoes: 'observacoes',
  etapaAtual: 'etapa_atual',
  status: 'status',
  totalCentavos: 'total_centavos',
  dataEmissao: 'data_emissao',
} as const;
export type CampoOrcamento = keyof typeof COLUNAS_EDITAVEIS;

export const orcamentosRepo = {
  listar(db: Db, profissionalId: string, filtros: { busca?: string; status?: Status }): OrcamentoResumo[] {
    const condicoes = ['o.profissional_id = @profissionalId'];
    if (filtros.busca) condicoes.push(`normalizar(c.nome) LIKE '%' || normalizar(@busca) || '%'`);
    if (filtros.status) condicoes.push('o.status = @status');
    const rows = db
      .prepare(`${SELECT_ORCAMENTO} WHERE ${condicoes.join(' AND ')} ORDER BY o.atualizado_em DESC, o.numero DESC`)
      .all({ profissionalId, busca: filtros.busca ?? null, status: filtros.status ?? null }) as OrcamentoRow[];
    return rows.map((r) => paraResumo(mapearOrcamento(r)));
  },

  porId(db: Db, profissionalId: string, id: string): OrcamentoRegistro | undefined {
    const r = db.prepare(`${SELECT_ORCAMENTO} WHERE o.id = ? AND o.profissional_id = ?`).get(id, profissionalId) as
      | OrcamentoRow
      | undefined;
    return r && mapearOrcamento(r);
  },

  inserir(db: Db, o: NovoOrcamento): void {
    db.prepare(
      `INSERT INTO orcamento (id, numero, profissional_id, cliente_id, prazo_execucao_dias, validade_dias,
         condicoes_pagamento, observacoes, total_centavos, criado_em, atualizado_em)
       VALUES (@id, @numero, @profissionalId, @clienteId, @prazoExecucaoDias, @validadeDias,
         @condicoesPagamento, @observacoes, @totalCentavos, @agora, @agora)`,
    ).run(o);
  },

  atualizar(db: Db, id: string, campos: Partial<Record<CampoOrcamento, unknown>>, agora: string): void {
    const entradas = Object.entries(campos).filter(([, v]) => v !== undefined) as [CampoOrcamento, unknown][];
    const sets = entradas.map(([k]) => `${COLUNAS_EDITAVEIS[k]} = @${k}`);
    db.prepare(`UPDATE orcamento SET ${[...sets, 'atualizado_em = @agora'].join(', ')} WHERE id = @id`).run({
      ...Object.fromEntries(entradas),
      agora,
      id,
    });
  },

  excluir(db: Db, id: string): void {
    db.prepare('DELETE FROM orcamento WHERE id = ?').run(id);
  },

  contarDaConta(db: Db, profissionalId: string): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM orcamento WHERE profissional_id = ?').get(profissionalId) as { n: number }).n;
  },
};

// ------------------------------------------------------------------ Numeração (RN07)

export const sequenciasRepo = {
  /** Incrementa e retorna o próximo número do ano para o profissional (chamar dentro de transação). */
  proximo(db: Db, profissionalId: string, ano: number): number {
    const r = db
      .prepare(
        `INSERT INTO sequencia_numeracao (profissional_id, ano, ultimo_numero) VALUES (?, ?, 1)
         ON CONFLICT (profissional_id, ano) DO UPDATE SET ultimo_numero = ultimo_numero + 1
         RETURNING ultimo_numero`,
      )
      .get(profissionalId, ano) as { ultimo_numero: number };
    return r.ultimo_numero;
  },
};

// ------------------------------------------------------------------ Itens

interface ItemRow {
  id: string;
  orcamento_id: string;
  ordem: number;
  descricao: string;
  quantidade: number;
  unidade: ItemServico['unidade'];
  valor_unitario_centavos: number;
  subtotal_centavos: number;
}

const mapearItem = (r: ItemRow): ItemServico => ({
  id: r.id,
  orcamentoId: r.orcamento_id,
  ordem: r.ordem,
  descricao: r.descricao,
  quantidade: r.quantidade,
  unidade: r.unidade,
  valorUnitarioCentavos: r.valor_unitario_centavos,
  subtotalCentavos: r.subtotal_centavos,
});

export const itensRepo = {
  listar(db: Db, orcamentoId: string): ItemServico[] {
    return (
      db.prepare('SELECT * FROM item_servico WHERE orcamento_id = ? ORDER BY ordem').all(orcamentoId) as ItemRow[]
    ).map(mapearItem);
  },

  inserir(db: Db, item: Omit<ItemServico, 'id'> & { id: string }): void {
    db.prepare(
      `INSERT INTO item_servico (id, orcamento_id, ordem, descricao, quantidade, unidade, valor_unitario_centavos, subtotal_centavos)
       VALUES (@id, @orcamentoId, @ordem, @descricao, @quantidade, @unidade, @valorUnitarioCentavos, @subtotalCentavos)`,
    ).run(item);
  },

  atualizar(db: Db, id: string, dados: ItemDados & { subtotalCentavos: number }): void {
    db.prepare(
      `UPDATE item_servico SET descricao = @descricao, quantidade = @quantidade, unidade = @unidade,
         valor_unitario_centavos = @valorUnitarioCentavos, subtotal_centavos = @subtotalCentavos
       WHERE id = @id`,
    ).run({ ...dados, id });
  },

  definirOrdem(db: Db, id: string, ordem: number): void {
    db.prepare('UPDATE item_servico SET ordem = ? WHERE id = ?').run(ordem, id);
  },

  excluir(db: Db, id: string): void {
    db.prepare('DELETE FROM item_servico WHERE id = ?').run(id);
  },
};

// ------------------------------------------------------------------ Documentos PDF

interface DocumentoRow {
  id: string;
  orcamento_id: string;
  nome_arquivo: string;
  tamanho_bytes: number;
  hash_sha256: string;
  conteudo?: Buffer;
  gerado_em: string;
}

const mapearDocumento = (r: DocumentoRow): DocumentoPdfResumo => ({
  id: r.id,
  nomeArquivo: r.nome_arquivo,
  tamanhoBytes: r.tamanho_bytes,
  hashSha256: r.hash_sha256,
  geradoEm: r.gerado_em,
});

export const documentosRepo = {
  /** PDF vigente = o gerado mais recentemente (RN10). */
  atual(db: Db, orcamentoId: string): DocumentoPdfResumo | undefined {
    const r = db
      .prepare(
        `SELECT id, orcamento_id, nome_arquivo, tamanho_bytes, hash_sha256, gerado_em FROM documento_pdf
         WHERE orcamento_id = ? ORDER BY gerado_em DESC, rowid DESC LIMIT 1`,
      )
      .get(orcamentoId) as DocumentoRow | undefined;
    return r && mapearDocumento(r);
  },

  conteudoAtual(db: Db, orcamentoId: string): { nomeArquivo: string; conteudo: Buffer } | undefined {
    const r = db
      .prepare(
        `SELECT nome_arquivo, conteudo FROM documento_pdf WHERE orcamento_id = ?
         ORDER BY gerado_em DESC, rowid DESC LIMIT 1`,
      )
      .get(orcamentoId) as DocumentoRow | undefined;
    return r && { nomeArquivo: r.nome_arquivo, conteudo: r.conteudo! };
  },

  /** Remove os PDFs do orçamento; usado ao gerar um novo, que passa a ser o vigente (RN10). */
  excluirDoOrcamento(db: Db, orcamentoId: string): void {
    db.prepare('DELETE FROM documento_pdf WHERE orcamento_id = ?').run(orcamentoId);
  },

  /** Bytes de PDF guardados pela conta, sem contar os de um orçamento. */
  bytesDaConta(db: Db, profissionalId: string, excetoOrcamentoId: string): number {
    return (
      db
        .prepare(
          `SELECT COALESCE(SUM(d.tamanho_bytes), 0) AS n FROM documento_pdf d
           JOIN orcamento o ON o.id = d.orcamento_id
           WHERE o.profissional_id = ? AND o.id <> ?`,
        )
        .get(profissionalId, excetoOrcamentoId) as { n: number }
    ).n;
  },

  inserir(
    db: Db,
    d: DocumentoPdfResumo & { orcamentoId: string; conteudo: Buffer },
  ): void {
    db.prepare(
      `INSERT INTO documento_pdf (id, orcamento_id, nome_arquivo, tamanho_bytes, hash_sha256, conteudo, gerado_em)
       VALUES (@id, @orcamentoId, @nomeArquivo, @tamanhoBytes, @hashSha256, @conteudo, @geradoEm)`,
    ).run(d);
  },
};
