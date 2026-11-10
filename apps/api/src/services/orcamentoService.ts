import { createHash, randomUUID } from 'node:crypto';
import {
  atualizarOrcamentoSchema,
  calcularSubtotal,
  calcularTotal,
  clienteSchema,
  criarOrcamentoSchema,
  formatarNumero,
  hojeIso,
  itemSchema,
  LIMITE_ITENS,
  nomeArquivoPdf,
  novoItemSchema,
  pendenciasEmissao,
  STATUS,
  VALIDADE_PADRAO_DIAS,
  type Orcamento,
  type OrcamentoResumo,
  type Profissional,
  type Status,
} from '@orcafacil/shared';
import type { Db } from '../db/connection';
import { AppError, naoEncontrado } from '../errors';
import { LIMITES_PADRAO, type Limites } from '../middleware/limites';
import { gerarPdf } from '../pdf/gerarPdf';
import { clientesRepo } from '../repositories/clientes';
import { clienteService } from './clienteService';
import {
  documentosRepo,
  itensRepo,
  orcamentosRepo,
  paraResumo,
  sequenciasRepo,
  type CampoOrcamento,
  type OrcamentoRegistro,
} from '../repositories/orcamentos';

/** Limite do arquivo PDF (RNF06). */
export const TAMANHO_MAXIMO_PDF = 3 * 1024 * 1024;

const agoraIso = () => new Date().toISOString();

function carregar(db: Db, profissionalId: string, id: string): OrcamentoRegistro {
  const orcamento = orcamentosRepo.porId(db, profissionalId, id);
  if (!orcamento) throw naoEncontrado('Orçamento');
  return orcamento;
}

/** Próximo número `ORC-AAAA-NNNN` (RN07) — deve rodar dentro de uma transação. */
function proximoNumero(db: Db, profissionalId: string): string {
  const ano = new Date().getFullYear();
  return formatarNumero(ano, sequenciasRepo.proximo(db, profissionalId, ano));
}

/** Lança 422 se a conta já está na cota de orçamentos. */
function exigirCotaOrcamentos(db: Db, profissionalId: string, limites: Limites): void {
  if (orcamentosRepo.contarDaConta(db, profissionalId) >= limites.orcamentosPorConta) {
    throw new AppError(422, 'LIMITE_CONTA', `Sua conta atingiu o limite de ${limites.orcamentosPorConta} orçamentos`);
  }
}

/**
 * Recalcula o total a partir dos itens (RN02) e aplica RN10: um orçamento
 * emitido que é editado volta para RASCUNHO (o PDF anterior continua disponível até gerar outro).
 */
function registrarEdicao(db: Db, orcamento: OrcamentoRegistro, campos: Partial<Record<CampoOrcamento, unknown>> = {}) {
  const total = calcularTotal(itensRepo.listar(db, orcamento.id));
  orcamentosRepo.atualizar(
    db,
    orcamento.id,
    { ...campos, totalCentavos: total, status: 'RASCUNHO' satisfies Status },
    agoraIso(),
  );
}

