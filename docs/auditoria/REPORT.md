# Relatório de auditoria de segurança — OrçaFácil (run-1)

## 1. Escopo e método

| Item | Valor |
|---|---|
| Perfil | `standard`, repositório inteiro |
| Orçamento | Não definido. 37 agentes: 4 de reconhecimento, 9 de caça, 4 críticos de cobertura, 10 de validação e 10 de verificação final |
| Revisão | Commit `2b304d1`, branch `feat/mvp-funcional`. A árvore tinha só `package-lock.json` alterado, sem mudança de versões |
| Execuções anteriores | Nenhuma: não existia ledger anterior |
| Execução | Só leitura de código e sandboxed-source-and-local-only. **Nenhum código do alvo foi executado nesta auditoria** |

**Limitação decisiva:** o host não tem sandbox imposto pelo sistema operacional (Windows Home, Docker desligado, WSL sem Node, `node_modules` só com binários Windows). Sem resultado observado dentro do limite da auditoria, a skill não permite `confirmed`. Por isso **nenhum registro tem veredito `confirmed` nem severidade**, e todos ficam como `needs_validation`. Isso não significa que sejam incertos do ponto de vista do código: os caminhos foram verificados de forma independente duas vezes.

**Desvios registrados em `run-metadata.json`:**
- Os validadores da skill recusam ler arquivos no Windows porque `O_NOFOLLOW` não existe. As funções de validação originais foram chamadas por um wrapper, sem alteração, depois de uma checagem com `lstat`.
- Os prompts foram entregues em arquivos `PROMPT.md` por agente, com os blocos literais.

**Fora da cobertura:** vulnerabilidades conhecidas nas dependências (`npm audit` contata o registro, proibido na auditoria; adiado) e TLS/HSTS em produção (não visível no código; unidade bloqueada).

## 2. Postura de segurança

A base está bem construída nas fronteiras mais importantes. Isolamento entre contas, SQL parametrizado, JWT e renderização no navegador não mostraram falhas. Os problemas estão em **controles ausentes**: limites de taxa e de volume, revogação de sessão, segredo padrão no código e proteções que dependem de uma configuração de hospedagem que não existe no repositório.

## 3. Achados confirmados

Nenhum nesta execução, pela limitação da seção 1.

## 4. NEEDS VALIDATION

Sem severidade, conforme a metodologia. Detalhes completos em `NEEDS-VALIDATION.md`.

| # | Título | Rastro no código | O que bloqueia | Próximo passo local |
|---|---|---|---|---|
| 1 | API aceita tokens assinados com segredo commitado se produção ou segredo real não estiverem configurados | `config.ts:15` → `authService.ts:50` | Sandbox; `NODE_ENV` e `JWT_SECRET` reais | Assinar token com o literal e chamar `/auth/me` |
| 2 | Login sem limite de tentativas | `routes.ts:23` → `authService.ts:40` | Sandbox; limite em proxy | 10 senhas erradas, nenhum 429 |
| 3 | Tokens continuam válidos após logout e não podem ser revogados | `AuthContext.tsx:28` → `authService.ts:50` | Sandbox | Reusar token após logout |
| 4 | Cadastro e login rodam bcryptjs no event loop sem limite | `routes.ts:20` → `authService.ts:31` | Sandbox; CPU e proxy | Medir latência de `/health` |
| 5 | Repetir `emitir` acumula PDFs sem limite agregado | `routes.ts:96` → `orcamentos.ts:259` | Sandbox; tamanho por emissão e disco | Emitir 3 vezes e contar linhas |
| 6 | Uma conta gratuita pode ocupar o event loop gerando PDFs | `routes.ts:96` → `gerarPdf.ts:205` | Sandbox; tempo por PDF e réplicas | Medir atraso do event loop |
| 7 | Listagens sem paginação e sem cota de linhas por conta | `routes.ts:44` → `clientes.ts:33` | Sandbox; CPU e heap | Medir com 1.000 a 10.000 linhas |
| 8 | Logout em uma aba mantém dados da conta anterior em outra, em condições restritas | `AuthContext.tsx:29` → `PdfPronto.tsx:40` | Sandbox; navegador real | Playwright com duas páginas |
| 9 | Página de exclusão irreversível sem proteção contra iframe | `App.tsx:45` → `routes.ts:30` | Sandbox; cabeçalhos reais; particionamento do navegador | Iframe local em origens cruzadas |
| 10 | Clientes anônimos descobrem se um e-mail tem conta | `routes.ts:20` → `authService.ts:27` | Sandbox; medir tempo do login | Comparar 409/201 e latência |

