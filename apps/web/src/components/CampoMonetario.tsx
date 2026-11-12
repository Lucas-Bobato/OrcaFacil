import { centavosDeDigitos, formatarBRL } from '@orcafacil/shared';
import { Campo } from './ui';

/**
 * Campo monetário com máscara em centavos (CA03.4, RN03):
 * digitar `1250` exibe `R$ 12,50`. Abre o teclado numérico (RNF16).
 */
export function CampoMonetario({
  rotulo,
  valor,
  aoMudar,
  erro,
  obrigatorio,
  id,
  className,
}: {
  rotulo: string;
  valor: number;
  aoMudar(centavos: number): void;
  erro?: string;
  obrigatorio?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <Campo
      id={id}
      className={className}
      rotulo={rotulo}
      erro={erro}
      obrigatorio={obrigatorio}
      inputMode="numeric"
      autoComplete="off"
      placeholder="R$ 0,00"
      value={valor > 0 ? formatarBRL(valor) : ''}
      onChange={(e) => aoMudar(centavosDeDigitos(e.target.value))}
    />
  );
}
