import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  errosPorCampo,
  formatarBRL,
  formatarQuantidade,
  itemSchema,
  LIMITE_ITENS,
  parseDecimalBR,
  ROTULO_UNIDADE,
  UNIDADES,
  type ItemServico,
  type Orcamento,
  type Unidade,
} from '@orcafacil/shared';
import { ApiError } from '../api/client';
import { mensagemErro, useAdicionarItem, useAtualizarItem, useAtualizarOrcamento, useRemoverItem } from '../api/hooks';
import { CampoMonetario } from '../components/CampoMonetario';
import { Icone } from '../components/Icones';
import { BarraEtapa, Pagina } from '../components/Layout';
import { useToast } from '../components/Toast';
import { Botao, Campo, Cartao, Nota, RotuloSecao, Selecao } from '../components/ui';
import { ComOrcamento } from './comum';

/** T3 · 02 Detalhar — itens de serviço (US03, US04). */
export function Detalhar() {
  return (
    <ComOrcamento titulo="Serviços" etapa={2}>
      {(o) => <Itens orcamento={o} />}
    </ComOrcamento>
  );
}

interface Rascunho {
  descricao: string;
  quantidade: string;
  unidade: Unidade;
  valorUnitarioCentavos: number;
}

const rascunhoVazio: Rascunho = { descricao: '', quantidade: '', unidade: 'UN', valorUnitarioCentavos: 0 };

