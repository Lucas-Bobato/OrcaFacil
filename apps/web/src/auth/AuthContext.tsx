import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { AlterarSenhaInput, CadastroInput, LoginInput, SessaoResposta } from '@orcafacil/shared';
import { api, CHAVE_TOKEN, definirAoExpirarSessao, tokenStorage } from '../api/client';

interface AuthValor {
  autenticado: boolean;
  entrar(dados: LoginInput): Promise<void>;
  cadastrar(dados: CadastroInput): Promise<void>;
  trocarSenha(dados: AlterarSenhaInput): Promise<void>;
  /** Encerra a sessão também no servidor: o token deixa de valer em todos os aparelhos. */
  sair(): void;
  /** Encerra só neste navegador, para quando o servidor já não reconhece a sessão. */
  encerrarSessaoLocal(): void;
}

const AuthContext = createContext<AuthValor | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [token, setToken] = useState(() => tokenStorage.obter());
  // Muda quando outra aba troca a sessão: remonta as telas, descartando dados e formulários da conta anterior.
  const [geracao, setGeracao] = useState(0);

  const iniciarSessao = useCallback(
    (sessao: SessaoResposta) => {
      qc.clear();
      tokenStorage.salvar(sessao.token);
      setToken(sessao.token);
    },
    [qc],
  );

  const encerrarSessaoLocal = useCallback(() => {
    tokenStorage.limpar();
    setToken(null);
    qc.clear();
  }, [qc]);

  const sair = useCallback(() => {
    // Melhor esforço: sem rede, a sessão local termina assim mesmo.
    api.post('/auth/logout').catch(() => {});
    encerrarSessaoLocal();
  }, [encerrarSessaoLocal]);

  useEffect(() => definirAoExpirarSessao(encerrarSessaoLocal), [encerrarSessaoLocal]);

  // O token é compartilhado entre abas, mas o estado e o cache são de cada uma.
  useEffect(() => {
    const aoMudarArmazenamento = (e: StorageEvent) => {
      if (e.key !== CHAVE_TOKEN && e.key !== null) return; // `null` = localStorage.clear()
      qc.clear();
      setToken(tokenStorage.obter());
      setGeracao((g) => g + 1);
    };
    window.addEventListener('storage', aoMudarArmazenamento);
    return () => window.removeEventListener('storage', aoMudarArmazenamento);
  }, [qc]);

  const valor = useMemo<AuthValor>(
    () => ({
      autenticado: Boolean(token),
      entrar: async (dados) => iniciarSessao(await api.post<SessaoResposta>('/auth/login', dados)),
      cadastrar: async (dados) => iniciarSessao(await api.post<SessaoResposta>('/auth/cadastro', dados)),
      trocarSenha: async (dados) => iniciarSessao(await api.post<SessaoResposta>('/auth/senha', dados)),
      sair,
      encerrarSessaoLocal,
    }),
    [token, iniciarSessao, sair, encerrarSessaoLocal],
  );

  return (
    <AuthContext.Provider value={valor}>
      <Fragment key={geracao}>{children}</Fragment>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValor {
  const valor = useContext(AuthContext);
  if (!valor) throw new Error('useAuth deve ser usado dentro de <AuthProvider>');
  return valor;
}
