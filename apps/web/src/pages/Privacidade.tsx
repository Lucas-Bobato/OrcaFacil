import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { alterarSenhaSchema, type AlterarSenhaInput } from '@orcafacil/shared';
import { api } from '../api/client';
import { mensagemErro } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';
import { Confirmacao } from '../components/Dialogo';
import { Icone } from '../components/Icones';
import { BarraEtapa, Pagina } from '../components/Layout';
import { useToast } from '../components/Toast';
import { Botao, Campo, Cartao, Nota } from '../components/ui';
import { aplicarErrosApi } from '../lib/formularios';

/** Troca de senha: derruba as outras sessões da conta e mantém esta. */
function TrocarSenha() {
  const { trocarSenha } = useAuth();
  const toast = useToast();
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AlterarSenhaInput>({ resolver: zodResolver(alterarSenhaSchema), defaultValues: { senhaAtual: '', novaSenha: '' } });

  const enviar = handleSubmit(async (dados) => {
    setErroGeral(null);
    try {
      await trocarSenha(dados);
      reset();
      toast.mostrar('Senha alterada. As outras sessões foram encerradas.');
    } catch (e) {
      setErroGeral(aplicarErrosApi(e, setError));
    }
  });

  return (
    <Cartao>
      <form onSubmit={enviar} noValidate className="flex flex-col gap-4">
        <p className="font-semibold">Trocar senha</p>
        <Campo rotulo="Senha atual" type="password" autoComplete="current-password" erro={errors.senhaAtual?.message} {...register('senhaAtual')} />
        <Campo rotulo="Nova senha" type="password" autoComplete="new-password" erro={errors.novaSenha?.message} {...register('novaSenha')} />
        {erroGeral ? <Nota tom="erro">{erroGeral}</Nota> : null}
        <Botao type="submit" variante="secundario" carregando={isSubmitting}>
          Trocar senha
        </Botao>
      </form>
    </Cartao>
  );
}

/** Privacidade e LGPD (RNF21): informa onde estão os dados e permite apagá-los. */
export function Privacidade() {
  const { encerrarSessaoLocal } = useAuth();
  const [confirmando, setConfirmando] = useState(false);
  const [senha, setSenha] = useState('');
  const apagar = useMutation({ mutationFn: () => api.delete('/conta', { senha }), onSuccess: encerrarSessaoLocal });

  const cancelar = () => {
    setConfirmando(false);
    setSenha('');
    apagar.reset();
  };

  return (
    <Pagina topo={<BarraEtapa titulo="Privacidade e dados" voltarPara="/perfil" />}>
      <div className="flex flex-col gap-5">
        <Cartao className="flex gap-3">
          <Icone nome="escudo" className="mt-0.5 shrink-0 text-primaria" />
          <div className="space-y-2 leading-relaxed">
            <p className="font-semibold">Onde ficam seus dados</p>
            <p className="text-suave">
              Seu perfil, seus clientes, orçamentos e PDFs ficam guardados na sua conta do OrçaFácil, protegidos por senha,
              para que você acesse tudo de qualquer celular ou computador.
            </p>
            <p className="text-suave">
              Usamos esses dados apenas para montar seus orçamentos. Nada é compartilhado com terceiros e o PDF só é enviado
              ao cliente quando você baixa ou compartilha.
            </p>
          </div>
        </Cartao>
        <Cartao className="flex gap-3">
          <Icone nome="cadeado" className="mt-0.5 shrink-0 text-primaria" />
          <div className="space-y-2 leading-relaxed">
            <p className="font-semibold">Seus direitos (LGPD)</p>
            <p className="text-suave">Você pode corrigir seus dados a qualquer momento em “Meu perfil” e apagar tudo de uma vez abaixo.</p>
          </div>
        </Cartao>
        <TrocarSenha />
        <Botao variante="perigo" icone="lixeira" bloco className="min-h-14" onClick={() => setConfirmando(true)}>
          Apagar todos os meus dados
        </Botao>
      </div>

      {confirmando ? (
        <Confirmacao
          titulo="Apagar todos os dados?"
          mensagem={
            <div className="flex flex-col gap-4">
              <p>Sua conta, seu perfil, clientes, orçamentos e PDFs serão apagados definitivamente. Não é possível desfazer.</p>
              <Campo
                rotulo="Sua senha, para confirmar"
                type="password"
                autoComplete="current-password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
              />
              {apagar.isError ? <Nota tom="erro">{mensagemErro(apagar.error)}</Nota> : null}
            </div>
          }
          rotuloConfirmar="Apagar tudo"
          carregando={apagar.isPending}
          desabilitarConfirmar={!senha}
          aoConfirmar={() => apagar.mutate()}
          aoCancelar={cancelar}
        />
      ) : null}
    </Pagina>
  );
}
