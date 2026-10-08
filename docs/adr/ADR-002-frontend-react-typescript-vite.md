# ADR-002: Frontend com React + TypeScript + Vite

| | |
|---|---|
| **Status** | ✅ Aprovado |
| **Data** | 08/10/2026 |
| **Requisitos relacionados** | RNF02, RNF03, RNF04, RNF05, RNF12, RNF15, RNF25, RNF26 |

## Contexto

Como toda a lógica roda no cliente ([ADR-001](ADR-001-arquitetura-local-first-pwa.md)), a escolha do framework frontend define a produtividade da equipe e a qualidade do produto. O app é composto por formulários com validação, máscara monetária, uma lista dinâmica de itens com recálculo instantâneo do total e um fluxo em etapas. Os requisitos exigem:

- carregamento rápido em celulares intermediários (LCP ≤ 2,5 s, JS inicial ≤ 250 KB gzip);
- suporte de primeira classe a PWA/Service Worker;
- **segurança nos cálculos monetários** (tipos fortes evitam misturar reais e centavos);
- ecossistema maduro e familiar para a equipe acadêmica, com boa documentação.

## Decisão

Utilizar:

| Ferramenta | Papel |
|---|---|
| **React 18** | Biblioteca de UI baseada em componentes |
| **TypeScript (modo `strict`)** | Tipagem estática, incluindo tipo `Centavos` para valores monetários |
| **Vite** | Build e servidor de desenvolvimento; `vite-plugin-pwa` para o Service Worker |
| **Tailwind CSS** | Estilização utilitária mobile-first |
| **React Hook Form + Zod** | Formulários performáticos e validação declarativa das regras de negócio |
| **Zustand** | Estado leve do rascunho em edição |
| **Vitest + Testing Library + Playwright** | Testes unitários, de componentes e E2E |

## Alternativas consideradas

| Alternativa | Prós | Motivo da rejeição |
|---|---|---|
| **Next.js** | SSR, roteamento pronto | Recursos de servidor (SSR/API routes) não são usados numa PWA sem backend; mais complexidade de configuração offline. |
| **Vue 3 / Nuxt** | Curva de aprendizado suave | Menor familiaridade da equipe; ecossistema de bibliotecas de PDF/formulários menos amplo. |
| **Angular** | Estrutura completa | Bundle inicial maior e verbosidade excessiva para um MVP pequeno. |
| **Svelte/SvelteKit** | Bundle muito pequeno | Ecossistema e base de conhecimento da equipe menores. |
| **HTML + JS puro** | Zero dependências | Baixa produtividade e manutenibilidade para formulários dinâmicos e testes. |

## Consequências

### Vantagens
- ✅ Maior ecossistema de bibliotecas e exemplos; fácil encontrar soluções e contratar.
- ✅ TypeScript reduz erros de cálculo e de contrato entre camadas (RNF11, RNF26).
- ✅ Vite oferece build rápido, *code splitting* nativo (pdfmake carregado sob demanda — RNF04) e integração PWA madura.
- ✅ Componentes reutilizáveis (campo monetário, lista de itens) facilitam testes e manutenção.

### Desvantagens (trade-offs assumidos)
- ⚠️ React + bibliotecas adicionam ~45 KB gzip ao bundle (maior que Svelte/JS puro). Aceitável dentro do limite de 250 KB.
- ⚠️ SPA renderizada no cliente: o primeiro acesso depende de baixar e executar JS. *Mitigação:* precache do Service Worker deixa acessos seguintes ≤ 1 s.
- ⚠️ Mais decisões de bibliotecas a tomar (estado, formulários, rotas), pois React não é um framework completo.
