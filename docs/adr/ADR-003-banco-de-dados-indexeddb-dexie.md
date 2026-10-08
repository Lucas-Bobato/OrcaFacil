# ADR-003: Banco de dados local IndexedDB com Dexie.js

| | |
|---|---|
| **Status** | ✅ Aprovado |
| **Data** | 08/10/2026 |
| **Requisitos relacionados** | RF01, RF12, RF13, RNF08, RNF10, RNF18, RNF21 · [Modelagem de dados](../05-modelagem-dados.md) |

## Contexto

Com a arquitetura local-first ([ADR-001](ADR-001-arquitetura-local-first-pwa.md)), os dados precisam ser persistidos **no próprio navegador**. Precisamos armazenar:

- dados estruturados com relacionamentos (perfil → clientes → orçamentos → itens);
- arquivos binários (os PDFs gerados, para baixar novamente sem regerar);
- índices para listar orçamentos por data, buscar por cliente e garantir número único;
- operações **atômicas** (emitir orçamento = salvar PDF + mudar status juntos);
- volume estimado: até ~1.000 orçamentos e ~1.000 PDFs (≈ 300 MB no pior caso) por aparelho.

## Decisão

Usar **IndexedDB** como banco de dados, acessado pela biblioteca **Dexie.js** (v4), com o modelo relacional lógico descrito no [DER](../05-modelagem-dados.md):

- cada entidade do DER vira uma *object store* (tabela) com chave primária UUID;
- relacionamentos por chaves estrangeiras lógicas (ex.: `orcamento.clienteId`), com integridade garantida pela camada de Repositórios;
- índices: `orcamentos.numero` (único), `orcamentos.atualizadoEm`, `clientes.nome`;
- transações Dexie (`db.transaction('rw', ...)`) para operações que envolvem múltiplas tabelas;
- versões de schema com migrações declarativas (`db.version(n).stores(...)`);
- chamada a `navigator.storage.persist()` para reduzir o risco de remoção automática pelo navegador.

## Alternativas consideradas

| Alternativa | Prós | Motivo da rejeição |
|---|---|---|
| **localStorage** | API trivial | Limite ~5 MB, apenas strings, síncrono (trava a UI), sem índices nem transações; não comporta PDFs. |
| **SQLite via WASM (sql.js / wa-sqlite + OPFS)** | SQL real e relacional | ~1 MB extra de WASM (estoura RNF04), suporte a OPFS ainda irregular em navegadores móveis mais antigos. |
| **PouchDB** | Sincronização futura com CouchDB | Biblioteca pesada (~45 KB gzip) e modelo de documentos/revisões além do necessário para o MVP. |
| **IndexedDB puro (sem biblioteca)** | Zero dependências | API verbosa baseada em eventos, propensa a erros; Dexie custa ~25 KB gzip e entrega Promises, tipagem e migrações. |
| **Banco relacional na nuvem (PostgreSQL)** | Robustez, SQL, multi-aparelho | Exige backend e conexão — incompatível com o ADR-001. |

## Consequências

### Vantagens
- ✅ Disponível nativamente em todos os navegadores suportados (RNF23), **funciona 100 % offline**.
- ✅ Armazena **Blobs** (PDFs) diretamente, sem conversão para base64.
- ✅ Cota ampla (centenas de MB, proporcional ao espaço livre do aparelho).
- ✅ Assíncrono: não bloqueia a interface (RNF05).
- ✅ Dexie oferece transações, índices, consultas tipadas com TypeScript e migrações de versão.
- ✅ Caminho de evolução: Dexie Cloud ou sincronização própria caso surjam contas em nuvem.

### Desvantagens (trade-offs assumidos)
- ⚠️ **Não é relacional**: não há *foreign keys* nem *JOINs* nativos. Integridade referencial e exclusões em cascata são responsabilidade dos Repositórios (cobertas por testes — RNF25).
- ⚠️ Consultas complexas (ex.: relatórios agregados) exigem processamento em memória. Aceitável para o volume do MVP.
- ⚠️ Os dados podem ser apagados pelo usuário ou pelo navegador (ver ADR-001).
- ⚠️ Inspeção/depuração menos amigável que SQL (feita via DevTools → Application → IndexedDB).
