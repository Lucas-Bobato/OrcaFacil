import { criarApp } from './app';
import { config } from './config';
import { abrirBanco, migrar } from './db/connection';

const db = abrirBanco(config.caminhoBanco);
const aplicadas = migrar(db);
if (aplicadas.length) console.log(`Migrações aplicadas: ${aplicadas.join(', ')}`);

const app = criarApp({
  db,
  jwtSecret: config.jwtSecret,
  jwtExpiraEm: config.jwtExpiraEm,
  corsOrigin: config.corsOrigin,
});

const servidor = app.listen(config.porta, () => {
  console.log(`OrçaFácil API em http://localhost:${config.porta}/api`);
  console.log(`Documentação (Swagger) em http://localhost:${config.porta}/api/docs`);
});

function encerrar() {
  servidor.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', encerrar);
process.on('SIGTERM', encerrar);
