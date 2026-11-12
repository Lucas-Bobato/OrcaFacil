/**
 * Geração do PDF do orçamento (RF10) com pdfmake — layout do componente
 * "PDF / Orçamento A4" do protótipo (docs/03-prototipacao.md §3.4).
 */
import { createRequire } from 'node:module';
import PdfPrinter from 'pdfmake';
import type { Content, TableCell, TDocumentDefinitions, TFontDictionary } from 'pdfmake/interfaces';
import {
  dataValidade,
  formatarBRL,
  formatarData,
  formatarDocumento,
  formatarQuantidade,
  formatarTelefone,
  rotuloDocumento,
  ROTULO_UNIDADE,
  type Cliente,
  type ItemServico,
  type Profissional,
} from '@orcafacil/shared';

const require = createRequire(import.meta.url);
const vfs = require('pdfmake/build/vfs_fonts.js') as Record<string, string>;
const fonte = (arquivo: string) => Buffer.from(vfs[arquivo], 'base64');

const fontes: TFontDictionary = {
  Roboto: {
    normal: fonte('Roboto-Regular.ttf'),
    bold: fonte('Roboto-Medium.ttf'),
    italics: fonte('Roboto-Italic.ttf'),
    bolditalics: fonte('Roboto-MediumItalic.ttf'),
  } as unknown as TFontDictionary[string],
  Courier: { normal: 'Courier', bold: 'Courier-Bold', italics: 'Courier-Oblique', bolditalics: 'Courier-BoldOblique' },
};

const printer = new PdfPrinter(fontes);

const COR_PRIMARIA = '#25467C';
const COR_TEXTO_SUAVE = '#5F6368';
const COR_CABECALHO_TABELA = '#EEF0EA';
const COR_CONDICOES = '#E8ECF4';
const COR_LINHA = '#D9DBD4';

export interface DadosPdf {
  numero: string;
  dataEmissao: string; // AAAA-MM-DD
  profissional: Profissional;
  cliente: Cliente;
  itens: ItemServico[];
  totalCentavos: number;
  prazoExecucaoDias: number;
  validadeDias: number;
  condicoesPagamento: string | null;
  observacoes: string | null;
}

const juntar = (...partes: Array<string | null | undefined>) => partes.filter(Boolean).join(' · ');

