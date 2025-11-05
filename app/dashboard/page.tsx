"use client";
import React, { useEffect, useState } from 'react';
import useSWR from 'swr';
import { apiUrl, api } from '../../lib/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import AuthGate from '../_components/AuthGate';

const fetcher = (url: string) => api.get(url.replace(API_BASE, '')).then(r => r.data);
import { API_BASE } from '../../lib/api';

export default function Dashboard() {
  const { data } = useSWR(apiUrl('/metrics'), (url) => api.get('/metrics').then(r => r.data), { refreshInterval: 5000 });
  const totals = data?.totals || {};
  const rates = data?.rates || {};
  const series = data?.series || {};

  return (
    <AuthGate>
      <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <CardStat label="Prospectos" value={totals.prospects || 0} />
        <CardStat label="Enviados" value={totals.sent || 0} />
        <CardStat label="Clientes" value={totals.won || 0} />
        <CardStat label="Interesados %" value={`${(rates.interested_pct || 0).toFixed(1)}%`} />
        <CardStat label="Cerrados %" value={`${(rates.closed_pct || 0).toFixed(1)}%`} />
        <CardStat label="Tasa conv." value={`${(rates.conversion || 0).toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="col-span-2 card p-4">
          <h2 className="font-semibold mb-3">Mensajes enviados por día</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={(series.sentByDay || []).map((d: any) => ({ date: d.date, sent: d.sent }))}>
                <XAxis dataKey="date" stroke="#e5e7eb" tick={{ fill: '#e5e7eb' }} />
                <YAxis stroke="#e5e7eb" tick={{ fill: '#e5e7eb' }} />
                <Tooltip contentStyle={{ background: 'rgba(10,10,10,0.9)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff' }} labelStyle={{ color: '#fff' }} itemStyle={{ color: '#fff' }} />
                <Line type="monotone" dataKey="sent" stroke="var(--accent)" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card p-4">
          <h2 className="font-semibold mb-3">Costos</h2>
          <div className="space-y-2">
            <div className="flex justify-between"><span>Horas</span><strong>{(rates.hours || 0).toFixed(2)}</strong></div>
            <div className="flex justify-between"><span>Costo total</span><strong>${(rates.cost || 0).toFixed(2)}</strong></div>
            <div className="flex justify-between"><span>CPA (mensaje)</span><strong>${(rates.cpa || 0).toFixed(2)}</strong></div>
            <div className="flex justify-between"><span>CPR (cliente)</span><strong>${(rates.cpr || 0).toFixed(2)}</strong></div>
          </div>
        </div>
      </div>

      {/* Hourly rate moved to Users; editor removed from dashboard */}
      </div>
    </AuthGate>
  );
}

function CardStat({ label, value }: { label: string, value: any }) {
  return (
    <div className="card p-4">
      <div className="text-sm text-white/70">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  )
}

// HourlyRate editor removed
