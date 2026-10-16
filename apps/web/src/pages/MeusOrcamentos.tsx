import { useDeferredValue, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatarBRL, formatarData, type OrcamentoResumo } from '@orcafacil/shared';
import { mensagemErro, useCriarOrcamento, useDuplicarOrcamento, useExcluirOrcamento, useOrcamentos } from '../api/hooks';
import { Confirmacao, FolhaAcoes } from '../components/Dialogo';
import { Icone, type NomeIcone } from '../components/Icones';
import { BarraInicio, Pagina } from '../components/Layout';
import { useToast } from '../components/Toast';
import { Botao, Carregando, ErroCarregamento, Nota, RotuloSecao, SeloStatus, Spinner } from '../components/ui';
import { buscarPdf, salvarArquivo } from '../lib/arquivos';

const ROTA_ETAPA = { PREENCHER: 'preencher', DETALHAR: 'detalhar', REVISAR: 'revisar' } as const;

/** Rota para continuar um orçamento: emitido abre na revisão; rascunho na etapa onde parou (CA08.3). */
export const rotaContinuar = (o: Pick<OrcamentoResumo, 'id' | 'status' | 'etapaAtual'>) =>
  `/orcamentos/${o.id}/${o.status === 'EMITIDO' ? 'revisar' : ROTA_ETAPA[o.etapaAtual]}`;

/** T0 · Meus orçamentos (US08). */
export function MeusOrcamentos() {
  const navigate = useNavigate();
  const toast = useToast();
  const [busca, setBusca] = useState('');
  const buscaAdiada = useDeferredValue(busca.trim());
  const lista = useOrcamentos(buscaAdiada);
  const criar = useCriarOrcamento();
  const duplicar = useDuplicarOrcamento();
  const excluir = useExcluirOrcamento();
  const [menu, setMenu] = useState<OrcamentoResumo | null>(null);
  const [aExcluir, setAExcluir] = useState<OrcamentoResumo | null>(null);
  const [baixando, setBaixando] = useState(false);

  const novoOrcamento = () =>
    criar.mutate(undefined, {
      onSuccess: (o) => navigate(`/orcamentos/${o.id}/preencher`),
      onError: (e) => toast.mostrar(mensagemErro(e), { tom: 'erro' }),
    });

  const acao = async (tipo: 'abrir' | 'duplicar' | 'baixar' | 'excluir') => {
    const o = menu!;
    if (tipo === 'abrir') navigate(rotaContinuar(o));
    if (tipo === 'excluir') setAExcluir(o);
    if (tipo === 'duplicar') {
      duplicar.mutate(o.id, {
        onSuccess: (novo) => {
          toast.mostrar(`Cópia criada: ${novo.numero}`);
          navigate(`/orcamentos/${novo.id}/preencher`);
        },
        onError: (e) => toast.mostrar(mensagemErro(e), { tom: 'erro' }),
      });
    }
    if (tipo === 'baixar') {
      setBaixando(true);
      try {
        const { blob, nomeArquivo } = await buscarPdf(o.id);
        salvarArquivo(blob, nomeArquivo);
        toast.mostrar('PDF baixado');
      } catch (e) {
        toast.mostrar(mensagemErro(e), { tom: 'erro' });
      } finally {
        setBaixando(false);
      }
    }
    setMenu(null);
  };

  const itens = lista.data ?? [];

  return (
    <Pagina
      topo={<BarraInicio />}
      rodape={
        <Botao bloco icone="mais" className="min-h-14" onClick={novoOrcamento} carregando={criar.isPending}>
          Novo orçamento
        </Botao>
      }
    >
      <h1 className="mb-4 text-3xl font-bold">Meus orçamentos</h1>

      <div className="relative mb-5">
        <label htmlFor="busca" className="sr-only">
          Buscar por cliente
        </label>
        <input
          id="busca"
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por cliente…"
          className="w-full rounded-xl border border-borda bg-superficie py-3 pr-12 pl-4 text-[17px] outline-none focus:border-primaria focus:ring-3 focus:ring-primaria/20"
        />
        <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-suave">
          {lista.isFetching && buscaAdiada ? <Spinner className="size-5" /> : <Icone nome="busca" />}
        </span>
      </div>

      {lista.isPending ? (
        <Carregando texto="Carregando orçamentos…" />
      ) : lista.isError ? (
        <ErroCarregamento mensagem={mensagemErro(lista.error)} aoTentar={() => lista.refetch()} />
      ) : itens.length === 0 ? (
        buscaAdiada ? (
          <p className="py-10 text-center text-suave">Nenhum orçamento para “{buscaAdiada}”.</p>
        ) : (
          <EstadoVazio />
        )
      ) : (
        <>
          <RotuloSecao className="mb-3">
            {itens.length} {itens.length === 1 ? 'orçamento' : 'orçamentos'} · mais recentes primeiro
          </RotuloSecao>
          <ul className="flex flex-col gap-3" aria-label="Orçamentos">
            {itens.map((o) => (
              <CartaoOrcamento key={o.id} orcamento={o} aoAbrir={() => navigate(rotaContinuar(o))} aoMenu={() => setMenu(o)} />
            ))}
          </ul>
        </>
      )}

      <Nota icone="nuvem" className="mt-6">
        Tudo salvo na sua conta — acesse de qualquer aparelho.
      </Nota>

      {menu ? (
        <FolhaAcoes titulo={`${menu.numero} · ${menu.clienteNome ?? 'Sem cliente'}`} aoFechar={() => setMenu(null)}>
          <ItemMenu icone="abrir" onClick={() => acao('abrir')}>Abrir</ItemMenu>
          <ItemMenu icone="copiar" onClick={() => acao('duplicar')}>Duplicar como novo</ItemMenu>
          {menu.possuiPdf ? (
            <ItemMenu icone="download" onClick={() => acao('baixar')} carregando={baixando}>
              Baixar PDF
            </ItemMenu>
          ) : null}
          <ItemMenu icone="lixeira" perigo onClick={() => acao('excluir')}>Excluir</ItemMenu>
        </FolhaAcoes>
      ) : null}

      {aExcluir ? (
        <Confirmacao
          titulo="Excluir orçamento?"
          mensagem={
            <>
              O orçamento <span className="font-mono">{aExcluir.numero}</span>
              {aExcluir.clienteNome ? ` de ${aExcluir.clienteNome}` : ''} e seus PDFs serão apagados. Não é possível desfazer.
            </>
          }
          rotuloConfirmar="Excluir"
          carregando={excluir.isPending}
          aoCancelar={() => setAExcluir(null)}
          aoConfirmar={() =>
            excluir.mutate(aExcluir.id, {
              onSuccess: () => {
                toast.mostrar('Orçamento excluído');
                setAExcluir(null);
              },
              onError: (e) => toast.mostrar(mensagemErro(e), { tom: 'erro' }),
            })
          }
        />
      ) : null}
    </Pagina>
  );
}

