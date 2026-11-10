import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Botao } from './ui';

/** Fundo escurecido + painel. `folha` = bottom sheet (menu de ações), senão diálogo central. */
function Sobreposicao({ aoFechar, folha, titulo, children }: { aoFechar(): void; folha?: boolean; titulo: string; children: ReactNode }) {
  const tituloId = useId();
  const painel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', tecla);
    // Foco inicial nunca na ação destrutiva: um Enter acidental não pode confirmar.
    const alvo = ['input', '[data-foco-inicial]', 'button'].map((s) => painel.current?.querySelector<HTMLElement>(s)).find(Boolean);
    alvo?.focus();
    return () => document.removeEventListener('keydown', tecla);
  }, [aoFechar]);

  return (
    <div className={`fixed inset-0 z-40 flex justify-center bg-black/45 ${folha ? 'items-end' : 'items-center p-4'}`} onClick={aoFechar}>
      <div
        ref={painel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        onClick={(e) => e.stopPropagation()}
        className={
          folha
            ? 'animar-subida w-full max-w-xl rounded-t-3xl bg-superficie px-4 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]'
            : 'animar-subida w-full max-w-sm rounded-2xl bg-superficie p-6'
        }
      >
        {folha ? <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-divisor" /> : null}
        <h2 id={tituloId} className={folha ? 'mb-2 px-2 font-mono text-sm text-suave' : 'mb-2 text-xl font-semibold'}>
          {titulo}
        </h2>
        {children}
      </div>
    </div>
  );
}

export function Confirmacao({
  titulo,
  mensagem,
  rotuloConfirmar,
  aoConfirmar,
  aoCancelar,
  carregando,
  desabilitarConfirmar,
}: {
  titulo: string;
  mensagem: ReactNode;
  rotuloConfirmar: string;
  aoConfirmar(): void;
  aoCancelar(): void;
  carregando?: boolean;
  desabilitarConfirmar?: boolean;
}) {
  return (
    <Sobreposicao titulo={titulo} aoFechar={aoCancelar}>
      <div className="mb-6 text-suave">{mensagem}</div>
      <div className="flex flex-col gap-2">
        <Botao variante="perigo" onClick={aoConfirmar} carregando={carregando} disabled={desabilitarConfirmar} bloco>
          {rotuloConfirmar}
        </Botao>
        <Botao variante="texto" onClick={aoCancelar} data-foco-inicial bloco>
          Cancelar
        </Botao>
      </div>
    </Sobreposicao>
  );
}

export function FolhaAcoes({ titulo, aoFechar, children }: { titulo: string; aoFechar(): void; children: ReactNode }) {
  return (
    <Sobreposicao titulo={titulo} aoFechar={aoFechar} folha>
      <div className="flex flex-col">{children}</div>
    </Sobreposicao>
  );
}
