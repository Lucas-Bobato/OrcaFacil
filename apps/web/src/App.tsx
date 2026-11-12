import type { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { mensagemErro, usePerfil } from './api/hooks';
import { useAuth } from './auth/AuthContext';
import { Carregando, ErroCarregamento } from './components/ui';
import { Cadastrar, Entrar } from './pages/Acesso';
import { Detalhar } from './pages/Detalhar';
import { MeuPerfil } from './pages/MeuPerfil';
import { MeusOrcamentos } from './pages/MeusOrcamentos';
import { PdfPronto } from './pages/PdfPronto';
import { Preencher } from './pages/Preencher';
import { Privacidade } from './pages/Privacidade';
import { Revisar } from './pages/Revisar';

/** Exige sessão; sem token vai para /entrar. */
function ExigeLogin() {
  const { autenticado } = useAuth();
  const local = useLocation();
  return autenticado ? <Outlet /> : <Navigate to="/entrar" replace state={{ de: local.pathname }} />;
}

/** CA01.1 — sem perfil salvo, o usuário é levado a "Meu perfil" antes de usar o app. */
function ExigePerfil() {
  const perfil = usePerfil();
  if (perfil.isPending) return <Tela><Carregando /></Tela>;
  if (perfil.isError) return <Tela><ErroCarregamento mensagem={mensagemErro(perfil.error)} aoTentar={() => perfil.refetch()} /></Tela>;
  if (!perfil.data) return <Navigate to="/perfil" replace />;
  return <Outlet />;
}

function SomenteVisitante({ children }: { children: ReactNode }) {
  const { autenticado } = useAuth();
  return autenticado ? <Navigate to="/" replace /> : children;
}

const Tela = ({ children }: { children: ReactNode }) => <div className="mx-auto max-w-xl p-4">{children}</div>;

export function App() {
  return (
    <Routes>
      <Route path="/entrar" element={<SomenteVisitante><Entrar /></SomenteVisitante>} />
      <Route path="/cadastrar" element={<SomenteVisitante><Cadastrar /></SomenteVisitante>} />
      <Route element={<ExigeLogin />}>
        <Route path="/perfil" element={<MeuPerfil />} />
        <Route path="/privacidade" element={<Privacidade />} />
        <Route element={<ExigePerfil />}>
          <Route path="/" element={<MeusOrcamentos />} />
          <Route path="/orcamentos/:id/preencher" element={<Preencher />} />
          <Route path="/orcamentos/:id/detalhar" element={<Detalhar />} />
          <Route path="/orcamentos/:id/revisar" element={<Revisar />} />
          <Route path="/orcamentos/:id/pdf" element={<PdfPronto />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
