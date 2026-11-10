import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { ApiError } from './api/client';
import { App } from './App';
import { AuthProvider } from './auth/AuthContext';
import { ToastProvider } from './components/Toast';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      // Não insiste em erros de regra/autorização; tenta de novo só falhas de rede/servidor.
      retry: (tentativas, erro) => !(erro instanceof ApiError && erro.status >= 400 && erro.status < 500) && tentativas < 2,
    },
  },
});

// Defesa contra clickjacking em hospedagens sem os cabeçalhos de apps/web/vercel.json:
// dentro de um iframe a aplicação não abre, nem toca na sessão.
const emQuadro = window.top !== window.self;

createRoot(document.getElementById('root')!).render(
  emQuadro ? (
    <p className="p-6">O OrçaFácil não pode ser aberto dentro de outra página.</p>
  ) : (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <AuthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </StrictMode>
  ),
);
