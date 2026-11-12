import { describe, expect, it } from 'vitest';
import { formatarNumero, nomeArquivoPdf, PADRAO_NUMERO } from '../src/numeracao';
import {
  cnpjValido,
  cpfCnpjValido,
  cpfValido,
  formatarDocumento,
  formatarTelefone,
  telefoneValido,
} from '../src/documento';

describe('formatarNumero (RN07)', () => {
  it('gera ORC-AAAA-NNNN', () => {
    expect(formatarNumero(2026, 1)).toBe('ORC-2026-0001');
    expect(formatarNumero(2026, 123)).toBe('ORC-2026-0123');
    expect(PADRAO_NUMERO.test(formatarNumero(2027, 9999))).toBe(true);
  });
});

describe('nomeArquivoPdf (RN12)', () => {
  it('CA07.1 — Orcamento_ORC-2026-0001_Maria-Silva.pdf', () => {
    expect(nomeArquivoPdf('ORC-2026-0001', 'Maria Silva')).toBe('Orcamento_ORC-2026-0001_Maria-Silva.pdf');
  });
  it('remove acentos e caracteres especiais', () => {
    expect(nomeArquivoPdf('ORC-2026-0002', 'João  Conceição / Ltda.')).toBe(
      'Orcamento_ORC-2026-0002_Joao-Conceicao-Ltda.pdf',
    );
  });
  it('limita o nome do cliente a 40 caracteres', () => {
    const nome = nomeArquivoPdf('ORC-2026-0003', 'A'.repeat(60));
    const cliente = nome.replace('Orcamento_ORC-2026-0003_', '').replace('.pdf', '');
    expect(cliente).toHaveLength(40);
  });
});

describe('telefone (CA02.3)', () => {
  it('aceita 10 ou 11 dígitos', () => {
    expect(telefoneValido('(11) 98765-4321')).toBe(true);
    expect(telefoneValido('1133334444')).toBe(true);
  });
  it('rejeita menos de 10 dígitos', () => {
    expect(telefoneValido('98765-4321')).toBe(false);
  });
  it('formata na digitação', () => {
    expect(formatarTelefone('11987654321')).toBe('(11) 98765-4321');
    expect(formatarTelefone('1133334444')).toBe('(11) 3333-4444');
    expect(formatarTelefone('119')).toBe('(11) 9');
  });
});

describe('CPF/CNPJ (RF01)', () => {
  it('valida dígitos verificadores', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('529.982.247-26')).toBe(false);
    expect(cpfValido('111.111.111-11')).toBe(false);
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-80')).toBe(false);
    expect(cpfCnpjValido('123')).toBe(false);
  });
  it('formata CPF e CNPJ', () => {
    expect(formatarDocumento('52998224725')).toBe('529.982.247-25');
    expect(formatarDocumento('11222333000181')).toBe('11.222.333/0001-81');
  });
});
