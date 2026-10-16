import { useState, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { cadastroSchema, loginSchema, type LoginInput } from '@orcafacil/shared';
import { useAuth } from '../auth/AuthContext';
import { Icone } from '../components/Icones';
import { Botao, Campo, Nota } from '../components/ui';
import { aplicarErrosApi } from '../lib/formularios';

function TelaAcesso({ titulo, subtitulo, children }: { titulo: string; subtitulo: string; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-xl bg-primaria text-white">
          <Icone nome="arquivo" width={26} height={26} />
        </span>
        <span className="text-2xl font-bold">OrçaFácil</span>
      </div>
      <h1 className="text-3xl font-bold">{titulo}</h1>
      <p className="mt-2 mb-7 text-lg text-suave">{subtitulo}</p>
      {children}
    </div>
  );
}

export function Entrar() {
  const { entrar } = useAuth();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', senha: '' } });

  const enviar = handleSubmit(async (dados) => {
    setErroGeral(null);
    try {
      await entrar(dados);
    } catch (e) {
      setErroGeral(aplicarErrosApi(e, setError));
    }
  });

  return (
    <TelaAcesso titulo="Entrar" subtitulo="Seu trabalho merece um orçamento profissional.">
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <Campo rotulo="E-mail" type="email" autoComplete="email" inputMode="email" erro={errors.email?.message} {...register('email')} />
        <Campo rotulo="Senha" type="password" autoComplete="current-password" erro={errors.senha?.message} {...register('senha')} />
        {erroGeral ? <Nota tom="erro">{erroGeral}</Nota> : null}
        <Botao type="submit" bloco carregando={isSubmitting} className="mt-2 min-h-14">
          Entrar
        </Botao>
      </form>
      <p className="mt-6 text-center text-suave">
        Ainda não tem conta?{' '}
        <Link to="/cadastrar" className="font-semibold text-primaria underline-offset-4 hover:underline">
          Criar conta grátis
        </Link>
      </p>
    </TelaAcesso>
  );
}

const cadastroFormSchema = cadastroSchema
  .extend({ confirmacao: z.string().min(1, 'Repita a senha') })
  .refine((d) => d.senha === d.confirmacao, { path: ['confirmacao'], message: 'As senhas não conferem' });
type CadastroForm = z.input<typeof cadastroFormSchema>;

export function Cadastrar() {
  const { cadastrar } = useAuth();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CadastroForm>({
    resolver: zodResolver(cadastroFormSchema),
    defaultValues: { email: '', senha: '', confirmacao: '' },
  });

  const enviar = handleSubmit(async ({ email, senha }) => {
    setErroGeral(null);
    try {
      await cadastrar({ email, senha });
    } catch (e) {
      setErroGeral(aplicarErrosApi(e, setError));
    }
  });

  return (
    <TelaAcesso titulo="Criar conta" subtitulo="Seus orçamentos ficam salvos e disponíveis em qualquer aparelho.">
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <Campo rotulo="E-mail" type="email" autoComplete="email" inputMode="email" obrigatorio erro={errors.email?.message} {...register('email')} />
        <Campo
          rotulo="Senha"
          type="password"
          autoComplete="new-password"
          obrigatorio
          erro={errors.senha?.message}
          ajuda={<p className="mt-1.5 text-sm text-suave">Mínimo de 8 caracteres.</p>}
          {...register('senha')}
        />
        <Campo rotulo="Repita a senha" type="password" autoComplete="new-password" obrigatorio erro={errors.confirmacao?.message} {...register('confirmacao')} />
        {erroGeral ? <Nota tom="erro">{erroGeral}</Nota> : null}
        <Botao type="submit" bloco carregando={isSubmitting} className="mt-2 min-h-14">
          Criar conta
        </Botao>
      </form>
      <p className="mt-6 text-center text-suave">
        Já tem conta?{' '}
        <Link to="/entrar" className="font-semibold text-primaria underline-offset-4 hover:underline">
          Entrar
        </Link>
      </p>
    </TelaAcesso>
  );
}
