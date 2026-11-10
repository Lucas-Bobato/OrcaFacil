import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { apiFalsa, orcamento, PERFIL, renderizarApp } from './utils';

/** Regressão da auditoria de segurança (docs/08-seguranca.md). */

const CHAVE = 'orcafacil.token';

/** Simula outra aba mudando o token: o navegador só avisa as demais abas. */
function outraAbaMudaToken(novoValor: string | null) {
  act(() => {
    if (novoValor === null) localStorage.removeItem(CHAVE);
    else localStorage.setItem(CHAVE, novoValor);
    window.dispatchEvent(new StorageEvent('storage', { key: CHAVE, newValue: novoValor }));
  });
}

describe('S8 — sessão entre abas', () => {
  const rotas = { 'GET /perfil': [200, PERFIL], 'GET /orcamentos/o1': [200, orcamento()] } as const;

  it('logout em outra aba leva para o login e tira os dados da tela', async () => {
    apiFalsa({ ...rotas } as never);
    renderizarApp('/orcamentos/o1/preencher');
    expect(await screen.findByDisplayValue('Maria Silva')).toBeInTheDocument();

    outraAbaMudaToken(null);

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Maria Silva')).not.toBeInTheDocument();
  });

  it('login de outra conta em outra aba descarta os dados da conta anterior', async () => {
    let conta: 'A' | 'B' = 'A';
    apiFalsa({
      'GET /perfil': [200, PERFIL],
      'GET /orcamentos/o1': () =>
        conta === 'A' ? [200, orcamento()] : [404, { erro: { codigo: 'ORCAMENTO_NAO_ENCONTRADO', mensagem: 'Orçamento não encontrado' } }],
    });
    renderizarApp('/orcamentos/o1/preencher');
    expect(await screen.findByDisplayValue('Maria Silva')).toBeInTheDocument();

    conta = 'B';
    outraAbaMudaToken('token-da-conta-b');

    expect(await screen.findByText('Orçamento não encontrado')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('Maria Silva')).not.toBeInTheDocument();
  });

  it('mudança em outra chave do armazenamento não derruba a sessão', async () => {
    apiFalsa({ ...rotas } as never);
    renderizarApp('/orcamentos/o1/preencher');
    await screen.findByDisplayValue('Maria Silva');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'outra-chave', newValue: 'x' }));
    });
    expect(screen.getByDisplayValue('Maria Silva')).toBeInTheDocument();
  });

  it('401 de sessão ausente também volta para o login', async () => {
    apiFalsa({ 'GET /perfil': [401, { erro: { codigo: 'NAO_AUTENTICADO', mensagem: 'Entre na sua conta para continuar' } }] });
    renderizarApp('/');
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });
});

