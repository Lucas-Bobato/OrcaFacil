# 1. Requisitos Funcionais, Histórias de Usuário e Regras de Negócio

[← Voltar ao README](../README.md)

**Ator principal:** Prestador de serviço autônomo (doravante "profissional").
**Ator secundário:** Cliente final (apenas recebe o PDF; não interage com o sistema).

Prioridade segundo **MoSCoW**: **M** = Must (obrigatório no MVP), **S** = Should (importante, entra se houver tempo), **C** = Could (desejável).

---

## 1.1 Requisitos Funcionais (RF)

| ID | Requisito | Prioridade | Origem |
|---|---|---|---|
| **RF01** | O sistema deve permitir o **cadastro do perfil do profissional** (nome, nome da empresa, telefone/WhatsApp, e-mail, CPF/CNPJ opcional), armazenado localmente no aparelho e reutilizado em todos os orçamentos. | M | Requisitos.txt RF01 + RF06 |
| **RF02** | O sistema deve permitir a inserção dos **dados do cliente**: nome (obrigatório), telefone, e-mail e endereço do serviço (opcionais). | M | Requisitos.txt RF02 |
| **RF03** | O sistema deve **criar um novo orçamento** atribuindo automaticamente um número sequencial e a data de criação. | M | Novo |
| **RF04** | O sistema deve permitir **adicionar múltiplos itens de serviço**, cada um com descrição, quantidade, unidade (un, m², m, h, diária, vb) e valor unitário, exibindo o subtotal do item. | M | Requisitos.txt RF03 + slide 7 |
| **RF05** | O sistema deve permitir **editar e remover** itens de serviço já adicionados. | M | Novo |
| **RF06** | O sistema deve **calcular e exibir automaticamente o valor total** do orçamento a cada inclusão, alteração ou remoção de item. | M | Requisitos.txt RF04 |
| **RF07** | O sistema deve permitir informar o **prazo de execução** do serviço (em dias). | M | Requisitos.txt RF05 |
| **RF08** | O sistema deve permitir informar **condições de pagamento**, **validade da proposta** e **observações** (ex.: "Materiais por conta do cliente"). | M | Slide 6 e 7 |
| **RF09** | O sistema deve exibir uma **tela de revisão** com todos os dados do orçamento antes da geração do PDF. | M | Fluxo "03 Revisar" |
| **RF10** | O sistema deve **gerar um PDF estruturado** contendo: cabeçalho do profissional, dados do cliente, número e data, tabela de itens, total, prazo, condições de pagamento, validade e observações. | M | Requisitos.txt RF07 |
| **RF11** | O sistema deve permitir **baixar o PDF** no dispositivo e, quando suportado pelo navegador, **compartilhá-lo diretamente** (ex.: WhatsApp) via Web Share API. | M | Requisitos.txt RF08 |
| **RF12** | O sistema deve manter um **histórico local de orçamentos**, permitindo listar, buscar por cliente, reabrir, baixar novamente o último PDF e excluir. | S | Novo |
| **RF13** | O sistema deve **salvar automaticamente o rascunho** do orçamento em andamento e permitir **duplicar** um orçamento existente como base para um novo. | S | Novo |

> **Nota de revisão em relação ao `Requisitos.txt`:** o antigo "RF01 — cadastro de usuário" foi reinterpretado como **perfil local do profissional**, pois o RNF04 original exige que todo o funcionamento ocorra localmente/offline (ver [ADR-001](adr/ADR-001-arquitetura-local-first-pwa.md)). O antigo RF06 (dados do profissional) foi incorporado ao RF01.

---

## 1.2 Histórias de Usuário e Critérios de Aceite (BDD)

### US01 — Configurar meu perfil profissional
> **Como** prestador de serviço, **quero** cadastrar meus dados uma única vez, **para que** eles apareçam automaticamente em todos os meus orçamentos.

*Rastreia:* RF01 · RN11

