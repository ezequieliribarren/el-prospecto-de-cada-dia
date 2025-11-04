"use client";
import useSWR from 'swr';
import { api } from '../../lib/api';

export default function AuthGate({ children, allow }: { children: React.ReactNode, allow?: ('admin'|'sender')[] }) {
  const { data } = useSWR('/auth/me', () => api.get('/auth/me').then(r => r.data).catch(() => ({ user: null })));
  const user = data?.user || null;
  const role = user?.role;
  const ok = !!user && (!allow || allow.includes(role));
  if (!user) {
    return (
      <div className="card p-6 max-w-md mx-auto text-center">
        <div className="text-lg font-semibold mb-2">Necesitas iniciar sesión</div>
        <a className="btn" href="/login">Ir a login</a>
      </div>
    );
  }
  if (!ok) {
    return (
      <div className="card p-6 max-w-md mx-auto text-center">
        <div className="text-lg font-semibold mb-2">Acceso restringido</div>
        <div className="text-white/70">No tienes permisos para ver esta sección.</div>
      </div>
    );
  }
  return <>{children}</>;
}

