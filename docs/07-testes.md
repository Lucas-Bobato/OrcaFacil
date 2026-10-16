# 7. Testes

[← Voltar ao README](../README.md)

## 7.1 Como executar

```bash
npm test                 # unitários + API + componentes (Vitest) em todos os pacotes
npm run test:coverage    # idem, com relatório de cobertura (pasta coverage/ de cada pacote)
npx playwright install chromium   # uma vez, baixa o navegador dos testes E2E
npm run test:e2e         # E2E: sobe API (banco descartável) + interface e roda no Chromium
```

## 7.2 Suítes

| Suíte | Arquivos | Testes | O que cobre |
|---|---|---|---|
| Domínio | `packages/shared/tests/*.test.ts` | 69 | Money/BRL, máscara em centavos, arredondamento, total, pendências RN01, validade RN06, numeração RN07, nome do arquivo RN12, CPF/CNPJ, telefone, schemas com as mensagens dos CAs |
| API + banco | `apps/api/tests/*.test.ts` | 54 | Todos os endpoints com SQLite em memória: autenticação, perfil, CRUD de clientes, orçamentos, itens, emissão e download do PDF, RN10, isolamento entre usuários, formato de erros, restrições do banco (CHECK, FK, UNIQUE, trigger, índices) |
| Interface | `apps/web/tests/telas.test.tsx` | 22 | Telas com API simulada: validações, máscara, habilitação do "Gerar PDF", Desfazer, estados de carregamento/erro/vazio, Compartilhar condicional |
| E2E | `e2e/fluxo-completo.spec.ts` | 5 | Integração real interface → API → SQLite no Chromium (viewport de celular) |

## 7.3 Rastreabilidade (critérios de aceite → testes)

| Critério / Regra | Domínio | API | Interface | E2E |
|---|:-:|:-:|:-:|:-:|
| CA01.1 Primeiro acesso → perfil | | ✅ | ✅ | ✅ |
| CA01.2 Salvar perfil / "Perfil salvo" | ✅ | ✅ | ✅ | ✅ |
| CA01.3 Perfil sem nome e sem empresa | ✅ | ✅ | ✅ | ✅ |
| CA01.4 Perfil reaproveitado na etapa 01 | | | ✅ | ✅ |
| CA02.1 Cliente válido + número do orçamento | ✅ | ✅ | ✅ | ✅ |
| CA02.2 Nome do cliente ausente | ✅ | ✅ | ✅ | ✅ |
| CA02.3 Telefone inválido | ✅ | ✅ | ✅ | ✅ |
| CA03.1 Adicionar item (subtotal R$ 500,00) | ✅ | ✅ | ✅ | ✅ |
| CA03.2 Total atualizado (R$ 800,00) | ✅ | ✅ | | ✅ |
| CA03.3 Valor zerado | ✅ | ✅ | ✅ | |
| CA03.4 Máscara monetária (1250 → R$ 12,50) | ✅ | | ✅ | ✅ |
| CA03.5 Limite de 50 itens | ✅ | ✅ | ✅ | |
| CA04.1 Editar item | ✅ | ✅ | | ✅ |
| CA04.2 Remover item | ✅ | ✅ | ✅ | |
| CA04.3 Desfazer remoção na mesma posição | | ✅ | ✅ | |
| CA05.1 / CA05.2 Prazo válido / inválido | ✅ | ✅ | ✅ | ✅ |
| CA05.3 Validade padrão 15 dias | | ✅ | ✅ | ✅ |
| CA05.4 Revisão completa com "Editar" | | | ✅ | ✅ |
| CA06.1 PDF gerado ≤ 2 s e status Emitido | | ✅ | ✅ | ✅ |
| CA06.2 "Gerar PDF" bloqueado com pendências | ✅ | ✅ | ✅ | ✅ |
| CA06.3 Fidelidade: ordem dos itens e R$ 1.234,56 | ✅ | ✅ | | |
| CA07.1 Download `Orcamento_<numero>_<cliente>.pdf` | ✅ | ✅ | | ✅ |
| CA07.2 / CA07.3 Compartilhar só quando suportado | | | ✅ | |
| CA08.1 Lista ordenada com número, cliente, total, data e status | | ✅ | ✅ | ✅ |
| CA08.2 Busca por cliente | | ✅ | ✅ | ✅ |
| CA08.3 Rascunho continua na etapa em que parou | | ✅ | | ✅ |
| CA08.4 Duplicar | | ✅ | | ✅ |
| CA08.5 Excluir com confirmação (cascata) | | ✅ | | ✅ |
| RN02 Total não editável | ✅ | ✅ | | |
| RN07 Numeração sem reuso | ✅ | ✅ | | |
| RN08 Arredondamento em centavos | ✅ | ✅ | | |
| RN10 Emitido editado volta a Rascunho | | ✅ | | |
| RN11 PDF já gerado não muda com o perfil | | ✅ | | |
| RNF12 360 px sem rolagem horizontal | | | | ✅ |
| RNF21 Apagar todos os dados | | ✅ | | ✅ |
| Mesmos dados em outro navegador (ADR-006) | | ✅ | | ✅ |

## 7.4 Resultado da última execução

| Suíte | Resultado |
|---|---|
| `npm test` | 145 testes aprovados (69 domínio + 54 API + 22 interface) |
| `npm run test:e2e` | 5 testes aprovados |
| `npm audit` | 0 vulnerabilidades |