| Cenário | Critério |
|---|---|
| **CA01.1 — Primeiro acesso** | **Dado que** abro o aplicativo pela primeira vez e não há perfil salvo<br>**Quando** toco em "Novo orçamento"<br>**Então** sou direcionado à tela "Meu perfil" antes de iniciar o orçamento. |
| **CA01.2 — Salvar perfil** | **Dado que** estou na tela "Meu perfil"<br>**Quando** preencho o nome (ou nome da empresa) e o telefone e toco em "Salvar"<br>**Então** vejo a mensagem "Perfil salvo" e os dados permanecem após fechar e reabrir o app. |
| **CA01.3 — Perfil incompleto** | **Dado que** estou na tela "Meu perfil"<br>**Quando** tento salvar sem nome e sem nome da empresa<br>**Então** o campo é destacado com a mensagem "Informe seu nome ou o nome da empresa" e o perfil não é salvo. |
| **CA01.4 — Reaproveitamento** | **Dado que** já tenho um perfil salvo<br>**Quando** inicio um novo orçamento<br>**Então** os dados do profissional já aparecem preenchidos na etapa "Preencher". |

### US02 — Informar os dados do cliente
> **Como** prestador de serviço, **quero** registrar os dados do meu cliente, **para que** o orçamento seja personalizado e identificável.

*Rastreia:* RF02, RF03 · RN01, RN13

| Cenário | Critério |
|---|---|
| **CA02.1 — Cliente válido** | **Dado que** estou na etapa "01 Preencher"<br>**Quando** informo o nome do cliente "Maria Silva" e toco em "Próximo"<br>**Então** avanço para a etapa "02 Detalhar" e o orçamento recebe um número (ex.: `ORC-2026-0001`). |
| **CA02.2 — Nome ausente** | **Dado que** estou na etapa "01 Preencher"<br>**Quando** toco em "Próximo" com o nome do cliente vazio<br>**Então** permaneço na etapa e vejo "Informe o nome do cliente". |
| **CA02.3 — Telefone inválido** | **Dado que** preenchi um telefone<br>**Quando** ele tiver menos de 10 dígitos<br>**Então** vejo "Telefone inválido" e não consigo avançar até corrigir ou apagar o campo. |

### US03 — Adicionar itens de serviço
> **Como** prestador de serviço, **quero** adicionar os itens de serviço que serão realizados, **para que** o cliente entenda o que está sendo cobrado.

*Rastreia:* RF04, RF06 · RN02, RN03, RN04, RN08, RN09

| Cenário | Critério |
|---|---|
| **CA03.1 — Adicionar 1 item** | **Dado que** estou na tela "02 Detalhar"<br>**Quando** preencho descrição "Pintura de parede", quantidade "20", unidade "m²", valor unitário "R$ 25,00" e toco em "Adicionar"<br>**Então** o item aparece na lista com subtotal **R$ 500,00** e os campos do formulário são limpos. |
| **CA03.2 — Total atualizado** | **Dado que** a lista contém um item de R$ 500,00<br>**Quando** adiciono outro item de 1 × R$ 300,00<br>**Então** o total exibido passa a ser **R$ 800,00** imediatamente. |
| **CA03.3 — Valor zerado** | **Dado que** estou adicionando um item<br>**Quando** informo valor unitário R$ 0,00 e toco em "Adicionar"<br>**Então** o item não é adicionado e vejo "O valor deve ser maior que R$ 0,00". |
| **CA03.4 — Formatação monetária** | **Dado que** estou digitando o valor unitário<br>**Quando** digito `1250`<br>**Então** o campo exibe `R$ 12,50` (máscara em centavos, padrão BRL). |
| **CA03.5 — Limite de itens** | **Dado que** o orçamento já tem 50 itens<br>**Quando** tento adicionar outro<br>**Então** o botão "Adicionar" fica desabilitado com a mensagem "Limite de 50 itens atingido". |

### US04 — Corrigir itens de serviço
> **Como** prestador de serviço, **quero** editar ou remover um item, **para que** eu corrija erros sem recomeçar o orçamento.

*Rastreia:* RF05, RF06 · RN02, RN14

| Cenário | Critério |
|---|---|
| **CA04.1 — Editar item** | **Dado que** a lista tem o item "Pintura de parede — 20 m² × R$ 25,00"<br>**Quando** altero a quantidade para 30 e confirmo<br>**Então** o subtotal passa a R$ 750,00 e o total é recalculado. |
| **CA04.2 — Remover item** | **Dado que** a lista tem 2 itens totalizando R$ 800,00<br>**Quando** removo o item de R$ 300,00 e confirmo<br>**Então** a lista exibe 1 item e o total passa a R$ 500,00. |
| **CA04.3 — Desfazer remoção** | **Dado que** acabei de remover um item<br>**Quando** toco em "Desfazer" em até 5 segundos<br>**Então** o item volta para a mesma posição e o total é restaurado. |

