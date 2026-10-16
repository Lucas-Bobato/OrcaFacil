/**
 * Validações de documentos e contatos (RF01, RF02).
 */

export function somenteDigitos(texto: string | null | undefined): string {
  return (texto ?? '').replace(/\D/g, '');
}

/** Telefone com DDD: 10 ou 11 dígitos (CA02.3). */
export function telefoneValido(telefone: string): boolean {
  const d = somenteDigitos(telefone);
  return d.length === 10 || d.length === 11;
}

/** `"11987654321"` → `"(11) 98765-4321"`. Aceita entrada parcial (máscara de digitação). */
export function formatarTelefone(telefone: string | null | undefined): string {
  const d = somenteDigitos(telefone).slice(0, 11);
  if (d.length === 0) return '';
  if (d.length <= 2) return `(${d}`;
  const ddd = d.slice(0, 2);
  const resto = d.slice(2);
  if (resto.length <= 4) return `(${ddd}) ${resto}`;
  const corte = d.length === 11 ? 5 : 4;
  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`;
}

function todosIguais(d: string): boolean {
  return /^(\d)\1+$/.test(d);
}

export function cpfValido(cpf: string): boolean {
  const d = somenteDigitos(cpf);
  if (d.length !== 11 || todosIguais(d)) return false;
  const dv = (base: string, pesoInicial: number) => {
    const soma = [...base].reduce((acc, n, i) => acc + Number(n) * (pesoInicial - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return dv(d.slice(0, 9), 10) === Number(d[9]) && dv(d.slice(0, 10), 11) === Number(d[10]);
}

export function cnpjValido(cnpj: string): boolean {
  const d = somenteDigitos(cnpj);
  if (d.length !== 14 || todosIguais(d)) return false;
  const dv = (base: string) => {
    const pesos =
      base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = [...base].reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return dv(d.slice(0, 12)) === Number(d[12]) && dv(d.slice(0, 13)) === Number(d[13]);
}

export function cpfCnpjValido(documento: string): boolean {
  const d = somenteDigitos(documento);
  return d.length === 11 ? cpfValido(d) : d.length === 14 ? cnpjValido(d) : false;
}

/** Formata CPF (`000.000.000-00`) ou CNPJ (`00.000.000/0000-00`); parcial na digitação. */
export function formatarDocumento(documento: string | null | undefined): string {
  const d = somenteDigitos(documento).slice(0, 14);
  if (d.length <= 11) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
  }
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}

export function rotuloDocumento(documento: string | null | undefined): string {
  return somenteDigitos(documento).length === 14 ? 'CNPJ' : 'CPF';
}
