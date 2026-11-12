import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icone } from './Icones';
import { cx } from './ui';

/** Coluna central mobile-first (360 px → desktop) com rodapé de ação fixo opcional. */
export function Pagina({ topo, rodape, children }: { topo: ReactNode; rodape?: ReactNode; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-xl flex-col bg-fundo sm:border-x sm:border-divisor">
      {topo}
      <main className="flex-1 px-4 pt-5 pb-8 sm:px-6">{children}</main>
      {rodape ? (
        <div className="sticky bottom-0 z-10 border-t border-divisor bg-superficie px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">
          {rodape}
        </div>
      ) : null}
    </div>
  );
}

/** Barra superior do tipo Início: logo + acesso ao perfil. */
export function BarraInicio() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-divisor bg-superficie px-4 sm:px-6">
      <Link to="/" className="flex items-center gap-2.5 text-xl font-bold">
        <span className="grid size-9 place-items-center rounded-lg bg-primaria text-white">
          <Icone nome="arquivo" width={20} height={20} />
        </span>
        OrçaFácil
      </Link>
      <Link to="/perfil" className="grid size-12 place-items-center rounded-full hover:bg-neutro" aria-label="Meu perfil">
        <Icone nome="usuario" width={26} height={26} />
      </Link>
    </header>
  );
}

/** Barra superior do tipo Etapa: voltar + título + número do orçamento. */
export function BarraEtapa({
  titulo,
  numero,
  voltarPara,
  etapa,
  semVoltar,
}: {
  titulo: string;
  numero?: string;
  voltarPara?: string;
  etapa?: 1 | 2 | 3 | 4;
  semVoltar?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <header className="border-b border-divisor bg-superficie">
      <div className="flex h-14 items-center gap-2 px-2 sm:px-4">
        {semVoltar ? (
          <span className="w-2" />
        ) : (
          <button
            type="button"
            onClick={() => (voltarPara ? navigate(voltarPara) : navigate(-1))}
            className="grid size-12 place-items-center rounded-full hover:bg-neutro"
            aria-label="Voltar"
          >
            <Icone nome="voltar" width={26} height={26} />
          </button>
        )}
        <h1 className="flex-1 truncate text-xl font-semibold">{titulo}</h1>
        {numero ? <span className="pr-2 font-mono text-sm text-suave">{numero}</span> : null}
      </div>
      {etapa ? <IndicadorEtapas atual={etapa} /> : null}
    </header>
  );
}

const ETAPAS = ['Preencher', 'Detalhar', 'Revisar', 'PDF'];

/** 4 segmentos com rótulos; concluídos e atual na cor primária. */
export function IndicadorEtapas({ atual }: { atual: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="grid grid-cols-4 gap-2 px-4 pb-3 sm:px-6" aria-label={`Etapa ${atual} de 4: ${ETAPAS[atual - 1]}`}>
      {ETAPAS.map((rotulo, i) => {
        const n = i + 1;
        return (
          <li key={rotulo} aria-current={n === atual ? 'step' : undefined}>
            <span className={cx('block h-1.5 rounded-full', n <= atual ? 'bg-primaria' : 'bg-divisor')} />
            <span className={cx('mt-1.5 block text-sm', n === atual ? 'font-semibold text-primaria' : 'text-suave')}>
              {rotulo}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