/** Monta a definição do documento (função pura — testada sem gerar o binário). */
export function montarDocumento(d: DadosPdf): TDocumentDefinitions {
  const p = d.profissional;
  const titulo = (p.nomeEmpresa ?? p.nome ?? '').toUpperCase();
  const subtitulo = juntar(
    p.nomeEmpresa ? p.nome : null,
    p.documento ? `${rotuloDocumento(p.documento)} ${formatarDocumento(p.documento)}` : null,
  );
  const contato = juntar(formatarTelefone(p.telefone), p.email);

  const linhasItens: TableCell[][] = d.itens.map((item, i) => [
    { text: String(i + 1), color: COR_TEXTO_SUAVE },
    { text: item.descricao },
    { text: formatarQuantidade(item.quantidade), alignment: 'right' },
    { text: ROTULO_UNIDADE[item.unidade] },
    { text: formatarBRL(item.valorUnitarioCentavos), alignment: 'right' },
    { text: formatarBRL(item.subtotalCentavos), alignment: 'right', bold: true },
  ]);

  const condicao = (rotulo: string, valor: string): Content => ({
    text: [{ text: `${rotulo}: `, bold: true }, valor],
    margin: [0, 0, 0, 6],
  });

  const condicoes: Content[] = [
    condicao('Prazo de execução', `${d.prazoExecucaoDias} ${d.prazoExecucaoDias === 1 ? 'dia' : 'dias'}`),
    ...(d.condicoesPagamento ? [condicao('Condições de pagamento', d.condicoesPagamento)] : []),
    ...(d.observacoes ? [condicao('Observações', d.observacoes)] : []),
    condicao('Validade', `Proposta válida até ${formatarData(dataValidade(d.dataEmissao, d.validadeDias))}.`),
  ];

  return {
    pageSize: 'A4',
    pageMargins: [56, 56, 56, 64],
    info: {
      title: `Orçamento ${d.numero}`,
      author: p.nomeEmpresa ?? p.nome ?? 'OrçaFácil',
      subject: `Orçamento para ${d.cliente.nome}`,
      creator: 'OrçaFácil',
    },
    defaultStyle: { font: 'Roboto', fontSize: 10, color: '#1F1F1F', lineHeight: 1.2 },
    footer: (paginaAtual, totalPaginas) => ({
      columns: [
        { text: `Orçamento ${d.numero}`, color: COR_TEXTO_SUAVE, fontSize: 8 },
        {
          text: `Gerado com OrçaFácil · pág. ${paginaAtual}/${totalPaginas}`,
          alignment: 'right',
          color: COR_TEXTO_SUAVE,
          fontSize: 8,
        },
      ],
      margin: [56, 24, 56, 0],
    }),
    content: [
      {
        columns: [
          {
            width: '*',
            stack: [
              { text: titulo, fontSize: 18, bold: true, color: COR_PRIMARIA },
              ...(subtitulo ? [{ text: subtitulo, color: COR_TEXTO_SUAVE, margin: [0, 4, 0, 0] } as Content] : []),
              { text: contato, color: COR_TEXTO_SUAVE },
            ],
          },
          {
            width: 'auto',
            alignment: 'right',
            stack: [
              { text: 'ORÇAMENTO', fontSize: 8, bold: true, color: COR_TEXTO_SUAVE, characterSpacing: 1.5 },
              { text: `Nº ${d.numero}`, font: 'Courier', bold: true, fontSize: 11, margin: [0, 2, 0, 2] },
              { text: `Emissão ${formatarData(d.dataEmissao)}`, color: COR_TEXTO_SUAVE },
            ],
          },
        ],
      },
      {
        canvas: [{ type: 'line', x1: 0, y1: 0, x2: 483, y2: 0, lineWidth: 2, lineColor: COR_PRIMARIA }],
        margin: [0, 16, 0, 20],
      },
      { text: 'CLIENTE', fontSize: 8, bold: true, color: COR_TEXTO_SUAVE, characterSpacing: 1.5 },
      { text: d.cliente.nome, bold: true, fontSize: 12, margin: [0, 2, 0, 2] },
      {
        text: juntar(d.cliente.endereco, formatarTelefone(d.cliente.telefone), d.cliente.email) || ' ',
        color: COR_TEXTO_SUAVE,
        margin: [0, 0, 0, 18],
      },
      {
        table: {
          headerRows: 1,
          widths: [18, '*', 40, 36, 72, 72],
          body: [
            [
              { text: '#', bold: true },
              { text: 'Descrição', bold: true },
              { text: 'Qtd', bold: true, alignment: 'right' },
              { text: 'Unid.', bold: true },
              { text: 'Valor unit.', bold: true, alignment: 'right' },
              { text: 'Total', bold: true, alignment: 'right' },
            ].map((c): TableCell => ({ ...c, fontSize: 9, color: COR_TEXTO_SUAVE, fillColor: COR_CABECALHO_TABELA }) as TableCell),
            ...linhasItens,
          ],
        },
        layout: {
          hLineWidth: (i: number) => (i === 0 ? 0 : 0.6),
          vLineWidth: () => 0,
          hLineColor: () => COR_LINHA,
          paddingTop: () => 7,
          paddingBottom: () => 7,
          paddingLeft: () => 6,
          paddingRight: () => 6,
        },
      },
      {
        columns: [
          { width: '*', text: '' },
          {
            width: 'auto',
            text: 'TOTAL',
            fontSize: 9,
            bold: true,
            color: COR_TEXTO_SUAVE,
            characterSpacing: 1.5,
            margin: [0, 6, 16, 0],
          },
          { width: 'auto', text: formatarBRL(d.totalCentavos), fontSize: 16, bold: true },
        ],
        margin: [0, 16, 6, 20],
      },
      {
        table: { widths: ['*'], body: [[{ stack: condicoes, fillColor: COR_CONDICOES, margin: [10, 10, 10, 4] }]] },
        layout: 'noBorders',
      },
      {
        unbreakable: true,
        margin: [0, 80, 0, 0],
        stack: [
          { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.8, lineColor: '#9AA0A6' }] },
          { text: p.nome ?? p.nomeEmpresa ?? '', margin: [0, 6, 0, 0] },
        ],
      },
    ],
  };
}

/** Renderiza o PDF em memória. */
export function gerarPdf(dados: DadosPdf): Promise<Buffer> {
  const doc = printer.createPdfKitDocument(montarDocumento(dados));
  return new Promise((resolve, reject) => {
    const partes: Buffer[] = [];
    doc.on('data', (parte: Buffer) => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
    doc.end();
  });
}
