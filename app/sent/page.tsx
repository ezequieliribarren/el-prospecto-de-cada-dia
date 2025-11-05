"use client";
import React from 'react';
import useSWR from 'swr';
import { api } from '../../lib/api';
import AuthGate from '../_components/AuthGate';

export default function SentPage(){
  const [q, setQ] = React.useState('');
  const [showInterested, setShowInterested] = React.useState(false);
  const [showWon, setShowWon] = React.useState(false);
  function buildStatuses(){
    const arr:string[] = [];
    if (showInterested) arr.push('interested');
    if (showWon) arr.push('won');
    return arr.join(',');
  }
  const queryKey = ['/sent', q, showInterested, showWon];
  const { data, mutate } = useSWR(queryKey, () => api.get('/sent', { params: {
    q: q || undefined,
    statuses: buildStatuses() || undefined,
  }}).then(r=>r.data));
  const items = data?.items || [];
  return (
    <AuthGate>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Enviados</h1>
        <div className="text-xs text-white/60">Total: {items.length}</div>
        <div className="card p-4 grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
          <L label="Buscar">
            <input className="input w-full" value={q} onChange={e=>setQ(e.target.value)} placeholder="usuario o telefono" />
          </L>
          <L label="Interesados">
            <input type="checkbox" checked={showInterested} onChange={e=>setShowInterested(e.target.checked)} />
          </L>
          <L label="Cerrados">
            <input type="checkbox" checked={showWon} onChange={e=>setShowWon(e.target.checked)} />
          </L>
        </div>
        <div className="card p-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-white/10">
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Usuario</th>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Asignado a</th>
                <th className="py-2 pr-4">Estado</th>
                <th className="py-2 pr-4">Interesado</th>
                <th className="py-2 pr-4">Cerrado</th>
                <th className="py-2 pr-4">WhatsApp</th>
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
                  <td className="py-2 pr-4">
                    <input
                      type="checkbox"
                      checked={it.status === 'interested' || it.status === 'won'}
                      onChange={async (e)=>{
                        const checked = e.target.checked;
                        const newStatus = checked ? 'interested' : (it.status === 'interested' ? 'sent' : it.status);
                        if (newStatus !== it.status) {
                          await api.put(`/plan/${it.plan_id}/status`, { status: newStatus });
                          mutate();
                        }
                      }}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <input
                      type="checkbox"
                      checked={it.status === 'won'}
                      onChange={async (e)=>{
                        const checked = e.target.checked;
                        const newStatus = checked ? 'won' : (it.status === 'won' ? 'sent' : it.status);
                        if (newStatus !== it.status) {
                          await api.put(`/plan/${it.plan_id}/status`, { status: newStatus });
                          mutate();
                        }
                      }}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <WhatsInput prospectId={it.prospect_id} initial={it.whatsapp_number || ''} />
                  </td>
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

function WhatsInput({ prospectId, initial }: { prospectId: number, initial: string }){
  const [val, setVal] = React.useState(initial);
  const [saving, setSaving] = React.useState(false);
  React.useEffect(()=>{ setVal(initial); }, [initial]);
  return (
    <div className="flex items-center gap-2">
      <input className="input w-40" value={val} onChange={e=>setVal(e.target.value)} onBlur={async ()=>{
        setSaving(true);
        try { await api.put(`/sent/prospect/${prospectId}/whatsapp`, { whatsapp_number: val }); } finally { setSaving(false); }
      }} placeholder="+549..." />
      {saving && <span className="text-xs text-white/70">Guardando...</span>}
    </div>
  );
}

function L({ label, children }: { label: string, children: React.ReactNode }){
  return (
    <label className="text-sm">
      <div className="text-white/70 mb-1">{label}</div>
      {children}
    </label>
  );
}



