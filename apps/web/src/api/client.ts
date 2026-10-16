import type { ErroResposta } from '@orcafacil/shared';

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';
const CHAVE_TOKEN = 'orcafacil.token';

/** Erro devolvido pela API, já no formato padrão `{ erro: {...} }`. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensagem: string,
    public readonly campos: Record<string, string> = {},
    public readonly pendencias: string[] = [],
  ) {
    super(mensagem);
  }
}

export const tokenStorage = {
  obter(): string | null {
    try {
      return localStorage.getItem(CHAVE_TOKEN);
    } catch {
      return null;
    }
  },
  salvar(token: string) {
    try {
      localStorage.setItem(CHAVE_TOKEN, token);
    } catch {
      /* armazenamento indisponível: a sessão dura até fechar a aba */
    }
  },
  limpar() {
    try {
      localStorage.removeItem(CHAVE_TOKEN);
    } catch {
      /* ignora */
    }
  },
};

/** Avisado quando a API responde 401 (sessão expirada) para voltar à tela de login. */
let aoExpirarSessao: () => void = () => {};
export function definirAoExpirarSessao(fn: () => void) {
  aoExpirarSessao = fn;
}

async function requisitar(metodo: string, caminho: string, corpo?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  const token = tokenStorage.obter();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${caminho}`, {
      method: metodo,
      headers,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });
  } catch {
    throw new ApiError(0, 'SEM_CONEXAO', 'Sem conexão com o servidor. Verifique sua internet e tente novamente.');
  }

  if (!res.ok) {
    let erro: ErroResposta['erro'] = { codigo: 'ERRO_INTERNO', mensagem: 'Ocorreu um erro inesperado. Tente novamente.' };
    try {
      erro = ((await res.json()) as ErroResposta).erro ?? erro;
    } catch {
      /* resposta sem JSON */
    }
    if (res.status === 401 && token && erro.codigo === 'SESSAO_INVALIDA') aoExpirarSessao();
    throw new ApiError(res.status, erro.codigo, erro.mensagem, erro.campos, erro.pendencias);
  }
  return res;
}

async function json<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
  const res = await requisitar(metodo, caminho, corpo);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export const api = {
  get: <T>(caminho: string) => json<T>('GET', caminho),
  post: <T>(caminho: string, corpo: unknown = {}) => json<T>('POST', caminho, corpo),
  put: <T>(caminho: string, corpo: unknown) => json<T>('PUT', caminho, corpo),
  delete: <T = void>(caminho: string) => json<T>('DELETE', caminho),
  /** Baixa um arquivo binário (PDF), devolvendo o Blob e o nome do arquivo. */
  async arquivo(caminho: string): Promise<{ blob: Blob; nomeArquivo: string }> {
    const res = await requisitar('GET', caminho);
    const disposicao = res.headers.get('Content-Disposition') ?? '';
    const nomeArquivo = /filename="([^"]+)"/.exec(disposicao)?.[1] ?? 'orcamento.pdf';
    return { blob: await res.blob(), nomeArquivo };
  },
};
