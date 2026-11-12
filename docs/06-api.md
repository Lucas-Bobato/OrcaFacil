# 6. API REST

[← Voltar ao README](../README.md) · Especificação OpenAPI: [`apps/api/openapi.yaml`](../apps/api/openapi.yaml) · Swagger UI: `http://localhost:3333/api/docs` (com a API rodando)

- **Base URL:** `http://localhost:3333/api`
- **Formato:** JSON (UTF-8). Valores monetários em **centavos inteiros** (`2500` = R$ 25,00 — RN08). Datas em ISO 8601.
- **Autenticação:** `POST /auth/cadastro` ou `POST /auth/login` devolvem `{ token, usuario }`. Envie `Authorization: Bearer <token>` em todas as outras rotas (exceto `/health`).
- **Perfil obrigatório:** rotas de clientes e orçamentos exigem o perfil profissional cadastrado; sem ele respondem `409 PERFIL_NAO_CADASTRADO` (CA01.1).
- **Isolamento:** cada usuário só acessa os próprios dados; recursos de outra conta respondem `404`.

## 6.1 Endpoints

| Método | Rota | Descrição | Sucesso | Requisitos |
|---|---|---|---|---|
| GET | `/health` | Verifica se a API está no ar | 200 | — |
| POST | `/auth/cadastro` | Cria conta (`email`, `senha` ≥ 8) | 201 | ADR-006 |
| POST | `/auth/login` | Inicia sessão | 200 | ADR-006 |
| GET | `/auth/me` | Usuário da sessão | 200 | — |
| POST | `/auth/logout` | Encerra a sessão: invalida todos os tokens da conta | 204 | [Segurança](08-seguranca.md) |
| POST | `/auth/senha` | Troca a senha (`senhaAtual`, `novaSenha`), revoga tokens antigos e devolve nova sessão | 200 | [Segurança](08-seguranca.md) |
| DELETE | `/conta` | Apaga conta e **todos** os dados (cascata). Exige `{ "senha" }` no corpo | 204 | RNF21 |
| GET | `/perfil` | Perfil do profissional (404 se ainda não existe) | 200 | RF01, CA01.1 |
| PUT | `/perfil` | Cria (201) ou atualiza (200) o perfil | 200/201 | RF01, CA01.2, CA01.3, RN11 |
| GET | `/clientes?busca=` | Lista clientes (busca sem acentos) | 200 | RF02 |
| POST | `/clientes` | Cria cliente | 201 | RF02 |
| GET | `/clientes/:id` | Detalha cliente | 200 | RF02 |
| PUT | `/clientes/:id` | Atualiza cliente | 200 | RF02 |
| DELETE | `/clientes/:id` | Exclui cliente sem orçamentos (409 se tiver) | 204 | DER §5.2 |
| GET | `/orcamentos?busca=&status=` | Lista do mais recente ao mais antigo | 200 | RF12, CA08.1, CA08.2 |
| POST | `/orcamentos` | Cria rascunho com número `ORC-AAAA-NNNN` | 201 | RF03, RN07 |
| GET | `/orcamentos/:id` | Detalhe com cliente, itens, `pendencias` e `documentoAtual` | 200 | RF09, RN01 |
| PUT | `/orcamentos/:id` | Condições, cliente vinculado e etapa atual | 200 | RF07, RF08, RN05, RN06, RN10, CA08.3 |
| DELETE | `/orcamentos/:id` | Exclui orçamento, itens e PDFs | 204 | CA08.5, RN14 |
| PUT | `/orcamentos/:id/cliente` | Cria/atualiza o cliente do orçamento (etapa 01) | 200 | RF02, US02 |
| POST | `/orcamentos/:id/duplicar` | Novo rascunho com mesmos itens/condições, sem cliente | 201 | RF13, CA08.4 |
| POST | `/orcamentos/:id/itens` | Adiciona item (opcional `ordem` para "Desfazer") | 201 | RF04, RN04, RN08, RN09, CA04.3 |
| PUT | `/orcamentos/:id/itens/:itemId` | Edita item | 200 | RF05, CA04.1 |
| DELETE | `/orcamentos/:id/itens/:itemId` | Remove item | 200 | RF05, CA04.2 |
| POST | `/orcamentos/:id/emitir` | Gera o PDF, substitui o anterior e marca como EMITIDO | 200 | RF10, RN01, RN10, RN13 |
| GET | `/orcamentos/:id/pdf` | Baixa o PDF vigente | 200 | RF11, RN12 |

