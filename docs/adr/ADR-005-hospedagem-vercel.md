# ADR-005: Hospedagem estática na Vercel

| | |
|---|---|
| **Status** | ✅ Aprovado |
| **Data** | 08/10/2026 |
| **Requisitos relacionados** | RNF03, RNF09, RNF19, RNF20, RNF27 |

## Contexto

Pelo [ADR-001](ADR-001-arquitetura-local-first-pwa.md), não há servidor de aplicação: o build do Vite gera apenas arquivos estáticos (`dist/`). A hospedagem precisa:

- servir os arquivos por **HTTPS** (obrigatório para Service Worker e Web Share API);
- ter **CDN global** e boa latência no Brasil (RNF03);
- permitir **cabeçalhos HTTP customizados** (CSP, HSTS — RNF20) e regra de *fallback* de SPA;
- integrar com o **GitHub** para deploy automático e *preview* por pull request (RNF27);
- custo **zero** na fase de MVP.

## Decisão

Hospedar o site estático na **Vercel (plano Hobby)**, conectada ao repositório GitHub:

- *build command* `npm run build`, *output* `dist/`;
- **deploy de produção** automático a cada merge na `main`;
- **Preview Deployments** a cada pull request (usados para Lighthouse CI e revisão);
- `vercel.json` com cabeçalhos de segurança, `Cache-Control: immutable` para arquivos com hash e `no-cache` para `index.html` e `sw.js` (garante que atualizações do app cheguem aos usuários);
- domínio inicial `orcafacil.vercel.app` (domínio próprio opcional no futuro).

## Alternativas consideradas

| Alternativa | Prós | Motivo da rejeição |
|---|---|---|
| **GitHub Pages** | Gratuito, no mesmo lugar do código | Não permite cabeçalhos HTTP customizados (CSP/HSTS — RNF20); sem *preview* por PR nativo. |
| **Netlify** | Muito similar à Vercel | Equivalente técnico; Vercel escolhida pela familiaridade da equipe e integração com Vite. Alternativa de saída imediata. |
| **Cloudflare Pages** | CDN excelente, banda ilimitada | Equivalente técnico; mantida como plano B. |
| **AWS S3 + CloudFront** | Controle total, escalável | Configuração e gestão de IAM/certificados desproporcionais para um MVP. |
| **VPS (ex.: Nginx em servidor próprio)** | Controle total | Custo mensal, manutenção de SO, certificados e disponibilidade por conta da equipe. |

## Consequências

### Vantagens
- ✅ HTTPS automático (Let's Encrypt), HTTP/2-3 e CDN global com PoPs no Brasil.
- ✅ Disponibilidade alta (meta ≥ 99,9 %, RNF09) sem operar infraestrutura.
- ✅ *Preview* por PR facilita revisão e testes automatizados antes do merge.
- ✅ Custo zero no MVP; *rollback* instantâneo para qualquer deploy anterior.

### Desvantagens (trade-offs assumidos)
- ⚠️ **Dependência de fornecedor** (*vendor lock-in*) leve. *Mitigação:* o artefato é HTML/JS estático puro; migrar para Netlify/Cloudflare Pages exige apenas reescrever o `vercel.json`.
- ⚠️ Plano Hobby tem limites de banda (100 GB/mês) e é destinado a uso não comercial; uma eventual comercialização exige migrar para o plano Pro (pago).
- ⚠️ Como os usuários dependem do cache do Service Worker, um deploy com erro pode ficar em cache. *Mitigação:* estratégia de atualização "nova versão disponível — recarregar" e testes E2E obrigatórios antes do deploy.
