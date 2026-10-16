/**
 * Regras de cálculo e emissão do orçamento (RN01, RN02, RN05, RN06, RN08, RN09).
 */

export const LIMITE_ITENS = 50;
export const VALIDADE_PADRAO_DIAS = 15;

export const UNIDADES = ['UN', 'M2', 'M', 'H', 'DIARIA', 'VB'] as const;
export type Unidade = (typeof UNIDADES)[number];

export const ROTULO_UNIDADE: Record<Unidade, string> = {
  UN: 'un',
  M2: 'm²',
  M: 'm',
  H: 'h',
  DIARIA: 'diária',
  VB: 'vb',
};

export const STATUS = ['RASCUNHO', 'EMITIDO'] as const;
export type Status = (typeof STATUS)[number];

export const ETAPAS = ['PREENCHER', 'DETALHAR', 'REVISAR'] as const;
export type Etapa = (typeof ETAPAS)[number];

/**
 * Subtotal de um item em centavos (RN08): quantidade × valor unitário,
 * arredondado para o centavo mais próximo (meio para cima).
 * Usa BigInt porque 99.999,99 × R$ 9.999.999,99 ultrapassa Number.MAX_SAFE_INTEGER.
 */
export function calcularSubtotal(quantidade: number, valorUnitarioCentavos: number): number {
  const quantidadeCentesimos = BigInt(Math.round(quantidade * 100));
  const produto = quantidadeCentesimos * BigInt(Math.trunc(valorUnitarioCentavos));
  return Number((produto + 50n) / 100n);
}

/** Total do orçamento (RN02): soma dos subtotais, nunca informado pelo usuário. */
export function calcularTotal(itens: ReadonlyArray<{ subtotalCentavos: number }>): number {
  return itens.reduce((soma, item) => soma + item.subtotalCentavos, 0);
}

export function prazoValido(prazo: number | null | undefined): prazo is number {
  return typeof prazo === 'number' && Number.isInteger(prazo) && prazo >= 1 && prazo <= 365;
}

export interface DadosEmissao {
  profissional: { nome?: string | null; nomeEmpresa?: string | null } | null;
  cliente: { nome?: string | null } | null;
  itens: ReadonlyArray<{ subtotalCentavos: number }>;
  prazoExecucaoDias: number | null | undefined;
}

/**
 * RN01 + RN09: lista o que falta para habilitar "Gerar PDF".
 * Lista vazia = pode emitir.
 */
export function pendenciasEmissao(dados: DadosEmissao): string[] {
  const pendencias: string[] = [];
  const p = dados.profissional;
  if (!p || (!p.nome?.trim() && !p.nomeEmpresa?.trim())) {
    pendencias.push('Complete seu perfil com seu nome ou o nome da empresa');
  }
  if (!dados.cliente?.nome?.trim()) {
    pendencias.push('Informe o nome do cliente');
  }
  if (!dados.itens.some((i) => i.subtotalCentavos > 0)) {
    pendencias.push('Adicione ao menos um item com valor maior que R$ 0,00');
  }
  if (dados.itens.length > LIMITE_ITENS) {
    pendencias.push(`O orçamento pode ter no máximo ${LIMITE_ITENS} itens`);
  }
  if (!prazoValido(dados.prazoExecucaoDias)) {
    pendencias.push('Informe um prazo entre 1 e 365 dias');
  }
  return pendencias;
}

/** Soma dias a uma data ISO `AAAA-MM-DD` (sem fuso horário). */
export function somarDias(dataIso: string, dias: number): string {
  const [ano, mes, dia] = dataIso.split('-').map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia + dias));
  return data.toISOString().slice(0, 10);
}

/** RN06: data limite da proposta = data de emissão + validade em dias. */
export function dataValidade(dataEmissaoIso: string, validadeDias: number): string {
  return somarDias(dataEmissaoIso, validadeDias);
}

/** `"2026-10-23"` → `"23/10/2026"` (RNF17). */
export function formatarData(dataIso: string): string {
  const [ano, mes, dia] = dataIso.slice(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

/** Data local de hoje no formato ISO `AAAA-MM-DD`. */
export function hojeIso(agora: Date = new Date()): string {
  const y = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
