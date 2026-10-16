import { describe, expect, it } from 'vitest';
import {
  atualizarOrcamentoSchema,
  cadastroSchema,
  clienteSchema,
  errosPorCampo,
  itemSchema,
  perfilSchema,
} from '../src/schemas';

const erros = (resultado: { success: boolean; error?: unknown }) =>
  resultado.success ? {} : errosPorCampo(resultado.error as never);

describe('perfilSchema (US01)', () => {
  it('CA01.2 — salva com nome e telefone, normalizando dígitos', () => {
    const r = perfilSchema.parse({ nome: 'João da Silva', telefone: '(11) 98765-4321' });
    expect(r).toMatchObject({ nome: 'João da Silva', nomeEmpresa: null, telefone: '11987654321', documento: null });
  });
  it('CA01.3 — sem nome e sem empresa', () => {
    const r = perfilSchema.safeParse({ nome: '', nomeEmpresa: '  ', telefone: '11987654321' });
    expect(erros(r)).toEqual({ nome: 'Informe seu nome ou o nome da empresa' });
  });
  it('exige telefone válido e CPF/CNPJ válido quando informado', () => {
    const r = perfilSchema.safeParse({ nome: 'João', telefone: '123', documento: '12.345.678/0001-90' });
    expect(erros(r)).toEqual({ telefone: 'Telefone inválido', documento: 'CPF ou CNPJ inválido' });
  });
});

describe('clienteSchema (US02)', () => {
  it('CA02.1 — cliente válido só com nome', () => {
    expect(clienteSchema.parse({ nome: 'Maria Silva' })).toEqual({
      nome: 'Maria Silva',
      telefone: null,
      email: null,
      endereco: null,
    });
  });
  it('CA02.2 — nome ausente', () => {
    expect(erros(clienteSchema.safeParse({ nome: '   ' }))).toEqual({ nome: 'Informe o nome do cliente' });
  });
  it('CA02.3 — telefone com menos de 10 dígitos', () => {
    expect(erros(clienteSchema.safeParse({ nome: 'Maria', telefone: '98765-432' }))).toEqual({
      telefone: 'Telefone inválido',
    });
  });
  it('CA02.3 — apagar o telefone permite avançar', () => {
    expect(clienteSchema.safeParse({ nome: 'Maria', telefone: '' }).success).toBe(true);
  });
  it('valida e-mail', () => {
    expect(erros(clienteSchema.safeParse({ nome: 'Maria', email: 'maria@' }))).toEqual({ email: 'E-mail inválido' });
  });
});

describe('itemSchema (RN04)', () => {
  const valido = { descricao: 'Pintura de parede', quantidade: 20, unidade: 'M2', valorUnitarioCentavos: 2500 };

  it('aceita item válido', () => {
    expect(itemSchema.safeParse(valido).success).toBe(true);
  });
  it('CA03.3 — valor zerado', () => {
    expect(erros(itemSchema.safeParse({ ...valido, valorUnitarioCentavos: 0 }))).toEqual({
      valorUnitarioCentavos: 'O valor deve ser maior que R$ 0,00',
    });
  });
  it('descrição entre 3 e 120 caracteres', () => {
    expect(erros(itemSchema.safeParse({ ...valido, descricao: 'ab' })).descricao).toBeDefined();
    expect(erros(itemSchema.safeParse({ ...valido, descricao: 'x'.repeat(121) })).descricao).toBeDefined();
  });
  it('quantidade > 0, até 2 casas e no máximo 99.999,99', () => {
    expect(erros(itemSchema.safeParse({ ...valido, quantidade: 0 })).quantidade).toBeDefined();
    expect(erros(itemSchema.safeParse({ ...valido, quantidade: 1.234 })).quantidade).toBe(
      'Use no máximo 2 casas decimais',
    );
    expect(erros(itemSchema.safeParse({ ...valido, quantidade: 100000 })).quantidade).toBeDefined();
    expect(itemSchema.safeParse({ ...valido, quantidade: 99999.99 }).success).toBe(true);
  });
  it('valor unitário máximo R$ 9.999.999,99', () => {
    expect(itemSchema.safeParse({ ...valido, valorUnitarioCentavos: 999999999 }).success).toBe(true);
    expect(itemSchema.safeParse({ ...valido, valorUnitarioCentavos: 1000000000 }).success).toBe(false);
  });
  it('unidade precisa ser do enum', () => {
    expect(erros(itemSchema.safeParse({ ...valido, unidade: 'KG' })).unidade).toBe('Unidade inválida');
  });
});

describe('atualizarOrcamentoSchema (RN05, RN06)', () => {
  it('CA05.2 — prazo 0 ou maior que 365', () => {
    for (const prazo of [0, 366]) {
      expect(erros(atualizarOrcamentoSchema.safeParse({ prazoExecucaoDias: prazo }))).toEqual({
        prazoExecucaoDias: 'Informe um prazo entre 1 e 365 dias',
      });
    }
  });
  it('validade entre 1 e 90 dias', () => {
    expect(atualizarOrcamentoSchema.safeParse({ validadeDias: 91 }).success).toBe(false);
    expect(atualizarOrcamentoSchema.safeParse({ validadeDias: 90 }).success).toBe(true);
  });
  it('rejeita campos desconhecidos (ex.: total manual — RN02)', () => {
    expect(atualizarOrcamentoSchema.safeParse({ totalCentavos: 1 }).success).toBe(false);
  });
});

describe('cadastroSchema', () => {
  it('exige e-mail válido e senha com 8+ caracteres', () => {
    expect(erros(cadastroSchema.safeParse({ email: 'x', senha: '123' }))).toEqual({
      email: 'E-mail inválido',
      senha: 'A senha deve ter pelo menos 8 caracteres',
    });
  });
  it('normaliza e-mail', () => {
    expect(cadastroSchema.parse({ email: ' Joao@Email.COM ', senha: '12345678' }).email).toBe('joao@email.com');
  });
});
