import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { formatarDocumento, formatarTelefone, perfilSchema, type PerfilInput } from '@orcafacil/shared';
import { mensagemErro, usePerfil, useSalvarPerfil } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';
import { Icone } from '../components/Icones';
import { BarraEtapa, Pagina } from '../components/Layout';
import { useToast } from '../components/Toast';
import { Botao, Campo, Carregando, ErroCarregamento, Nota } from '../components/ui';
import { aplicarErrosApi } from '../lib/formularios';

const vazio: PerfilInput = { nome: '', nomeEmpresa: '', telefone: '', email: '', documento: '' };

/** T1 · Meu perfil — 1º acesso e edição (US01). */
export function MeuPerfil() {
  const perfil = usePerfil();
  const salvar = useSalvarPerfil();
  const { sair } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const primeiroAcesso = perfil.data === null;

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<PerfilInput>({ resolver: zodResolver(perfilSchema), defaultValues: vazio });

  useEffect(() => {
    if (perfil.data) {
      reset({
        nome: perfil.data.nome ?? '',
        nomeEmpresa: perfil.data.nomeEmpresa ?? '',
        telefone: formatarTelefone(perfil.data.telefone),
        email: perfil.data.email ?? '',
        documento: formatarDocumento(perfil.data.documento),
      });
    }
  }, [perfil.data, reset]);

  const enviar = handleSubmit(async (dados) => {
    setErroGeral(null);
    try {
      await salvar.mutateAsync(dados);
      toast.mostrar('Perfil salvo'); // CA01.2
      navigate('/');
    } catch (e) {
      setErroGeral(aplicarErrosApi(e, setError));
    }
  });

  return (
    <Pagina
      topo={<BarraEtapa titulo={primeiroAcesso ? 'Configure seu perfil' : 'Meu perfil'} semVoltar={primeiroAcesso} voltarPara="/" />}
      rodape={
        perfil.isSuccess ? (
          <Botao bloco icone="check" className="min-h-14" onClick={enviar} carregando={salvar.isPending}>
            {primeiroAcesso ? 'Salvar e começar' : 'Salvar'}
          </Botao>
        ) : null
      }
    >
      {perfil.isPending ? (
        <Carregando />
      ) : perfil.isError ? (
        <ErroCarregamento mensagem={mensagemErro(perfil.error)} aoTentar={() => perfil.refetch()} />
      ) : (
        <form onSubmit={enviar} noValidate className="flex flex-col gap-5">
          <p className="text-lg leading-relaxed text-suave">
            {primeiroAcesso
              ? 'Antes do primeiro orçamento, informe seus dados. Eles aparecem automaticamente em todos os seus orçamentos.'
              : 'Esses dados aparecem em todos os seus orçamentos. Mudanças valem para os próximos PDFs.'}
          </p>
          <Campo rotulo="Seu nome" autoComplete="name" erro={errors.nome?.message} {...register('nome')} />
          <Campo rotulo="Nome da empresa" autoComplete="organization" {...register('nomeEmpresa')} erro={errors.nomeEmpresa?.message} />
          {!errors.nome ? <Nota>Informe seu nome ou o nome da empresa. Um dos dois é obrigatório.</Nota> : null}
          <Controller
            control={control}
            name="telefone"
            render={({ field }) => (
              <Campo
                rotulo="Telefone / WhatsApp"
                obrigatorio
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="(11) 98765-4321"
                erro={errors.telefone?.message}
                {...field}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(formatarTelefone(e.target.value))}
              />
            )}
          />
          <Campo rotulo="E-mail" type="email" inputMode="email" autoComplete="email" erro={errors.email?.message} {...register('email')} />
          <Controller
            control={control}
            name="documento"
            render={({ field }) => (
              <Campo
                rotulo="CPF / CNPJ (opcional)"
                inputMode="numeric"
                erro={errors.documento?.message}
                {...field}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(formatarDocumento(e.target.value))}
              />
            )}
          />
          {erroGeral ? <Nota tom="erro">{erroGeral}</Nota> : null}
          <button type="submit" hidden />

          <div className="flex items-start gap-3 rounded-2xl bg-neutro p-4 text-suave">
            <Icone nome="nuvem" className="mt-0.5 shrink-0" />
            <p>Seus dados ficam salvos na sua conta e você acessa os mesmos orçamentos em qualquer aparelho.</p>
          </div>

          {!primeiroAcesso ? (
            <Link to="/privacidade" className="flex min-h-14 items-center gap-3 rounded-2xl border border-divisor bg-superficie px-4 text-lg font-medium hover:bg-neutro">
              <Icone nome="escudo" className="text-primaria" />
              <span className="flex-1">Privacidade e dados</span>
              <Icone nome="chevron" className="text-suave" />
            </Link>
          ) : null}
          <Botao variante="texto" icone="sair" onClick={sair} className="self-center">
            Sair da conta
          </Botao>
        </form>
      )}
    </Pagina>
  );
}
