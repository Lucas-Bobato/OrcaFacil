import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { clienteSchema, formatarTelefone, type ClienteInput, type Orcamento } from '@orcafacil/shared';
import { useAtualizarOrcamento, useDefinirCliente, usePerfil } from '../api/hooks';
import { BarraEtapa, Pagina } from '../components/Layout';
import { Botao, Campo, Nota, RotuloSecao } from '../components/ui';
import { aplicarErrosApi } from '../lib/formularios';
import { useAutosave } from '../lib/useAutosave';
import { ComOrcamento, StatusSalvamento } from './comum';

/** T2 · 01 Preencher — dados do cliente (US02). */
export function Preencher() {
  return (
    <ComOrcamento titulo="Novo orçamento" etapa={1}>
      {(o) => <FormularioCliente key={o.id} orcamento={o} />}
    </ComOrcamento>
  );
}

function FormularioCliente({ orcamento }: { orcamento: Orcamento }) {
  const navigate = useNavigate();
  const { data: perfil } = usePerfil();
  const definirCliente = useDefinirCliente(orcamento.id);
  const atualizar = useAtualizarOrcamento(orcamento.id);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const c = orcamento.cliente;

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ClienteInput>({
    resolver: zodResolver(clienteSchema),
    defaultValues: {
      nome: c?.nome ?? '',
      telefone: formatarTelefone(c?.telefone),
      email: c?.email ?? '',
      endereco: c?.endereco ?? '',
    },
  });

  // Salvamento automático do rascunho enquanto os dados forem válidos (CA08.3).
  const valores = useWatch({ control }) as ClienteInput;
  const valido = clienteSchema.safeParse(valores).success;
  const { estado, salvarAgora } = useAutosave(valores, valido, (v) => definirCliente.mutateAsync(v));

  const proximo = handleSubmit(async (dados) => {
    setErroGeral(null);
    try {
      await salvarAgora();
      await definirCliente.mutateAsync(dados);
      await atualizar.mutateAsync({ etapaAtual: 'DETALHAR' });
      navigate(`/orcamentos/${orcamento.id}/detalhar`);
    } catch (e) {
      setErroGeral(aplicarErrosApi(e, setError));
    }
  });

  const contatoPerfil = perfil ? [perfil.nomeEmpresa ?? perfil.nome, formatarTelefone(perfil.telefone)].join(' · ') : '';

  return (
    <Pagina
      topo={<BarraEtapa titulo={orcamento.cliente ? 'Orçamento' : 'Novo orçamento'} numero={orcamento.numero} etapa={1} voltarPara="/" />}
      rodape={
        <Botao bloco icone="avancar" className="min-h-14" onClick={proximo} carregando={isSubmitting}>
          Próximo
        </Botao>
      }
    >
      {/* CA01.4 — dados do profissional já preenchidos a partir do perfil */}
      <section className="mb-6 rounded-2xl bg-neutro p-4" aria-label="Profissional">
        <div className="mb-1 flex items-center justify-between">
          <RotuloSecao>Profissional</RotuloSecao>
          <Link to="/perfil" className="-my-2 rounded-lg px-2 py-2 font-medium text-primaria hover:bg-primaria-clara">
            Editar
          </Link>
        </div>
        <p className="text-[17px]">{contatoPerfil}</p>
      </section>

      <form onSubmit={proximo} noValidate className="flex flex-col gap-5">
        <RotuloSecao>Cliente</RotuloSecao>
        <Campo rotulo="Nome do cliente" obrigatorio autoComplete="off" erro={errors.nome?.message} {...register('nome')} />
        <Controller
          control={control}
          name="telefone"
          render={({ field }) => (
            <Campo
              rotulo="Telefone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="(11) 91234-5678"
              erro={errors.telefone?.message}
              {...field}
              value={field.value ?? ''}
              onChange={(e) => field.onChange(formatarTelefone(e.target.value))}
            />
          )}
        />
        <Campo rotulo="E-mail" type="email" inputMode="email" autoComplete="off" placeholder="cliente@email.com" erro={errors.email?.message} {...register('email')} />
        <Campo rotulo="Endereço do serviço" autoComplete="off" erro={errors.endereco?.message} {...register('endereco')} />
        {erroGeral ? <Nota tom="erro">{erroGeral}</Nota> : <StatusSalvamento estado={estado} />}
        <button type="submit" hidden />
      </form>
    </Pagina>
  );
}