As rotas que alteram um orçamento devolvem o **orçamento completo atualizado** (com `totalCentavos` recalculado — RN02), o que permite à interface atualizar a tela com uma única requisição.

## 6.2 Regras aplicadas pela API

| Regra | Comportamento |
|---|---|
| RN02 | `totalCentavos` é sempre recalculado a partir dos itens; enviar `totalCentavos` no `PUT` é rejeitado (400). |
| RN07 | Número gerado em transação por profissional/ano; nunca reutilizado (há *trigger* no banco). |
| RN08 | `subtotal = round_half_up(quantidade × valorUnitarioCentavos)` com BigInt. |
| RN09 | 51º item → `422 LIMITE_ITENS` "Limite de 50 itens atingido". |
| RN01 | `pendencias` lista o que falta; `/emitir` com pendências → `422 EMISSAO_BLOQUEADA`. |
| RN10 | Alterar conteúdo de um EMITIDO (condições, cliente ou itens) volta para RASCUNHO; o PDF anterior continua disponível até a nova emissão. Mudar só `etapaAtual` não altera o status. |
| RN11 | O PDF é guardado como *snapshot*; mudar o perfil não altera PDFs já gerados. |
| RN12 | `Content-Disposition: attachment; filename="Orcamento_<numero>_<cliente>.pdf"`. |
| RN13 | `dataEmissao` é definida pelo servidor na emissão. |

## 6.3 Formato de erro

Todas as falhas usam o mesmo formato:

```json
{
  "erro": {
    "codigo": "VALIDACAO",
    "mensagem": "Verifique os campos destacados",
    "campos": { "nome": "Informe o nome do cliente", "telefone": "Telefone inválido" }
  }
}
```

| Status | Códigos |
|---|---|
| 400 | `VALIDACAO` (com `campos`), `JSON_INVALIDO`, `REQUISICAO_INVALIDA` |
| 401 | `NAO_AUTENTICADO`, `SESSAO_INVALIDA`, `CREDENCIAIS_INVALIDAS` |
| 403 | `SENHA_INCORRETA` (troca de senha e exclusão de conta) |
| 404 | `PERFIL_NAO_CADASTRADO` (GET /perfil), `ORCAMENTO_NAO_ENCONTRADO`, `CLIENTE_NAO_ENCONTRADO`, `ITEM_NAO_ENCONTRADO`, `PDF_NAO_ENCONTRADO`, `ROTA_NAO_ENCONTRADA` |
| 409 | `EMAIL_EM_USO`, `PERFIL_NAO_CADASTRADO` (perfil exigido), `CLIENTE_COM_ORCAMENTOS` |
| 413 | `CORPO_MUITO_GRANDE` |
| 415 | `REQUISICAO_INVALIDA` (corpo comprimido não é aceito) |
| 422 | `LIMITE_ITENS`, `LIMITE_CONTA`, `EMISSAO_BLOQUEADA` (com `pendencias`), `PDF_MUITO_GRANDE` |
| 429 | `MUITAS_TENTATIVAS` (com cabeçalho `Retry-After`) |
| 500 | `ERRO_INTERNO` (detalhes apenas no log do servidor) |
| 503 | `SERVIDOR_OCUPADO` (com cabeçalho `Retry-After`) |

## 6.4 Exemplo de uso (curl)

```bash
API=http://localhost:3333/api

# 1. Entrar com o usuário de demonstração (criado por npm run db:seed)
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"demo@orcafacil.com.br","senha":"demo1234"}' | node -pe 'JSON.parse(require("fs").readFileSync(0)).token')
AUTH="Authorization: Bearer $TOKEN"

# 2. Criar orçamento e definir o cliente
ID=$(curl -s -X POST $API/orcamentos -H "$AUTH" | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
curl -s -X PUT $API/orcamentos/$ID/cliente -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"nome":"Maria Silva","telefone":"(11) 91234-5678"}'

# 3. Adicionar item: 20 m² × R$ 25,00
curl -s -X POST $API/orcamentos/$ID/itens -H "$AUTH" -H 'Content-Type: application/json' \
  -d '{"descricao":"Pintura de parede","quantidade":20,"unidade":"M2","valorUnitarioCentavos":2500}'

# 4. Prazo, emissão e download
curl -s -X PUT $API/orcamentos/$ID -H "$AUTH" -H 'Content-Type: application/json' -d '{"prazoExecucaoDias":2}'
curl -s -X POST $API/orcamentos/$ID/emitir -H "$AUTH"
curl -s -OJ $API/orcamentos/$ID/pdf -H "$AUTH"   # salva Orcamento_ORC-2026-000N_Maria-Silva.pdf
```
