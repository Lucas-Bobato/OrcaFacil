# 8. Segurança: relatório de vulnerabilidades e correções

[← Voltar ao README](../README.md)

Auditoria do MVP no commit `2b304d1` (branch `feat/mvp-funcional`), com a skill [`security-audit` da Cloudflare](https://github.com/cloudflare/security-audit-skill), seguida das correções descritas aqui.

## 8.1 Resumo

| | |
|---|---|
| Vulnerabilidades encontradas | 12: 10 na auditoria e 2 alertas do `npm audit` |
| Corrigidas | 8 |
| Reduzidas, com risco restante | 3 (S4, S6, S10) |
| Não corrigida, por decisão pendente | 1 (S12, `zod`) |
| Sem falha encontrada | Isolamento entre contas, SQL, JWT, XSS, cabeçalho do PDF, redirecionamentos |
| Testes depois das correções | 188 unitários/API/interface e 7 E2E aprovados |

## 8.2 Como a auditoria foi feita

A skill define seis fases: reconhecimento, caça em ondas, validação independente, saída estruturada, verificação final e relatório. Foram 37 agentes (4 de reconhecimento, 9 de caça, 4 críticos de cobertura, 10 de validação e 10 de verificação final), cobrindo 32 unidades da superfície do sistema em três ondas. O crítico final independente não encontrou novas lacunas.

**Limitação que afeta como ler os resultados.** A skill só permite classificar um achado como `confirmed`, com severidade, se ele for reproduzido em um sandbox imposto pelo sistema operacional, e esta máquina não tem um (Windows Home, Docker desligado, WSL sem Node, `node_modules` só com binários Windows). Por isso, **na auditoria formal todos os achados têm veredito `needs_validation`, sem severidade**.

A evidência dinâmica veio depois, na etapa de correção e fora do limite da skill: testes de regressão com dados fictícios, banco em memória, rodando na máquina de desenvolvimento. Cada teste foi executado primeiro contra o código sem correção.

As **prioridades da tabela abaixo são uma estimativa minha para ordenar o trabalho, não a severidade formal da metodologia**.

**Desvios da skill:** os validadores dela recusam ler arquivos no Windows (`O_NOFOLLOW` não existe), então suas funções foram chamadas sem alteração por meio de um wrapper. Os relatórios originais gerados pela skill estão em [`auditoria/REPORT.md`](auditoria/REPORT.md) (resumo da auditoria) e [`auditoria/NEEDS-VALIDATION.md`](auditoria/NEEDS-VALIDATION.md) (cada achado com evidência no código e plano de validação, em inglês). Eles descrevem o código **antes** das correções, no commit `2b304d1`; os números de linha citados se referem a essa versão.

## 8.3 Vulnerabilidades e correções

| ID | Vulnerabilidade | Prioridade (estimada) | Situação |
|---|---|---|---|
| S1 | Segredo JWT padrão commitado no código | Alta | Corrigida |
| S3 | Login sem limite de tentativas | Alta | Corrigida |
| S2 | Token continua válido após logout, sem como revogar | Média | Corrigida |
| S9 | Exclusão de conta sem proteção contra iframe e sem senha | Média | Corrigida |
| S4 | bcrypt sem limite no processo único da API | Média | Reduzida |
| S5 | PDFs acumulam sem limite no banco | Média | Corrigida |
| S6 | Geração de PDF sem limite no processo único | Média | Reduzida |
| S7 | Sem cota de linhas por conta | Média | Corrigida |
| S11 | `body-parser` 2.3.0 (GHSA-27r3-jxmh-p828) | Média | Corrigida |
| S8 | Dados da conta anterior em outra aba | Baixa | Corrigida |
| S10 | Descoberta de contas por e-mail | Baixa | Reduzida |
| S12 | `zod` 3 (GHSA-mrhx-c7xc-m3w5) | Baixa neste projeto | **Não corrigida** |

### S1. Segredo JWT padrão commitado

- **Problema:** sem `NODE_ENV=production`, a API assinava tokens com um valor fixo no código, e `npm start` não define essa variável. Em produção, o valor de exemplo do `.env.example` passava na validação. Quem conhece o segredo forja tokens, mas precisa saber o UUID da vítima.
- **Correção (`apps/api/src/config.ts`, `authService.ts`):** o valor fixo saiu. Fora de produção, sem segredo, a API gera um aleatório por processo. Em produção, exige pelo menos 32 caracteres e recusa os valores públicos. `jwt.verify` agora aceita só HS256 e exige `exp`.
- **Evidência antes:** `config.jwtSecret` devolvia o valor commitado; `troque-este-segredo` era aceito; token sem `exp` e token HS384 recebiam 200.

### S2. Tokens não podiam ser revogados

- **Problema:** logout só limpava o navegador; um token copiado valia por até 7 dias, e não havia como trocar a senha.
- **Correção:** coluna `usuario.token_versao` (migração `002_seguranca.sql`), conferida a cada requisição. `POST /auth/logout` e o novo `POST /auth/senha` aumentam a versão. A tela Privacidade ganhou o formulário de troca de senha.
- **Evidência antes:** não existia rota para revogar; o token seguia válido.

### S3. Login sem limite de tentativas

- **Problema:** tentativas ilimitadas e senhas fracas aceitas; um acerto dá acesso a dados pessoais de clientes.
- **Correção (`apps/api/src/middleware/limites.ts`):** 10 falhas a cada 15 min por conta + IP, 50 por conta somando todos os IPs, resposta `429` com `Retry-After`. O mesmo limite vale para a senha em `/auth/senha` e `/conta`.
- **Evidência antes:** depois das falhas, a resposta seguia 200/401, nunca 429.

### S4. Custo de bcrypt antes da autenticação

- **Problema:** cada cadastro ou login consome CPU no único processo que atende todas as contas.
- **Correção:** 100 requisições de autenticação a cada 15 min e 10 cadastros por hora, por IP; no máximo 8 operações simultâneas (`503` acima disso).
- **Risco restante:** o bcrypt continua na thread principal, e um atacante com muitos IPs ainda consome CPU.
- **Evidência antes:** cadastros e logins além do limite seguiam 201/401. **A degradação de latência não foi medida.**

### S5. PDFs acumulavam sem limite

- **Problema:** repetir `emitir` inseria uma linha por chamada, sem limite, e nenhuma rota lia as antigas.
- **Correção:** o novo PDF substitui o anterior na mesma transação; 200 MB de PDFs por conta. A migração `002` apaga os antigos já existentes.
- **Evidência antes:** 3 emissões geravam 3 linhas (`expected 3 to be 1`).

### S6. Geração de PDF sem limite

- **Problema:** uma conta gratuita podia repetir a renderização, que ocupa o processo compartilhado.
- **Correção:** 30 emissões por minuto por conta e no máximo 4 simultâneas.
- **Risco restante:** o pdfmake continua na thread principal. Isolar em um worker reduziria mais, mas é mudança maior. **O tempo de bloqueio por PDF não foi medido.**

### S7. Sem cota de linhas por conta

- **Problema:** clientes e orçamentos sem limite, em listagens sem paginação e síncronas.
- **Correção:** cota de 5.000 clientes e 5.000 orçamentos por conta, incluindo `duplicar` e `PUT /orcamentos/:id/cliente` (`422 LIMITE_CONTA`). A cota limita o tamanho das listagens; **não foi adicionada paginação**.

### S8. Dados em outra aba após logout

- **Problema:** logout ou troca de conta limpava só a aba atual. Em outra aba, dados e formulários da conta anterior podiam continuar visíveis, e um "Salvar" podia gravá-los na nova conta.
- **Correção (`AuthContext.tsx`, `client.ts`):** evento `storage` limpa o cache e remonta as telas; `401 NAO_AUTENTICADO` também encerra a sessão.
- **Evidência:** o teste com evento simulado falha no código antigo. O E2E com duas abas reais passa no código novo.

### S9. Exclusão de conta sem proteção contra iframe

- **Problema:** o repositório não define proteção contra iframe, e a exclusão irreversível exigia só dois cliques, com o botão destrutivo focado.
- **Correção:** `DELETE /conta` exige a senha; `apps/web/vercel.json` define `frame-ancestors 'none'` e `X-Frame-Options: DENY`; a aplicação não abre dentro de iframe, mesmo em hospedagem sem esses cabeçalhos; o foco inicial nunca fica na ação destrutiva.
- **Limite do que foi verificado:** não testei se o ataque funcionava de fato no código antigo; navegadores modernos isolam o `localStorage` de iframes de outros sites, o que pode já impedi-lo. A CSP foi validada localmente com `vite preview` (0 violações no Chromium), **não em um deploy real na Vercel**.

### S10. Descoberta de contas por e-mail

- **Correção:** o login compara com um hash fictício quando o e-mail não existe, igualando o trabalho nos dois casos. Os limites de S3 e S4 dificultam a consulta em massa.
- **Risco restante:** o cadastro ainda responde `409 EMAIL_EM_USO`. Remover isso exige confirmar o e-mail por mensagem, e o sistema não envia e-mails. **A diferença de tempo não foi medida**; o teste confere que a comparação acontece.

### S11. `body-parser` 2.3.0

- **Alerta:** segundo o GHSA-27r3-jxmh-p828, uma requisição anônima comprimida com bytes extras pode derrubar o processo.
- **Correção:** atualizado para 2.4.0; `express.json({ inflate: false })` recusa corpo comprimido com `415`. A interface nunca envia corpo comprimido.
- **Limite do que foi verificado:** **não consegui reproduzir a queda em duas tentativas** com a versão 2.3.0 (o servidor respondeu 400 e continuou no ar). Isso não prova que seja impossível. Corrigi porque o custo é mínimo.

### S12. `zod` 3: não corrigida

- **Alerta:** consumo de memória ao validar arrays grandes em `z.array` sem limite de tamanho.
- **Por que não é alcançável aqui:** nenhum schema do projeto usa `z.array`, e o corpo é limitado a 100 KB.
- **Por que continua:** não há correção para a versão 3. Exige migrar para o zod 4 e trocar o `@hookform/resolvers`, afetando todos os schemas e mensagens.
- **Consequência:** o **RNF22 não está atendido**: `npm audit --omit=dev` ainda aponta 1 vulnerabilidade alta. Na árvore completa são 7 (1 alta, 4 moderadas e 2 baixas); as demais estão em dependências de desenvolvimento.

### Endurecimento adicional

`Cache-Control: no-store` em toda a API; senha limitada a 72 bytes; tamanho máximo no login; `secure_delete` e checkpoint do WAL ao apagar conta; `db:seed` bloqueado em produção; `.gitignore` cobre `.env.*`, `*.pem`, `*.key` e `*.sqlite`; id da rota codificado em `useOrcamento`; erros 4xx do Express não viram mais 500. O teste de isolamento entre contas (clientes, itens, emissão, duplicação, PDF) foi adicionado e **já passava no código antigo**, confirmando a auditoria.

## 8.4 Mudanças de comportamento

- **Migração `002` apaga PDFs antigos** de cada orçamento na próxima vez que a API iniciar, mantendo só o mais recente, inclusive no banco local. Isso interpreta a RN10 ("mantido até que um novo seja gerado"); o DER antes modelava vários PDFs por orçamento.
- **Todos precisam entrar de novo** depois da atualização: tokens antigos não têm a versão.
- **"Sair da conta" encerra a sessão em todos os aparelhos.**
- **Apagar a conta exige a senha**, também na API.
- **`JWT_SECRET` fraco impede a API de iniciar em produção.**
- **Atrás de um proxy, defina `TRUST_PROXY`.** Sem isso, todos os clientes parecem ter o mesmo IP e dividem os limites.
- Fora de produção, sem `JWT_SECRET`, as sessões terminam quando a API reinicia.

## 8.5 O que permanece em aberto

| Item | Motivo |
|---|---|
| `zod` 3 (S12) | Decisão pendente |
| bcrypt e PDF na thread principal (S4, S6) | Limites reduzem o risco; workers seriam a próxima etapa |
| Cadastro revela e-mail existente (S10) | Exige confirmação por e-mail |
| Limites em memória | Zeram ao reiniciar; suficientes para um único processo com SQLite |
| Bloqueio temporário por terceiros | Quem souber o e-mail pode bloquear o login da conta por até 15 min, com 50 falhas |
| Token em `localStorage` | Sem XSS encontrado, e a CSP reduz o risco, mas um XSS futuro leria o token |
| CSP desligada na API; Google Fonts; `connect-src https:` amplo | Hospedar as fontes localmente e fixar a origem da API permitiriam restringir mais |
| Chave estrangeira composta em `orcamento.cliente_id` | Defesa extra; hoje o serviço garante o isolamento |
| Divergências da RN10 (editar cliente por `/clientes/:id`; `emitir` não reconfere após gerar o PDF) | Afetam só a própria conta |
| TLS/HSTS e cabeçalhos em produção | Não há deploy no repositório para verificar |

## 8.6 Como verificar

```bash
npm test                      # 188 testes, incluindo apps/api/tests/seguranca.test.ts e limites.test.ts
npm run test:e2e              # 7 testes em Chromium
npm audit --omit=dev          # deve listar apenas o zod
```

Rodadas contra o código sem correção: na API, **22 de 25** testes falharam, e passaram os de isolamento, de zerar falhas após login correto e de cota entre contas. Na interface, **9 de 11** falharam.
