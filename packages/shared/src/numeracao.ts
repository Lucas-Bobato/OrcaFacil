/**
 * Numeração dos orçamentos (RN07) e nome do arquivo PDF (RN12).
 */

/** `(2026, 1)` → `"ORC-2026-0001"`. */
export function formatarNumero(ano: number, sequencial: number): string {
  return `ORC-${ano}-${String(sequencial).padStart(4, '0')}`;
}

export const PADRAO_NUMERO = /^ORC-\d{4}-\d{4,}$/;

/** Remove acentos/diacríticos: `"João"` → `"Joao"`. */
export function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * RN12: `Orcamento_<numero>_<cliente>.pdf`, cliente sem acentos,
 * espaços trocados por `-` e limitado a 40 caracteres.
 */
export function nomeArquivoPdf(numero: string, nomeCliente: string): string {
  const cliente = removerAcentos(nomeCliente)
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 40)
    .replace(/-$/, '');
  return `Orcamento_${numero}_${cliente || 'Cliente'}.pdf`;
}
