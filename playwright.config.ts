import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

/**
 * Testes E2E: sobem a API (com um banco SQLite novo e descartável) e a
 * interface, e exercitam o fluxo completo no navegador.
 */
const PORTA_API = 3399;
const PORTA_WEB = 5199;
const BANCO = path.resolve('e2e/.tmp/e2e.db');

// A configuração também é avaliada nos workers; só o processo principal recria o banco.
if (process.env.TEST_WORKER_INDEX === undefined) {
  fs.mkdirSync(path.dirname(BANCO), { recursive: true });
  for (const sufixo of ['', '-wal', '-shm']) fs.rmSync(BANCO + sufixo, { force: true });
}

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORTA_WEB}`,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    ...devices['Pixel 7'],
    browserName: 'chromium',
  },
  webServer: [
    {
      command: 'npm run start -w @orcafacil/api',
      url: `http://localhost:${PORTA_API}/api/health`,
      env: {
        PORT: String(PORTA_API),
        DATABASE_PATH: BANCO,
        JWT_SECRET: 'segredo-e2e',
        CORS_ORIGIN: `http://localhost:${PORTA_WEB}`,
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'npm run dev -w @orcafacil/web',
      url: `http://localhost:${PORTA_WEB}`,
      env: { WEB_PORT: String(PORTA_WEB), API_PROXY_TARGET: `http://localhost:${PORTA_API}` },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
