import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import type { Status } from '@orcafacil/shared';
import { Icone, type NomeIcone } from './Icones';

const cx = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

// ------------------------------------------------------------------ Botão

type Variante = 'primario' | 'secundario' | 'texto' | 'perigo';

const estilosBotao: Record<Variante, string> = {
  primario: 'bg-primaria text-white hover:bg-primaria-escura disabled:bg-[#9aa6ba] disabled:text-white/90',
  secundario: 'border-2 border-primaria bg-superficie text-primaria hover:bg-primaria-clara disabled:border-borda disabled:text-suave',
  texto: 'text-primaria hover:bg-primaria-clara disabled:text-suave',
  perigo: 'bg-perigo text-white hover:brightness-95 disabled:opacity-60',
};

interface BotaoProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  icone?: NomeIcone;
  carregando?: boolean;
  bloco?: boolean;
}

export function Botao({ variante = 'primario', icone, carregando, bloco, className, children, disabled, ...props }: BotaoProps) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-[17px] font-semibold transition-colors disabled:cursor-not-allowed',
        estilosBotao[variante],
        bloco && 'w-full',
        className,
      )}
      disabled={disabled || carregando}
      aria-busy={carregando || undefined}
      {...props}
    >
      {carregando ? <Spinner /> : null}
      {children}
      {!carregando && icone ? <Icone nome={icone} /> : null}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cx('inline-block size-5 animate-spin rounded-full border-2 border-current border-r-transparent', className)}
      role="status"
      aria-label="Carregando"
    />
  );
}

// ------------------------------------------------------------------ Campos

interface CampoBase {
  rotulo: string;
  erro?: string;
  obrigatorio?: boolean;
  ajuda?: ReactNode;
}

const estiloInput = (erro?: string) =>
  cx(
    'w-full rounded-xl border bg-superficie px-4 py-3 text-[17px] text-texto placeholder:text-[#8a8f86] outline-none transition-shadow',
    'focus:border-primaria focus:ring-3 focus:ring-primaria/20 disabled:bg-neutro',
    erro ? 'border-perigo ring-1 ring-perigo' : 'border-borda',
  );

function Rotulo({ htmlFor, rotulo, obrigatorio }: { htmlFor: string; rotulo: string; obrigatorio?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[15px] font-medium text-texto">
      {rotulo}
      {obrigatorio ? <span aria-hidden="true"> *</span> : null}
    </label>
  );
}

export function MensagemErro({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="mt-1.5 flex items-start gap-1.5 text-sm font-medium text-perigo" role="alert">
      <Icone nome="alerta" width={18} height={18} className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}

type CampoProps = CampoBase & InputHTMLAttributes<HTMLInputElement>;

export const Campo = forwardRef<HTMLInputElement, CampoProps>(function Campo(
  { rotulo, erro, obrigatorio, ajuda, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const campoId = id ?? autoId;
  return (
    <div className={className}>
      <Rotulo htmlFor={campoId} rotulo={rotulo} obrigatorio={obrigatorio} />
      <input
        ref={ref}
        id={campoId}
        className={estiloInput(erro)}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${campoId}-erro` : undefined}
        aria-required={obrigatorio || undefined}
        {...props}
      />
      {erro ? <MensagemErro id={`${campoId}-erro`}>{erro}</MensagemErro> : ajuda}
    </div>
  );
});

type AreaTextoProps = CampoBase & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const AreaTexto = forwardRef<HTMLTextAreaElement, AreaTextoProps>(function AreaTexto(
  { rotulo, erro, obrigatorio, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const campoId = id ?? autoId;
  return (
    <div className={className}>
      <Rotulo htmlFor={campoId} rotulo={rotulo} obrigatorio={obrigatorio} />
      <textarea
        ref={ref}
        id={campoId}
        rows={2}
        className={cx(estiloInput(erro), 'resize-y')}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro ? `${campoId}-erro` : undefined}
        {...props}
      />
      {erro ? <MensagemErro id={`${campoId}-erro`}>{erro}</MensagemErro> : null}
    </div>
  );
});

type SelecaoProps = CampoBase & SelectHTMLAttributes<HTMLSelectElement>;

export const Selecao = forwardRef<HTMLSelectElement, SelecaoProps>(function Selecao(
  { rotulo, erro, id, className, children, ...props },
  ref,
) {
  const autoId = useId();
  const campoId = id ?? autoId;
  return (
    <div className={className}>
      <Rotulo htmlFor={campoId} rotulo={rotulo} />
      <div className="relative">
        <select ref={ref} id={campoId} className={cx(estiloInput(erro), 'appearance-none pr-9')} {...props}>
          {children}
        </select>
        <Icone nome="chevronBaixo" className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-suave" />
      </div>
    </div>
  );
});

// ------------------------------------------------------------------ Feedback

type TomNota = 'info' | 'sucesso' | 'erro' | 'aviso';

const estilosNota: Record<TomNota, { classe: string; icone: NomeIcone }> = {
  info: { classe: 'text-suave', icone: 'info' },
  sucesso: { classe: 'text-sucesso', icone: 'check' },
  erro: { classe: 'text-perigo', icone: 'alerta' },
  aviso: { classe: 'text-rascunho', icone: 'alerta' },
};

/** Linha com ícone + texto curto (dicas, avisos e erros). */
export function Nota({ tom = 'info', icone, children, className }: { tom?: TomNota; icone?: NomeIcone; children: ReactNode; className?: string }) {
  const estilo = estilosNota[tom];
  return (
    <div className={cx('flex items-start gap-2.5 text-[15px] leading-snug', estilo.classe, className)} role={tom === 'erro' ? 'alert' : undefined}>
      <Icone nome={icone ?? estilo.icone} className="mt-px shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function SeloStatus({ status }: { status: Status }) {
  return status === 'EMITIDO' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-sucesso-fundo px-3 py-1 text-sm font-medium text-sucesso">
      <Icone nome="check" width={16} height={16} /> Emitido
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-rascunho-fundo px-3 py-1 text-sm font-medium text-rascunho">
      <Icone nome="lapis" width={16} height={16} /> Rascunho
    </span>
  );
}

export function RotuloSecao({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cx('text-[13px] font-semibold tracking-[0.08em] text-suave uppercase', className)}>{children}</h2>;
}

export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('rounded-2xl border border-divisor bg-superficie p-4', className)}>{children}</div>;
}

/** Estado de carregamento de página inteira. */
export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-suave">
      <Spinner className="size-8 text-primaria" />
      <p>{texto}</p>
    </div>
  );
}

/** Estado de erro com opção de tentar novamente. */
export function ErroCarregamento({ mensagem, aoTentar }: { mensagem: string; aoTentar?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-perigo/30 bg-perigo-fundo p-6 text-center">
      <Nota tom="erro">{mensagem}</Nota>
      {aoTentar ? (
        <Botao variante="secundario" onClick={aoTentar}>
          Tentar novamente
        </Botao>
      ) : null}
    </div>
  );
}

export { cx };
