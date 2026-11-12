import type { Request, RequestHandler, Response } from 'express';
import { AppError } from '../errors';

/** Limites de uso (docs/08-seguranca.md). Os testes podem sobrescrever qualquer um via `criarApp`. */
export interface Limites {
  autenticacaoPorIp: number;
  cadastrosPorIp: number;
  falhasLoginPorContaEIp: number;
  falhasLoginPorConta: number;
  emissoesPorConta: number;
  emissoesSimultaneas: number;
  hashesSimultaneos: number;
  clientesPorConta: number;
  orcamentosPorConta: number;
  bytesPdfPorConta: number;
}

export const LIMITES_PADRAO: Limites = {
  autenticacaoPorIp: 100, // a cada 15 min, cadastro + login
  cadastrosPorIp: 10, // por hora
  falhasLoginPorContaEIp: 10, // a cada 15 min
  falhasLoginPorConta: 50, // a cada 15 min, somando todos os IPs
  emissoesPorConta: 30, // por minuto
  emissoesSimultaneas: 4,
  hashesSimultaneos: 8,
  clientesPorConta: 5000,
  orcamentosPorConta: 5000,
  bytesPdfPorConta: 200 * 1024 * 1024,
};

const MINUTO = 60_000;

/**
 * Contador por chave em janela fixa, em memória. Basta para a API porque o SQLite
 * a limita a um único processo; reiniciar o processo zera os contadores.
 */
export class JanelaFixa {
  private readonly contagens = new Map<string, { n: number; expiraEm: number }>();

  constructor(
    private readonly maximo: number,
    private readonly duracaoMs: number,
    private readonly agora: () => number = Date.now,
  ) {}

  /** Conta uma ocorrência; devolve `false`, sem contar, se a chave já atingiu o máximo. */
  consumir(chave: string): boolean {
    const t = this.agora();
    if (this.contagens.size > 50_000) this.removerExpiradas(t);
    const atual = this.contagens.get(chave);
    if (!atual || atual.expiraEm <= t) {
      if (this.maximo < 1) return false;
      this.contagens.set(chave, { n: 1, expiraEm: t + this.duracaoMs });
      return true;
    }
    if (atual.n >= this.maximo) return false;
    atual.n += 1;
    return true;
  }

  /** Desfaz uma ocorrência contada que não deveria valer. */
  devolver(chave: string): void {
    const atual = this.contagens.get(chave);
    if (atual && atual.n > 0) atual.n -= 1;
  }

  limpar(chave: string): void {
    this.contagens.delete(chave);
  }

  /** Segundos até a janela da chave terminar (pelo menos 1). */
  segundosRestantes(chave: string): number {
    const atual = this.contagens.get(chave);
    return atual ? Math.max(1, Math.ceil((atual.expiraEm - this.agora()) / 1000)) : 1;
  }

  private removerExpiradas(t: number) {
    for (const [chave, { expiraEm }] of this.contagens) if (expiraEm <= t) this.contagens.delete(chave);
  }
}

function recusar(res: Response, segundos: number): never {
  res.setHeader('Retry-After', String(segundos));
  throw new AppError(429, 'MUITAS_TENTATIVAS', 'Muitas tentativas. Aguarde alguns minutos e tente novamente.');
}

/** Recusa com 503 quando já há `maximo` requisições em andamento. */
export function limitarConcorrencia(maximo: number): RequestHandler {
  let ativas = 0;
  return (_req, res, next) => {
    if (ativas >= maximo) {
      res.setHeader('Retry-After', '1');
      throw new AppError(503, 'SERVIDOR_OCUPADO', 'O servidor está ocupado. Tente novamente em instantes.');
    }
    ativas += 1;
    res.once('close', () => {
      ativas -= 1;
    });
    next();
  };
}

const ipDe = (req: Request) => req.ip ?? 'desconhecido';
const normalizarEmail = (email: unknown) => (typeof email === 'string' ? email.trim().toLowerCase() : '');

/** Controles de taxa de uma instância da API. */
export function criarControleLimites(limites: Limites) {
  const autenticacao = new JanelaFixa(limites.autenticacaoPorIp, 15 * MINUTO);
  const cadastros = new JanelaFixa(limites.cadastrosPorIp, 60 * MINUTO);
  const falhasContaIp = new JanelaFixa(limites.falhasLoginPorContaEIp, 15 * MINUTO);
  const falhasConta = new JanelaFixa(limites.falhasLoginPorConta, 15 * MINUTO);
  const emissoes = new JanelaFixa(limites.emissoesPorConta, MINUTO);

  const porIp =
    (janela: JanelaFixa): RequestHandler =>
    (req, res, next) => {
      const chave = ipDe(req);
      if (!janela.consumir(chave)) recusar(res, janela.segundosRestantes(chave));
      next();
    };

  return {
    autenticacaoPorIp: porIp(autenticacao),
    cadastroPorIp: porIp(cadastros),
    hashes: limitarConcorrencia(limites.hashesSimultaneos),
    emissoesSimultaneas: limitarConcorrencia(limites.emissoesSimultaneas),

    /** Requer `res.locals.profissional` (depois de `exigirPerfil`). */
    emissaoPorConta: ((_req, res, next) => {
      const chave: string = res.locals.profissional.id;
      if (!emissoes.consumir(chave)) recusar(res, emissoes.segundosRestantes(chave));
      next();
    }) as RequestHandler,

    /**
     * Executa uma verificação de senha contando as falhas. Conta antes de verificar,
     * para que requisições simultâneas não ultrapassem o limite; só a senha errada
     * mantém a contagem. O teto por conta soma todos os IPs e não é zerado por um
     * acerto, senão o dono da conta poderia ser usado para abrir espaço a novas tentativas.
     */
    async tentativaDeSenha<T>(req: Request, res: Response, email: unknown, verificar: () => Promise<T>): Promise<T> {
      const conta = normalizarEmail(email);
      const chaveContaIp = `${conta}|${ipDe(req)}`;
      if (!falhasContaIp.consumir(chaveContaIp)) recusar(res, falhasContaIp.segundosRestantes(chaveContaIp));
      if (!falhasConta.consumir(conta)) {
        falhasContaIp.devolver(chaveContaIp);
        recusar(res, falhasConta.segundosRestantes(conta));
      }
      try {
        const resultado = await verificar();
        falhasContaIp.limpar(chaveContaIp);
        falhasConta.devolver(conta);
        return resultado;
      } catch (erro) {
        const senhaErrada = erro instanceof AppError && ['CREDENCIAIS_INVALIDAS', 'SENHA_INCORRETA'].includes(erro.codigo);
        if (!senhaErrada) {
          falhasContaIp.devolver(chaveContaIp);
          falhasConta.devolver(conta);
        }
        throw erro;
      }
    },
  };
}
