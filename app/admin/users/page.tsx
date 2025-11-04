"use client";
import React from 'react';
import useSWR from 'swr';
import { api } from '../../../lib/api';
import { useRouter } from 'next/navigation';
import PhoneInput from 'react-phone-number-input/input';
import 'react-phone-number-input/style.css';

export default function UsersAdminPage() {
  const { data, mutate } = useSWR('/auth/users', () => api.get('/auth/users').then(r => r.data));
  const [form, setForm] = React.useState({ name: '', username: '', email: '', password: '', role: 'sender', phone_number: '' });
  const [err, setErr] = React.useState('');
  const router = useRouter();

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      await api.post('/auth/register', form);
      setForm({ name: '', username: '', email: '', password: '', role: 'sender', phone_number: '' });
      mutate();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'No se pudo crear');
      if (String(e?.response?.status) === '401') router.push('/login');
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Usuarios</h1>
      <form onSubmit={createUser} className="card p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <L label="Nombre"><input className="input w-full" value={form.name} onChange={e=>setForm({ ...form, name: e.target.value })} /></L>
        <L label="Usuario"><input className="input w-full" value={form.username} onChange={e=>setForm({ ...form, username: e.target.value })} /></L>
        <L label="Email"><input className="input w-full" value={form.email} onChange={e=>setForm({ ...form, email: e.target.value })} /></L>
        <L label="Contraseña"><input type="password" className="input w-full" value={form.password} onChange={e=>setForm({ ...form, password: e.target.value })} /></L>
        <L label="Rol">
          <select className="input w-full" value={form.role} onChange={e=>setForm({ ...form, role: e.target.value })}>
            <option value="sender">Enviador</option>
            <option value="admin">Administrador</option>
          </select>
        </L>
        <L label="Número (Argentina)">
          <PhoneInput
            country="AR"
            international
            withCountryCallingCode
            className="input w-full"
            placeholder="Ej: +54 9 11 2345 6789"
            value={form.phone_number as any}
            onChange={(v)=>setForm({ ...form, phone_number: v || '' })}
          />
        </L>
        {err && <div className="text-red-400 text-sm md:col-span-2">{err}</div>}
        <div className="md:col-span-2"><button className="btn">Crear usuario</button></div>
      </form>

      <div className="card p-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b border-white/10">
              <th className="py-2 pr-4">ID</th>
              <th className="py-2 pr-4">Nombre</th>
              <th className="py-2 pr-4">Usuario</th>
              <th className="py-2 pr-4">Email</th>
              <th className="py-2 pr-4">Rol</th>
              <th className="py-2 pr-4">Número</th>
            </tr>
          </thead>
          <tbody>
            {(data?.users || []).map((u: any) => (
              <tr key={u.id} className="border-b border-white/10">
                <td className="py-2 pr-4">{u.id}</td>
                <td className="py-2 pr-4">{u.name || '-'}</td>
                <td className="py-2 pr-4">{u.username}</td>
                <td className="py-2 pr-4">{u.email}</td>
                <td className="py-2 pr-4">{u.role}</td>
                <td className="py-2 pr-4">{u.phone_number || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
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
