import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';
import type { Db } from './db/connection';
import { rotaNaoEncontrada, tratarErros } from './middleware/error';
import { criarRotas } from './routes';

export interface OpcoesApp {
  db: Db;
  jwtSecret: string;
  jwtExpiraEm?: string;
  corsOrigin?: string[];
}

const especificacao = YAML.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'openapi.yaml'), 'utf8'),
);

export function criarApp({ db, jwtSecret, jwtExpiraEm = '7d', corsOrigin = [] }: OpcoesApp) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: corsOrigin, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json({ limit: '100kb' }));

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(especificacao, { customSiteTitle: 'OrçaFácil API' }));
  app.get('/api/openapi.json', (_req, res) => {
    res.json(especificacao);
  });
  app.use('/api', criarRotas(db, { segredo: jwtSecret, expiraEm: jwtExpiraEm }));
  app.use('/api', rotaNaoEncontrada);
  app.use(tratarErros);
  return app;
}
