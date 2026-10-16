/**
 * Contratos (DTOs) trocados entre a API e a interface.
 */
import type { Etapa, Status, Unidade } from './orcamento';

export interface Usuario {
  id: string;
  email: string;
  criadoEm: string;
}

export interface SessaoResposta {
  token: string;
  usuario: Usuario;
}

export interface Profissional {
  id: string;
  nome: string | null;
  nomeEmpresa: string | null;
  documento: string | null;
  telefone: string;
  email: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Cliente {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  endereco: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface ItemServico {
  id: string;
  orcamentoId: string;
  ordem: number;
  descricao: string;
  quantidade: number;
  unidade: Unidade;
  valorUnitarioCentavos: number;
  subtotalCentavos: number;
}

export interface DocumentoPdfResumo {
  id: string;
  nomeArquivo: string;
  tamanhoBytes: number;
  hashSha256: string;
  geradoEm: string;
}

export interface OrcamentoResumo {
  id: string;
  numero: string;
  status: Status;
  clienteId: string | null;
  clienteNome: string | null;
  totalCentavos: number;
  etapaAtual: Etapa;
  dataEmissao: string | null;
  possuiPdf: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Orcamento extends OrcamentoResumo {
  prazoExecucaoDias: number | null;
  validadeDias: number;
  condicoesPagamento: string | null;
  observacoes: string | null;
  cliente: Cliente | null;
  itens: ItemServico[];
  pendencias: string[];
  documentoAtual: DocumentoPdfResumo | null;
}

export interface ErroResposta {
  erro: {
    codigo: string;
    mensagem: string;
    campos?: Record<string, string>;
    pendencias?: string[];
  };
}
