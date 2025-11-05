"use client";
import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import { api, ensureApiBase } from '../../lib/api';

export default function Nav() {
  const [apiUp, setApiUp] = useState<boolean | null>(null);
  useEffect(() => {
    let mounted = true;
    async function check() {
      const r = await ensureApiBase();
      if (mounted) setApiUp(r.up);
    }
    check();
    const id = setInterval(check, 3000);
    return () => { mounted = false; clearInterval(id); };
  }, []);
  const { data, mutate } = useSWR(apiUp ? '/auth/me' : null, () => api.get('/auth/me').then(r => r.data).catch(() => ({ user: null })));
  const user = data?.user || null;
  const role = user?.role;

  return (
    <div className="mx-auto max-w-6xl px-4 py-3 flex items-center gap-6 w-full">
      <a href="/" className="font-semibold tracking-wide">Flaks</a>
      <a href="/dashboard" className="text-white/80 hover:text-white">Dashboard</a>
      {role === 'admin' && (<>
        <a href="/upload" className="text-white/80 hover:text-white">Cargar</a>
        <a href="/prospects" className="text-white/80 hover:text-white">Datos</a>
        <a href="/uncategorized" className="text-white/80 hover:text-white">Sin categoria</a>
        <a href="/no-leads" className="text-white/80 hover:text-white">No-Leads</a>
        <a href="/sent" className="text-white/80 hover:text-white">Enviados</a>
        <a href="/users" className="text-white/80 hover:text-white">Usuarios</a>
      </>)}
      <a href="/plan" className="ml-auto font-semibold" style={{ color: 'var(--accent)' }}>Enviar</a>
      <span className="inline-flex items-center gap-3">
        {user ? (
          <>
            <span className="text-sm text-white/80">Hola, {user.name || user.username} <span className="text-white/50">({role})</span></span>
            <button className="btn-outline" onClick={async ()=>{ await api.post('/auth/logout'); mutate(); location.href='/login'; }}>Salir</button>
          </>
        ) : (
          <a className="btn-outline" href="/login">Entrar</a>
        )}
        {apiUp === false && <span className="text-xs text-white/60">API offline</span>}
      </span>
    </div>
  );
}


