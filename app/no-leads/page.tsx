"use client";
import useSWR from 'swr';
import { api } from '../../lib/api';
import AuthGate from '../_components/AuthGate';

export default function NoLeadsPage(){
  const { data, mutate } = useSWR('/prospects?only_unwanted=1&limit=100&offset=0', () => api.get('/prospects', { params: { only_unwanted: '1', limit: 100, offset: 0 } }).then(r=>r.data));
  const items = data?.items || [];
  return (
    <AuthGate allow={["admin"]}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">No-Leads</h1>
        <div className="text-sm text-white/70">Total: {data?.total ?? items.length}</div>
        <div className="card p-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-white/10">
                <th className="py-2 pr-4">Perfil</th>
                <th className="py-2 pr-4">Usuario</th>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Link</th>
                <th className="py-2 pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it:any)=>(
                <tr key={it.id} className="border-b border-white/10">
                  <td className="py-2 pr-4"><img src={it.avatar_url || `https://unavatar.io/instagram/${it.username}`} className="w-8 h-8 rounded-full" /></td>
                  <td className="py-2 pr-4">@{it.username}</td>
                  <td className="py-2 pr-4">{it.full_name || '-'}</td>
                  <td className="py-2 pr-4"><a className="hover:underline" style={{ color: 'var(--accent)' }} href={it.href} target="_blank">Abrir</a></td>
                  <td className="py-2 pr-4">
                    <button className="btn" onClick={async ()=>{ await api.put(`/prospects/${it.id}`, { unwanted: 0 }); mutate(); }}>Lead</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AuthGate>
  );
}
