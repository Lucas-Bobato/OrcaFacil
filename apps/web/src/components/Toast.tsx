import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icone } from './Icones';

interface Acao {
  rotulo: string;
  aoClicar(): void;
}

interface Mensagem {
  id: number;
  texto: string;
  tom: 'sucesso' | 'erro' | 'info';
  acao?: Acao;
}

interface ToastValor {
  mostrar(texto: string, opcoes?: { tom?: Mensagem['tom']; acao?: Acao; duracaoMs?: number }): void;
}

const ToastContext = createContext<ToastValor | null>(null);

/** Mensagens curtas no rodapé: "Perfil salvo", "Item removido · Desfazer" (RN14). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [mensagem, setMensagem] = useState<Mensagem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const mostrar = useCallback<ToastValor['mostrar']>((texto, { tom = 'sucesso', acao, duracaoMs = acao ? 5000 : 3000 } = {}) => {
    clearTimeout(timer.current);
    setMensagem({ id: Date.now(), texto, tom, acao });
    timer.current = setTimeout(() => setMensagem(null), duracaoMs);
  }, []);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={{ mostrar }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-48 z-50 flex justify-center px-4" aria-live="polite">
        {mensagem ? (
          <div
            key={mensagem.id}
            role="status"
            className="animar-subida pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-[#1f2a37] px-4 py-3 text-white shadow-lg"
          >
            <Icone
              nome={mensagem.tom === 'erro' ? 'alerta' : mensagem.tom === 'info' ? 'info' : 'check'}
              className={mensagem.tom === 'erro' ? 'text-[#ffb4ab]' : 'text-[#9fd6b0]'}
            />
            <span className="flex-1">{mensagem.texto}</span>
            {mensagem.acao ? (
              <button
                type="button"
                className="min-h-10 rounded-lg px-3 font-semibold text-[#b9cdf0] hover:bg-white/10"
                onClick={() => {
                  mensagem.acao!.aoClicar();
                  setMensagem(null);
                }}
              >
                {mensagem.acao.rotulo}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastValor {
  const valor = useContext(ToastContext);
  if (!valor) throw new Error('useToast deve ser usado dentro de <ToastProvider>');
  return valor;
}
