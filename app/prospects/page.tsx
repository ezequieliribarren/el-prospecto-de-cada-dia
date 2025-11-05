"use client";
import React from 'react';
import useSWR from 'swr';
import { apiUrl, api } from '../../lib/api';
import AuthGate from '../_components/AuthGate';

export default function ProspectsPage() {
  const [q, setQ] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [date, setDate] = React.useState('');
  const [exclude, setExclude] = React.useState(true);
  const [onlyUnwanted, setOnlyUnwanted] = React.useState(false);
  const [uploadId, setUploadId] = React.useState('');
  const [srcFilter, setSrcFilter] = React.useState('');
  const [acctFilter, setAcctFilter] = React.useState('');
  const [page, setPage] = React.useState(0);
  const [showDup, setShowDup] = React.useState(false);
  const limit = 50;

  const uploads = useSWR('/uploads', () => api.get('/uploads').then(r=>r.data));
  const { data } = useSWR(
    apiUrl(`/prospects?q=${encodeURIComponent(q)}&status=${status}&date=${date}&exclude_unwanted=${exclude ? '1' : '0'}&only_unwanted=${onlyUnwanted ? '1' : '0'}&upload_id=${uploadId}&source=${encodeURIComponent(srcFilter)}&account=${encodeURIComponent(acctFilter)}&duplicates=${showDup ? '1':'0'}&limit=${limit}&offset=${page*limit}`),
    () => api.get(`/prospects`, { params: { q, status, date, exclude_unwanted: exclude ? '1':'0', only_unwanted: onlyUnwanted ? '1':'0', upload_id: uploadId || undefined, source: srcFilter || undefined, account: acctFilter || undefined, duplicates: showDup ? '1' : undefined, limit, offset: page*limit } }).then(r => r.data)
  );

  const items = data?.items || [];
  const total = data?.total || 0;
  const pages = Math.ceil(total / limit);

  return (
    <AuthGate allow={["admin"]}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Datos</h1>
        <div className="text-sm text-white/70">Total: {total}</div>

        <div className="card p-4 grid grid-cols-2 md:grid-cols-9 gap-3 items-end">
          <L label="Buscar"><input className="input w-full" value={q} onChange={e => setQ(e.target.value)} placeholder="usuario o nombre" /></L>
          <L label="Estado">
            <select className="input w-full" value={status} onChange={e => setStatus(e.target.value)}>
              <option value="">Todos</option>
              <option value="pending">Pendiente</option>
              <option value="sent">Enviado</option>
              <option value="won">Cliente</option>
            </select>
          </L>
          <L label="Dia asignado"><input type="date" className="input w-full" value={date} onChange={e => setDate(e.target.value)} /></L>
          <L label="Duplicados"><input type="checkbox" checked={showDup} onChange={e => { setShowDup(e.target.checked); setPage(0); }} /></L>
          <L label="Carga">
            <select className="input w-full" value={uploadId} onChange={e=>setUploadId(e.target.value)}>
              <option value="">Todas</option>
              {(uploads.data?.uploads || []).map((u:any)=>(
                <option key={u.id} value={u.id}>{u.id} - {u.filename}</option>
              ))}
            </select>
          </L>
          <L label="Fuente">
            <select className="input w-full" value={srcFilter} onChange={e=>{ setSrcFilter(e.target.value); setPage(0); }}>
              <option value="">Todas</option>
              {Array.from(new Set((uploads.data?.uploads||[]).map((u:any)=>u.source).filter(Boolean))).map((s:string)=>(
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </L>
          <L label="Cuenta">
            <select className="input w-full" value={acctFilter} onChange={e=>{ setAcctFilter(e.target.value); setPage(0); }}>
              <option value="">Todas</option>
              {Array.from(new Set((uploads.data?.uploads||[]).map((u:any)=>u.instagram_account).filter(Boolean))).map((s:string)=>(
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </L>
          <L label="Filtrar no deseados"><input type="checkbox" checked={exclude} onChange={e => setExclude(e.target.checked)} /></L>
        </div>

        <div className="card p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-white/10">
                  <th className="py-2 pr-4">Perfil</th>
                  <th className="py-2 pr-4">Cuenta</th>
                  <th className="py-2 pr-4">Link</th>
                  <th className="py-2 pr-4">Fuente</th>
                  <th className="py-2 pr-4">Redes</th>
                  <th className="py-2 pr-4">Cuenta</th>
                  <th className="py-2 pr-4">Dia</th>
                  <th className="py-2 pr-4">Usuario</th>
                  <th className="py-2 pr-4">Estado</th>
                  <th className="py-2 pr-4">Carga</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it: any) => (
                  <tr key={it.id + ':' + (it.plan_id || 'na')} className="border-b border-white/10">
                    <td className="py-2 pr-4">
                      <img src={it.avatar_url || `https://unavatar.io/instagram/${it.username}`} alt="avatar" className="w-8 h-8 rounded-full" onError={(e) => { (e.target as HTMLImageElement).src = `https://unavatar.io/instagram/${it.username}`; }} />
                    </td>
                    <td className="py-2 pr-4">@{it.username}</td>
                    <td className="py-2 pr-4"><a className="hover:underline" style={{ color: 'var(--accent)' }} href={it.href} target="_blank" rel="noreferrer">Abrir</a></td>
                    <td className="py-2 pr-4">{it.upload_source || '-'}</td>
                    <td className="py-2 pr-4">{it.upload_network || '-'}</td>
                    <td className="py-2 pr-4">{it.upload_instagram_account || '-'}</td>
                    <td className="py-2 pr-4">{it.date || '-'}</td>
                    <td className="py-2 pr-4">{it.account_label || '-'}</td>
                    <td className="py-2 pr-4 capitalize">{it.status || '-'}</td>
                    <td className="py-2 pr-4">{it.upload_created_at ? new Date(it.upload_created_at).toLocaleDateString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-4 text-sm">
            <div>Total: {total}</div>
            <div className="flex gap-2">
              <button className="btn-outline" disabled={page<=0} onClick={() => setPage(p => Math.max(0, p-1))}>Anterior</button>
              <span>Pagina {page+1} / {Math.max(pages,1)}</span>
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
  );
}
