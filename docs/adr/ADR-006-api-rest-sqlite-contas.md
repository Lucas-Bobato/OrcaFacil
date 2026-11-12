# ADR-006: API REST com SQLite e contas de usuário

| | |
|---|---|
| **Status** | ✅ Aprovado |
| **Data** | 16/10/2026 |
| **Substitui** | [ADR-001](ADR-001-arquitetura-local-first-pwa.md) (local-first sem backend) e [ADR-003](ADR-003-banco-de-dados-indexeddb-dexie.md) (IndexedDB) · **Altera** [ADR-004](ADR-004-geracao-pdf-pdfmake.md) (PDF passa a ser gerado no servidor) |
| **Requisitos relacionados** | RF01–RF13, RNF08, RNF10, RNF18, RNF21 · [Modelagem de dados](../05-modelagem-dados.md) · [API](../06-api.md) |

## Contexto

Na implementação do MVP, os usuários precisam **acessar os mesmos orçamentos em mais de um navegador/aparelho** (ex.: montar no celular na obra e reenviar pelo computador). Com o modelo local-first do ADR-001, os dados ficavam presos ao navegador em que foram criados e eram perdidos ao limpar o navegador ou trocar de celular — riscos já listados como desvantagens do ADR-001.

Além disso, a etapa de desenvolvimento exige um backend com API documentada, regras de negócio no servidor e um banco de dados que implemente o DER (PKs, FKs, restrições e índices).

## Decisão

1. **Contas de usuário** (e-mail + senha, hash bcrypt) com autenticação **JWT** (`Authorization: Bearer`). Cada conta tem um perfil profissional (1:1).
2. **API REST** em **Node.js 22 + Express 5 + TypeScript** (`apps/api`), com as regras de negócio em serviços e validação de entrada com os mesmos schemas **Zod** da interface (`packages/shared`).
3. **SQLite** (via `better-sqlite3`) como banco: um arquivo, sem instalação, com chaves estrangeiras, `CHECK`, `UNIQUE`, índices e *trigger*. Migrações versionadas em SQL.
4. **PDF gerado no servidor** com **pdfmake** (mesma biblioteca do ADR-004) e guardado como *snapshot* imutável (`documento_pdf`). Assim o mesmo arquivo pode ser baixado de qualquer aparelho.
5. A interface continua sendo uma **PWA** React (`apps/web`): a "casca" fica em cache e pode ser instalada, mas **os dados vêm sempre da API**.
6. Monorepo com **npm workspaces**: `packages/shared` (domínio puro, testado à parte), `apps/api`, `apps/web`.

## Alternativas consideradas

| Alternativa | Motivo da rejeição |
|---|---|
| Manter local-first (ADR-001) | Não permite usar os dados em outro navegador/aparelho. |
| Local-first + sincronização (IndexedDB ↔ API) | Resolve offline e multiaparelho, mas exige resolução de conflitos — complexidade alta para o MVP. Fica como evolução. |
| PostgreSQL | Mais robusto para produção, mas exige Docker/serviço externo para rodar e testar. O SQL foi escrito de forma portável para facilitar a migração. |
| Backend-as-a-Service (Firebase/Supabase) | Menos código, porém as regras de negócio ficariam espalhadas e o projeto dependeria de serviço externo para rodar localmente. |

## Consequências

### Vantagens
- ✅ Mesmos dados em qualquer navegador/aparelho após o login.
- ✅ Regras de negócio validadas no servidor (o cliente não consegue burlar RN01, RN02, RN07…).
- ✅ Integridade garantida pelo banco (FKs, CHECKs, numeração com *trigger*).
- ✅ Zero instalação: `npm install` e o SQLite é criado sozinho.

### Desvantagens (trade-offs assumidos)
- ⚠️ **Exige conexão** para salvar e gerar o PDF — revisa o **RNF08** (offline). *Mitigação futura:* fila local com sincronização.
- ⚠️ Os dados agora ficam no servidor — revisa o **RNF18**. A tela Privacidade foi atualizada e o **RNF21** ("Apagar todos os meus dados") apaga a conta e tudo em cascata.
- ⚠️ É preciso hospedar um processo Node com disco persistente (a Vercel do ADR-005 continua servindo a interface estática; a API vai para um serviço como Render/Railway/Fly.io).
- ⚠️ SQLite atende bem um único servidor; para escalar horizontalmente, migrar para PostgreSQL (DDL de referência na [modelagem](../05-modelagem-dados.md#55-equivalente-relacional-ddl-sql--referência)).
