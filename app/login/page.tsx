"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import PhoneInput from 'react-phone-number-input/input';
import 'react-phone-number-input/style.css';

export default function LoginPage() {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const router = useRouter();
  const [openBootstrap, setOpenBootstrap] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: '', username: '', email: '', password: '', phone_number: '' });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    try {
      const r = await api.post('/auth/login', { email: user.includes('@') ? user : undefined, username: user.includes('@') ? undefined : user, password: pass });
      if (typeof window !== 'undefined' && r?.data?.token) localStorage.setItem('authToken', r.data.token);
      router.push('/dashboard');
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Error al iniciar sesion');
    }
  }

  return (
    <div className="max-w-sm mx-auto card p-6 space-y-4">
      <h1 className="text-xl font-semibold">Iniciar sesion</h1>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <div className="text-sm text-white/70 mb-1">Email o usuario</div>
          <input className="input w-full" value={user} onChange={e => setUser(e.target.value)} />
        </div>
        <div>
          <div className="text-sm text-white/70 mb-1">Contrasena</div>
          <input type="password" className="input w-full" value={pass} onChange={e => setPass(e.target.value)} />
        </div>
        {err && <div className="text-red-400 text-sm">{err}</div>}
        <button className="btn w-full">Entrar</button>
      </form>
      <div className="text-sm text-white/70">Primera vez? Si no hay usuarios, puedes crear el primer administrador.</div>
      <button className="btn-outline" onClick={()=>setOpenBootstrap(v=>!v)}>{openBootstrap ? 'Ocultar' : 'Crear primer admin'}</button>
      {openBootstrap && (
        <form className="space-y-3 pt-2" onSubmit={async (e)=>{e.preventDefault(); setErr(''); try { await api.post('/auth/register', { ...adminForm, role: 'admin' }); alert('Admin creado. Ahora inicia sesion.'); setOpenBootstrap(false);} catch (e:any){ setErr(e?.response?.data?.error || 'No se pudo crear'); } }}>
          <div>
            <div className="text-sm text-white/70 mb-1">Nombre</div>
            <input className="input w-full" value={adminForm.name} onChange={e=>setAdminForm({...adminForm, name: e.target.value})} />
          </div>
          <div>
            <div className="text-sm text-white/70 mb-1">Usuario</div>
            <input className="input w-full" value={adminForm.username} onChange={e=>setAdminForm({...adminForm, username: e.target.value})} />
          </div>
          <div>
            <div className="text-sm text-white/70 mb-1">Email</div>
            <input className="input w-full" value={adminForm.email} onChange={e=>setAdminForm({...adminForm, email: e.target.value})} />
          </div>
          <div>
            <div className="text-sm text-white/70 mb-1">Contrasena</div>
            <input type="password" className="input w-full" value={adminForm.password} onChange={e=>setAdminForm({...adminForm, password: e.target.value})} />
          </div>
          <div>
            <div className="text-sm text-white/70 mb-1">Numero (Argentina)</div>
            <PhoneInput
              country="AR"
              international
              withCountryCallingCode
              className="input w-full"
              placeholder="Ej: +54 9 11 2345 6789"
              value={adminForm.phone_number as any}
              onChange={(v)=>setAdminForm({ ...adminForm, phone_number: v || '' })}
            />
          </div>
          <button className="btn w-full">Crear administrador</button>
        </form>
      )}
    </div>
  );
}
