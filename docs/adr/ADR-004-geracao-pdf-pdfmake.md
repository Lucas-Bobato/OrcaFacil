# ADR-004: Geração de PDF no cliente com pdfmake

| | |
|---|---|
| **Status** | ✅ Aprovado |
| **Data** | 08/10/2026 |
| **Requisitos relacionados** | RF10, RF11, RNF01, RNF04, RNF06, RNF07, RNF08 |

## Contexto

O PDF é o **produto final** do OrçaFácil — é o que o cliente recebe. Requisitos:

- gerar **no aparelho e offline** ([ADR-001](ADR-001-arquitetura-local-first-pwa.md));
- concluir em **≤ 2 s** em celular intermediário (RNF01);
- arquivo leve para envio pelo WhatsApp: **≤ 500 KB típico, ≤ 3 MB máximo** (RNF06);
- texto **vetorial e selecionável**, com tabela de itens que **quebra páginas** corretamente quando há muitos itens (até 50);
- layout consistente independentemente do tamanho da tela do celular.

## Decisão

Usar **pdfmake** (v0.2.x) para gerar o PDF a partir de uma definição declarativa (JSON) montada pela camada de Infraestrutura (`src/infra/pdf`):

- a biblioteca é **carregada sob demanda** (`import()` dinâmico) apenas ao tocar em "Gerar PDF", e fica no precache do Service Worker para uso offline;
- tabela de itens com cabeçalho repetido a cada página (`headerRows: 1`);
- fonte Roboto embutida em subconjunto (padrão do pdfmake) — sem dependência de fontes do sistema;
- o resultado é um `Blob` salvo no IndexedDB ([ADR-003](ADR-003-banco-de-dados-indexeddb-dexie.md)) e entregue por download ou Web Share API.

## Alternativas consideradas

| Alternativa | Prós | Motivo da rejeição |
|---|---|---|
| **jsPDF + html2canvas** (captura da tela) | Reaproveita o HTML da pré-visualização | Gera **imagem** (texto não selecionável), arquivos de 1–5 MB (risco a RNF06), resultado varia conforme a tela do aparelho, lento em celulares. |
| **jsPDF (API de desenho)** | Leve | Posicionamento manual por coordenadas; tabelas e quebras de página exigem plugin e muito código. |
| **@react-pdf/renderer** | Sintaxe React | Bundle maior (~500 KB+), geração mais lenta em dispositivos modestos. |
| **Geração no servidor (Puppeteer/Chromium headless)** | Fidelidade total ao HTML/CSS | Exige backend e internet — viola ADR-001; custo de servidor. |
| **`window.print()` → "Salvar como PDF"** | Zero dependências | Experiência inconsistente no mobile; usuário precisa navegar em diálogos do sistema; sem controle do nome do arquivo. |

## Consequências

### Vantagens
- ✅ PDF **vetorial**, nítido e leve (~50–150 KB para o orçamento de referência).
- ✅ Tabelas, quebra de página automática, cabeçalho/rodapé e numeração de páginas nativos.
- ✅ Layout **determinístico**: o mesmo PDF em qualquer aparelho.
- ✅ 100 % offline; nenhum dado sai do aparelho (RNF18).
- ✅ Definição declarativa fácil de testar (snapshot da `docDefinition`).

### Desvantagens (trade-offs assumidos)
- ⚠️ Bundle do pdfmake + fontes ≈ 400 KB gzip. *Mitigação:* carregamento sob demanda — fora do JS inicial (RNF04).
- ⚠️ O layout do PDF é escrito em uma DSL própria, **separado** do HTML da pré-visualização; mudanças visuais precisam ser feitas nos dois lugares. *Mitigação:* a pré-visualização renderiza o próprio PDF gerado (iframe/`<object>`), e não um HTML paralelo.
- ⚠️ Fontes personalizadas exigem gerar um *virtual file system* de fontes, aumentando o arquivo.