Verificação independente: os 10 passaram na Fase 3 e na Fase 5, sem nenhum refutado. A Fase 5 aplicou uma correção de redação, não material, no item 9.

## 5. Notas de hardening (não são achados)

- `orcamento.cliente_id` não tem chave composta com o dono; hoje os 4 caminhos de escrita são checados no serviço. Escritas por `id` no repositório também dependem da checagem prévia.
- Faltam testes de isolamento entre contas em `/clientes`, itens de outra conta e PDF de outra conta. A revisão não encontrou falha nesses caminhos.
- Respostas JSON privadas não têm `Cache-Control: no-store`, ao contrário do PDF.
- CSP desligada na API e inexistente na web, contra o RNF20. Google Fonts envia IP e user agent ao Google e impede `default-src 'self'`.
- `seed.ts` não bloqueia execução em produção; `.gitignore` não cobre `.env.*`, `*.pem`, `*.key`.
- Senha limitada a 72 caracteres, mas o bcrypt considera 72 bytes. `loginSchema` não tem tamanho máximo.
- `:id` da rota entra sem `encodeURIComponent` em `hooks.ts:58`; só afeta GET da própria conta hoje.
- Sem `secure_delete`, dados apagados podem persistir fisicamente no SQLite e no WAL.
- Divergências de RN10: editar cliente por `/clientes/:id` não volta orçamento emitido para rascunho; `emitir` lê antes e grava depois sem reconferir.
- Funcional, sem impacto de segurança: `VITE_API_URL` vazio (como em `.env.example`) produz `BASE_URL` `''`, porque `??` não trata string vazia.

## 6. Padrões positivos

- Tenant sempre derivado de `res.locals`, nunca do cliente, com 404 para recursos de outra conta.
- Schemas `.strict()` e allowlist de colunas impedem mass assignment.
- SQL sempre parametrizado; texto de usuário entra no pdfmake só como texto; nome do arquivo reduzido a `[A-Za-z0-9-]`.
- `jwt.verify` em todos os caminhos, conta consultada a cada requisição, hash nunca devolvido.
- Sem `dangerouslySetInnerHTML`, sem redirecionamentos dinâmicos, service worker sem cache de API, CORS por igualdade exata e sem credenciais.
- Lockfile com integridade e todas as fontes em `registry.npmjs.org`.

## 7. Cobertura

| Estado | Unidades |
|---|---|
| Cobertas | 20 |
| Com candidato | 10 |
| Bloqueadas | 1 (itens "Obvious things": CVEs e TLS/HSTS) |
| Adiadas | 1 (status de CVEs das dependências) |
| **Total** | **32** |

Três ondas de caça. Os críticos pediram novas unidades duas vezes (clickjacking, adivinhação de senha, cache privado, CPU de PDF). O crítico pós-onda 3 e o crítico final independente não aceitaram novos trabalhos. Isso não prova ausência de falhas: uma execução nunca esgota o alvo.

Exclusões principais, com o motivo no ledger: memória/binários, LLM, desktop/mobile/IPC, RPC/mensageria e nuvem/IaC, por não existirem no repositório; CSRF, porque a autenticação é bearer explícito, sem cookies.
