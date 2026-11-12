import { useCallback, useEffect, useRef, useState } from 'react';

export type EstadoSalvamento = 'ocioso' | 'salvando' | 'salvo' | 'erro';

/**
 * Salvamento automático com debounce (RNF10: 500 ms): chama `salvar` quando
 * `valores` mudam e `valido` é verdadeiro. `salvarAgora()` força o envio
 * pendente (ex.: antes de navegar ou gerar o PDF).
 */
export function useAutosave<T>(valores: T, valido: boolean, salvar: (v: T) => Promise<unknown>, atrasoMs = 500) {
  const [estado, setEstado] = useState<EstadoSalvamento>('ocioso');
  const serializado = JSON.stringify(valores);
  const ultimoSalvo = useRef(serializado);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const refs = useRef({ valores, valido, salvar });
  refs.current = { valores, valido, salvar };

  const executar = useCallback(async () => {
    clearTimeout(timer.current);
    const { valores: v, valido: ok, salvar: fn } = refs.current;
    const atual = JSON.stringify(v);
    if (!ok || atual === ultimoSalvo.current) return;
    setEstado('salvando');
    try {
      await fn(v);
      ultimoSalvo.current = atual;
      setEstado('salvo');
    } catch (e) {
      setEstado('erro');
      throw e;
    }
  }, []);

  useEffect(() => {
    if (!valido || serializado === ultimoSalvo.current) return;
    timer.current = setTimeout(() => {
      executar().catch(() => {});
    }, atrasoMs);
    return () => clearTimeout(timer.current);
  }, [serializado, valido, atrasoMs, executar]);

  return { estado, salvarAgora: executar };
}
