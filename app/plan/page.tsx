"use client";
import React from 'react';
import useSWR from 'swr';
import dayjs from 'dayjs';
import { api } from '../../lib/api';
import AuthGate from '../_components/AuthGate';

export default function PlanPage(){
  const me = useSWR('/auth/me', () => api.get('/auth/me').then(r=>r.data));
  const [start, setStart] = React.useState(dayjs().format('YYYY-MM-DD'));
  const [days, setDays] = React.useState(2);
  const range = useSWR(['/plan/range', start, days], () => api.get('/plan/range', { params: { start, days } }).then(r=>r.data));
  const settings = useSWR('/settings', () => api.get('/settings').then(r=>r.data));
  const users = useSWR(me.data?.user?.role==='admin' ? '/auth/users' : null, () => api.get('/auth/users').then(r=>r.data));

  async function startTimer(){ await api.post('/work/start'); }
  async function stopTimer(){ await api.post('/work/stop'); }

  React.useEffect(()=>{
    const role = me.data?.user?.role;
    if (role === 'admin') {
      // Intenta asegurar planificación de próximas semanas en background
      api.post('/plan/auto', { days: 60 }).catch(()=>{});
    }
  }, [me.data?.user?.role]);

  return (
    <AuthGate>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Enviar</h1>

        {range.data?.no_senders && (
          <div className="card p-4 text-sm text-white/80">No hay usuarios asignados para Enviar. Ve a Usuarios y crea/selecciona enviadores.</div>
        )}

        <RangeBoard
          data={range.data}
          user={me.data?.user}
          onMark={async (id:number, status:string)=>{ await api.put(`/plan/${id}/status`, { status }); range.mutate(); }}
          onDelete={async (prospectId:number)=>{ await api.delete(`/prospects/${prospectId}`); range.mutate(); }}
        />

        <div className="flex items-center gap-2">
          <button className="btn-outline" onClick={()=>{ setDays(d=>d+2); range.mutate(); }}>Cargar +2 días</button>
          {me.data?.user?.role==='admin' && (
            <>
              <button className="btn-outline" onClick={async ()=>{ await api.post('/plan/auto', { days: 60 }); range.mutate(); }}>Auto-planificar</button>
              <AssignSenders users={users.data?.users || []} settings={settings.data} onSave={async (ids:number[])=>{ await api.post('/settings', { active_senders: ids }); settings.mutate(); range.mutate(); }} />
            </>
          )}
          <div className="ml-auto flex gap-2">
            <button className="btn-outline" onClick={startTimer}>Iniciar cronómetro</button>
            <button className="btn-outline" onClick={stopTimer}>Detener</button>
          </div>
        </div>
      </div>
    </AuthGate>
  );
}

function RangeBoard({ data, user, onMark, onDelete }: { data:any, user:any, onMark:(id:number,status:string)=>Promise<void>, onDelete:(pid:number)=>Promise<void> }){
  if (!data) return null;
  const today = dayjs().format('YYYY-MM-DD');
  const dates: string[] = data.dates || [];
  const items = data.items || [];
  const byDay: Record<string, any[]> = Object.fromEntries(dates.map(d=>[d,[]]));
  for (const it of items){ if (byDay[it.date]) byDay[it.date].push(it); }

  function fmtDate(d:string){
    const dd = dayjs(d);
    const names = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    return `${names[dd.day()]} ${dd.format('D/MM [de] YYYY')}`;
  }

  return (
    <div className="space-y-6">
      {dates.map(date => {
        const list = (byDay[date]||[]);
        // group by assigned user
        const groups: Record<string, any[]> = {};
        for (const it of list){ const key = it.assigned_username || it.account_label || 'Sin asignar'; (groups[key] ||= []).push(it); }
        const locked = date !== today; // sólo hoy clickeable; resto visible pero bloqueado
        return (
          <div key={date} className="card p-4">
            <div className="text-white/90 font-semibold mb-3">{fmtDate(date)}</div>
            <div className="grid grid-cols-1 gap-4">
              {Object.entries(groups).map(([owner, arr]) => (
                <div key={owner} className="rounded-lg border border-white/10">
                  <div className="px-3 py-2 text-sm text-white/70 border-b border-white/10">{owner} ({arr.length})</div>
                  <div>
                    <HeaderRow />
                    {arr.map((it:any)=>{
                      const mine = !user || user.role==='admin' || it.assigned_user_id==null || it.assigned_user_id===user.id;
                      const clickable = mine && (!locked || user?.role==='admin');
                      return (
                        <div key={it.plan_id} className={`grid grid-cols-3 gap-2 items-center px-3 py-2 border-t border-white/10 ${mine ? 'shadow-[0_0_0_1px_rgba(46,255,126,0.25)]' : 'opacity-60'} `}>
                          <div className="truncate">{it.full_name || '@'+it.username}</div>
                          <div className="text-sm capitalize">{it.status}</div>
                          <div className="flex justify-end gap-2">
                            <a
                              className={`btn ${clickable ? '' : 'pointer-events-none opacity-60'}`}
                              href={it.href}
                              target="_blank"
                              onClick={(e)=>{
                                if (!clickable) { e.preventDefault(); return; }
                                // Marca enviado en background para no bloquear popup
                                setTimeout(()=>onMark(it.plan_id,'sent'), 0);
                              }}
                            >Ir</a>
                            {user?.role==='admin' && (
                              <button className="btn-outline" onClick={async ()=>{ await onDelete(it.prospect_id); }}>Eliminar</button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HeaderRow(){
  return (
    <div className="grid grid-cols-3 gap-2 text-xs text-white/60 px-3 py-1">
      <div>Usuario</div>
      <div>Estado</div>
      <div className="text-right">Enviar</div>
    </div>
  );
}

function AssignSenders({ users, settings, onSave }: { users:any[], settings:any, onSave:(ids:number[])=>Promise<void> }){
  const [sel, setSel] = React.useState<number[]>([]);
  React.useEffect(()=>{
    if (settings?.active_senders) setSel(settings.active_senders);
  }, [settings?.active_senders]);
  const senders = (users||[]).filter((u:any)=>u.role==='sender');
  return (
    <div className="flex items-center gap-2">
      <select className="input" multiple value={sel.map(String)} onChange={e=>{ const ids = Array.from(e.target.selectedOptions).map(o=>Number(o.value)); setSel(ids); }}>
        {senders.map((u:any)=>(<option key={u.id} value={u.id}>{u.username}</option>))}
      </select>
      <button className="btn" onClick={()=>onSave(sel)}>Asignar usuarios</button>
    </div>
  );
}
