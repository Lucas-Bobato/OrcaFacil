import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AtualizarOrcamentoInput,
  ClienteInput,
  ItemDados,
  Orcamento,
  OrcamentoResumo,
  PerfilInput,
  Profissional,
} from '@orcafacil/shared';
import { api, ApiError } from './client';

export const chaves = {
  perfil: ['perfil'] as const,
  orcamentos: (busca = '') => ['orcamentos', busca] as const,
  orcamento: (id: string) => ['orcamento', id] as const,
};

// ------------------------------------------------------------------ Perfil

/** `null` quando o perfil ainda não foi cadastrado (CA01.1). */
export function usePerfil() {
  return useQuery({
    queryKey: chaves.perfil,
    queryFn: async () => {
      try {
        return await api.get<Profissional>('/perfil');
      } catch (e) {
        if (e instanceof ApiError && e.codigo === 'PERFIL_NAO_CADASTRADO') return null;
        throw e;
      }
    },
  });
}

export function useSalvarPerfil() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (dados: PerfilInput) => api.put<Profissional>('/perfil', dados),
    onSuccess: (perfil) => {
      qc.setQueryData(chaves.perfil, perfil);
      qc.invalidateQueries({ queryKey: ['orcamento'] });
    },
  });
}

// ------------------------------------------------------------------ Orçamentos

export function useOrcamentos(busca: string) {
  return useQuery({
    queryKey: chaves.orcamentos(busca),
    queryFn: () => api.get<OrcamentoResumo[]>(`/orcamentos${busca ? `?busca=${encodeURIComponent(busca)}` : ''}`),
    placeholderData: (anterior) => anterior,
  });
}

export function useOrcamento(id: string) {
  // `id` vem da URL: sem codificar, "..%2Fperfil" mudaria o caminho chamado na API.
  return useQuery({ queryKey: chaves.orcamento(id), queryFn: () => api.get<Orcamento>(`/orcamentos/${encodeURIComponent(id)}`) });
}

/** Mutação que devolve o orçamento atualizado e o grava no cache. */
function useMutacaoOrcamento<V>(fn: (v: V) => Promise<Orcamento>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (o) => {
      qc.setQueryData(chaves.orcamento(o.id), o);
      qc.invalidateQueries({ queryKey: ['orcamentos'] });
    },
  });
}

export const useCriarOrcamento = () => useMutacaoOrcamento(() => api.post<Orcamento>('/orcamentos'));

export const useDuplicarOrcamento = () =>
  useMutacaoOrcamento((id: string) => api.post<Orcamento>(`/orcamentos/${id}/duplicar`));

export const useAtualizarOrcamento = (id: string) =>
  useMutacaoOrcamento((dados: AtualizarOrcamentoInput) => api.put<Orcamento>(`/orcamentos/${id}`, dados));

export const useDefinirCliente = (id: string) =>
  useMutacaoOrcamento((dados: ClienteInput) => api.put<Orcamento>(`/orcamentos/${id}/cliente`, dados));

export const useAdicionarItem = (id: string) =>
  useMutacaoOrcamento((dados: ItemDados & { ordem?: number }) => api.post<Orcamento>(`/orcamentos/${id}/itens`, dados));

export const useAtualizarItem = (id: string) =>
  useMutacaoOrcamento(({ itemId, dados }: { itemId: string; dados: ItemDados }) =>
    api.put<Orcamento>(`/orcamentos/${id}/itens/${itemId}`, dados),
  );

export const useRemoverItem = (id: string) =>
  useMutacaoOrcamento((itemId: string) => api.delete<Orcamento>(`/orcamentos/${id}/itens/${itemId}`));

export const useEmitir = (id: string) => useMutacaoOrcamento(() => api.post<Orcamento>(`/orcamentos/${id}/emitir`));

export function useExcluirOrcamento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/orcamentos/${id}`),
    onSuccess: (_r, id) => {
      qc.removeQueries({ queryKey: chaves.orcamento(id) });
      qc.invalidateQueries({ queryKey: ['orcamentos'] });
    },
  });
}

/** Mensagem amigável para qualquer erro. */
export function mensagemErro(e: unknown): string {
  return e instanceof Error ? e.message : 'Ocorreu um erro inesperado. Tente novamente.';
}
