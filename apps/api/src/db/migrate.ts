import { config } from '../config';
import { abrirBanco, migrar } from './connection';

const db = abrirBanco(config.caminhoBanco);
const aplicadas = migrar(db);
console.log(
  aplicadas.length
    ? `Migrações aplicadas em ${config.caminhoBanco}: ${aplicadas.join(', ')}`
    : `Banco ${config.caminhoBanco} já está atualizado.`,
);
db.close();
