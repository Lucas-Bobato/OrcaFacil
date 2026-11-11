# Relatório OWASP Top 10 – OrcaFacil

11/11/2026 · Jandir

## Resumo executivo

O PR #1 do OrçaFácil corrige 8 das 12 vulnerabilidades levantadas na auditoria de segurança, reduz 3 e deixa 1 em aberto; a maior parte das correções cai em **A07 (Autenticação)**, **A04 (Design inseguro)** e **A06 (Componentes vulneráveis)** do OWASP Top 10 (2021).

- **Escopo:** PR #1 "MVP funcional + auditoria de segurança e correções", aberto por Lucas Bobato em 10/11/2026 (branch `feat/mvp-funcional`, **ainda aberto**, não mergeado). O relatório compara o antes (commit `2b304d1`, o MVP auditado) com o depois (commit `5451e33`, as correções subidas ontem).
- **Resultado:** 12 achados (10 da auditoria + 2 alertas do `npm audit`): 8 corrigidos, 3 reduzidos com risco restante (S4, S6, S10) e 1 não corrigido (S12, `zod` 3).
- **Testes:** 188 testes unitários/API/interface e 7 E2E passam. Os testes novos foram rodados antes contra o código sem correção: 22 de 25 falharam na API e 9 de 11 na interface.
- **Aviso de leitura:** o repositório **não classifica nada pelo OWASP Top 10**. A coluna de categoria neste relatório é um mapeamento meu, feito a partir dos achados. As prioridades (Alta/Média/Baixa) também são estimativas do autor, não severidade formal.

## Metodologia

A análise parte dos documentos que o próprio PR publicou, não de uma nova auditoria de código.

1. Lida a descrição do PR #1 (104 arquivos, 20.660 linhas adicionadas, 218 removidas, contando o MVP inteiro) e o diff entre `2b304d1` e `5451e33`, que isola as correções de segurança (44 arquivos).
2. Lidos `docs/08-seguranca.md` (vulnerabilidades e correções), `docs/auditoria/REPORT.md` e o início de `docs/auditoria/NEEDS-VALIDATION.md`, na branch `feat/mvp-funcional`.
3. Foram mapeados cada achado (S1 a S12) para a categoria OWASP Top 10 (2021) mais próxima. Quando um achado toca duas categorias, indico a principal e a secundária.

## Antes e depois por categoria OWASP Top 10 (2021)

"Antes" é o commit `2b304d1` (MVP de 16/10/2026) e "Depois" é o commit `5451e33` (correções subidas em 10/11/2026), comparados no diff entre os dois (44 arquivos). As correções se concentram em três categorias; A01 e A03 não tiveram falha e A09 e A10 não foram tratadas.

