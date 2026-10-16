import type { ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import type { Orcamento } from '@orcafacil/shared';
import { mensagemErro, useOrcamento } from '../api/hooks';
import { BarraEtapa, Pagina } from '../components/Layout';
import { Carregando, ErroCarregamento, Nota, Spinner } from '../components/ui';
import type { EstadoSalvamento } from '../lib/useAutosave';

/** Carrega o orçamento da URL e mostra os estados de carregamento/erro antes do conteúdo. */
export function ComOrcamento({
  titulo,
  etapa,
  children,
}: {
  titulo: string;
  etapa: 1 | 2 | 3 | 4;
  children(orcamento: Orcamento): ReactNode;
}) {
  const { id = '' } = useParams();
  const consulta = useOrcamento(id);
  if (consulta.data) return <>{children(consulta.data)}</>;
  return (
    <Pagina topo={<BarraEtapa titulo={titulo} etapa={etapa} voltarPara="/" />}>
      {consulta.isError ? (
        <ErroCarregamento mensagem={mensagemErro(consulta.error)} aoTentar={() => consulta.refetch()} />
      ) : (
        <Carregando texto="Carregando orçamento…" />
      )}
    </Pagina>
  );
}

/** Indicador do salvamento automático (RNF10, CA08.3). */
export function StatusSalvamento({ estado }: { estado: EstadoSalvamento }) {
  if (estado === 'salvando')
    return (
      <p className="flex items-center gap-2 text-[15px] text-suave" role="status">
        <Spinner className="size-4" /> Salvando rascunho…
      </p>
    );
  if (estado === 'erro')
    return <Nota tom="erro">Não foi possível salvar. Verifique sua conexão — tentaremos de novo ao continuar.</Nota>;
  if (estado === 'salvo') return <Nota tom="sucesso">Rascunho salvo automaticamente na sua conta.</Nota>;
  return null;
}
