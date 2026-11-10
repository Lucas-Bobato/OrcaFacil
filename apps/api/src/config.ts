import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raizApi = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const producao = process.env.NODE_ENV === 'production';

/** Valores públicos (no repositório, inclusive em versões antigas): nunca valem como segredo. */
const SEGREDOS_CONHECIDOS = new Set(['troque-este-segredo', 'segredo-de-desenvolvimento-troque-em-producao']);
const TAMANHO_MINIMO_SEGREDO = 32;

function resolverJwtSecret(): string {
  const informado = process.env.JWT_SECRET?.trim();
  const utilizavel = informado && !SEGREDOS_CONHECIDOS.has(informado) ? informado : undefined;

  if (producao) {
    if (!utilizavel || utilizavel.length < TAMANHO_MINIMO_SEGREDO) {
      throw new Error(
        `JWT_SECRET é obrigatório em produção: use um valor aleatório com pelo menos ${TAMANHO_MINIMO_SEGREDO} caracteres.`,
      );
    }
    return utilizavel;
  }
  if (utilizavel) return utilizavel;

  // Sem segredo fora de produção: gera um por processo. As sessões caem ao reiniciar, e ninguém pode forjar tokens.
  console.warn('JWT_SECRET não definido: usando um segredo temporário. As sessões terminam quando a API reiniciar.');
  return randomBytes(32).toString('hex');
}

/** Número de proxies confiáveis à frente da API; define de onde vem o IP usado nos limites. */
function resolverTrustProxy(): number | false {
  const saltos = Number(process.env.TRUST_PROXY);
  return Number.isInteger(saltos) && saltos > 0 ? saltos : false;
}

export const config = {
  porta: Number(process.env.PORT ?? 3333),
  caminhoBanco: path.resolve(raizApi, process.env.DATABASE_PATH ?? './data/orcafacil.db'),
  jwtSecret: resolverJwtSecret(),
  jwtExpiraEm: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((o) => o.trim()),
  trustProxy: resolverTrustProxy(),
  producao,
};
