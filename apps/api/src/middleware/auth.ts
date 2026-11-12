import type { RequestHandler } from 'express';
import type { Profissional, Usuario } from '@orcafacil/shared';
import type { Db } from '../db/connection';
import { AppError } from '../errors';
import { authService } from '../services/authService';
import { perfilService } from '../services/perfilService';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      usuario: Usuario;
      profissional: Profissional;
    }
  }
}

/** Exige `Authorization: Bearer <token>` válido e coloca o usuário em `res.locals.usuario`. */
export function autenticar(db: Db, segredo: string): RequestHandler {
  return (req, res, next) => {
    const [tipo, token] = (req.headers.authorization ?? '').split(' ');
    if (tipo !== 'Bearer' || !token) {
      throw new AppError(401, 'NAO_AUTENTICADO', 'Entre na sua conta para continuar');
    }
    res.locals.usuario = authService.verificar(db, token, segredo);
    next();
  };
}

/** Exige perfil profissional cadastrado (CA01.1) e coloca-o em `res.locals.profissional`. */
export function exigirPerfil(db: Db): RequestHandler {
  return (_req, res, next) => {
    res.locals.profissional = perfilService.exigir(db, res.locals.usuario.id);
    next();
  };
}
