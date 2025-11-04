"use client";
import useSWR from 'swr';
import { api } from '../../lib/api';
import AuthGate from '../_components/AuthGate';

export default function SentPage(){
  const { data } = useSWR('/sent', () => api.get('/sent').then(r=>r.data));
  const items = data?.items || [];
  return (
    <AuthGate>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Enviados</h1>
        <div className="card p-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-white/10">
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Usuario</th>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Asignado a</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Link</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it:any)=> (
                <tr key={it.plan_id} className="border-b border-white/10">
                  <td className="py-2 pr-4">{it.date}</td>
                  <td className="py-2 pr-4">@{it.username}</td>
                  <td className="py-2 pr-4">{it.full_name || '-'}</td>
                  <td className="py-2 pr-4">{it.assigned_username || '-'}</td>
                  <td className="py-2 pr-4 capitalize">{it.status}</td>
                  <td className="py-2 pr-4"><a className="hover:underline" style={{ color: 'var(--accent)' }} href={it.href} target="_blank">Abrir</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AuthGate>
  );
}

