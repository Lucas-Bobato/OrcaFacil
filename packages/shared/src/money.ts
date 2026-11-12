/**
 * Valores monetários em centavos inteiros (RN08) e formatação BRL (RN03).
 */

/** Maior valor unitário aceito: R$ 9.999.999,99 (RN04). */
export const VALOR_UNITARIO_MAXIMO_CENTAVOS = 999_999_999;

/** Formata centavos no padrão brasileiro: `123456` → `"R$ 1.234,56"` (RN03). */
export function formatarBRL(centavos: number): string {
  const negativo = centavos < 0;
  const abs = Math.abs(Math.trunc(centavos));
  const reais = Math.floor(abs / 100);
  const cents = String(abs % 100).padStart(2, '0');
  const milhar = String(reais).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-' : ''}R$ ${milhar},${cents}`;
}

/**
 * Máscara em centavos (CA03.4): considera apenas os dígitos digitados.
 * `"1250"` → `1250` (exibido como `R$ 12,50`).
 */
export function centavosDeDigitos(digitado: string): number {
  const digitos = digitado.replace(/\D/g, '').replace(/^0+/, '').slice(0, 9);
  return digitos === '' ? 0 : Number(digitos);
}

/** Converte um texto em formato brasileiro (`"20,5"`, `"1.000,25"`) para número. */
export function parseDecimalBR(texto: string): number {
  const limpo = texto.trim().replace(/\s/g, '');
  if (limpo === '') return NaN;
  const normalizado = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return NaN;
  return Number(normalizado);
}

/** Formata quantidade sem casas desnecessárias: `20` → `"20"`, `2.5` → `"2,5"`. */
export function formatarQuantidade(quantidade: number): string {
  const [inteiro, decimal] = (Math.round(quantidade * 100) / 100).toString().split('.');
  const milhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return decimal ? `${milhar},${decimal}` : milhar;
}
