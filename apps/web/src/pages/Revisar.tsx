import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  dataValidade,
  formatarBRL,
  formatarData,
  formatarTelefone,
  hojeIso,
  pendenciasEmissao,
  prazoSchema,
  validadeSchema,
  type Orcamento,
} from '@orcafacil/shared';
import { ApiError } from '../api/client';
import { mensagemErro, useAtualizarOrcamento, useEmitir, usePerfil } from '../api/hooks';
import { BarraEtapa, Pagina } from '../components/Layout';
import { AreaTexto, Botao, Campo, Cartao, Nota, RotuloSecao } from '../components/ui';
import { useAutosave } from '../lib/useAutosave';
import { ComOrcamento, StatusSalvamento } from './comum';

/** T4 · 03 Revisar — condições e resumo (US05, US06). */
export function Revisar() {
  return (
    <ComOrcamento titulo="Revisar" etapa={3}>
      {(o) => <Revisao key={o.id} orcamento={o} />}
    </ComOrcamento>
  );
}

const inteiro = (texto: string) => (/^\d+$/.test(texto.trim()) ? Number(texto) : texto.trim() === '' ? null : NaN);

function Revisao({ orcamento }: { orcamento: Orcamento }) {
  const navigate = useNavigate();
  const { data: perfil } = usePerfil();
  const atualizar = useAtualizarOrcamento(orcamento.id);
  const emitir = useEmitir(orcamento.id);

  const [prazo, setPrazo] = useState(orcamento.prazoExecucaoDias?.toString() ?? '');
  const [validade, setValidade] = useState(String(orcamento.validadeDias)); // CA05.3 — padrão 15
  const [pagamento, setPagamento] = useState(orcamento.condicoesPagamento ?? '');
  const [observacoes, setObservacoes] = useState(orcamento.observacoes ?? '');
  const [tocouPrazo, setTocouPrazo] = useState(false);
  const [erroEmissao, setErroEmissao] = useState<{ mensagem: string; pendencias: string[] } | null>(null);

  const prazoNum = inteiro(prazo);
  const validadeNum = inteiro(validade);
  const erroPrazo = prazoNum === null ? null : prazoSchema.safeParse(prazoNum).error?.issues[0].message ?? null;
  const erroValidade = validadeSchema.safeParse(validadeNum).error?.issues[0].message ?? null;

  const condicoes = {
    prazoExecucaoDias: erroPrazo ? null : prazoNum,
    validadeDias: validadeNum as number,
    condicoesPagamento: pagamento,
    observacoes,
  };
  const { estado, salvarAgora } = useAutosave(condicoes, !erroPrazo && !erroValidade, (v) => atualizar.mutateAsync(v));

  // RN01 — o que falta, considerando o prazo digitado (CA06.2)
  const pendencias = pendenciasEmissao({
    profissional: perfil ?? null,
    cliente: orcamento.cliente,
    itens: orcamento.itens,
    prazoExecucaoDias: erroPrazo ? null : prazoNum,
  });
  const podeEmitir = pendencias.length === 0 && !erroValidade;

  const gerarPdf = async () => {
    setErroEmissao(null);
    try {
      await salvarAgora();
      await emitir.mutateAsync();
      navigate(`/orcamentos/${orcamento.id}/pdf`);
    } catch (e) {
      setErroEmissao({ mensagem: mensagemErro(e), pendencias: e instanceof ApiError ? e.pendencias : [] });
    }
  };

  const base = `/orcamentos/${orcamento.id}`;
  const cliente = orcamento.cliente;

  return (
    <Pagina
      topo={<BarraEtapa titulo="Revisar" numero={orcamento.numero} etapa={3} voltarPara={`${base}/detalhar`} />}
      rodape={
        <>
          {!podeEmitir ? (
            <div className="mb-3 rounded-xl bg-rascunho-fundo p-3" id="pendencias">
              <Nota tom="aviso">
                <p className="font-semibold">Para gerar o PDF, falta:</p>
                <ul className="mt-1 list-disc pl-5">
                  {pendencias.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                  {erroValidade ? <li>{erroValidade}</li> : null}
                </ul>
              </Nota>
            </div>
          ) : null}
          <Botao
            bloco
            icone="arquivo"
            className="min-h-14"
            disabled={!podeEmitir}
            aria-describedby={!podeEmitir ? 'pendencias' : undefined}
            carregando={emitir.isPending}
            onClick={gerarPdf}
          >
            {emitir.isPending ? 'Gerando PDF…' : 'Gerar PDF'}
          </Botao>
        </>
      }
    >
      {orcamento.status === 'EMITIDO' && orcamento.dataEmissao ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-sucesso-fundo p-4">
          <Nota tom="sucesso">Emitido em {formatarData(orcamento.dataEmissao)}. Se alterar algo, ele volta a ser rascunho.</Nota>
          <Link to={`${base}/pdf`} className="font-semibold text-primaria">
            Ver PDF
          </Link>
        </div>
      ) : null}

      <RotuloSecao className="mb-3">Condições</RotuloSecao>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Campo
          rotulo="Prazo (dias)"
          obrigatorio
          inputMode="numeric"
          value={prazo}
          onChange={(e) => setPrazo(e.target.value.replace(/\D/g, '').slice(0, 3))}
          onBlur={() => setTocouPrazo(true)}
          erro={(tocouPrazo || prazo !== '') && erroPrazo ? erroPrazo : undefined}
        />
        <Campo
          rotulo="Validade (dias)"
          inputMode="numeric"
          value={validade}
          onChange={(e) => setValidade(e.target.value.replace(/\D/g, '').slice(0, 2))}
          erro={erroValidade ?? undefined}
        />
      </div>
      {!erroValidade ? (
        <Nota icone="calendario" className="mb-5">
          Se emitido hoje, a proposta vale até {formatarData(dataValidade(hojeIso(), validadeNum as number))}.
        </Nota>
      ) : null}
      <div className="flex flex-col gap-5">
        <AreaTexto
          rotulo="Condições de pagamento"
          placeholder="Ex.: 50% no início e 50% na conclusão."
          maxLength={500}
          value={pagamento}
          onChange={(e) => setPagamento(e.target.value)}
        />
        <AreaTexto
          rotulo="Observações"
          placeholder="Ex.: Materiais por conta do cliente."
          maxLength={1000}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
        />
        <StatusSalvamento estado={estado} />
      </div>

      <RotuloSecao className="mt-8 mb-3">Resumo</RotuloSecao>
      <Cartao className="py-1">
        <LinhaResumo titulo="Profissional" editar="/perfil">
          {perfil ? [perfil.nomeEmpresa ?? perfil.nome, formatarTelefone(perfil.telefone)].join(' · ') : '—'}
        </LinhaResumo>
        <LinhaResumo titulo="Cliente" editar={`${base}/preencher`}>
          {cliente ? [cliente.nome, cliente.endereco, formatarTelefone(cliente.telefone)].filter(Boolean).join(' · ') : <span className="text-perigo">Não informado</span>}
        </LinhaResumo>
        <LinhaResumo titulo={`Itens (${orcamento.itens.length})`} editar={`${base}/detalhar`}>
          {orcamento.itens.length ? orcamento.itens.map((i) => i.descricao).join(' · ') : <span className="text-perigo">Nenhum item</span>}
        </LinhaResumo>
        <div className="flex items-center justify-between py-4">
          <RotuloSecao>Total</RotuloSecao>
          <span className="text-3xl font-bold">{formatarBRL(orcamento.totalCentavos)}</span>
        </div>
      </Cartao>

      {erroEmissao ? (
        <Nota tom="erro" className="mt-5">
          {erroEmissao.mensagem}
          {erroEmissao.pendencias.length ? (
            <ul className="mt-1 list-disc pl-5">
              {erroEmissao.pendencias.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : null}
        </Nota>
      ) : null}
    </Pagina>
  );
}

function LinhaResumo({ titulo, editar, children }: { titulo: string; editar: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-divisor py-4">
      <div className="min-w-0 flex-1">
        <RotuloSecao className="mb-1">{titulo}</RotuloSecao>
        <p className="text-[17px] break-words">{children}</p>
      </div>
      <Link to={editar} className="-my-1 rounded-lg px-2 py-2 font-medium text-primaria hover:bg-primaria-clara" aria-label={`Editar ${titulo.toLowerCase()}`}>
        Editar
      </Link>
    </div>
  );
}
