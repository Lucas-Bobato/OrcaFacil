import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from '../api/client';
import { mensagemErro } from '../api/hooks';

/**
 * Leva os erros por campo devolvidos pela API (400 VALIDACAO) para o formulário.
 * Devolve a mensagem geral quando o erro não é de um campo específico.
 */
export function aplicarErrosApi<T extends FieldValues>(erro: unknown, setError: UseFormSetError<T>): string | null {
  if (erro instanceof ApiError && Object.keys(erro.campos).length > 0) {
    for (const [campo, mensagem] of Object.entries(erro.campos)) {
      setError(campo as Path<T>, { type: 'api', message: mensagem }, { shouldFocus: true });
    }
    return null;
  }
  return mensagemErro(erro);
}
