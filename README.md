# OrçaFácil — Documentação Técnica do MVP

> **Seu trabalho merece um orçamento profissional.**
> Aplicação web mobile-first para que prestadores de serviço autônomos (pintores, pedreiros, eletricistas…) montem um orçamento, vejam o total calculado automaticamente e gerem um **PDF profissional** pronto para enviar pelo WhatsApp.

Este repositório transforma a ideia conceitual do MVP (ver [apresentação](docs/apresentacao/OrcaFacil-apresentacao.pptx)) em uma documentação técnica estruturada.

---

## 1. Contexto

| | |
|---|---|
| **Problema** | Orçamentos feitos em papel ou mensagens soltas no WhatsApp têm informações espalhadas e sem padrão, o que dificulta a compreensão do cliente e não transmite o cuidado do serviço. |
| **Público-alvo** | Profissionais que trabalham por conta própria e usam principalmente o celular. |
| **Proposta de valor** | Preencher dados → detalhar serviços → revisar → gerar e baixar o PDF, em poucos minutos e mesmo sem internet. |
| **Fluxo do MVP** | `01 Preencher` (profissional e cliente) → `02 Detalhar` (serviços e valores) → `03 Revisar` (total e condições) → `04 Gerar PDF` (baixar e enviar) |

### Escopo do MVP

| Dentro do escopo | Fora do escopo (versões futuras) |
|---|---|
| Perfil do profissional salvo no aparelho | Login/contas em nuvem e sincronização entre aparelhos |
| Dados do cliente | Assinatura digital e aceite online pelo cliente |
| Itens de serviço com quantidade e preço | Catálogo de materiais / tabela de preços |
| Total automático (não editável) | Cobrança, pagamentos e emissão de nota fiscal |
| Prazo, validade e condições de pagamento | Envio automático por e-mail/WhatsApp via API |
| Geração, download e compartilhamento do PDF | Relatórios e dashboard financeiro |
| Histórico local de orçamentos | |

---

## 2. Índice da documentação

| # | Documento | Conteúdo |
|---|---|---|
| 1 | [Requisitos Funcionais, Histórias de Usuário e Regras de Negócio](docs/01-requisitos-funcionais.md) | RF, US com critérios de aceite em BDD (Dado/Quando/Então) e RN |
| 2 | [Requisitos Não Funcionais](docs/02-requisitos-nao-funcionais.md) | RNF mensuráveis: desempenho, usabilidade, disponibilidade, segurança, manutenibilidade |
| 3 | [Prototipação de Interfaces](docs/03-prototipacao.md) | Fluxo de navegação e wireframes das telas mobile |
| 4 | [Arquitetura de Software](docs/04-arquitetura.md) + [ADRs](docs/adr/README.md) | Visão geral da arquitetura e Registros de Decisão de Arquitetura |
| 5 | [Modelagem de Dados (DER)](docs/05-modelagem-dados.md) | Diagrama Entidade-Relacionamento, dicionário de dados e esquema IndexedDB |

### Registros de Decisão de Arquitetura (ADRs)

| ADR | Título | Status |
|---|---|---|
| [ADR-001](docs/adr/ADR-001-arquitetura-local-first-pwa.md) | Arquitetura local-first (PWA) sem backend | Aprovado |
| [ADR-002](docs/adr/ADR-002-frontend-react-typescript-vite.md) | Frontend com React + TypeScript + Vite | Aprovado |
| [ADR-003](docs/adr/ADR-003-banco-de-dados-indexeddb-dexie.md) | Banco de dados local IndexedDB com Dexie.js | Aprovado |
| [ADR-004](docs/adr/ADR-004-geracao-pdf-pdfmake.md) | Geração de PDF no cliente com pdfmake | Aprovado |
| [ADR-005](docs/adr/ADR-005-hospedagem-vercel.md) | Hospedagem estática na Vercel | Aprovado |

---

## 3. Stack tecnológica (resumo)

| Camada | Tecnologia | Decisão |
|---|---|---|
| Interface | React 18 + TypeScript + Vite | ADR-002 |
| Estilo | Tailwind CSS (mobile-first) | ADR-002 |
| Offline / instalação | PWA (Service Worker via `vite-plugin-pwa`) | ADR-001 |
| Persistência | IndexedDB via Dexie.js | ADR-003 |
| Validação | Zod | ADR-002 |
| PDF | pdfmake (geração vetorial no navegador) | ADR-004 |
| Testes | Vitest + Testing Library + Playwright | ADR-002 |
| Hospedagem | Vercel (CDN estática, HTTPS) | ADR-005 |

---

## 4. Rastreabilidade (visão rápida)

| Etapa do fluxo | Requisitos | Histórias | Regras |
|---|---|---|---|
| Configurar perfil | RF01 | US01 | RN11 |
| 01 Preencher | RF02, RF03 | US02 | RN01, RN13 |
| 02 Detalhar | RF04, RF05, RF06 | US03, US04 | RN02, RN03, RN04, RN08, RN09 |
| 03 Revisar | RF07, RF08, RF09 | US05 | RN05, RN06 |
| 04 Gerar PDF | RF10, RF11 | US06, US07 | RN01, RN07, RN10, RN12 |
| Histórico | RF12, RF13 | US08 | RN10 |

---

## 5. Estrutura do repositório

```
.
├── README.md
├── Requisitos.txt                      # levantamento inicial (versão original)
└── docs/
    ├── 01-requisitos-funcionais.md
    ├── 02-requisitos-nao-funcionais.md
    ├── 03-prototipacao.md
    ├── 04-arquitetura.md
    ├── 05-modelagem-dados.md
    ├── adr/
    │   ├── README.md
    │   ├── ADR-001-arquitetura-local-first-pwa.md
    │   ├── ADR-002-frontend-react-typescript-vite.md
    │   ├── ADR-003-banco-de-dados-indexeddb-dexie.md
    │   ├── ADR-004-geracao-pdf-pdfmake.md
    │   └── ADR-005-hospedagem-vercel.md
    └── apresentacao/
        └── OrcaFacil-apresentacao.pptx
```

> Os diagramas usam [Mermaid](https://mermaid.js.org/), renderizado nativamente pelo GitHub.
