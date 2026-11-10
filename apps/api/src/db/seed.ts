/**
 * Dados iniciais para testes manuais: usuário demo com perfil, clientes e
 * orçamentos (emitidos e rascunho). Usa os próprios serviços, então todas as
 * regras de negócio são aplicadas. Rodar de novo recria o usuário demo.
 *
 *   E-mail: demo@orcafacil.com.br
 *   Senha:  demo1234
 */
import { config } from '../config';
import { usuariosRepo } from '../repositories/usuarios';
import { authService } from '../services/authService';
import { orcamentoService } from '../services/orcamentoService';
import { perfilService } from '../services/perfilService';
import { abrirBanco, migrar, type Db } from './connection';

export const USUARIO_DEMO = { email: 'demo@orcafacil.com.br', senha: 'demo1234' };

export async function semear(db: Db): Promise<void> {
  const existente = usuariosRepo.porEmail(db, USUARIO_DEMO.email);
  if (existente) usuariosRepo.excluir(db, existente.id);

  const { usuario } = await authService.cadastrar(db, USUARIO_DEMO, { segredo: config.jwtSecret, expiraEm: '1h' });
  const { perfil } = perfilService.salvar(db, usuario.id, {
    nome: 'João da Silva',
    nomeEmpresa: 'João Pinturas',
    telefone: '(11) 98765-4321',
    email: 'joao@joaopinturas.com.br',
    documento: '11.222.333/0001-81',
  });

  const orcamentos = [
    {
      cliente: { nome: 'Ana Lima', telefone: '(11) 97777-1234', endereco: 'Av. Brasil, 500 - Casa 2' },
      itens: [
        { descricao: 'Pintura interna completa', quantidade: 80, unidade: 'M2', valorUnitarioCentavos: 2500 },
        { descricao: 'Textura em parede da sala', quantidade: 1, unidade: 'VB', valorUnitarioCentavos: 40000 },
      ],
      condicoes: { prazoExecucaoDias: 5, condicoesPagamento: '50% no início e 50% na conclusão.' },
      emitir: true,
    },
    {
      cliente: { nome: 'Maria Silva', telefone: '(11) 91234-5678', endereco: 'Rua das Flores, 100 - Apto 12' },
      itens: [
        { descricao: 'Pintura de parede', quantidade: 20, unidade: 'M2', valorUnitarioCentavos: 2500 },
        { descricao: 'Massa corrida', quantidade: 1, unidade: 'VB', valorUnitarioCentavos: 30000 },
      ],
      condicoes: {
        prazoExecucaoDias: 2,
        condicoesPagamento: '50% no início e 50% na conclusão.',
        observacoes: 'Materiais por conta do cliente.',
      },
      emitir: true,
    },
    {
      cliente: { nome: 'Carlos Souza', email: 'carlos@email.com' },
      itens: [
        { descricao: 'Pintura de fachada', quantidade: 35, unidade: 'M2', valorUnitarioCentavos: 3000 },
        { descricao: 'Ajudante', quantidade: 2, unidade: 'DIARIA', valorUnitarioCentavos: 5000 },
      ],
      condicoes: {},
      emitir: false,
    },
  ];

  for (const dados of orcamentos) {
    const o = orcamentoService.criar(db, perfil, {});
    orcamentoService.definirCliente(db, perfil, o.id, dados.cliente);
    for (const item of dados.itens) orcamentoService.adicionarItem(db, perfil, o.id, item);
    orcamentoService.atualizar(db, perfil, o.id, {
      ...dados.condicoes,
      etapaAtual: dados.emitir ? 'REVISAR' : 'DETALHAR',
    });
    if (dados.emitir) await orcamentoService.emitir(db, perfil, o.id);
  }
}

// Execução via `npm run db:seed`
if (process.argv[1]?.replace(/\\/g, '/').endsWith('db/seed.ts')) {
  if (config.producao) throw new Error('O seed cria uma conta com senha pública e não pode rodar em produção.');
  const db = abrirBanco(config.caminhoBanco);
  migrar(db);
  await semear(db);
  db.close();
  console.log(`Dados iniciais criados em ${config.caminhoBanco}`);
  console.log(`Entre com ${USUARIO_DEMO.email} / ${USUARIO_DEMO.senha}`);
}
