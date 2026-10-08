# 2. Requisitos Não Funcionais (RNF)

[← Voltar ao README](../README.md)

Todos os requisitos abaixo são **mensuráveis** e possuem um método de verificação definido.

### Ambiente de referência para medições

| Item | Valor |
|---|---|
| **Dispositivo de referência** | Smartphone Android intermediário (4 GB RAM, CPU octa-core ~2.0 GHz — classe Moto G / Galaxy A) |
| **Navegador** | Chrome para Android, versão estável atual |
| **Rede** | Perfil "Slow 4G" do Lighthouse (≈ 1,6 Mbps, RTT 150 ms) |
| **Orçamento de referência** | 20 itens de serviço, perfil completo, observações com 500 caracteres |
| **Carga normal** | 1 usuário por dispositivo (aplicação local-first, sem servidor de aplicação) |

---

## 2.1 Desempenho

| ID | Requisito | Métrica / Meta | Verificação |
|---|---|---|---|
| **RNF01** | Geração do PDF | Do toque em "Gerar PDF" até a pré-visualização exibida: **≤ 2,0 s (p95)** para o orçamento de referência. | Teste E2E (Playwright) com `performance.now()`, 20 execuções no dispositivo de referência |
| **RNF02** | Recalcular o total | Atualização do total na tela após adicionar/editar/remover item: **≤ 100 ms**. | Teste de componente + React Profiler |
| **RNF03** | Carregamento inicial | Primeiro acesso em Slow 4G: **LCP ≤ 2,5 s**; acessos seguintes (cache do Service Worker): **≤ 1,0 s**. | Lighthouse CI (mobile) em cada pull request |
| **RNF04** | Tamanho do pacote | JavaScript inicial **≤ 250 KB gzip**; a biblioteca de PDF é carregada sob demanda (lazy) e não entra nesse limite. | `vite build` + `size-limit` no CI |
| **RNF05** | Responsividade de interação | **INP ≤ 200 ms** em todas as telas. | Lighthouse / Web Vitals |

## 2.2 Arquivo PDF

| ID | Requisito | Métrica / Meta | Verificação |
|---|---|---|---|
| **RNF06** | Tamanho do arquivo | PDF do orçamento de referência **≤ 500 KB**; limite absoluto de **3 MB** para qualquer orçamento válido (50 itens + logotipo). | Teste automatizado que gera os casos limite e verifica `blob.size` |
| **RNF07** | Qualidade e compatibilidade | Texto vetorial e selecionável (não imagem), formato A4, abre sem erros no Adobe Reader, visualizador do Chrome e pré-visualização do WhatsApp (Android e iOS). | Checklist de testes manuais por release |

## 2.3 Disponibilidade e Confiabilidade

| ID | Requisito | Métrica / Meta | Verificação |
|---|---|---|---|
| **RNF08** | Funcionamento offline | Após o primeiro acesso, **100 % das funcionalidades do MVP** (RF01–RF13) funcionam em modo avião. | Teste E2E com `context.setOffline(true)` |
| **RNF09** | Disponibilidade do site | Hospedagem estática com disponibilidade **≥ 99,9 %/mês** (SLA da CDN). | Monitor de uptime (ex.: UptimeRobot, verificação a cada 5 min) |
| **RNF10** | Persistência sem perda | Toda alteração é salva localmente em **≤ 1 s** (autosave com *debounce* de 500 ms); **0 perda de dados** ao fechar a aba ou o app após esse intervalo. | Teste E2E: editar → aguardar 1 s → recarregar página → validar dados |
| **RNF11** | Integridade dos cálculos | **100 %** dos casos da suíte de testes de cálculo (arredondamento, limites de RN04/RN08) passam; nenhuma divergência entre total da tela e total do PDF. | Testes unitários (Vitest) obrigatórios no CI |

## 2.4 Usabilidade e Acessibilidade

