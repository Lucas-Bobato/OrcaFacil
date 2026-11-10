import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { removerAcentos } from '@orcafacil/shared';

export type Db = Database.Database;

const pastaMigracoes = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrations');

/**
 * Abre (ou cria) o banco SQLite com integridade referencial ligada.
 * `':memory:'` é usado nos testes.
 */
export function abrirBanco(caminho: string): Db {
  if (caminho !== ':memory:') fs.mkdirSync(path.dirname(caminho), { recursive: true });
  const db = new Database(caminho);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('secure_delete = ON'); // zera as páginas de dados apagados (RNF21)
  // Busca sem acento e sem diferenciar maiúsculas (CA08.2): "maria" encontra "María".
  db.function('normalizar', { deterministic: true }, (texto: unknown) =>
    typeof texto === 'string' ? removerAcentos(texto).toLowerCase() : null,
  );
  return db;
}

/** Aplica, em ordem, as migrações `.sql` ainda não executadas. Retorna os nomes aplicados. */
export function migrar(db: Db): string[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    nome TEXT PRIMARY KEY,
    aplicada_em TEXT NOT NULL
  )`);
  const aplicadas = new Set(
    db.prepare('SELECT nome FROM schema_migrations').all().map((r) => (r as { nome: string }).nome),
  );
  const pendentes = fs
    .readdirSync(pastaMigracoes)
    .filter((f) => f.endsWith('.sql') && !aplicadas.has(f))
    .sort();

  for (const arquivo of pendentes) {
    const sql = fs.readFileSync(path.join(pastaMigracoes, arquivo), 'utf8');
    db.transaction(() => {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (nome, aplicada_em) VALUES (?, ?)').run(
        arquivo,
        new Date().toISOString(),
      );
    })();
  }
  return pendentes;
}
