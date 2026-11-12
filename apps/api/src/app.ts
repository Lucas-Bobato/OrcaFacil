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
import { LIMITES_PADRAO, type Limites } from './middleware/limites';
import { criarRotas } from './routes';

export interface OpcoesApp {
  db: Db;
  jwtSecret: string;
  jwtExpiraEm?: string;
  corsOrigin?: string[];
  /** Proxies confiáveis à frente da API; sem isso, `X-Forwarded-For` é ignorado. */
  trustProxy?: number | false;
  limites?: Partial<Limites>;
}

const especificacao = YAML.parse(
  fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'openapi.yaml'), 'utf8'),
);

export function criarApp({ db, jwtSecret, jwtExpiraEm = '7d', corsOrigin = [], trustProxy = false, limites = {} }: OpcoesApp) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', trustProxy);
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(cors({ origin: corsOrigin, exposedHeaders: ['Content-Disposition', 'Retry-After'] }));
  // A interface nunca envia corpo comprimido; `inflate: false` recusa com 415 antes de descomprimir.
  app.use(express.json({ limit: '100kb', inflate: false }));

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(especificacao, { customSiteTitle: 'OrçaFácil API' }));
  app.get('/api/openapi.json', (_req, res) => {
    res.json(especificacao);
  });
  app.use('/api', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store'); // respostas trazem dados privados da conta
    next();
  });
  app.use('/api', criarRotas(db, { segredo: jwtSecret, expiraEm: jwtExpiraEm }, { ...LIMITES_PADRAO, ...limites }));
  app.use('/api', rotaNaoEncontrada);
  app.use(tratarErros);
  return app;
}