### US05 — Definir condições e revisar o orçamento
> **Como** prestador de serviço, **quero** informar prazo, pagamento e observações e revisar tudo, **para que** eu envie um orçamento sem erros.

*Rastreia:* RF07, RF08, RF09 · RN05, RN06

| Cenário | Critério |
|---|---|
| **CA05.1 — Prazo válido** | **Dado que** estou na etapa "03 Revisar"<br>**Quando** informo prazo "2" dias<br>**Então** a revisão exibe "Prazo: 2 dias". |
| **CA05.2 — Prazo inválido** | **Dado que** estou na etapa "03 Revisar"<br>**Quando** informo prazo "0" ou maior que 365<br>**Então** vejo "Informe um prazo entre 1 e 365 dias". |
| **CA05.3 — Validade padrão** | **Dado que** não alterei a validade<br>**Quando** abro a etapa "03 Revisar"<br>**Então** a validade aparece preenchida com 15 dias. |
| **CA05.4 — Revisão completa** | **Dado que** preenchi todas as etapas<br>**Quando** abro a etapa "03 Revisar"<br>**Então** vejo profissional, cliente, itens, total, prazo, pagamento, validade e observações, cada bloco com um botão "Editar" que leva à etapa correspondente. |

### US06 — Gerar o PDF do orçamento
> **Como** prestador de serviço, **quero** gerar um PDF organizado com os dados preenchidos, **para que** eu passe uma imagem profissional ao cliente.

*Rastreia:* RF10 · RN01, RN07, RN10, RN13

| Cenário | Critério |
|---|---|
| **CA06.1 — PDF gerado com sucesso** | **Dado que** preenchi todos os campos obrigatórios (RN01)<br>**Quando** toco em "Gerar PDF"<br>**Então** em até 2 s o PDF é exibido em pré-visualização com todos os dados e o total formatado em BRL, e o orçamento muda para o status **Emitido**. |
| **CA06.2 — Botão bloqueado** | **Dado que** o orçamento não possui nenhum item com valor > R$ 0,00<br>**Quando** chego à etapa "03 Revisar"<br>**Então** o botão "Gerar PDF" está desabilitado e há um aviso indicando o que falta. |
| **CA06.3 — Fidelidade dos dados** | **Dado que** o orçamento tem 3 itens totalizando R$ 1.234,56<br>**Quando** o PDF é gerado<br>**Então** o PDF lista os 3 itens na mesma ordem e o total impresso é exatamente "R$ 1.234,56". |
| **CA06.4 — Offline** | **Dado que** o aparelho está sem conexão com a internet<br>**Quando** toco em "Gerar PDF"<br>**Então** o PDF é gerado normalmente. |

### US07 — Baixar e compartilhar o PDF
> **Como** prestador de serviço, **quero** baixar ou compartilhar o PDF, **para que** eu envie o orçamento ao cliente pelo WhatsApp.

*Rastreia:* RF11 · RN12

| Cenário | Critério |
|---|---|
| **CA07.1 — Download do arquivo** | **Dado que** o PDF já foi gerado<br>**Quando** toco em "Baixar"<br>**Então** o arquivo `Orcamento_ORC-2026-0001_Maria-Silva.pdf` é salvo no dispositivo. |
| **CA07.2 — Compartilhar** | **Dado que** o navegador suporta compartilhamento de arquivos<br>**Quando** toco em "Compartilhar"<br>**Então** abre-se a folha de compartilhamento nativa com o PDF anexado (ex.: WhatsApp). |
| **CA07.3 — Sem suporte a compartilhar** | **Dado que** o navegador **não** suporta compartilhamento de arquivos<br>**Quando** a tela do PDF é exibida<br>**Então** o botão "Compartilhar" não é mostrado e o botão "Baixar" permanece disponível. |

### US08 — Consultar meus orçamentos
> **Como** prestador de serviço, **quero** ver os orçamentos que já fiz, **para que** eu reenvie, ajuste ou reaproveite um orçamento.

*Rastreia:* RF12, RF13 · RN10, RN14

