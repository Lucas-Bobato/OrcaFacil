-- OrçaFácil — esquema inicial (SQLite)
-- Implementação física do DER (docs/05-modelagem-dados.md).
-- Datas/horas: texto ISO 8601. Valores monetários: inteiros em centavos (RN08).

-- Conta de acesso (ADR-006): permite usar os mesmos dados em qualquer navegador/aparelho.
CREATE TABLE usuario (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE COLLATE NOCASE CHECK (length(email) BETWEEN 3 AND 120),
  senha_hash  TEXT NOT NULL,
  criado_em   TEXT NOT NULL
);

-- PROFISSIONAL — perfil de quem emite o orçamento (RF01). 1 perfil por usuário.
CREATE TABLE profissional (
  id             TEXT PRIMARY KEY,
  usuario_id     TEXT NOT NULL UNIQUE REFERENCES usuario(id) ON DELETE CASCADE,
  nome           TEXT CHECK (nome IS NULL OR length(nome) BETWEEN 1 AND 80),
  nome_empresa   TEXT CHECK (nome_empresa IS NULL OR length(nome_empresa) BETWEEN 1 AND 80),
  documento      TEXT CHECK (documento IS NULL OR length(documento) IN (11, 14)),
  telefone       TEXT NOT NULL CHECK (length(telefone) BETWEEN 10 AND 11),
  email          TEXT CHECK (email IS NULL OR length(email) <= 120),
  criado_em      TEXT NOT NULL,
  atualizado_em  TEXT NOT NULL,
  CHECK (nome IS NOT NULL OR nome_empresa IS NOT NULL)                -- RN01 (a)
);

-- CLIENTE — destinatário do orçamento (RF02).
CREATE TABLE cliente (
  id               TEXT PRIMARY KEY,
  profissional_id  TEXT NOT NULL REFERENCES profissional(id) ON DELETE CASCADE,
  nome             TEXT NOT NULL CHECK (length(nome) BETWEEN 2 AND 80),
  telefone         TEXT CHECK (telefone IS NULL OR length(telefone) BETWEEN 10 AND 11),
  email            TEXT CHECK (email IS NULL OR length(email) <= 120),
  endereco         TEXT CHECK (endereco IS NULL OR length(endereco) <= 200),
  criado_em        TEXT NOT NULL,
  atualizado_em    TEXT NOT NULL
);
CREATE INDEX idx_cliente_profissional_nome ON cliente(profissional_id, nome COLLATE NOCASE);

-- ORCAMENTO — proposta comercial (RF03, RF06–RF09).
-- cliente_id é opcional apenas enquanto RASCUNHO (ex.: orçamento recém-criado ou duplicado — CA08.4).
-- A FK de cliente não tem ação de exclusão (NO ACTION): um cliente com orçamentos não pode ser excluído.
CREATE TABLE orcamento (
  id                   TEXT PRIMARY KEY,
  numero               TEXT NOT NULL CHECK (numero GLOB 'ORC-[0-9][0-9][0-9][0-9]-[0-9][0-9][0-9][0-9]*'),
  profissional_id      TEXT NOT NULL REFERENCES profissional(id) ON DELETE CASCADE,
  cliente_id           TEXT REFERENCES cliente(id),
  status               TEXT NOT NULL DEFAULT 'RASCUNHO' CHECK (status IN ('RASCUNHO', 'EMITIDO')),
  prazo_execucao_dias  INTEGER CHECK (prazo_execucao_dias IS NULL OR prazo_execucao_dias BETWEEN 1 AND 365),
  validade_dias        INTEGER NOT NULL DEFAULT 15 CHECK (validade_dias BETWEEN 1 AND 90),
  condicoes_pagamento  TEXT CHECK (condicoes_pagamento IS NULL OR length(condicoes_pagamento) <= 500),
  observacoes          TEXT CHECK (observacoes IS NULL OR length(observacoes) <= 1000),
  total_centavos       INTEGER NOT NULL DEFAULT 0 CHECK (total_centavos >= 0),
  etapa_atual          TEXT NOT NULL DEFAULT 'PREENCHER' CHECK (etapa_atual IN ('PREENCHER', 'DETALHAR', 'REVISAR')),
  data_emissao         TEXT,
  criado_em            TEXT NOT NULL,
  atualizado_em        TEXT NOT NULL,
  UNIQUE (profissional_id, numero),                                    -- RN07
  CHECK (status = 'RASCUNHO'
         OR (data_emissao IS NOT NULL AND prazo_execucao_dias IS NOT NULL AND cliente_id IS NOT NULL))
);
CREATE INDEX idx_orcamento_profissional_atualizado ON orcamento(profissional_id, atualizado_em DESC);
CREATE INDEX idx_orcamento_cliente ON orcamento(cliente_id);

-- ITEM_SERVICO — linhas do orçamento (RF04, RF05, RN04).
CREATE TABLE item_servico (
  id                       TEXT PRIMARY KEY,
  orcamento_id             TEXT NOT NULL REFERENCES orcamento(id) ON DELETE CASCADE,
  ordem                    INTEGER NOT NULL CHECK (ordem BETWEEN 1 AND 50),       -- RN09
  descricao                TEXT NOT NULL CHECK (length(descricao) BETWEEN 3 AND 120),
  quantidade               REAL NOT NULL CHECK (quantidade > 0 AND quantidade <= 99999.99),
  unidade                  TEXT NOT NULL CHECK (unidade IN ('UN', 'M2', 'M', 'H', 'DIARIA', 'VB')),
  valor_unitario_centavos  INTEGER NOT NULL CHECK (valor_unitario_centavos > 0 AND valor_unitario_centavos <= 999999999),
  subtotal_centavos        INTEGER NOT NULL CHECK (subtotal_centavos >= 0),
  UNIQUE (orcamento_id, ordem)
);

-- DOCUMENTO_PDF — snapshot imutável gerado na emissão (RF10, RN10, RN11).
CREATE TABLE documento_pdf (
  id             TEXT PRIMARY KEY,
  orcamento_id   TEXT NOT NULL REFERENCES orcamento(id) ON DELETE CASCADE,
  nome_arquivo   TEXT NOT NULL CHECK (length(nome_arquivo) <= 80),
  tamanho_bytes  INTEGER NOT NULL CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 3145728),  -- RNF06
  hash_sha256    TEXT NOT NULL CHECK (length(hash_sha256) = 64),
  conteudo       BLOB NOT NULL,
  gerado_em      TEXT NOT NULL
);
CREATE INDEX idx_documento_orcamento ON documento_pdf(orcamento_id, gerado_em DESC);

-- SEQUENCIA_NUMERACAO — controle da numeração por profissional e ano (RN07).
CREATE TABLE sequencia_numeracao (
  profissional_id  TEXT NOT NULL REFERENCES profissional(id) ON DELETE CASCADE,
  ano              INTEGER NOT NULL CHECK (ano BETWEEN 2000 AND 9999),
  ultimo_numero    INTEGER NOT NULL DEFAULT 0 CHECK (ultimo_numero >= 0),
  PRIMARY KEY (profissional_id, ano)
);

-- RN07: números nunca são reutilizados — a sequência não pode voltar.
CREATE TRIGGER trg_sequencia_nao_decrementa
BEFORE UPDATE OF ultimo_numero ON sequencia_numeracao
WHEN NEW.ultimo_numero < OLD.ultimo_numero
BEGIN
  SELECT RAISE(ABORT, 'RN07: a sequência de numeração não pode ser decrementada');
END;
