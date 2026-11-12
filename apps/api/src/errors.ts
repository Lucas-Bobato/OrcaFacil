import { removerAcentos } from '@orcafacil/shared';

/**
 * Erro de aplicação com status HTTP e código estável, convertido para
 * `{ erro: { codigo, mensagem, ... } }` pelo middleware de erros.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly codigo: string,
    mensagem: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(mensagem);
  }
}

/** `naoEncontrado('Orçamento')` → 404 `ORCAMENTO_NAO_ENCONTRADO`. */
export const naoEncontrado = (recurso: string) =>
  new AppError(
    404,
    `${removerAcentos(recurso).toUpperCase().replace(/\s/g, '_')}_NAO_ENCONTRADO`,
    `${recurso} não encontrado`,
  );
