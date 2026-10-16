/**
 * Schemas de validação de entrada (Zod), compartilhados entre API e interface.
 * As mensagens são as definidas nos critérios de aceite.
 */
import { z } from 'zod';
import { cpfCnpjValido, somenteDigitos, telefoneValido } from './documento';
import { VALOR_UNITARIO_MAXIMO_CENTAVOS } from './money';
import { ETAPAS, LIMITE_ITENS, UNIDADES } from './orcamento';

/** Texto opcional: string vazia vira `null`. */
const textoOpcional = (max: number, mensagem: string) =>
  z
    .string()
    .trim()
    .max(max, mensagem)
    .nullish()
    .transform((v) => (v ? v : null));

const emailOpcional = z
  .string()
  .trim()
  .max(120, 'E-mail muito longo')
  .nullish()
  .transform((v) => (v ? v.toLowerCase() : null))
  .refine((v) => v === null || z.string().email().safeParse(v).success, 'E-mail inválido');

const telefoneOpcional = z
  .string()
  .nullish()
  .transform((v) => somenteDigitos(v) || null)
  .refine((v) => v === null || telefoneValido(v), 'Telefone inválido');

// ---------------------------------------------------------------- Conta

export const cadastroSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Informe seu e-mail').email('E-mail inválido').max(120),
  senha: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres').max(72, 'Senha muito longa'),
});
export type CadastroInput = z.input<typeof cadastroSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'Informe seu e-mail').email('E-mail inválido'),
  senha: z.string().min(1, 'Informe sua senha'),
});
export type LoginInput = z.input<typeof loginSchema>;

// ---------------------------------------------------------------- Perfil (RF01, CA01.3)

export const perfilSchema = z
  .object({
    nome: textoOpcional(80, 'Use no máximo 80 caracteres'),
    nomeEmpresa: textoOpcional(80, 'Use no máximo 80 caracteres'),
    telefone: z
      .string()
      .transform(somenteDigitos)
      .refine((v) => v.length > 0, 'Informe seu telefone')
      .refine((v) => v.length === 0 || telefoneValido(v), 'Telefone inválido'),
    email: emailOpcional,
    documento: z
      .string()
      .nullish()
      .transform((v) => somenteDigitos(v) || null)
      .refine((v) => v === null || cpfCnpjValido(v), 'CPF ou CNPJ inválido'),
  })
  .superRefine((p, ctx) => {
    if (!p.nome && !p.nomeEmpresa) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['nome'],
        message: 'Informe seu nome ou o nome da empresa',
      });
    }
  });
export type PerfilInput = z.input<typeof perfilSchema>;
export type PerfilDados = z.output<typeof perfilSchema>;

// ---------------------------------------------------------------- Cliente (RF02, CA02.2, CA02.3)

export const clienteSchema = z.object({
  nome: z
    .string({ required_error: 'Informe o nome do cliente' })
    .trim()
    .min(1, 'Informe o nome do cliente')
    .min(2, 'O nome do cliente deve ter pelo menos 2 caracteres')
    .max(80, 'Use no máximo 80 caracteres'),
  telefone: telefoneOpcional,
  email: emailOpcional,
  endereco: textoOpcional(200, 'Use no máximo 200 caracteres'),
});
export type ClienteInput = z.input<typeof clienteSchema>;
export type ClienteDados = z.output<typeof clienteSchema>;

// ---------------------------------------------------------------- Item de serviço (RN04)

export const itemSchema = z.object({
  descricao: z
    .string({ required_error: 'Descreva o serviço' })
    .trim()
    .min(1, 'Descreva o serviço')
    .min(3, 'A descrição deve ter pelo menos 3 caracteres')
    .max(120, 'Use no máximo 120 caracteres'),
  quantidade: z
    .number({ required_error: 'Informe a quantidade', invalid_type_error: 'Informe a quantidade' })
    .gt(0, 'A quantidade deve ser maior que 0')
    .max(99_999.99, 'A quantidade máxima é 99.999')
    .refine((q) => Math.abs(Math.round(q * 100) - q * 100) < 1e-6, 'Use no máximo 2 casas decimais'),
  unidade: z.enum(UNIDADES, { errorMap: () => ({ message: 'Unidade inválida' }) }),
  valorUnitarioCentavos: z
    .number({ required_error: 'Informe o valor unitário', invalid_type_error: 'Informe o valor unitário' })
    .int('Valor inválido')
    .gt(0, 'O valor deve ser maior que R$ 0,00')
    .max(VALOR_UNITARIO_MAXIMO_CENTAVOS, 'O valor máximo é R$ 9.999.999,99'),
});
export type ItemInput = z.input<typeof itemSchema>;
export type ItemDados = z.output<typeof itemSchema>;

/** Criação de item: aceita a posição (`ordem`) para o "Desfazer" (CA04.3). */
export const novoItemSchema = itemSchema.extend({
  ordem: z.number().int().min(1).max(LIMITE_ITENS).optional(),
});

// ---------------------------------------------------------------- Condições (RN05, RN06)

export const prazoSchema = z
  .number({ invalid_type_error: 'Informe um prazo entre 1 e 365 dias' })
  .int('Informe um prazo entre 1 e 365 dias')
  .min(1, 'Informe um prazo entre 1 e 365 dias')
  .max(365, 'Informe um prazo entre 1 e 365 dias');

export const validadeSchema = z
  .number({ invalid_type_error: 'Informe uma validade entre 1 e 90 dias' })
  .int('Informe uma validade entre 1 e 90 dias')
  .min(1, 'Informe uma validade entre 1 e 90 dias')
  .max(90, 'Informe uma validade entre 1 e 90 dias');

export const atualizarOrcamentoSchema = z
  .object({
    clienteId: z.string().uuid('Cliente inválido').nullable(),
    prazoExecucaoDias: prazoSchema.nullable(),
    validadeDias: validadeSchema,
    condicoesPagamento: textoOpcional(500, 'Use no máximo 500 caracteres'),
    observacoes: textoOpcional(1000, 'Use no máximo 1000 caracteres'),
    etapaAtual: z.enum(ETAPAS),
  })
  .partial()
  .strict();
export type AtualizarOrcamentoInput = z.input<typeof atualizarOrcamentoSchema>;

export const criarOrcamentoSchema = z
  .object({
    clienteId: z.string().uuid('Cliente inválido').nullish(),
  })
  .strict();

/** Converte um ZodError em `{ campo: mensagem }` (primeira mensagem de cada campo). */
export function errosPorCampo(error: z.ZodError): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const issue of error.issues) {
    const chave = issue.path.join('.') || '_';
    if (!campos[chave]) campos[chave] = issue.message;
  }
  return campos;
}
