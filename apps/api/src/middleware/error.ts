import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { errosPorCampo, type ErroResposta } from '@orcafacil/shared';
import { AppError } from '../errors';

/** 404 para rotas inexistentes da API. */
export const rotaNaoEncontrada: RequestHandler = (req, res) => {
  const corpo: ErroResposta = {
    erro: { codigo: 'ROTA_NAO_ENCONTRADA', mensagem: `Rota ${req.method} ${req.path} não encontrada` },
  };
  res.status(404).json(corpo);
};

/**
 * Converte qualquer erro no formato padrão `{ erro: { codigo, mensagem, campos?, pendencias? } }`.
 * - ZodError → 400 VALIDACAO com mensagens por campo
 * - AppError → status/código definidos pela regra de negócio
 * - JSON malformado → 400 JSON_INVALIDO
 * - outros erros 4xx do Express → REQUISICAO_INVALIDA
 * - demais → 500 ERRO_INTERNO (detalhes só no log)
 */
export const tratarErros: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let corpo: ErroResposta = {
    erro: { codigo: 'ERRO_INTERNO', mensagem: 'Ocorreu um erro inesperado. Tente novamente.' },
  };

  if (err instanceof ZodError) {
    status = 400;
    corpo = { erro: { codigo: 'VALIDACAO', mensagem: 'Verifique os campos destacados', campos: errosPorCampo(err) } };
  } else if (err instanceof AppError) {
    status = err.status;
    corpo = { erro: { codigo: err.codigo, mensagem: err.message, ...err.extra } };
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    corpo = { erro: { codigo: 'JSON_INVALIDO', mensagem: 'O corpo da requisição não é um JSON válido' } };
  } else if (err?.type === 'entity.too.large') {
    status = 413;
    corpo = { erro: { codigo: 'CORPO_MUITO_GRANDE', mensagem: 'A requisição é muito grande' } };
  } else if (err?.status >= 400 && err?.status < 500) {
    // Erros do cliente vindos do Express: corpo comprimido, URL malformada etc.
    status = err.status;
    corpo = { erro: { codigo: 'REQUISICAO_INVALIDA', mensagem: 'A requisição não pôde ser processada' } };
  } else {
    console.error(err);
  }
  res.status(status).json(corpo);
};