function Itens({ orcamento }: { orcamento: Orcamento }) {
  const navigate = useNavigate();
  const toast = useToast();
  const adicionar = useAdicionarItem(orcamento.id);
  const editarItem = useAtualizarItem(orcamento.id);
  const remover = useRemoverItem(orcamento.id);
  const atualizar = useAtualizarOrcamento(orcamento.id);

  const [form, setForm] = useState<Rascunho>(rascunhoVazio);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [editando, setEditando] = useState<ItemServico | null>(null);
  const descricaoRef = useRef<HTMLInputElement>(null);

  const limiteAtingido = orcamento.itens.length >= LIMITE_ITENS && !editando;
  const salvando = adicionar.isPending || editarItem.isPending;

  const definir = <K extends keyof Rascunho>(campo: K, valor: Rascunho[K]) => {
    setForm((f) => ({ ...f, [campo]: valor }));
    setErros(({ [campo]: _removido, ...resto }) => resto);
  };

  const enviar = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setErroGeral(null);
    const quantidade = parseDecimalBR(form.quantidade);
    const resultado = itemSchema.safeParse({
      descricao: form.descricao,
      quantidade: Number.isNaN(quantidade) ? undefined : quantidade,
      unidade: form.unidade,
      valorUnitarioCentavos: form.valorUnitarioCentavos,
    });
    if (!resultado.success) {
      setErros(errosPorCampo(resultado.error));
      return;
    }
    try {
      if (editando) {
        await editarItem.mutateAsync({ itemId: editando.id, dados: resultado.data });
        toast.mostrar('Item atualizado');
        setEditando(null);
      } else {
        await adicionar.mutateAsync(resultado.data);
      }
      setForm(rascunhoVazio); // CA03.1 — campos limpos após adicionar
      setErros({});
      descricaoRef.current?.focus();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.campos).length) setErros(err.campos);
      else setErroGeral(mensagemErro(err));
    }
  };

  const iniciarEdicao = (item: ItemServico) => {
    setEditando(item);
    setErros({});
    setForm({
      descricao: item.descricao,
      quantidade: formatarQuantidade(item.quantidade).replace(/\./g, ''),
      unidade: item.unidade,
      valorUnitarioCentavos: item.valorUnitarioCentavos,
    });
    descricaoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    descricaoRef.current?.focus();
  };

  const cancelarEdicao = () => {
    setEditando(null);
    setForm(rascunhoVazio);
    setErros({});
  };

  // CA04.2 / CA04.3 — remove na hora e oferece "Desfazer" por 5 s (RN14).
  const removerItem = (item: ItemServico) => {
    if (editando?.id === item.id) cancelarEdicao();
    remover.mutate(item.id, {
      onSuccess: () =>
        toast.mostrar('Item removido', {
          duracaoMs: 5000,
          acao: {
            rotulo: 'Desfazer',
            aoClicar: () =>
              adicionar.mutate(
                {
                  descricao: item.descricao,
                  quantidade: item.quantidade,
                  unidade: item.unidade,
                  valorUnitarioCentavos: item.valorUnitarioCentavos,
                  ordem: item.ordem,
                },
                { onError: (e) => toast.mostrar(mensagemErro(e), { tom: 'erro' }) },
              ),
          },
        }),
      onError: (e) => toast.mostrar(mensagemErro(e), { tom: 'erro' }),
    });
  };

  const proximo = () =>
    atualizar.mutate(
      { etapaAtual: 'REVISAR' },
      {
        onSuccess: () => navigate(`/orcamentos/${orcamento.id}/revisar`),
        onError: (e) => toast.mostrar(mensagemErro(e), { tom: 'erro' }),
      },
    );

  return (
    <Pagina
      topo={<BarraEtapa titulo="Serviços" numero={orcamento.numero} etapa={2} voltarPara={`/orcamentos/${orcamento.id}/preencher`} />}
      rodape={
        <>
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <RotuloSecao>Total</RotuloSecao>
              <p className="text-[15px] text-suave">Calculado automaticamente</p>
            </div>
            <output className="text-3xl font-bold" aria-live="polite" aria-label="Total do orçamento">
              {formatarBRL(orcamento.totalCentavos)}
            </output>
          </div>
          <Botao bloco icone="avancar" className="min-h-14" onClick={proximo} carregando={atualizar.isPending}>
            Próximo
          </Botao>
        </>
      }
    >
      <Cartao className="mb-6">
        <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
          <RotuloSecao>{editando ? `Editando item ${editando.ordem}` : 'Adicionar item'}</RotuloSecao>
          <Campo
            ref={descricaoRef}
            rotulo="Descrição do serviço"
            obrigatorio
            placeholder="Ex.: Pintura de parede"
            maxLength={120}
            value={form.descricao}
            onChange={(e) => definir('descricao', e.target.value)}
            erro={erros.descricao}
            disabled={limiteAtingido}
          />
          <div className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.5fr)] gap-3">
            <Campo
              rotulo="Qtd"
              obrigatorio
              inputMode="decimal"
              placeholder="0"
              value={form.quantidade}
              onChange={(e) => definir('quantidade', e.target.value.replace(/[^\d,.]/g, ''))}
              erro={erros.quantidade}
              disabled={limiteAtingido}
            />
            <Selecao rotulo="Unid." value={form.unidade} onChange={(e) => definir('unidade', e.target.value as Unidade)} disabled={limiteAtingido}>
              {UNIDADES.map((u) => (
                <option key={u} value={u}>
                  {ROTULO_UNIDADE[u]}
                </option>
              ))}
            </Selecao>
            <CampoMonetario
              rotulo="Valor unit."
              obrigatorio
              valor={form.valorUnitarioCentavos}
              aoMudar={(v) => definir('valorUnitarioCentavos', v)}
              erro={erros.valorUnitarioCentavos}
            />
          </div>
          {erroGeral ? <Nota tom="erro">{erroGeral}</Nota> : null}
          {limiteAtingido ? <Nota tom="aviso">Limite de {LIMITE_ITENS} itens atingido</Nota> : null}
          <div className="flex gap-2">
            {editando ? (
              <Botao variante="texto" onClick={cancelarEdicao} className="flex-1">
                Cancelar
              </Botao>
            ) : null}
            <Botao type="submit" variante="secundario" icone={editando ? 'check' : 'mais'} className="flex-[2]" bloco disabled={limiteAtingido} carregando={salvando}>
              {editando ? 'Salvar item' : 'Adicionar item'}
            </Botao>
          </div>
        </form>
      </Cartao>

      <RotuloSecao className="mb-1">Itens ({orcamento.itens.length})</RotuloSecao>
      {orcamento.itens.length === 0 ? (
        <p className="py-6 text-suave">Nenhum item ainda. Adicione o primeiro serviço acima.</p>
      ) : (
        <ul aria-label="Itens do orçamento">
          {orcamento.itens.map((item) => (
            <li key={item.id} className={`flex items-center gap-1 border-b border-divisor py-3 ${editando?.id === item.id ? 'bg-primaria-clara/60' : ''}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg">
                  {item.ordem}. {item.descricao}
                </p>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-suave">
                    {formatarQuantidade(item.quantidade)} {ROTULO_UNIDADE[item.unidade]} × {formatarBRL(item.valorUnitarioCentavos)}
                  </span>
                  <span className="text-lg font-bold">{formatarBRL(item.subtotalCentavos)}</span>
                </div>
              </div>
              <button type="button" onClick={() => iniciarEdicao(item)} className="grid size-12 shrink-0 place-items-center rounded-full text-suave hover:bg-neutro" aria-label={`Editar ${item.descricao}`}>
                <Icone nome="lapis" />
              </button>
              <button
                type="button"
                onClick={() => removerItem(item)}
                disabled={remover.isPending}
                className="grid size-12 shrink-0 place-items-center rounded-full text-perigo hover:bg-perigo-fundo"
                aria-label={`Remover ${item.descricao}`}
              >
                <Icone nome="lixeira" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Pagina>
  );
}