export const orcamentoService = {
  listar(db: Db, profissionalId: string, filtros: { busca?: unknown; status?: unknown }): OrcamentoResumo[] {
    const busca = typeof filtros.busca === 'string' && filtros.busca.trim() ? filtros.busca.trim() : undefined;
    let status: Status | undefined;
    if (filtros.status !== undefined && filtros.status !== '') {
      if (!STATUS.includes(filtros.status as Status)) {
        throw new AppError(400, 'VALIDACAO', 'Status inválido', { campos: { status: 'Use RASCUNHO ou EMITIDO' } });
      }
      status = filtros.status as Status;
    }
    return orcamentosRepo.listar(db, profissionalId, { busca, status });
  },

  /** Orçamento completo: cliente, itens em ordem, pendências para emissão (RN01) e PDF vigente. */
  detalhar(db: Db, profissional: Profissional, id: string): Orcamento {
    const o = carregar(db, profissional.id, id);
    const itens = itensRepo.listar(db, o.id);
    const cliente = o.clienteId ? (clientesRepo.porId(db, profissional.id, o.clienteId) ?? null) : null;
    const { profissionalId: _ignorado, ...resto } = o;
    return {
      ...resto,
      cliente,
      itens,
      pendencias: pendenciasEmissao({ profissional, cliente, itens, prazoExecucaoDias: o.prazoExecucaoDias }),
      documentoAtual: documentosRepo.atual(db, o.id) ?? null,
    };
  },

  /** RF03 — cria um rascunho com número sequencial e data de criação (RN07). */
  criar(db: Db, profissional: Profissional, entrada: unknown, limites: Limites = LIMITES_PADRAO): Orcamento {
    const { clienteId } = criarOrcamentoSchema.parse(entrada ?? {});
    if (clienteId && !clientesRepo.porId(db, profissional.id, clienteId)) throw naoEncontrado('Cliente');
    exigirCotaOrcamentos(db, profissional.id, limites);
    const id = randomUUID();
    db.transaction(() => {
      orcamentosRepo.inserir(db, {
        id,
        numero: proximoNumero(db, profissional.id),
        profissionalId: profissional.id,
        clienteId: clienteId ?? null,
        prazoExecucaoDias: null,
        validadeDias: VALIDADE_PADRAO_DIAS,
        condicoesPagamento: null,
        observacoes: null,
        totalCentavos: 0,
        agora: agoraIso(),
      });
    })();
    return this.detalhar(db, profissional, id);
  },

  /** Atualiza cliente vinculado, condições (RN05, RN06) e etapa atual (CA08.3). */
  atualizar(db: Db, profissional: Profissional, id: string, entrada: unknown): Orcamento {
    const o = carregar(db, profissional.id, id);
    const patch = atualizarOrcamentoSchema.parse(entrada ?? {});
    if (patch.clienteId && !clientesRepo.porId(db, profissional.id, patch.clienteId)) throw naoEncontrado('Cliente');

    const alterouConteudo = (Object.keys(patch) as Array<keyof typeof patch>).some(
      (k) => k !== 'etapaAtual' && patch[k] !== o[k],
    );
    if (alterouConteudo) {
      registrarEdicao(db, o, patch);
    } else if (patch.etapaAtual && patch.etapaAtual !== o.etapaAtual) {
      orcamentosRepo.atualizar(db, o.id, { etapaAtual: patch.etapaAtual }, agoraIso());
    }
    return this.detalhar(db, profissional, id);
  },

  /** Etapa "01 Preencher" (RF02): cria ou atualiza o cliente do orçamento. */
  definirCliente(db: Db, profissional: Profissional, id: string, entrada: unknown, limites: Limites = LIMITES_PADRAO): Orcamento {
    const o = carregar(db, profissional.id, id);
    const dados = clienteSchema.parse(entrada);
    db.transaction(() => {
      const atual = o.clienteId ? clientesRepo.porId(db, profissional.id, o.clienteId) : undefined;
      if (atual) {
        const mudou = (['nome', 'telefone', 'email', 'endereco'] as const).some((k) => atual[k] !== dados[k]);
        if (mudou) {
          clientesRepo.atualizar(db, atual.id, dados, agoraIso());
          registrarEdicao(db, o);
        }
      } else {
        clienteService.exigirCota(db, profissional.id, limites);
        const clienteId = randomUUID();
        clientesRepo.inserir(db, clienteId, profissional.id, dados, agoraIso());
        registrarEdicao(db, o, { clienteId });
      }
    })();
    return this.detalhar(db, profissional, id);
  },

  /** CA08.5 — exclui o orçamento com seus itens e PDFs (cascata). */
  excluir(db: Db, profissionalId: string, id: string): void {
    carregar(db, profissionalId, id);
    orcamentosRepo.excluir(db, id);
  },

  /** CA08.4 — novo rascunho com novo número, mesmos itens e condições, cliente em branco. */
  duplicar(db: Db, profissional: Profissional, id: string, limites: Limites = LIMITES_PADRAO): Orcamento {
    const origem = carregar(db, profissional.id, id);
    exigirCotaOrcamentos(db, profissional.id, limites);
    const novoId = randomUUID();
    db.transaction(() => {
      const itens = itensRepo.listar(db, origem.id);
      orcamentosRepo.inserir(db, {
        id: novoId,
        numero: proximoNumero(db, profissional.id),
        profissionalId: profissional.id,
        clienteId: null,
        prazoExecucaoDias: origem.prazoExecucaoDias,
        validadeDias: origem.validadeDias,
        condicoesPagamento: origem.condicoesPagamento,
        observacoes: origem.observacoes,
        totalCentavos: calcularTotal(itens),
        agora: agoraIso(),
      });
      for (const item of itens) itensRepo.inserir(db, { ...item, id: randomUUID(), orcamentoId: novoId });
    })();
    return this.detalhar(db, profissional, novoId);
  },

  // ---------------------------------------------------------------- Itens (RF04, RF05)

  /** Adiciona item no fim ou na posição `ordem` (usado pelo "Desfazer" — CA04.3). */
  adicionarItem(db: Db, profissional: Profissional, id: string, entrada: unknown): Orcamento {
    const o = carregar(db, profissional.id, id);
    const { ordem, ...dados } = novoItemSchema.parse(entrada);
    db.transaction(() => {
      const itens = itensRepo.listar(db, o.id);
      if (itens.length >= LIMITE_ITENS) {
        throw new AppError(422, 'LIMITE_ITENS', `Limite de ${LIMITE_ITENS} itens atingido`);
      }
      const posicao = Math.min(ordem ?? itens.length + 1, itens.length + 1);
      // Abre espaço deslocando de trás para frente (mantém UNIQUE(orcamento_id, ordem)).
      for (const item of [...itens].reverse()) {
        if (item.ordem >= posicao) itensRepo.definirOrdem(db, item.id, item.ordem + 1);
      }
      itensRepo.inserir(db, {
        id: randomUUID(),
        orcamentoId: o.id,
        ordem: posicao,
        ...dados,
        subtotalCentavos: calcularSubtotal(dados.quantidade, dados.valorUnitarioCentavos),
      });
      registrarEdicao(db, o);
    })();
    return this.detalhar(db, profissional, id);
  },

  atualizarItem(db: Db, profissional: Profissional, id: string, itemId: string, entrada: unknown): Orcamento {
    const o = carregar(db, profissional.id, id);
    const dados = itemSchema.parse(entrada);
    if (!itensRepo.listar(db, o.id).some((i) => i.id === itemId)) throw naoEncontrado('Item');
    db.transaction(() => {
      itensRepo.atualizar(db, itemId, {
        ...dados,
        subtotalCentavos: calcularSubtotal(dados.quantidade, dados.valorUnitarioCentavos),
      });
      registrarEdicao(db, o);
    })();
    return this.detalhar(db, profissional, id);
  },

  removerItem(db: Db, profissional: Profissional, id: string, itemId: string): Orcamento {
    const o = carregar(db, profissional.id, id);
    const itens = itensRepo.listar(db, o.id);
    const removido = itens.find((i) => i.id === itemId);
    if (!removido) throw naoEncontrado('Item');
    db.transaction(() => {
      itensRepo.excluir(db, itemId);
      for (const item of itens) {
        if (item.ordem > removido.ordem) itensRepo.definirOrdem(db, item.id, item.ordem - 1);
      }
      registrarEdicao(db, o);
    })();
    return this.detalhar(db, profissional, id);
  },

  // ---------------------------------------------------------------- Emissão (RF10)

  /**
   * Valida RN01, gera o PDF, guarda o snapshot no lugar do anterior e marca como
   * EMITIDO com a data de emissão automática (RN10, RN13).
   */
  async emitir(db: Db, profissional: Profissional, id: string, limites: Limites = LIMITES_PADRAO): Promise<Orcamento> {
    const o = this.detalhar(db, profissional, id);
    if (o.pendencias.length > 0 || !o.cliente || o.prazoExecucaoDias === null) {
      throw new AppError(422, 'EMISSAO_BLOQUEADA', 'Complete o orçamento antes de gerar o PDF', {
        pendencias: o.pendencias,
      });
    }
    const dataEmissao = hojeIso();
    const totalCentavos = calcularTotal(o.itens);
    const pdf = await gerarPdf({
      numero: o.numero,
      dataEmissao,
      profissional,
      cliente: o.cliente,
      itens: o.itens,
      totalCentavos,
      prazoExecucaoDias: o.prazoExecucaoDias,
      validadeDias: o.validadeDias,
      condicoesPagamento: o.condicoesPagamento,
      observacoes: o.observacoes,
    });
    if (pdf.length > TAMANHO_MAXIMO_PDF) {
      throw new AppError(422, 'PDF_MUITO_GRANDE', 'O PDF gerado ultrapassa o limite de 3 MB');
    }
    if (documentosRepo.bytesDaConta(db, profissional.id, o.id) + pdf.length > limites.bytesPdfPorConta) {
      throw new AppError(422, 'LIMITE_CONTA', 'Sua conta atingiu o limite de armazenamento de PDFs');
    }
    const agora = agoraIso();
    db.transaction(() => {
      documentosRepo.excluirDoOrcamento(db, o.id);
      documentosRepo.inserir(db, {
        id: randomUUID(),
        orcamentoId: o.id,
        nomeArquivo: nomeArquivoPdf(o.numero, o.cliente!.nome),
        tamanhoBytes: pdf.length,
        hashSha256: createHash('sha256').update(pdf).digest('hex'),
        conteudo: pdf,
        geradoEm: agora,
      });
      orcamentosRepo.atualizar(
        db,
        o.id,
        { status: 'EMITIDO', dataEmissao, totalCentavos, etapaAtual: 'REVISAR' },
        agora,
      );
    })();
    return this.detalhar(db, profissional, id);
  },

  /** RF11 — PDF vigente (o mais recente) para download. */
  pdfAtual(db: Db, profissionalId: string, id: string): { nomeArquivo: string; conteudo: Buffer } {
    carregar(db, profissionalId, id);
    const documento = documentosRepo.conteudoAtual(db, id);
    if (!documento) throw new AppError(404, 'PDF_NAO_ENCONTRADO', 'Este orçamento ainda não tem PDF gerado');
    return documento;
  },

  resumo: paraResumo,
};
