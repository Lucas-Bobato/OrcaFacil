import { api } from '../api/client';

/** Baixa o PDF vigente do orçamento (RF11). */
export function buscarPdf(orcamentoId: string) {
  return api.arquivo(`/orcamentos/${orcamentoId}/pdf`);
}

/** Salva o Blob no dispositivo com o nome definido por RN12 (CA07.1). */
export function salvarArquivo(blob: Blob, nomeArquivo: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = nomeArquivo;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** CA07.2 / CA07.3 — o navegador consegue compartilhar arquivos? */
export function podeCompartilharArquivos(): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function' || typeof File === 'undefined') {
    return false;
  }
  try {
    return navigator.canShare({ files: [new File([''], 'teste.pdf', { type: 'application/pdf' })] });
  } catch {
    return false;
  }
}

/** Abre a folha de compartilhamento nativa com o PDF anexado. Devolve `false` se o usuário cancelar. */
export async function compartilharArquivo(blob: Blob, nomeArquivo: string, titulo: string): Promise<boolean> {
  const arquivo = new File([blob], nomeArquivo, { type: 'application/pdf' });
  try {
    await navigator.share({ files: [arquivo], title: titulo });
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false;
    throw e;
  }
}