describe('S2 — sair e trocar senha', () => {
  it('"Sair da conta" avisa a API e volta para o login', async () => {
    const api = apiFalsa({ 'GET /perfil': [200, PERFIL], 'POST /auth/logout': [204] });
    renderizarApp('/perfil');
    await userEvent.click(await screen.findByRole('button', { name: 'Sair da conta' }));
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    await waitFor(() => expect(api.chamadasDe('POST', '/auth/logout')).toHaveLength(1));
    expect(localStorage.getItem(CHAVE)).toBeNull();
  });

  it('sair sem conexão encerra a sessão local mesmo assim', async () => {
    apiFalsa({ 'GET /perfil': [200, PERFIL], 'POST /auth/logout': () => { throw new TypeError('sem rede'); } });
    renderizarApp('/perfil');
    await userEvent.click(await screen.findByRole('button', { name: 'Sair da conta' }));
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('trocar senha guarda o token novo; senha atual errada aparece no campo', async () => {
    let tentativa = 0;
    const api = apiFalsa({
      'GET /perfil': [200, PERFIL],
      'POST /auth/senha': () =>
        ++tentativa === 1
          ? [403, { erro: { codigo: 'SENHA_INCORRETA', mensagem: 'Senha incorreta', campos: { senhaAtual: 'Senha incorreta' } } }]
          : [200, { token: 'token-novo', usuario: { id: 'u', email: 'a@b.com', criadoEm: '' } }],
    });
    renderizarApp('/privacidade');
    await userEvent.type(await screen.findByLabelText('Senha atual'), 'errada123');
    await userEvent.type(screen.getByLabelText('Nova senha'), 'novaSenha123');
    await userEvent.click(screen.getByRole('button', { name: 'Trocar senha' }));
    expect(await screen.findByText('Senha incorreta')).toBeInTheDocument();
    expect(localStorage.getItem(CHAVE)).toBe('token-teste');

    await userEvent.click(screen.getByRole('button', { name: 'Trocar senha' }));
    await waitFor(() => expect(localStorage.getItem(CHAVE)).toBe('token-novo'));
    expect(api.chamadasDe('POST', '/auth/senha')[1].corpo).toEqual({ senhaAtual: 'errada123', novaSenha: 'novaSenha123' });
  });
});

describe('S9 — apagar a conta', () => {
  it('exige a senha, envia para a API e nunca foca a ação destrutiva', async () => {
    const api = apiFalsa({ 'GET /perfil': [200, PERFIL], 'DELETE /conta': [204] });
    renderizarApp('/privacidade');
    await userEvent.click(await screen.findByRole('button', { name: 'Apagar todos os meus dados' }));

    const dialogo = screen.getByRole('dialog');
    const confirmar = within(dialogo).getByRole('button', { name: 'Apagar tudo' });
    const senha = within(dialogo).getByLabelText('Sua senha, para confirmar');
    expect(confirmar).toBeDisabled();
    expect(senha).toHaveFocus();

    await userEvent.type(senha, 'senha1234');
    await userEvent.click(confirmar);

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(api.chamadasDe('DELETE', '/conta')[0].corpo).toEqual({ senha: 'senha1234' });
    expect(api.chamadasDe('POST', '/auth/logout')).toHaveLength(0);
  });

  it('senha errada mantém a sessão e mostra o erro no diálogo', async () => {
    apiFalsa({
      'GET /perfil': [200, PERFIL],
      'DELETE /conta': [403, { erro: { codigo: 'SENHA_INCORRETA', mensagem: 'Senha incorreta' } }],
    });
    renderizarApp('/privacidade');
    await userEvent.click(await screen.findByRole('button', { name: 'Apagar todos os meus dados' }));
    const dialogo = screen.getByRole('dialog');
    await userEvent.type(within(dialogo).getByLabelText('Sua senha, para confirmar'), 'errada123');
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Apagar tudo' }));
    expect(await within(dialogo).findByText('Senha incorreta')).toBeInTheDocument();
    expect(localStorage.getItem(CHAVE)).toBe('token-teste');
  });

  it('confirmações sem senha focam "Cancelar", não a ação destrutiva', async () => {
    apiFalsa({ 'GET /perfil': [200, PERFIL], 'GET /orcamentos': [200, [orcamento()]] });
    renderizarApp('/');
    await userEvent.click(await screen.findByRole('button', { name: /ações|Mais|Opções/i }));
    await userEvent.click(await screen.findByRole('button', { name: /Excluir/ }));
    const dialogo = await screen.findByRole('dialog', { name: /Excluir/ });
    expect(within(dialogo).getByRole('button', { name: 'Cancelar' })).toHaveFocus();
  });
});

describe('Rota com id malicioso', () => {
  it('codifica o id: "..%2Fperfil" não muda o caminho chamado na API', async () => {
    const api = apiFalsa({ 'GET /perfil': [200, PERFIL] });
    renderizarApp('/orcamentos/..%2Fperfil/preencher');
    await waitFor(() => expect(api.chamadasDe('GET', '/orcamentos/..%2Fperfil')).toHaveLength(1));
  });
});
