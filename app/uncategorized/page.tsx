"use client";
import React from 'react';
import useSWR from 'swr';
import { apiUrl, api } from '../../lib/api';
import AuthGate from '../_components/AuthGate';

export default function UncategorizedPage(){
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(0);
  const limit = 50;
  const { data, mutate } = useSWR(apiUrl(`/prospects?q=${encodeURIComponent(q)}&category=uncategorized&limit=${limit}&offset=${page*limit}`), () => api.get(`/prospects`, { params: { q, category: 'uncategorized', limit, offset: page*limit } }).then(r => r.data));
  const items = data?.items || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / limit);
  return (
    <AuthGate allow={["admin"]}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Sin categoría</h1>
        <div className="text-sm text-white/70">Total: {total}</div>
        <div className="card p-4 grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <L label="Buscar"><input className="input w-full" value={q} onChange={e => setQ(e.target.value)} placeholder="usuario o nombre" /></L>
        </div>
        <div className="card p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-white/10">
                  <th className="py-2 pr-4">Perfil</th>
                  <th className="py-2 pr-4">Usuario</th>
                  <th className="py-2 pr-4">Link</th>
                  <th className="py-2 pr-4">Nombre</th>
                  <th className="py-2 pr-4">Carga</th>
                  <th className="py-2 pr-4">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any) => (
                  <tr key={it.id} className="border-b border-white/10">
                    <td className="py-2 pr-4">
                      <img src={it.avatar_url || `https://unavatar.io/instagram/${it.username}`} alt="avatar" className="w-8 h-8 rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = `https://unavatar.io/instagram/${it.username}`; }} />
                    </td>
                    <td className="py-2 pr-4">@{it.username}</td>
                    <td className="py-2 pr-4"><a className="hover:underline" style={{ color: 'var(--accent)' }} href={it.href} target="_blank" rel="noreferrer">Abrir</a></td>
                    <td className="py-2 pr-4">{it.full_name || '-'}</td>
                    <td className="py-2 pr-4">{it.upload_created_at ? new Date(it.upload_created_at).toLocaleString() : '-'}</td>
                    <td className="py-2 pr-4"><button className="btn-outline" onClick={async ()=>{ await api.put(`/prospects/${it.id}`, { category: 'lead' }); mutate(); }}>Marcar como Lead</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-4 text-sm">
            <div>Total: {total}</div>
            <div className="flex gap-2">
              <button className="btn-outline" disabled={page<=0} onClick={() => setPage(p => Math.max(0, p-1))}>Anterior</button>
              <span>Página {page+1} / {Math.max(pages,1)}</span>
              <button className="btn-outline" disabled={page>=pages-1} onClick={() => setPage(p => p+1)}>Siguiente</button>
            </div>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}

function L({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <label className="text-sm">
      <div className="text-white/70 mb-1">{label}</div>
      {children}
    </label>
  )
}

