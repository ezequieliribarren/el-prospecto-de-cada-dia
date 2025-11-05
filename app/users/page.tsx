"use client";
import React from 'react';
import useSWR from 'swr';
import { api } from '../../lib/api';
import AuthGate from '../_components/AuthGate';

export default function UsersPage(){
  const { data, mutate } = useSWR('/auth/users', () => api.get('/auth/users').then(r=>r.data));
  const users = data?.users || [];
  const [editing, setEditing] = React.useState<any|null>(null);
  const [creating, setCreating] = React.useState(false);
  const [q, setQ] = React.useState('');
  const [page, setPage] = React.useState(0);
  const limit = 20;
  const filtered = users.filter((u:any)=>{
    const t = (q||'').toLowerCase();
    if (!t) return true;
    return [u.username, u.name, u.email, u.role].some((x:any)=>String(x||'').toLowerCase().includes(t));
  });
  const pages = Math.max(1, Math.ceil(filtered.length / limit));
  const slice = filtered.slice(page*limit, page*limit + limit);
  return (
    <AuthGate allow={["admin"]}>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Usuarios</h1>
        <div className="flex items-end gap-3">
          <label className="text-sm">
            <div className="text-white/70 mb-1">Buscar</div>
            <input className="input" value={q} onChange={e=>{ setQ(e.target.value); setPage(0); }} placeholder="usuario, nombre, email, rol" />
          </label>
          <button className="btn ml-auto" onClick={()=> setCreating(true)}>Nuevo usuario</button>
        </div>
        <div className="card p-4 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-white/10">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Usuario</th>
                <th className="py-2 pr-4">Nombre</th>
                <th className="py-2 pr-4">Email</th>
                <th className="py-2 pr-4">Rol</th>
                <th className="py-2 pr-4">Telefono</th>
                <th className="py-2 pr-4">$/Hora</th>
                <th className="py-2 pr-4">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {slice.map((u:any)=>(
                <tr key={u.id} className="border-b border-white/10">
                  <td className="py-2 pr-4">{u.id}</td>
                  <td className="py-2 pr-4">{u.username}</td>
                  <td className="py-2 pr-4">{u.name || '-'}</td>
                  <td className="py-2 pr-4">{u.email}</td>
                  <td className="py-2 pr-4 capitalize">{u.role}</td>
                  <td className="py-2 pr-4">{u.phone_number || '-'}</td>
                  <td className="py-2 pr-4">{u.hourly_rate ?? 0}</td>
                  <td className="py-2 pr-4">
                    <button className="btn-outline" onClick={()=> setEditing(u)}>Editar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-sm">
          <div>Total: {filtered.length}</div>
          <div className="flex gap-2 items-center">
            <button className="btn-outline" disabled={page<=0} onClick={()=> setPage(p=>Math.max(0,p-1))}>Anterior</button>
            <span>Pagina {page+1} / {pages}</span>
            <button className="btn-outline" disabled={page>=pages-1} onClick={()=> setPage(p=>Math.min(pages-1,p+1))}>Siguiente</button>
          </div>
        </div>
        {editing && (
          <EditUserModal
            user={editing}
            onClose={()=> setEditing(null)}
            onSaved={() => { setEditing(null); mutate(); }}
          />
        )}
        {creating && (
          <CreateUserModal
            onClose={()=> setCreating(false)}
            onSaved={()=>{ setCreating(false); mutate(); }}
          />
        )}
      </div>
    </AuthGate>
  );
}

function EditUserModal({ user, onClose, onSaved }:{ user:any, onClose:()=>void, onSaved:()=>void }){
  const [username, setUsername] = React.useState(user.username || '');
  const [name, setName] = React.useState(user.name || '');
  const [email, setEmail] = React.useState(user.email || '');
  const [role, setRole] = React.useState(user.role || 'sender');
  const [phone, setPhone] = React.useState(user.phone_number || '');
  const [hourly, setHourly] = React.useState<number>(user.hourly_rate ?? 0);
  const [password, setPassword] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  async function onSubmit(e: React.FormEvent){
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const body:any = { username, name, email, role, phone_number: phone, hourly_rate: hourly };
      if (password) body.password = password;
      await api.post(`/auth/users/${user.id}`, body);
      onSaved();
    } catch (e:any) {
      setError(e?.response?.data?.error || 'No se pudo actualizar');
    } finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="card p-6 w-full max-w-lg">
        <div className="text-lg font-semibold mb-4">Editar usuario #{user.id}</div>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="text-sm block">
            <div className="text-white/70 mb-1">Usuario</div>
            <input className="input w-full" value={username} onChange={e=>setUsername(e.target.value)} required />
          </label>
          <label className="text-sm block">
            <div className="text-white/70 mb-1">Nombre</div>
            <input className="input w-full" value={name} onChange={e=>setName(e.target.value)} />
          </label>
          <label className="text-sm block">
            <div className="text-white/70 mb-1">Email</div>
            <input type="email" className="input w-full" value={email} onChange={e=>setEmail(e.target.value)} required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm block">
              <div className="text-white/70 mb-1">Rol</div>
              <select className="input w-full" value={role} onChange={e=>setRole(e.target.value)}>
                <option value="sender">Sender</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label className="text-sm block">
              <div className="text-white/70 mb-1">Telefono (+54...)</div>
              <input className="input w-full" value={phone} onChange={e=>setPhone(e.target.value)} />
            </label>
          </div>
          <label className="text-sm block">
            <div className="text-white/70 mb-1">$/Hora</div>
            <input type="number" min={0} step={0.01} className="input w-full" value={hourly} onChange={e=>setHourly(Number(e.target.value)||0)} />
          </label>
          <label className="text-sm block">
            <div className="text-white/70 mb-1">Nueva contrasena (opcional)</div>
            <input type="password" className="input w-full" value={password} onChange={e=>setPassword(e.target.value)} />
          </label>
          {error && <div className="text-sm text-red-400">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
            <button className="btn" disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateUserModal({ onClose, onSaved }:{ onClose:()=>void, onSaved:()=>void }){
  const [username, setUsername] = React.useState('');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<'admin'|'sender'>('sender');
  const [phone, setPhone] = React.useState('');
  const [hourly, setHourly] = React.useState<number>(0);
  const [password, setPassword] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  async function onSubmit(e: React.FormEvent){
    e.preventDefault(); setSaving(true); setError('');
    try {
      await api.post('/auth/register', { username, name, email, password, role, phone_number: phone, hourly_rate: hourly });
      onSaved();
    } catch (e:any) {
      setError(e?.response?.data?.error || 'No se pudo crear');
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="card p-6 w-full max-w-lg">
        <div className="text-lg font-semibold mb-4">Nuevo usuario</div>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="text-sm block">
            <div className="text-white/70 mb-1">Usuario</div>
            <input className="input w-full" value={username} onChange={e=>setUsername(e.target.value)} required />
          </label>
          <label className="text-sm block">
            <div className="text-white/70 mb-1">Nombre</div>
            <input className="input w-full" value={name} onChange={e=>setName(e.target.value)} />
          </label>
          <label className="text-sm block">
            <div className="text-white/70 mb-1">Email</div>
            <input type="email" className="input w-full" value={email} onChange={e=>setEmail(e.target.value)} required />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm block">
              <div className="text-white/70 mb-1">Rol</div>
              <select className="input w-full" value={role} onChange={e=>setRole(e.target.value as any)}>
                <option value="sender">Sender</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label className="text-sm block">
              <div className="text-white/70 mb-1">Telefono (+54...)</div>
              <input className="input w-full" value={phone} onChange={e=>setPhone(e.target.value)} />
            </label>
          </div>
          <label className="text-sm block">
            <div className="text-white/70 mb-1">$/Hora</div>
            <input type="number" min={0} step={0.01} className="input w-full" value={hourly} onChange={e=>setHourly(Number(e.target.value)||0)} />
          </label>
          <label className="text-sm block">
            <div className="text-white/70 mb-1">Contrasena</div>
            <input type="password" className="input w-full" value={password} onChange={e=>setPassword(e.target.value)} required />
          </label>
          {error && <div className="text-sm text-red-400">{error}</div>}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
            <button className="btn" disabled={saving}>{saving ? 'Creando...' : 'Crear'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}


