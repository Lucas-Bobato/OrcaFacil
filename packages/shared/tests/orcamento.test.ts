import { describe, expect, it } from 'vitest';
import {
  calcularSubtotal,
  calcularTotal,
  dataValidade,
  formatarData,
  pendenciasEmissao,
  prazoValido,
} from '../src/orcamento';
import { formatarBRL } from '../src/money';

describe('calcularSubtotal (RN08)', () => {
  it('CA03.1 — 20 m² × R$ 25,00 = R$ 500,00', () => {
    expect(calcularSubtotal(20, 2500)).toBe(50000);
  });
  it('CA04.1 — 30 × R$ 25,00 = R$ 750,00', () => {
    expect(calcularSubtotal(30, 2500)).toBe(75000);
  });
  it('arredonda meio centavo para cima', () => {
    // 0,5 × R$ 0,01 = 0,5 centavo → 1 centavo
    expect(calcularSubtotal(0.5, 1)).toBe(1);
    // 1,5 × R$ 0,33 = 49,5 centavos → 50
    expect(calcularSubtotal(1.5, 33)).toBe(50);
    // 0,25 × R$ 0,01 = 0,25 centavo → 0
    expect(calcularSubtotal(0.25, 1)).toBe(0);
  });
  it('evita erro de ponto flutuante (0,1 + 0,2)', () => {
    expect(calcularSubtotal(0.1, 100) + calcularSubtotal(0.2, 100)).toBe(30);
    expect(calcularSubtotal(1.15, 100)).toBe(115);
  });
  it('suporta os limites máximos de RN04 sem perder precisão', () => {
    expect(calcularSubtotal(99999.99, 999999999)).toBe(99999989900000);
  });
});

describe('calcularTotal (RN02)', () => {
  it('CA03.2 — R$ 500,00 + 1 × R$ 300,00 = R$ 800,00', () => {
    const itens = [{ subtotalCentavos: calcularSubtotal(20, 2500) }, { subtotalCentavos: calcularSubtotal(1, 30000) }];
    expect(formatarBRL(calcularTotal(itens))).toBe('R$ 800,00');
  });
  it('CA04.2 — remover o item de R$ 300,00 deixa R$ 500,00', () => {
    expect(calcularTotal([{ subtotalCentavos: 50000 }])).toBe(50000);
  });
  it('orçamento sem itens tem total zero', () => {
    expect(calcularTotal([])).toBe(0);
  });
  it('CA06.3 — 3 itens totalizando R$ 1.234,56', () => {
    const total = calcularTotal([{ subtotalCentavos: 100000 }, { subtotalCentavos: 23400 }, { subtotalCentavos: 56 }]);
    expect(formatarBRL(total)).toBe('R$ 1.234,56');
  });
});

describe('prazoValido (RN05)', () => {
  it.each([1, 2, 365])('%i dias é válido', (p) => expect(prazoValido(p)).toBe(true));
  it.each([0, 366, -1, 1.5, null, undefined])('%s é inválido (CA05.2)', (p) => expect(prazoValido(p)).toBe(false));
});

describe('pendenciasEmissao (RN01, CA06.2)', () => {
  const completo = {
    profissional: { nome: 'João da Silva', nomeEmpresa: null },
    cliente: { nome: 'Maria Silva' },
    itens: [{ subtotalCentavos: 50000 }],
    prazoExecucaoDias: 2,
  };

  it('sem pendências quando tudo está preenchido', () => {
    expect(pendenciasEmissao(completo)).toEqual([]);
  });
  it('aceita somente o nome da empresa (RN01a)', () => {
    expect(pendenciasEmissao({ ...completo, profissional: { nome: '', nomeEmpresa: 'João Pinturas' } })).toEqual([]);
  });
  it('exige nome ou empresa do profissional', () => {
    expect(pendenciasEmissao({ ...completo, profissional: { nome: ' ', nomeEmpresa: null } })).toContain(
      'Complete seu perfil com seu nome ou o nome da empresa',
    );
  });
  it('exige nome do cliente', () => {
    expect(pendenciasEmissao({ ...completo, cliente: null })).toContain('Informe o nome do cliente');
  });
  it('exige ao menos um item com valor > R$ 0,00', () => {
    expect(pendenciasEmissao({ ...completo, itens: [] })).toContain(
      'Adicione ao menos um item com valor maior que R$ 0,00',
    );
    expect(pendenciasEmissao({ ...completo, itens: [{ subtotalCentavos: 0 }] })).toHaveLength(1);
  });
  it('exige prazo válido', () => {
    expect(pendenciasEmissao({ ...completo, prazoExecucaoDias: null })).toEqual(['Informe um prazo entre 1 e 365 dias']);
  });
  it('limita a 50 itens (RN09)', () => {
    const itens = Array.from({ length: 51 }, () => ({ subtotalCentavos: 100 }));
    expect(pendenciasEmissao({ ...completo, itens })).toContain('O orçamento pode ter no máximo 50 itens');
  });
});

describe('validade da proposta (RN06)', () => {
  it('15 dias após 08/10/2026 = 23/10/2026', () => {
    expect(formatarData(dataValidade('2026-10-08', 15))).toBe('23/10/2026');
  });
  it('atravessa meses e anos', () => {
    expect(dataValidade('2026-12-20', 15)).toBe('2027-01-04');
  });
});
