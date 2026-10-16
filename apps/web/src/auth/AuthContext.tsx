import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { CadastroInput, LoginInput, SessaoResposta } from '@orcafacil/shared';
import { api, definirAoExpirarSessao, tokenStorage } from '../api/client';

interface AuthValor {
  autenticado: boolean;
  entrar(dados: LoginInput): Promise<void>;
  cadastrar(dados: CadastroInput): Promise<void>;
  sair(): void;
}

const AuthContext = createContext<AuthValor | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setToken] = useState(() => tokenStorage.obter());

  const iniciarSessao = useCallback(
    (sessao: SessaoResposta) => {
      qc.clear();
      tokenStorage.salvar(sessao.token);
      setToken(sessao.token);
    },
    [qc],
  );

  const sair = useCallback(() => {
    tokenStorage.limpar();
    setToken(null);
    qc.clear();
  }, [qc]);

  useEffect(() => definirAoExpirarSessao(sair), [sair]);

  const valor = useMemo<AuthValor>(
    () => ({
      autenticado: Boolean(token),
      entrar: async (dados) => iniciarSessao(await api.post<SessaoResposta>('/auth/login', dados)),
      cadastrar: async (dados) => iniciarSessao(await api.post<SessaoResposta>('/auth/cadastro', dados)),
      sair,
    }),
    [token, iniciarSessao, sair],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValor {
  const valor = useContext(AuthContext);
  if (!valor) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return valor;
}
