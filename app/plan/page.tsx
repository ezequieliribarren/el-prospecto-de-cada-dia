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
  

  async function startTimer(){ await api.post('/work/start'); }
  async function stopTimer(){ await api.post('/work/stop'); }

  React.useEffect(()=>{
    const role = me.data?.user?.role;
    if (role === 'admin') {
      // Intenta asegurar planificación de próximas semanas en background
      // api.post('/plan/auto', { days: 60 }).catch(()=>{});
    }
  }, [me.data?.user?.role]);

  return (
    <AuthGate>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Enviar</h1>

        {range.data?.no_senders && (
          <div className="card p-4 text-sm text-white/80">No hay usuarios con rol sender. Crea al menos uno en Usuarios.</div>
        )}

        <TopControls
          isAdmin={me.data?.user?.role==='admin'}
          isSender={me.data?.user?.role==='sender'}
          perDay={settings.data?.per_day ?? 25}
          onSavePerDay={async (n:number)=>{ await api.post('/settings', { per_day: n }); settings.mutate(); range.mutate(); }}
          onLoadMore={()=>{ setDays(d=>d+2); range.mutate(); }}
          onStart={startTimer}
          onStop={stopTimer}
        />

        <RangeBoard
          data={range.data}
          user={me.data?.user}
          onMark={async (id:number, status:string)=>{ await api.put(`/plan/${id}/status`, { status }); range.mutate(); }}
          onDelete={async (prospectId:number)=>{ await api.delete(`/prospects/${prospectId}`); range.mutate(); }}
        />

        <div className="hidden">
          <button className="btn-outline" onClick={()=>{ setDays(d=>d+2); range.mutate(); }}>Cargar +2 días</button>
          {me.data?.user?.role==='admin' && (
            <>
              {/* Auto-planificar removido */}
              {/* Asignar usuarios removido: se asignan automáticamente */}
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
  const [copied, setCopied] = React.useState<Record<number, boolean>>({});
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});
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
            <div className="flex items-center justify-between text-white/90 font-semibold mb-3">
              <span>{fmtDate(date)}</span>
              <button
                className="text-sm text-white/70 hover:text-white"
                onClick={()=> setCollapsed(prev => ({ ...prev, [date]: !prev[date] }))}
                aria-label={collapsed[date] ? 'Expandir día' : 'Colapsar día'}
              >{collapsed[date] ? '▶' : '▼'}</button>
            </div>
            {!collapsed[date] && (
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
                          <div className="truncate">
                            <div>{it.full_name || '@'+it.username}</div>
                            <div className="text-xs text-white/60">
                              Carga: {it.upload_created_at ? new Date(it.upload_created_at).toLocaleDateString() : '-'}
                              {' '}
                              • Cuenta: {it.upload_instagram_account || '-'}
                            </div>
                          </div>
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
                            <button
                              className={`btn-outline ${clickable ? '' : 'pointer-events-none opacity-60'}`}
                              onClick={async ()=>{
                                if (!clickable) return;
                                try {
                                  await navigator.clipboard.writeText(it.href);
                                  setCopied(prev => ({ ...prev, [it.plan_id]: true }));
                                  setTimeout(() => setCopied(prev => ({ ...prev, [it.plan_id]: false })), 1500);
                                  setTimeout(()=>onMark(it.plan_id,'sent'), 0);
                                } catch {}
                              }}
                            >{copied[it.plan_id] ? 'Copiado!' : 'Copiar'}</button>
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
            )}
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

function TopControls({ isAdmin, isSender, perDay, onSavePerDay, onLoadMore, onStart, onStop }:{ isAdmin:boolean, isSender:boolean, perDay:number, onSavePerDay:(n:number)=>Promise<void>, onLoadMore:()=>void, onStart:()=>Promise<void>, onStop:()=>Promise<void> }){
  const [val, setVal] = React.useState<number>(perDay || 25);
  React.useEffect(()=>{ setVal(perDay || 25); }, [perDay]);
  const { data, mutate } = useSWR('/work/status', () => api.get('/work/status').then(r=>r.data));
  const active = !!data?.active;
  const [elapsed, setElapsed] = React.useState<number>(data?.elapsed_sec || 0);
  React.useEffect(()=>{
    if (!active) { setElapsed(0); return; }
    setElapsed(data?.elapsed_sec || 0);
    const id = setInterval(()=> setElapsed(e=>e+1), 1000);
    return ()=> clearInterval(id);
  }, [active, data?.elapsed_sec]);
  function fmt(sec:number){ const m = Math.floor(sec/60); const s = sec%60; return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`; }
  return (
    <div className="flex items-center gap-2">
      {isAdmin && (
        <label className="text-sm flex items-end gap-2">
          <span className="text-white/70 mb-1">Mensajes/día por sender</span>
          <input type="number" min={1} className="input w-24" value={val} onChange={e=>setVal(Number(e.target.value)||1)} />
          <button className="btn" onClick={()=>onSavePerDay(val)}>Guardar</button>
        </label>
      )}
      <button className="btn-outline" onClick={onLoadMore}>Cargar +2 días</button>
      {isSender && (
        <div className="ml-auto flex items-center gap-2">
          <div className="text-sm text-white/70">{active ? fmt(elapsed) : '00:00'}</div>
          {!active ? (
            <button className="btn-outline" onClick={async ()=>{ await onStart(); mutate(); }}>Iniciar cronómetro</button>
          ) : (
            <button className="btn-outline" onClick={async ()=>{ await onStop(); mutate(); }}>Detener</button>
          )}
        </div>
      )}
    </div>
  );
}
