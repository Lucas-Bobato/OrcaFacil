import { Router } from 'express';
import type { Db } from './db/connection';
import { autenticar, exigirPerfil } from './middleware/auth';
import { criarControleLimites, type Limites } from './middleware/limites';
import { authService, type OpcoesToken } from './services/authService';
import { clienteService } from './services/clienteService';
import { orcamentoService } from './services/orcamentoService';
import { perfilService } from './services/perfilService';

/** Rotas da API (documentadas em openapi.yaml e docs/06-api.md). */
export function criarRotas(db: Db, token: OpcoesToken, limites: Limites): Router {
  const api = Router();
  const auth = autenticar(db, token.segredo);
  const perfil = exigirPerfil(db);
  const controle = criarControleLimites(limites);

  api.get('/health', (_req, res) => {
    res.json({ status: 'ok', horario: new Date().toISOString() });
  });

  // ------------------------------------------------------------ Conta
  api.post('/auth/cadastro', controle.autenticacaoPorIp, controle.cadastroPorIp, controle.hashes, async (req, res) => {
    res.status(201).json(await authService.cadastrar(db, req.body, token));
  });
  api.post('/auth/login', controle.autenticacaoPorIp, controle.hashes, async (req, res) => {
    res.json(await controle.tentativaDeSenha(req, res, req.body?.email, () => authService.entrar(db, req.body, token)));
  });
  api.get('/auth/me', auth, (_req, res) => {
    res.json(res.locals.usuario);
  });
  api.post('/auth/logout', auth, (_req, res) => {
    authService.sair(db, res.locals.usuario.id);
    res.status(204).end();
  });
  api.post('/auth/senha', auth, controle.hashes, async (req, res) => {
    const { id, email } = res.locals.usuario;
    res.json(await controle.tentativaDeSenha(req, res, email, () => authService.alterarSenha(db, id, req.body, token)));
  });
  api.delete('/conta', auth, controle.hashes, async (req, res) => {
    const { id, email } = res.locals.usuario;
    await controle.tentativaDeSenha(req, res, email, () => authService.excluirConta(db, id, req.body));
    res.status(204).end();
  });

  // ------------------------------------------------------------ Perfil (RF01)
  api.get('/perfil', auth, (_req, res) => {
    res.json(perfilService.obter(db, res.locals.usuario.id));
  });
  api.put('/perfil', auth, (req, res) => {
    const { perfil: salvo, criado } = perfilService.salvar(db, res.locals.usuario.id, req.body);
    res.status(criado ? 201 : 200).json(salvo);
  });

  // ------------------------------------------------------------ Clientes (RF02)
  api.get('/clientes', auth, perfil, (req, res) => {
    const busca = typeof req.query.busca === 'string' ? req.query.busca : undefined;
    res.json(clienteService.listar(db, res.locals.profissional.id, busca));
  });
  api.post('/clientes', auth, perfil, (req, res) => {
    res.status(201).json(clienteService.criar(db, res.locals.profissional.id, req.body, limites));
  });
  api.get('/clientes/:id', auth, perfil, (req, res) => {
    res.json(clienteService.obter(db, res.locals.profissional.id, String(req.params.id)));
  });
  api.put('/clientes/:id', auth, perfil, (req, res) => {
    res.json(clienteService.atualizar(db, res.locals.profissional.id, String(req.params.id), req.body));
  });
  api.delete('/clientes/:id', auth, perfil, (req, res) => {
    clienteService.excluir(db, res.locals.profissional.id, String(req.params.id));
    res.status(204).end();
  });

  // ------------------------------------------------------------ Orçamentos (RF03–RF13)
  api.get('/orcamentos', auth, perfil, (req, res) => {
    res.json(orcamentoService.listar(db, res.locals.profissional.id, req.query));
  });
  api.post('/orcamentos', auth, perfil, (req, res) => {
    res.status(201).json(orcamentoService.criar(db, res.locals.profissional, req.body, limites));
  });
  api.get('/orcamentos/:id', auth, perfil, (req, res) => {
    res.json(orcamentoService.detalhar(db, res.locals.profissional, String(req.params.id)));
  });
  api.put('/orcamentos/:id', auth, perfil, (req, res) => {
    res.json(orcamentoService.atualizar(db, res.locals.profissional, String(req.params.id), req.body));
  });
  api.delete('/orcamentos/:id', auth, perfil, (req, res) => {
    orcamentoService.excluir(db, res.locals.profissional.id, String(req.params.id));
    res.status(204).end();
  });
  api.put('/orcamentos/:id/cliente', auth, perfil, (req, res) => {
    res.json(orcamentoService.definirCliente(db, res.locals.profissional, String(req.params.id), req.body, limites));
  });
  api.post('/orcamentos/:id/duplicar', auth, perfil, (req, res) => {
    res.status(201).json(orcamentoService.duplicar(db, res.locals.profissional, String(req.params.id), limites));
  });
  api.post('/orcamentos/:id/itens', auth, perfil, (req, res) => {
    res.status(201).json(orcamentoService.adicionarItem(db, res.locals.profissional, String(req.params.id), req.body));
  });
  api.put('/orcamentos/:id/itens/:itemId', auth, perfil, (req, res) => {
    res.json(
      orcamentoService.atualizarItem(db, res.locals.profissional, String(req.params.id), String(req.params.itemId), req.body),
    );
  });
  api.delete('/orcamentos/:id/itens/:itemId', auth, perfil, (req, res) => {
    res.json(orcamentoService.removerItem(db, res.locals.profissional, String(req.params.id), String(req.params.itemId)));
  });
  api.post('/orcamentos/:id/emitir', auth, perfil, controle.emissaoPorConta, controle.emissoesSimultaneas, async (req, res) => {
    res.json(await orcamentoService.emitir(db, res.locals.profissional, String(req.params.id), limites));
  });
  api.get('/orcamentos/:id/pdf', auth, perfil, (req, res) => {
    const { nomeArquivo, conteudo } = orcamentoService.pdfAtual(db, res.locals.profissional.id, String(req.params.id));
    res
      .type('application/pdf')
      .setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`)
      .setHeader('Cache-Control', 'no-store')
      .send(conteudo);
  });

  return api;
}
