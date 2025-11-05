"use client";
import { useState, type FormEvent } from "react";
import { api } from "../../lib/api";
import AuthGate from "../_components/AuthGate";
import useSWR from "swr";

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<string>('instant scrapper');
  const [category, setCategory] = useState<string>('lead');
  const [network, setNetwork] = useState<string>('instagram');
  const [igAccount, setIgAccount] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const uploads = useSWR('/uploads', () => api.get('/uploads').then(r=>r.data));

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    setLoading(true);
    setResult(null);
    const data = new FormData();
    data.append('file', file);
    data.append('source', source);
    data.append('category', category);
    data.append('network', network);
    if (network === 'instagram' && igAccount) data.append('instagram_account', igAccount);
    try {
      const res = await api.post('/upload', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data);
    } catch (e: any) {
      setResult({ error: e?.response?.data?.error || 'Error al subir' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthGate allow={["admin"]}>
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Cargar base (.xlsx o .csv)</h1>
      <form onSubmit={onSubmit} className="flex items-center gap-4 card p-4">
        <label className="text-sm">
          <div className="text-white/70 mb-1">Fuente</div>
          <select className="input" value={source} onChange={(e)=>setSource(e.target.value)}>
            <option value="instant scrapper">Instant Scrapper</option>
            <option value="mailerfind">Mailerfind</option>
            <option value="generic">Genérico</option>
          </select>
        </label>
        <label className="text-sm">
          <div className="text-white/70 mb-1">Red</div>
          <select className="input" value={network} onChange={(e)=>setNetwork(e.target.value)}>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="tiktok">TikTok</option>
          </select>
        </label>
        {network === 'instagram' && (
          <label className="text-sm">
            <div className="text-white/70 mb-1">Cuenta Instagram (origen)</div>
            <input className="input" placeholder="@cuenta" value={igAccount} onChange={(e)=>setIgAccount(e.target.value)} />
          </label>
        )}
        <label className="text-sm">
          <div className="text-white/70 mb-1">Categoría</div>
          <select className="input" value={category} onChange={(e)=>setCategory(e.target.value)}>
            <option value="lead">Leads</option>
            <option value="sin_categoria">Sin categoría</option>
          </select>
        </label>
        <input
          type="file"
          accept=".xlsx,.csv"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="block text-sm"
        />
        <button
          disabled={!file || loading}
          className="btn disabled:opacity-60"
        >
          {loading ? 'Procesando…' : 'Subir y procesar'}
        </button>
      </form>

      {result && (
        <div className="card p-4">
          {result.error ? (
            <p className="text-red-400">{result.error}</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Stat label="Filas procesadas" value={result.processed} />
              <Stat label="Únicos (archivo)" value={result.unique} />
              <Stat label="Insertados (nuevos)" value={result.inserted} />
              <Stat label="Total en base" value={result.total_prospects} />
              <Stat label="Marcados no deseados" value={result.unwanted_marked} />
              {result.skipped_no_username != null && (
                <Stat label="Saltados (sin usuario)" value={result.skipped_no_username} />
              )}
            </div>
          )}
        </div>
      )}

      <div className="card p-4">
        <h2 className="font-semibold mb-3">Historial de cargas</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-white/10">
                <th className="py-2 pr-4">Fecha</th>
                <th className="py-2 pr-4">Archivo</th>
                <th className="py-2 pr-4">Fuente</th>
                <th className="py-2 pr-4">Red</th>
                <th className="py-2 pr-4">Cuenta IG</th>
                <th className="py-2 pr-4">Insertados</th>
                <th className="py-2 pr-4">No-leads</th>
                <th className="py-2 pr-4">Duplicados</th>
                <th className="py-2 pr-4">Prospectos</th>
                <th className="py-2 pr-4">Planificados</th>
                <th className="py-2 pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {(uploads.data?.uploads || []).map((u:any)=>(
                <tr key={u.id} className="border-b border-white/10">
                  <td className="py-2 pr-4">{new Date(u.created_at).toLocaleString()}</td>
                  <td className="py-2 pr-4">{u.filename}</td>
                  <td className="py-2 pr-4 capitalize">{u.source || '-'}</td>
                  <td className="py-2 pr-4 capitalize">{u.network || '-'}</td>
                  <td className="py-2 pr-4">{u.instagram_account || '-'}</td>
                  <td className="py-2 pr-4">{u.inserted}</td>
                  <td className="py-2 pr-4">{u.unwanted_count}</td>
                  <td className="py-2 pr-4">{u.duplicates_count || 0}</td>
                  <td className="py-2 pr-4">{u.prospects_count}</td>
                  <td className="py-2 pr-4">{u.planned_count}</td>
                  <td className="py-2 pr-4">
                    <div className="flex gap-2">
                      <button className="btn-outline" onClick={async ()=>{
                        const newSource = prompt('Fuente (instant scrapper / mailerfind / generic / otra)', u.source || '') ?? u.source;
                        const newNetwork = prompt('Red (instagram / facebook / tiktok)', u.network || '') ?? u.network;
                        let newAccount = u.instagram_account || '';
                        if ((newNetwork||'').toLowerCase()==='instagram') {
                          const input = prompt('Cuenta Instagram (@cuenta)', u.instagram_account || '');
                          newAccount = (input ?? u.instagram_account) || '';
                        }
                        try {
                          await api.put(`/uploads/${u.id}`, { source: newSource, network: newNetwork, instagram_account: newAccount });
                          uploads.mutate();
                        } catch (e:any) {
                          alert(e?.response?.data?.error || 'No se pudo actualizar');
                        }
                      }}>Editar</button>
                      <button className="btn-outline" onClick={async ()=>{ if(confirm('Eliminar carga y datos asociados?')){ await api.delete(`/uploads/${u.id}`); uploads.mutate(); }}}>Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-white/80">
          <div className="mb-2">¿Cargas antiguas sin tracking? Puedes purgarlas:</div>
          <button className="btn-outline" onClick={async ()=>{
            if(confirm('Esto eliminará TODOS los prospects y planes antiguos sin upload_id. ¿Continuar?')){
              const r = await api.delete('/uploads/legacy/all');
              alert(`Eliminados: ${r.data.deleted_prospects} prospects, ${r.data.deleted_plans} planes`);
              uploads.mutate();
            }
          }}>Purgar cargas antiguas</button>
        </div>
      </div>
    </div>
    </AuthGate>
  );
}

function Stat({ label, value }: { label: string, value: number }) {
  return (
    <div className="card p-3">
      <div className="text-sm text-white/70">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}