| Cenário | Critério |
|---|---|
| **CA08.1 — Listagem** | **Dado que** possuo orçamentos salvos<br>**Quando** abro a tela inicial<br>**Então** vejo a lista ordenada do mais recente para o mais antigo com número, cliente, total, data e status. |
| **CA08.2 — Busca** | **Dado que** possuo orçamentos de vários clientes<br>**Quando** digito "Maria" na busca<br>**Então** apenas orçamentos cujo cliente contém "Maria" são exibidos. |
| **CA08.3 — Rascunho recuperado** | **Dado que** fechei o app no meio de um orçamento<br>**Quando** reabro o app<br>**Então** o orçamento aparece com status **Rascunho** e, ao abri-lo, continuo da etapa em que parei. |
| **CA08.4 — Duplicar** | **Dado que** abro um orçamento emitido<br>**Quando** toco em "Duplicar"<br>**Então** é criado um novo rascunho com novo número, mesmos itens e condições, e cliente em branco. |
| **CA08.5 — Excluir** | **Dado que** estou na lista<br>**Quando** escolho "Excluir" em um orçamento e confirmo<br>**Então** o orçamento e seus PDFs são removidos do aparelho. |

---

## 1.3 Regras de Negócio (RN)

| ID | Nome | Regra |
|---|---|---|
| **RN01** | Campos obrigatórios para emissão | O botão "Gerar PDF" só é habilitado quando existirem: (a) nome do profissional **ou** nome da empresa; (b) nome do cliente; (c) **ao menos um** item de serviço com subtotal maior que R$ 0,00; (d) prazo de execução válido (RN05). |
| **RN02** | Total calculado e não editável | O valor total é sempre a soma dos subtotais dos itens: `total = Σ (quantidade × valor_unitário)`. O campo é somente leitura e não pode ser alterado manualmente. |
| **RN03** | Padrão monetário | Todos os valores são exibidos e impressos no padrão brasileiro (BRL): prefixo `R$`, separador de milhar `.` e decimal `,` com 2 casas (ex.: `R$ 1.234,56`). A digitação usa máscara em centavos. |
| **RN04** | Validade de um item | Descrição obrigatória com 3 a 120 caracteres; quantidade > 0 com até 2 casas decimais e máximo de 99.999; valor unitário > R$ 0,00 e ≤ R$ 9.999.999,99. |
| **RN05** | Prazo de execução | Número inteiro de dias entre 1 e 365. |
| **RN06** | Validade da proposta | Padrão de **15 dias** a partir da data de emissão, configurável entre 1 e 90 dias. O PDF exibe a data limite (ex.: "Válido até 23/10/2026"). |
| **RN07** | Numeração sequencial | Cada orçamento recebe número único no formato `ORC-AAAA-NNNN` (ano + sequencial de 4 dígitos), gerado na criação. Números nunca são reutilizados, mesmo após exclusão; a sequência reinicia a cada ano. |
| **RN08** | Precisão do cálculo | Valores monetários são armazenados e calculados como **inteiros em centavos**. O subtotal de cada item é arredondado para o centavo mais próximo (meio para cima) antes da soma do total. |
| **RN09** | Limite de itens | Um orçamento deve conter entre 1 e 50 itens para ser emitido. |
| **RN10** | Ciclo de vida do orçamento | Status possíveis: **Rascunho** → **Emitido**. Ao gerar o PDF o orçamento passa a Emitido. Se um orçamento emitido for editado, volta para Rascunho e o PDF anterior é mantido no histórico até que um novo seja gerado. |
| **RN11** | Reaproveitamento do perfil | Os dados do profissional vêm do perfil salvo. Alterações no perfil valem para os **próximos** PDFs; PDFs já gerados não são alterados. |
| **RN12** | Nome do arquivo | O PDF é nomeado como `Orcamento_<numero>_<cliente>.pdf`, com o nome do cliente sem acentos, espaços substituídos por `-` e limitado a 40 caracteres. |
| **RN13** | Data de emissão | A data de emissão é atribuída automaticamente no momento da geração do PDF e não é editável pelo usuário. |
| **RN14** | Exclusões confirmadas | Remover um item oferece "Desfazer" por 5 segundos; excluir um orçamento exige confirmação explícita, pois não há cópia em servidor. |
