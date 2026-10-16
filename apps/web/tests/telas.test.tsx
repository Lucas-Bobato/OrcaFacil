import { useState } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CampoMonetario } from '../src/components/CampoMonetario';
import { apiFalsa, item, orcamento, PERFIL, renderizarApp } from './utils';

describe('CampoMonetario (CA03.4 — máscara em centavos)', () => {
  it('digitar 1250 exibe R$ 12,50', async () => {
    function Teste() {
      const [v, setV] = useState(0);
      return <CampoMonetario rotulo="Valor unit." valor={v} aoMudar={setV} />;
    }
    render(<Teste />);
    const campo = screen.getByLabelText('Valor unit.');
    await userEvent.type(campo, '1250');
    expect(campo).toHaveValue('R$ 12,50');
    expect(campo).toHaveAttribute('inputmode', 'numeric'); // RNF16
  });
});

describe('Acesso', () => {
  it('sem sessão, redireciona para a tela de login', async () => {
    apiFalsa({});
    renderizarApp('/', { logado: false });
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('mostra erro de credenciais vindo da API', async () => {
    apiFalsa({ 'POST /auth/login': [401, { erro: { codigo: 'CREDENCIAIS_INVALIDAS', mensagem: 'E-mail ou senha incorretos' } }] });
    renderizarApp('/entrar', { logado: false });
    await userEvent.type(screen.getByLabelText('E-mail'), 'a@b.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'errada123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));
    expect(await screen.findByText('E-mail ou senha incorretos')).toBeInTheDocument();
  });
});

describe('US01 — perfil', () => {
  it('CA01.1 — sem perfil salvo, vai para "Meu perfil" antes de tudo', async () => {
    apiFalsa({ 'GET /perfil': [404, { erro: { codigo: 'PERFIL_NAO_CADASTRADO', mensagem: 'Cadastre seu perfil' } }] });
    renderizarApp('/');
    expect(await screen.findByRole('heading', { name: 'Configure seu perfil' })).toBeInTheDocument();
  });

  it('CA01.3 — sem nome e sem empresa não salva', async () => {
    const api = apiFalsa({ 'GET /perfil': [404, { erro: { codigo: 'PERFIL_NAO_CADASTRADO', mensagem: '' } }] });
    renderizarApp('/perfil');
    await userEvent.type(await screen.findByLabelText(/Telefone \/ WhatsApp/), '11987654321');
    await userEvent.click(screen.getByRole('button', { name: /Salvar e começar/ }));
    expect(await screen.findByText('Informe seu nome ou o nome da empresa')).toBeInTheDocument();
    expect(api.chamadasDe('PUT', '/perfil')).toHaveLength(0);
  });

  it('CA01.2 — salva e mostra "Perfil salvo"', async () => {
    const api = apiFalsa({
      'GET /perfil': [404, { erro: { codigo: 'PERFIL_NAO_CADASTRADO', mensagem: '' } }],
      'PUT /perfil': [201, PERFIL],
      'GET /orcamentos': [200, []],
    });
    renderizarApp('/perfil');
    await userEvent.type(await screen.findByLabelText('Seu nome'), 'João da Silva');
    await userEvent.type(screen.getByLabelText(/Telefone \/ WhatsApp/), '11987654321');
    await userEvent.click(screen.getByRole('button', { name: /Salvar e começar/ }));
    expect(await screen.findByText('Perfil salvo')).toBeInTheDocument();
    expect(api.chamadasDe('PUT', '/perfil')[0].corpo).toMatchObject({ nome: 'João da Silva', telefone: '11987654321' });
  });
});

describe('US08 — Meus orçamentos', () => {
  it('CA08.1 — lista número, cliente, total, data e status', async () => {
    apiFalsa({
      'GET /perfil': [200, PERFIL],
      'GET /orcamentos': [200, [orcamento({ status: 'EMITIDO', totalCentavos: 80000, dataEmissao: '2026-10-05' })]],
    });
    renderizarApp('/');
    const lista = await screen.findByRole('list', { name: 'Orçamentos' });
    expect(within(lista).getByText('ORC-2026-0001')).toBeInTheDocument();
    expect(within(lista).getByText('Maria Silva')).toBeInTheDocument();
    expect(within(lista).getByText('R$ 800,00')).toBeInTheDocument();
    expect(within(lista).getByText('05/10/2026')).toBeInTheDocument();
    expect(within(lista).getByText('Emitido')).toBeInTheDocument();
  });

  it('estado vazio', async () => {
    apiFalsa({ 'GET /perfil': [200, PERFIL], 'GET /orcamentos': [200, []] });
    renderizarApp('/');
    expect(await screen.findByText('Nenhum orçamento ainda')).toBeInTheDocument();
  });

  it('CA08.2 — a busca é enviada para a API', async () => {
    const api = apiFalsa({ 'GET /perfil': [200, PERFIL], 'GET /orcamentos': [200, []] });
    renderizarApp('/');
    await userEvent.type(await screen.findByLabelText('Buscar por cliente'), 'Maria');
    await waitFor(() => expect(api.chamadas.some((c) => c.caminho === '/orcamentos')).toBe(true));
    const fetchMock = vi.mocked(fetch);
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('busca=Maria'))).toBe(true));
  });

  it('estado de erro com "Tentar novamente"', async () => {
    apiFalsa({ 'GET /perfil': [200, PERFIL], 'GET /orcamentos': [500, { erro: { codigo: 'ERRO_INTERNO', mensagem: 'Falha no servidor' } }] });
    renderizarApp('/');
    expect(await screen.findByText('Falha no servidor')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});

describe('US02 — 01 Preencher', () => {
  const rotas = () => ({
    'GET /perfil': [200, PERFIL] as [number, unknown],
    'GET /orcamentos/o1': [200, orcamento({ cliente: null, clienteId: null, clienteNome: null })] as [number, unknown],
  });

  it('CA01.4 — mostra os dados do profissional vindos do perfil', async () => {
    apiFalsa(rotas());
    renderizarApp('/orcamentos/o1/preencher');
    expect(await screen.findByText('João Pinturas · (11) 98765-4321')).toBeInTheDocument();
  });

  it('CA02.2 / CA02.3 — nome ausente e telefone inválido impedem avançar', async () => {
    const api = apiFalsa(rotas());
    renderizarApp('/orcamentos/o1/preencher');
    await userEvent.type(await screen.findByLabelText('Telefone'), '1198765');
    await userEvent.click(screen.getByRole('button', { name: /Próximo/ }));
    expect(await screen.findByText('Informe o nome do cliente')).toBeInTheDocument();
    expect(screen.getByText('Telefone inválido')).toBeInTheDocument();
    expect(api.chamadasDe('PUT', '/orcamentos/o1/cliente')).toHaveLength(0);
  });

  it('CA02.1 — cliente válido avança para 02 Detalhar', async () => {
    const api = apiFalsa({
      ...rotas(),
      'PUT /orcamentos/o1/cliente': [200, orcamento()],
      'PUT /orcamentos/o1': [200, orcamento({ etapaAtual: 'DETALHAR' })],
    });
    renderizarApp('/orcamentos/o1/preencher');
    await userEvent.type(await screen.findByLabelText(/Nome do cliente/), 'Maria Silva');
    await userEvent.click(screen.getByRole('button', { name: /Próximo/ }));
    expect(await screen.findByRole('heading', { name: 'Serviços' })).toBeInTheDocument();
    expect(api.chamadasDe('PUT', '/orcamentos/o1/cliente').at(-1)?.corpo).toMatchObject({ nome: 'Maria Silva' });
    expect(api.chamadasDe('PUT', '/orcamentos/o1')[0].corpo).toEqual({ etapaAtual: 'DETALHAR' });
  });
});

describe('US03/US04 — 02 Detalhar', () => {
  it('CA03.1 — adiciona item, envia valores em centavos, limpa o formulário e mostra o total', async () => {
    const api = apiFalsa({
      'GET /perfil': [200, PERFIL],
      'GET /orcamentos/o1': [200, orcamento()],
      'POST /orcamentos/o1/itens': [
        201,
        orcamento({
          totalCentavos: 50000,
          itens: [{ ...item(1), descricao: 'Pintura de parede', quantidade: 20, unidade: 'M2', valorUnitarioCentavos: 2500 }],
        }),
      ],
    });
    renderizarApp('/orcamentos/o1/detalhar');
    await userEvent.type(await screen.findByLabelText(/Descrição do serviço/), 'Pintura de parede');
    await userEvent.type(screen.getByLabelText(/Qtd/), '20');
    await userEvent.selectOptions(screen.getByLabelText('Unid.'), 'M2');
    await userEvent.type(screen.getByLabelText(/Valor unit/), '2500');
    await userEvent.click(screen.getByRole('button', { name: /Adicionar item/ }));

    expect(await screen.findByText('1. Pintura de parede')).toBeInTheDocument();
    expect(api.chamadasDe('POST', '/orcamentos/o1/itens')[0].corpo).toEqual({
      descricao: 'Pintura de parede',
      quantidade: 20,
      unidade: 'M2',
      valorUnitarioCentavos: 2500,
    });
    expect(screen.getByLabelText('Total do orçamento')).toHaveTextContent('R$ 500,00');
    expect(screen.getByLabelText(/Descrição do serviço/)).toHaveValue('');
  });

  it('CA03.3 — valor zerado não é enviado', async () => {
    const api = apiFalsa({ 'GET /perfil': [200, PERFIL], 'GET /orcamentos/o1': [200, orcamento()] });
    renderizarApp('/orcamentos/o1/detalhar');
    await userEvent.type(await screen.findByLabelText(/Descrição do serviço/), 'Pintura');
    await userEvent.type(screen.getByLabelText(/Qtd/), '1');
    await userEvent.click(screen.getByRole('button', { name: /Adicionar item/ }));
    expect(await screen.findByText('O valor deve ser maior que R$ 0,00')).toBeInTheDocument();
    expect(api.chamadasDe('POST', '/orcamentos/o1/itens')).toHaveLength(0);
  });

  it('CA03.5 — com 50 itens o botão fica desabilitado', async () => {
    const itens = Array.from({ length: 50 }, (_, i) => item(i + 1, 100));
    apiFalsa({ 'GET /perfil': [200, PERFIL], 'GET /orcamentos/o1': [200, orcamento({ itens, totalCentavos: 5000 })] });
    renderizarApp('/orcamentos/o1/detalhar');
    expect(await screen.findByText('Limite de 50 itens atingido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Adicionar item/ })).toBeDisabled();
  });

  it('CA04.2 / CA04.3 — remover oferece "Desfazer", que recoloca o item na mesma posição', async () => {
    const api = apiFalsa({
      'GET /perfil': [200, PERFIL],
      'GET /orcamentos/o1': [200, orcamento({ itens: [item(1), item(2)], totalCentavos: 100000 })],
      'DELETE /orcamentos/o1/itens/i1': [200, orcamento({ itens: [{ ...item(2), ordem: 1 }], totalCentavos: 50000 })],
      'POST /orcamentos/o1/itens': [201, orcamento({ itens: [item(1), item(2)], totalCentavos: 100000 })],
    });
    renderizarApp('/orcamentos/o1/detalhar');
    await userEvent.click(await screen.findByRole('button', { name: 'Remover Serviço 1' }));
    expect(await screen.findByText('Item removido')).toBeInTheDocument();
    expect(screen.getByLabelText('Total do orçamento')).toHaveTextContent('R$ 500,00');
    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect(screen.getByLabelText('Total do orçamento')).toHaveTextContent('R$ 1.000,00'));
    expect(api.chamadasDe('POST', '/orcamentos/o1/itens')[0].corpo).toMatchObject({ descricao: 'Serviço 1', ordem: 1 });
  });
});

describe('US05/US06 — 03 Revisar', () => {
  it('CA06.2 — "Gerar PDF" desabilitado enquanto falta o prazo; CA05.3 validade padrão 15', async () => {
    apiFalsa({ 'GET /perfil': [200, PERFIL], 'GET /orcamentos/o1': [200, orcamento({ itens: [item(1)], totalCentavos: 50000 })] });
    renderizarApp('/orcamentos/o1/revisar');
    const botao = await screen.findByRole('button', { name: /Gerar PDF/ });
    expect(botao).toBeDisabled();
    expect(screen.getByText('Para gerar o PDF, falta:')).toBeInTheDocument();
    expect(screen.getByText('Informe um prazo entre 1 e 365 dias')).toBeInTheDocument();
    expect(screen.getByLabelText('Validade (dias)')).toHaveValue('15');
  });

  it('CA05.2 — prazo 0 mostra erro; prazo válido habilita "Gerar PDF"', async () => {
    apiFalsa({
      'GET /perfil': [200, PERFIL],
      'GET /orcamentos/o1': [200, orcamento({ itens: [item(1)], totalCentavos: 50000 })],
      'PUT /orcamentos/o1': (corpo) => [200, orcamento({ itens: [item(1)], totalCentavos: 50000, ...(corpo as object) })],
    });
    renderizarApp('/orcamentos/o1/revisar');
    const prazo = await screen.findByLabelText(/Prazo \(dias\)/);
    await userEvent.type(prazo, '0');
    expect(within(prazo.parentElement!).getByText('Informe um prazo entre 1 e 365 dias')).toBeInTheDocument();
    await userEvent.clear(prazo);
    await userEvent.type(prazo, '2');
    expect(screen.getByRole('button', { name: /Gerar PDF/ })).toBeEnabled();
  });

  it('CA05.4 — resumo com profissional, cliente, itens e total, cada um com "Editar"', async () => {
    apiFalsa({ 'GET /perfil': [200, PERFIL], 'GET /orcamentos/o1': [200, orcamento({ itens: [item(1)], totalCentavos: 50000 })] });
    renderizarApp('/orcamentos/o1/revisar');
    expect(await screen.findByRole('link', { name: 'Editar profissional' })).toHaveAttribute('href', '/perfil');
    expect(screen.getByRole('link', { name: 'Editar cliente' })).toHaveAttribute('href', '/orcamentos/o1/preencher');
    expect(screen.getByRole('link', { name: 'Editar itens (1)' })).toHaveAttribute('href', '/orcamentos/o1/detalhar');
  });
});

describe('US07 — 04 PDF pronto', () => {
  const emitido = orcamento({
    status: 'EMITIDO',
    dataEmissao: '2026-10-08',
    prazoExecucaoDias: 2,
    itens: [item(1)],
    totalCentavos: 50000,
    documentoAtual: { id: 'd1', nomeArquivo: 'Orcamento_ORC-2026-0001_Maria-Silva.pdf', tamanhoBytes: 1000, hashSha256: 'x', geradoEm: '' },
  });

  function rotasPdf() {
    apiFalsa({ 'GET /perfil': [200, PERFIL], 'GET /orcamentos/o1': [200, emitido] });
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (u, init) =>
      String(u).endsWith('/pdf')
        ? new Response(new Blob(['%PDF-1.7']), { headers: { 'Content-Disposition': 'attachment; filename="Orcamento_ORC-2026-0001_Maria-Silva.pdf"' } })
        : original(u, init),
    );
  }

  it('CA06.1 / CA07.3 — mostra PDF gerado e, sem suporte a compartilhar, só "Baixar"', async () => {
    rotasPdf();
    renderizarApp('/orcamentos/o1/pdf');
    expect(await screen.findByText('Orçamento marcado como Emitido em 08/10/2026.')).toBeInTheDocument();
    expect(screen.getByText('Orcamento_ORC-2026-0001_Maria-Silva.pdf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Baixar/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Compartilhar/ })).not.toBeInTheDocument();
  });

  it('CA07.2 — com suporte a compartilhar arquivos, mostra "Compartilhar"', async () => {
    rotasPdf();
    vi.stubGlobal('navigator', { ...navigator, canShare: () => true, share: vi.fn() });
    renderizarApp('/orcamentos/o1/pdf');
    expect(await screen.findByRole('button', { name: /Compartilhar/ })).toBeInTheDocument();
  });
});
