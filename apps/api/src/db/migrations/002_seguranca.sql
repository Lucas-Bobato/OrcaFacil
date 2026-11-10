-- Auditoria de segurança (docs/08-seguranca.md).

-- S2: versão dos tokens. Aumentar este número invalida todos os tokens já emitidos da conta.
ALTER TABLE usuario ADD COLUMN token_versao INTEGER NOT NULL DEFAULT 0 CHECK (token_versao >= 0);

-- S5: mantém só o PDF vigente de cada orçamento (RN10); nenhuma rota lê os anteriores.
DELETE FROM documento_pdf
WHERE rowid NOT IN (
  SELECT rowid FROM (
    SELECT rowid, ROW_NUMBER() OVER (PARTITION BY orcamento_id ORDER BY gerado_em DESC, rowid DESC) AS posicao
    FROM documento_pdf
  )
  WHERE posicao = 1
);
