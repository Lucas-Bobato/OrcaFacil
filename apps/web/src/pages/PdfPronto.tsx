import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { formatarData, type Orcamento } from '@orcafacil/shared';
import { mensagemErro, usePerfil } from '../api/hooks';
import { Icone } from '../components/Icones';
import { BarraEtapa, Pagina } from '../components/Layout';
import { PreviaPdf } from '../components/PreviaPdf';
import { useToast } from '../components/Toast';
import { Botao, Nota } from '../components/ui';
import { buscarPdf, compartilharArquivo, podeCompartilharArquivos, salvarArquivo } from '../lib/arquivos';
import { ComOrcamento } from './comum';

/** T5 · 04 PDF pronto — baixar e compartilhar (US06, US07). */
export function PdfPronto() {
  return (
    <ComOrcamento titulo="Orçamento pronto" etapa={4}>
      {(o) => <Pronto orcamento={o} />}
    </ComOrcamento>
  );
}

function Pronto({ orcamento }: { orcamento: Orcamento }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: perfil } = usePerfil();
  const documento = orcamento.documentoAtual;
  const [compartilhavel] = useState(podeCompartilharArquivos); // CA07.3
  const [compartilhando, setCompartilhando] = useState(false);

  const pdf = useQuery({
    queryKey: ['pdf', orcamento.id, documento?.id],
    queryFn: () => buscarPdf(orcamento.id),
    enabled: Boolean(documento),
    staleTime: Infinity,
  });

  const baixar = () => {
    if (!pdf.data) return;
    salvarArquivo(pdf.data.blob, pdf.data.nomeArquivo);
    toast.mostrar('PDF baixado');
  };

  const compartilhar = async () => {
    if (!pdf.data) return;
    setCompartilhando(true);
    try {
      await compartilharArquivo(pdf.data.blob, pdf.data.nomeArquivo, `Orçamento ${orcamento.numero}`);
    } catch (e) {
      toast.mostrar(mensagemErro(e), { tom: 'erro' });
    } finally {
      setCompartilhando(false);
    }
  };

  const base = `/orcamentos/${orcamento.id}`;

  if (!documento) {
    return (
      <Pagina topo={<BarraEtapa titulo="Orçamento pronto" numero={orcamento.numero} etapa={4} voltarPara={`${base}/revisar`} />}>
        <Nota tom="aviso">Este orçamento ainda não tem PDF.</Nota>
        <Botao className="mt-4" onClick={() => navigate(`${base}/revisar`)}>
          Ir para a revisão
        </Botao>
      </Pagina>
    );
  }

  return (
    <Pagina
      topo={<BarraEtapa titulo="Orçamento pronto" numero={orcamento.numero} etapa={4} voltarPara={`${base}/revisar`} />}
      rodape={
        <>
          <div className="flex gap-3">
            <Botao variante="secundario" icone="download" className="min-h-14 flex-1" onClick={baixar} disabled={!pdf.data}>
              Baixar
            </Botao>
            {compartilhavel ? (
              <Botao icone="compartilhar" className="min-h-14 flex-1" onClick={compartilhar} disabled={!pdf.data} carregando={compartilhando}>
                Compartilhar
              </Botao>
            ) : null}
          </div>
          <Link to="/" className="mt-2 flex min-h-12 items-center justify-center text-lg font-semibold text-primaria">
            Voltar aos orçamentos
          </Link>
        </>
      }
    >
      {orcamento.status === 'EMITIDO' ? (
        <div className="mb-5 flex items-start gap-3 rounded-2xl bg-sucesso-fundo p-4" role="status">
          <Icone nome="check" width={30} height={30} className="shrink-0 text-sucesso" />
          <div>
            <p className="text-xl font-semibold text-sucesso">PDF gerado</p>
            <p>Orçamento marcado como Emitido em {formatarData(orcamento.dataEmissao!)}.</p>
          </div>
        </div>
      ) : (
        <Nota tom="aviso" className="mb-5">
          O orçamento foi alterado depois da emissão. Este é o último PDF gerado; gere um novo na revisão.
        </Nota>
      )}

      <div className="rounded-2xl bg-neutro p-4">
        {perfil ? <PreviaPdf orcamento={orcamento} profissional={perfil} /> : null}
        <p className="mt-3 text-center font-mono text-sm break-all text-suave">{documento.nomeArquivo}</p>
      </div>

      {pdf.isPending ? <p className="mt-4 text-center text-suave">Preparando arquivo…</p> : null}
      {pdf.isError ? (
        <Nota tom="erro" className="mt-4">
          {mensagemErro(pdf.error)}{' '}
          <button type="button" className="font-semibold underline" onClick={() => pdf.refetch()}>
            Tentar novamente
          </button>
        </Nota>
      ) : null}
      {!compartilhavel ? (
        <Nota className="mt-4">Seu navegador não permite compartilhar arquivos. Baixe o PDF e envie pelo WhatsApp.</Nota>
      ) : null}
    </Pagina>
  );
}
