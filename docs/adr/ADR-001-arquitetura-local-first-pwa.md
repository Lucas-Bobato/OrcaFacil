# ADR-001: Arquitetura local-first (PWA) sem backend

| | |
|---|---|
| **Status** | ✅ Aprovado |
| **Data** | 08/10/2026 |
| **Requisitos relacionados** | RF01, RF10, RF11, RNF08, RNF09, RNF18, RNF21, RNF24 |

## Contexto

O público do OrçaFácil são prestadores de serviço autônomos (pintores, pedreiros, eletricistas) que usam o **celular** como principal ferramenta e frequentemente estão em **obras com sinal de internet fraco ou inexistente**. O levantamento inicial exige que "todo o funcionamento do aplicativo ocorra de forma local no dispositivo, garantindo o uso mesmo sem conexão" e, ao mesmo tempo, pedia "cadastro de usuário".

Precisamos decidir **onde ficam o processamento e os dados**:

- Um backend com contas de usuário exigiria conexão para login e sincronização, contrariando o requisito offline, além de custos de servidor, banco gerenciado e obrigações de segurança/LGPD sobre dados pessoais de clientes armazenados por nós.
- Um app nativo (Android/iOS) resolveria o offline, mas exige publicação em lojas, dois ciclos de revisão e instalação prévia — atrito alto para validar um MVP.

## Decisão

Adotar uma **Progressive Web App (PWA) local-first, sem backend de aplicação**:

- Todo processamento (validação, cálculo, persistência, geração de PDF) ocorre **no navegador**.
- Os dados ficam **apenas no aparelho** (ver [ADR-003](ADR-003-banco-de-dados-indexeddb-dexie.md)).
- Um **Service Worker** (Workbox, via `vite-plugin-pwa`) faz *precache* de todos os arquivos, permitindo uso offline após o primeiro acesso.
- O "cadastro de usuário" do levantamento inicial passa a ser um **perfil local do profissional**, sem login.
- O app pode ser **instalado na tela inicial** pelo próprio navegador, sem loja.

## Alternativas consideradas

| Alternativa | Motivo da rejeição |
|---|---|
| SPA + API REST + banco na nuvem (contas de usuário) | Não funciona offline sem uma camada complexa de sincronização; custo e responsabilidade sobre dados pessoais. |
| App nativo (Kotlin/Swift) ou React Native/Flutter | Publicação em lojas e instalação obrigatória aumentam o tempo e o atrito para validar o MVP. |
| Site estático sem Service Worker | Não atende ao requisito offline. |

## Consequências

### Vantagens
- ✅ **Funciona offline** de ponta a ponta (RNF08).
- ✅ **Custo de infraestrutura praticamente zero** — apenas hospedagem estática.
- ✅ **Privacidade por padrão**: nenhum dado de cliente sai do aparelho (RNF18), simplificando a adequação à LGPD.
- ✅ Acesso imediato por link (ex.: enviado no WhatsApp), sem loja; instalação opcional.
- ✅ Menos peças móveis: sem servidor para manter, escalar ou proteger.

### Desvantagens (trade-offs assumidos)
- ⚠️ **Sem sincronização entre aparelhos**: o histórico fica preso ao celular/navegador usado.
- ⚠️ **Risco de perda de dados** se o usuário limpar os dados do navegador ou trocar de aparelho. *Mitigação futura:* exportar/importar backup em arquivo JSON.
- ⚠️ No iOS/Safari o armazenamento pode ser removido após longos períodos sem uso. *Mitigação:* solicitar `navigator.storage.persist()` e incentivar a instalação como PWA.
- ⚠️ Sem métricas de uso centralizadas por padrão. *Mitigação futura:* analytics anônimo e opcional.
- ⚠️ Evoluir para contas em nuvem exigirá uma nova ADR e uma estratégia de sincronização — a separação em camadas (Domínio/Repositórios) foi pensada para facilitar essa troca.
