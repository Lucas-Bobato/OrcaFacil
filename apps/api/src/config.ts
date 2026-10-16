import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raizApi = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const producao = process.env.NODE_ENV === 'production';

if (producao && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET é obrigatório em produção.');
}

export const config = {
  porta: Number(process.env.PORT ?? 3333),
  caminhoBanco: path.resolve(raizApi, process.env.DATABASE_PATH ?? './data/orcafacil.db'),
  jwtSecret: process.env.JWT_SECRET ?? 'segredo-de-desenvolvimento-troque-em-producao',
  jwtExpiraEm: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim()),
  producao,
};
