import {
  dataValidade,
  formatarBRL,
  formatarData,
  formatarDocumento,
  formatarQuantidade,
  formatarTelefone,
  rotuloDocumento,
  ROTULO_UNIDADE,
  type Orcamento,
  type Profissional,
} from '@orcafacil/shared';

const juntar = (...p: Array<string | null | undefined>) => p.filter(Boolean).join(' · ');

/**
 * Pré-visualização do PDF em HTML (mesmo layout do componente "PDF / Orçamento A4").
 * O arquivo real é gerado pela API; aqui mostramos o mesmo conteúdo em tamanho reduzido.
 */
export function PreviaPdf({ orcamento: o, profissional: p }: { orcamento: Orcamento; profissional: Profissional }) {
  const emissao = o.dataEmissao ?? '';
  return (
    <div className="aspect-[595/842] w-full overflow-hidden bg-white p-[7%] text-[clamp(6px,1.9vw,10px)] leading-snug text-[#1f1f1f] shadow-md" aria-label="Pré-visualização do PDF">
      <div className="flex justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[1.8em] font-bold text-primaria">{(p.nomeEmpresa ?? p.nome ?? '').toUpperCase()}</p>
          <p className="text-[#5f6368]">
            {juntar(p.nomeEmpresa ? p.nome : null, p.documento ? `${rotuloDocumento(p.documento)} ${formatarDocumento(p.documento)}` : null)}
          </p>
          <p className="text-[#5f6368]">{juntar(formatarTelefone(p.telefone), p.email)}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[0.8em] font-semibold tracking-widest text-[#5f6368]">ORÇAMENTO</p>
          <p className="font-mono font-bold">Nº {o.numero}</p>
          {emissao ? <p className="text-[#5f6368]">Emissão {formatarData(emissao)}</p> : null}
        </div>
      </div>
      <hr className="my-[4%] border-t-2 border-primaria" />
      <p className="text-[0.8em] font-semibold tracking-widest text-[#5f6368]">CLIENTE</p>
      <p className="text-[1.2em] font-semibold">{o.cliente?.nome}</p>
      <p className="mb-[4%] text-[#5f6368]">{juntar(o.cliente?.endereco, formatarTelefone(o.cliente?.telefone), o.cliente?.email)}</p>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-neutro text-left text-[0.9em] text-[#5f6368]">
            <th className="p-[0.6em]">#</th>
            <th className="p-[0.6em]">Descrição</th>
            <th className="p-[0.6em] text-right">Qtd</th>
            <th className="p-[0.6em]">Unid.</th>
            <th className="p-[0.6em] text-right">Valor unit.</th>
            <th className="p-[0.6em] text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {o.itens.map((i) => (
            <tr key={i.id} className="border-b border-divisor">
              <td className="p-[0.6em] text-[#5f6368]">{i.ordem}</td>
              <td className="p-[0.6em]">{i.descricao}</td>
              <td className="p-[0.6em] text-right">{formatarQuantidade(i.quantidade)}</td>
              <td className="p-[0.6em]">{ROTULO_UNIDADE[i.unidade]}</td>
              <td className="p-[0.6em] text-right whitespace-nowrap">{formatarBRL(i.valorUnitarioCentavos)}</td>
              <td className="p-[0.6em] text-right font-semibold whitespace-nowrap">{formatarBRL(i.subtotalCentavos)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="my-[4%] text-right">
        <span className="mr-[1.5em] text-[0.9em] font-semibold tracking-widest text-[#5f6368]">TOTAL</span>
        <span className="text-[1.6em] font-bold">{formatarBRL(o.totalCentavos)}</span>
      </p>
      <div className="space-y-[0.4em] rounded bg-primaria-clara p-[3%]">
        <p>
          <b>Prazo de execução:</b> {o.prazoExecucaoDias} {o.prazoExecucaoDias === 1 ? 'dia' : 'dias'}
        </p>
        {o.condicoesPagamento ? (
          <p>
            <b>Condições de pagamento:</b> {o.condicoesPagamento}
          </p>
        ) : null}
        {o.observacoes ? (
          <p>
            <b>Observações:</b> {o.observacoes}
          </p>
        ) : null}
        {emissao ? (
          <p>
            <b>Validade:</b> Proposta válida até {formatarData(dataValidade(emissao, o.validadeDias))}.
          </p>
        ) : null}
      </div>
    </div>
  );
}