function CartaoOrcamento({ orcamento: o, aoAbrir, aoMenu }: { orcamento: OrcamentoResumo; aoAbrir(): void; aoMenu(): void }) {
  return (
    <li className="relative rounded-2xl border border-divisor bg-superficie transition-shadow hover:shadow-sm">
      <button type="button" onClick={aoAbrir} className="block w-full p-4 pr-14 text-left" aria-label={`Abrir ${o.numero} de ${o.clienteNome ?? 'cliente não informado'}`}>
        <div className="mb-3 flex items-center gap-3">
          <span className="font-mono text-[15px] text-suave">{o.numero}</span>
          <SeloStatus status={o.status} />
        </div>
        <p className="mb-1 text-lg font-medium">{o.clienteNome ?? <span className="text-suave italic">Cliente não informado</span>}</p>
        <div className="flex items-end justify-between gap-2">
          <span className="text-suave">{formatarData(o.dataEmissao ?? o.criadoEm)}</span>
          <span className="text-lg font-bold">{formatarBRL(o.totalCentavos)}</span>
        </div>
      </button>
      <button
        type="button"
        onClick={aoMenu}
        className="absolute top-2.5 right-2 grid size-12 place-items-center rounded-full text-suave hover:bg-neutro"
        aria-label={`Ações do orçamento ${o.numero}`}
      >
        <Icone nome="menu" />
      </button>
    </li>
  );
}

function ItemMenu({ icone, perigo, carregando, onClick, children }: { icone: NomeIcone; perigo?: boolean; carregando?: boolean; onClick(): void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={carregando}
      className={`flex min-h-14 items-center gap-4 rounded-xl px-3 text-left text-lg hover:bg-neutro ${perigo ? 'text-perigo' : ''}`}
    >
      {carregando ? <Spinner /> : <Icone nome={icone} />}
      {children}
    </button>
  );
}

function EstadoVazio() {
  return (
    <div className="flex flex-col items-center px-4 py-12 text-center">
      <span className="mb-5 grid size-20 place-items-center rounded-3xl bg-primaria-clara text-primaria">
        <Icone nome="arquivo" width={40} height={40} />
      </span>
      <h2 className="mb-2 text-xl font-semibold">Nenhum orçamento ainda</h2>
      <p className="max-w-xs text-suave">
        Toque em <strong>Novo orçamento</strong> para montar o primeiro. Em poucos minutos o PDF fica pronto para enviar ao cliente.
      </p>
    </div>
  );
}
