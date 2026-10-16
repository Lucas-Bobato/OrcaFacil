import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../api/client';
import { mensagemErro } from '../api/hooks';
import { useAuth } from '../auth/AuthContext';
import { Confirmacao } from '../components/Dialogo';
import { Icone } from '../components/Icones';
import { BarraEtapa, Pagina } from '../components/Layout';
import { Botao, Cartao, Nota } from '../components/ui';

/** Privacidade e LGPD (RNF21): informa onde estão os dados e permite apagá-los. */
export function Privacidade() {
  const { sair } = useAuth();
  const [confirmando, setConfirmando] = useState(false);
  const apagar = useMutation({ mutationFn: () => api.delete('/conta'), onSuccess: sair });

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
        <Botao variante="perigo" icone="lixeira" bloco className="min-h-14" onClick={() => setConfirmando(true)}>
          Apagar todos os meus dados
        </Botao>
        {apagar.isError ? <Nota tom="erro">{mensagemErro(apagar.error)}</Nota> : null}
      </div>

      {confirmando ? (
        <Confirmacao
          titulo="Apagar todos os dados?"
          mensagem="Sua conta, seu perfil, clientes, orçamentos e PDFs serão apagados definitivamente. Não é possível desfazer."
          rotuloConfirmar="Apagar tudo"
          carregando={apagar.isPending}
          aoConfirmar={() => apagar.mutate()}
          aoCancelar={() => setConfirmando(false)}
        />
      ) : null}
    </Pagina>
  );
}
