import { render } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import type { Orcamento, Profissional } from '@orcafacil/shared';
import { App } from '../src/App';
import { AuthProvider } from '../src/auth/AuthContext';
import { ToastProvider } from '../src/components/Toast';

type Resposta = [status: number, corpo?: unknown];
type Manipulador = (corpo: unknown, url: URL) => Resposta | Promise<Resposta>;

/**
 * API falsa: mapeia `"MÉTODO /caminho"` (sem querystring) para uma resposta.
 * Registra as chamadas para verificar o que a interface enviou.
 */
export function apiFalsa(rotas: Record<string, Manipulador | Resposta>) {
  const chamadas: Array<{ metodo: string; caminho: string; corpo: unknown }> = [];
  const fetchFalso = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entrada), 'http://localhost');
    const metodo = init?.method ?? 'GET';
    const caminho = url.pathname.replace(/^\/api/, '');
    const corpo = init?.body ? JSON.parse(String(init.body)) : undefined;
    chamadas.push({ metodo, caminho, corpo });
    const rota = rotas[`${metodo} ${caminho}`];
    if (!rota) return new Response(JSON.stringify({ erro: { codigo: 'X', mensagem: `sem rota ${metodo} ${caminho}` } }), { status: 404 });
    const [status, json] = typeof rota === 'function' ? await rota(corpo, url) : rota;
    return new Response(status === 204 ? null : JSON.stringify(json), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchFalso);
  return { chamadas, chamadasDe: (metodo: string, caminho: string) => chamadas.filter((c) => c.metodo === metodo && c.caminho === caminho) };
}

/** Renderiza o app inteiro numa rota, com sessão iniciada. */
export function renderizarApp(rota: string, { logado = true } = {}) {
  if (logado) localStorage.setItem('orcafacil.token', 'token-teste');
  else localStorage.removeItem('orcafacil.token');
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[rota]}>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

export const PERFIL: Profissional = {
  id: 'p1',
  nome: 'João da Silva',
  nomeEmpresa: 'João Pinturas',
  documento: null,
  telefone: '11987654321',
  email: null,
  criadoEm: '2026-10-01T10:00:00.000Z',
  atualizadoEm: '2026-10-01T10:00:00.000Z',
};

export function orcamento(parcial: Partial<Orcamento> = {}): Orcamento {
  return {
    id: 'o1',
    numero: 'ORC-2026-0001',
    status: 'RASCUNHO',
    clienteId: 'c1',
    clienteNome: 'Maria Silva',
    totalCentavos: 0,
    etapaAtual: 'PREENCHER',
    dataEmissao: null,
    possuiPdf: false,
    criadoEm: '2026-10-08T10:00:00.000Z',
    atualizadoEm: '2026-10-08T10:00:00.000Z',
    prazoExecucaoDias: null,
    validadeDias: 15,
    condicoesPagamento: null,
    observacoes: null,
    cliente: { id: 'c1', nome: 'Maria Silva', telefone: null, email: null, endereco: null, criadoEm: '', atualizadoEm: '' },
    itens: [],
    pendencias: [],
    documentoAtual: null,
    ...parcial,
  };
}

export const item = (n: number, subtotalCentavos = 50000) => ({
  id: `i${n}`,
  orcamentoId: 'o1',
  ordem: n,
  descricao: `Serviço ${n}`,
  quantidade: 1,
  unidade: 'UN' as const,
  valorUnitarioCentavos: subtotalCentavos,
  subtotalCentavos,
});