| Categoria | ID | Antes (`2b304d1`) | Depois (`5451e33`) | Situação |
| --- | --- | --- | --- | --- |
| A07 Falhas de identificação e autenticação | S1 | `config.ts` usava o literal `segredo-de-desenvolvimento-troque-em-producao` sem `JWT_SECRET`; em produção bastava qualquer valor não vazio, até o do `.env.example` (também A05) | Fora de produção sem segredo, gera 32 bytes aleatórios por processo; em produção exige 32+ caracteres e recusa os 2 valores públicos; `jwt.verify` só aceita HS256 e exige `exp` | Corrigida |
| A07 | S3 | `POST /auth/login` sem nenhum limitador de tentativas | Novo `limites.ts`: 10 falhas/15 min por conta+IP e 50 por conta em todos os IPs; resposta 429 com `Retry-After`; mesmo controle em `/auth/senha` e `DELETE /conta` | Corrigida |
| A07 | S2 | Token JWT só com `sub`; logout limpava só o navegador e o token valia até 7 dias | Token leva `v`; coluna `usuario.token_versao` (migração `002_seguranca.sql`) conferida a cada requisição; novos `POST /auth/logout` e `POST /auth/senha` incrementam a versão | Corrigida |
| A07 | S8 | Logout ou troca de conta limpava só a aba atual | `AuthContext.tsx` ouve o evento `storage` e limpa cache e telas; 401 `NAO_AUTENTICADO` encerra a sessão | Corrigida |
| A07 | S10 | Login respondia 401 antes do bcrypt quando o e-mail não existia, o que denunciava contas | `entrar` compara com `HASH_FICTICIO` quando o e-mail não existe, igualando o trabalho; o cadastro ainda responde 409 | Reduzida |
| A05 Configuração incorreta de segurança | S9 | `DELETE /conta` sem senha; sem `vercel.json`, portanto sem CSP, `X-Frame-Options` nem HSTS | `DELETE /conta` exige senha (403 `SENHA_INCORRETA`); novo `vercel.json` com CSP (`frame-ancestors 'none'`), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` e HSTS de 1 ano; `Dialogo.tsx` tira o foco inicial da ação destrutiva | Corrigida |
| A04 Design inseguro | S7 | Nenhuma contagem de clientes ou orçamentos por conta | `contarDaConta` nos repositórios; cota de 5.000 clientes e 5.000 orçamentos (422 `LIMITE_CONTA`), também em `duplicar` e `PUT /orcamentos/:id/cliente` | Corrigida (sem paginação) |
| A04 | S5 | Cada `emitir` inseria uma linha nova em `documento_pdf`, sem limite | `excluirDoOrcamento` roda antes do insert; 200 MB de PDFs por conta (`bytesDaConta`); migração `002` apaga os antigos com `ROW_NUMBER()` | Corrigida |
| A04 | S4 | Cadastro e login rodavam bcrypt sem limite de taxa ou de concorrência | 100 requisições de autenticação/15 min e 10 cadastros/hora por IP; máximo de 8 hashes simultâneos (503 acima) | Reduzida |
| A04 | S6 | `emitir` sem limite de frequência ou de simultaneidade | 30 emissões/min por conta e máximo de 4 simultâneas | Reduzida |
| A06 Componentes vulneráveis e desatualizados | S11 | `body-parser` 2.3.0 (GHSA-27r3-jxmh-p828); `express.json({ limit: '100kb' })` | `body-parser` 2.4.0; `express.json({ limit: '100kb', inflate: false })` recusa corpo comprimido com 415 | Corrigida |
| A06 | S12 | `zod` 3 (GHSA-mrhx-c7xc-m3w5) | Sem mudança: exige migrar para zod 4 e trocar `@hookform/resolvers` | **Aberta** |

### Endurecimento adicional (sem ID próprio)

- **A05:** `db:seed` bloqueado em produção; `.gitignore` cobre `.env.*`, `*.pem`, `*.key` e `*.sqlite`; erros 4xx do Express deixam de virar 500.
- **A02 Falhas criptográficas:** `Cache-Control: no-store` em toda a API; `secure_delete` e checkpoint do WAL ao apagar a conta; senha limitada a 72 bytes (limite do bcrypt) e tamanho máximo no login.
- **A03 Injeção:** id da rota passa por `encodeURIComponent` em `useOrcamento`.

### Categorias sem falha ou fora do escopo

- **A01 Controle de acesso:** sem falha. O tenant vem sempre de `res.locals`, e recurso de outra conta responde 404. Foi adicionado um teste de isolamento entre contas (clientes, itens, emissão, duplicação, PDF), que **já passava no código antigo**.
- **A03 Injeção:** sem falha. SQL sempre parametrizado, schemas `.strict()` com lista de colunas permitidas, sem `dangerouslySetInnerHTML`, texto do usuário entra no pdfmake só como texto.
- **A08 Falhas de integridade de software e dados:** sem achado. O lockfile tem integridade e todas as fontes estão em `registry.npmjs.org`.
- **A09 Falhas de registro e monitoramento:** não encontrei menção nos documentos do PR; não foi avaliada.
- **A10 SSRF:** não tratada nos documentos. A auditoria só registra que não há redirecionamentos dinâmicos; não verifiquei se a API busca URLs informadas pelo usuário.

## Lacunas e recomendações

O risco que mais pesa hoje é o `zod` 3 aberto, que mantém o requisito RNF22 sem atender: `npm audit --omit=dev` ainda aponta 1 vulnerabilidade alta. O restante está em reduzir riscos já mitigados.

1. **Decidir sobre o `zod` (A06/S12).** Migrar para zod 4 e `@hookform/resolvers` fecha o RNF22; a própria auditoria diz que a falha não é alcançável hoje, pois nenhum schema usa `z.array` e o corpo é limitado a 100 KB.
2. **Validar em deploy real (A05).** CSP e cabeçalhos do `vercel.json` foram testados só com `vite preview`; TLS/HSTS (RNF19) não têm como ser verificados no repositório.
3. **Restringir mais a CSP (A05).** A CSP está desligada na API, o Google Fonts impede `default-src 'self'` e `connect-src https:` é amplo. Hospedar as fontes localmente e fixar a origem da API permitiriam fechar isso.
4. **Tirar bcrypt e PDF da thread principal (A04/S4, S6).** Os limites reduzem o risco, mas workers seriam a próxima etapa. O autor não mediu a degradação de latência nem o tempo de bloqueio por PDF.
5. **Cadastro ainda revela e-mail existente (A07/S10).** Resolver exige confirmação por e-mail, que o sistema não tem.
6. **Token em `localStorage` (A07).** Sem XSS encontrado e com CSP, mas um XSS futuro leria o token.
7. **Limites em memória (A04).** Zeram ao reiniciar e só servem a um processo único; além disso, quem sabe o e-mail de alguém pode bloquear o login dessa conta por até 15 min.
8. **Avaliar A09 (registro e monitoramento).** Não há menção nos documentos; vale registrar tentativas de login falhas e bloqueios por limite.

**Pontos de atenção para quem for fazer o merge:** a migração `002` apaga PDFs antigos (mantém o mais recente por orçamento); todos os usuários precisam entrar de novo; excluir a conta exige senha; `JWT_SECRET` fraco impede a API de subir em produção; atrás de proxy é preciso definir `TRUST_PROXY`, senão todos os clientes dividem os mesmos limites.

### Fontes

- [PR #1: MVP funcional + auditoria de segurança e correções](https://github.com/Lucas-Bobato/OrcaFacil/pull/1)
- [docs/08-seguranca.md](https://github.com/Lucas-Bobato/OrcaFacil/blob/feat/mvp-funcional/docs/08-seguranca.md)
- [docs/auditoria/REPORT.md](https://github.com/Lucas-Bobato/OrcaFacil/blob/feat/mvp-funcional/docs/auditoria/REPORT.md)
- [docs/auditoria/NEEDS-VALIDATION.md](https://github.com/Lucas-Bobato/OrcaFacil/blob/feat/mvp-funcional/docs/auditoria/NEEDS-VALIDATION.md)
- [docs/02-requisitos-nao-funcionais.md](https://github.com/Lucas-Bobato/OrcaFacil/blob/main/docs/02-requisitos-nao-funcionais.md) (RNF19 a RNF22)