| ID | Requisito | Métrica / Meta | Verificação |
|---|---|---|---|
| **RNF12** | Mobile-first | Layout funcional de **360 px a 1440 px** de largura, **sem rolagem horizontal**. | Testes visuais Playwright em 360, 390, 768 e 1280 px |
| **RNF13** | Alvos de toque | Todos os botões e campos interativos com área mínima de **48 × 48 px** e espaçamento ≥ 8 px. | Auditoria Lighthouse "tap targets" + revisão de design |
| **RNF14** | Facilidade de uso | Um usuário novo conclui o fluxo completo (perfil + orçamento com 3 itens + PDF) em **≤ 5 min**; usuário recorrente (perfil salvo) em **≤ 3 min**. Taxa de sucesso **≥ 90 %** sem ajuda. | Teste de usabilidade com 5 prestadores de serviço reais |
| **RNF15** | Acessibilidade | Nota de acessibilidade Lighthouse **≥ 90**; contraste de texto **≥ 4,5:1** (WCAG 2.1 AA); todos os campos com `label` associado. | Lighthouse CI + axe-core nos testes E2E |
| **RNF16** | Teclado adequado | Campos numéricos e monetários abrem o teclado numérico (`inputmode="decimal"`), telefone abre teclado de telefone (`inputmode="tel"`). | Checklist manual em Android e iOS |
| **RNF17** | Idioma | 100 % dos textos da interface e do PDF em português do Brasil; datas no formato `DD/MM/AAAA`. | Revisão de conteúdo por release |

## 2.5 Segurança e Privacidade

| ID | Requisito | Métrica / Meta | Verificação |
|---|---|---|---|
| **RNF18** | Dados apenas no aparelho | **0 requisições** de rede contendo dados de profissional, cliente ou orçamento. A única comunicação é o download dos arquivos estáticos do app. | Teste E2E inspecionando requisições de rede + revisão de código |
| **RNF19** | Transporte seguro | 100 % do tráfego via **HTTPS (TLS 1.2+)** com HSTS habilitado. | Teste SSL Labs com nota **≥ A** |
| **RNF20** | Cabeçalhos de segurança | Content-Security-Policy restritiva (`default-src 'self'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. | Nota **≥ A** no securityheaders.com |
| **RNF21** | LGPD | Tela "Privacidade" informando que os dados ficam somente no aparelho; opção "Apagar todos os meus dados" que remove 100 % do armazenamento local em uma ação. | Teste E2E: apagar dados → IndexedDB vazio |
| **RNF22** | Dependências | **0 vulnerabilidades** de severidade alta ou crítica em dependências no momento do deploy. | `npm audit --audit-level=high` no CI |

## 2.6 Compatibilidade

| ID | Requisito | Métrica / Meta | Verificação |
|---|---|---|---|
| **RNF23** | Navegadores suportados | Chrome Android ≥ 110, Safari iOS ≥ 16, Samsung Internet ≥ 21, Chrome/Edge/Firefox desktop (2 últimas versões). | Matriz de testes E2E (Playwright: Chromium, WebKit, Firefox) |
| **RNF24** | Instalação | App instalável como PWA (critérios de instalabilidade do Chrome atendidos), com ícone e tela de abertura. | Lighthouse "PWA installable" |

## 2.7 Manutenibilidade

| ID | Requisito | Métrica / Meta | Verificação |
|---|---|---|---|
| **RNF25** | Cobertura de testes | Cobertura **≥ 90 %** nos módulos de domínio (cálculo, validação, numeração) e **≥ 70 %** no geral. | Relatório Vitest/Istanbul no CI |
| **RNF26** | Qualidade de código | TypeScript em modo `strict`, **0 erros** de ESLint e de `tsc` para merge na branch principal. | Pipeline de CI bloqueando merge |
| **RNF27** | Tempo de entrega | Pipeline de CI (lint + testes + build) **≤ 5 min**; deploy automático após merge na `main`. | Métricas do GitHub Actions / Vercel |
