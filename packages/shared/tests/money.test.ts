import { describe, expect, it } from 'vitest';
import { centavosDeDigitos, formatarBRL, formatarQuantidade, parseDecimalBR } from '../src/money';

describe('formatarBRL (RN03)', () => {
  it.each([
    [0, 'R$ 0,00'],
    [5, 'R$ 0,05'],
    [1250, 'R$ 12,50'],
    [50000, 'R$ 500,00'],
    [123456, 'R$ 1.234,56'],
    [999999999, 'R$ 9.999.999,99'],
    [123456789012, 'R$ 1.234.567.890,12'],
  ])('%i centavos → %s', (centavos, esperado) => {
    expect(formatarBRL(centavos)).toBe(esperado);
  });
});

describe('centavosDeDigitos — máscara em centavos (CA03.4)', () => {
  it('digitar "1250" resulta em R$ 12,50', () => {
    expect(formatarBRL(centavosDeDigitos('1250'))).toBe('R$ 12,50');
  });
  it('ignora caracteres não numéricos e zeros à esquerda', () => {
    expect(centavosDeDigitos('R$ 0,05')).toBe(5);
    expect(centavosDeDigitos('R$ 1.234,56')).toBe(123456);
  });
  it('campo vazio vale 0', () => {
    expect(centavosDeDigitos('')).toBe(0);
  });
  it('limita a 9 dígitos (R$ 9.999.999,99)', () => {
    expect(centavosDeDigitos('99999999999')).toBe(999999999);
  });
});

describe('parseDecimalBR / formatarQuantidade', () => {
  it('aceita vírgula decimal e separador de milhar', () => {
    expect(parseDecimalBR('20')).toBe(20);
    expect(parseDecimalBR('2,5')).toBe(2.5);
    expect(parseDecimalBR('1.000,25')).toBe(1000.25);
    expect(parseDecimalBR('3.5')).toBe(3.5);
  });
  it('retorna NaN para texto inválido', () => {
    expect(parseDecimalBR('')).toBeNaN();
    expect(parseDecimalBR('abc')).toBeNaN();
  });
  it('formata quantidade em pt-BR', () => {
    expect(formatarQuantidade(20)).toBe('20');
    expect(formatarQuantidade(2.5)).toBe('2,5');
    expect(formatarQuantidade(12345.67)).toBe('12.345,67');
  });
});
