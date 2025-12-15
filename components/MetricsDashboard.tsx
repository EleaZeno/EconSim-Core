import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { EconomicMetrics, WorldState } from '../types';

interface MetricsDashboardProps {
  state: WorldState;
}

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ state }) => {
  const data = state.metricsHistory.slice(-50); // Show last 50 ticks
  const latest = data[data.length - 1] || { gdp: 0, cpi: 0, unemploymentRate: 0, moneySupply: 0 };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full p-4">
      {/* KPI Cards */}
      <div className="col-span-1 md:col-span-2 grid grid-cols-4 gap-4 mb-4">
        <div className="bg-slate-800 p-4 rounded-lg shadow border border-slate-700">
          <h3 className="text-slate-400 text-sm font-semibold">GDP (名义)</h3>
          <p className="text-2xl font-bold text-emerald-400">${latest.gdp.toFixed(0)}</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg shadow border border-slate-700">
          <h3 className="text-slate-400 text-sm font-semibold">平均物价 (CPI)</h3>
          <p className="text-2xl font-bold text-blue-400">${latest.cpi.toFixed(2)}</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg shadow border border-slate-700">
          <h3 className="text-slate-400 text-sm font-semibold">失业率</h3>
          <p className="text-2xl font-bold text-rose-400">{(latest.unemploymentRate * 100).toFixed(1)}%</p>
        </div>
        <div className="bg-slate-800 p-4 rounded-lg shadow border border-slate-700">
          <h3 className="text-slate-400 text-sm font-semibold">货币供应量 (M1)</h3>
          <p className="text-2xl font-bold text-amber-400">${latest.moneySupply.toFixed(0)}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 h-64">
        <h4 className="text-white mb-2 font-medium">GDP 与 货币供应趋势</h4>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="tick" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff' }}
              formatter={(value: number, name: string) => [
                value.toFixed(0), 
                name === 'gdp' ? 'GDP' : '货币供应'
              ]}
            />
            <Area type="monotone" dataKey="gdp" stackId="1" stroke="#10b981" fill="#10b981" fillOpacity={0.3} />
            <Area type="monotone" dataKey="moneySupply" stackId="2" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 h-64">
        <h4 className="text-white mb-2 font-medium">通胀与失业率 (菲利普斯曲线)</h4>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="tick" stroke="#94a3b8" />
            <YAxis yAxisId="left" stroke="#ef4444" />
            <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" />
            <Tooltip 
              contentStyle={{ backgroundColor: '#1e293b', border: 'none', color: '#fff' }} 
              formatter={(value: number, name: string) => [
                name === 'unemploymentRate' ? `${(value * 100).toFixed(1)}%` : value.toFixed(2),
                name === 'unemploymentRate' ? '失业率' : 'CPI'
              ]}
            />
            <Line yAxisId="left" type="monotone" dataKey="unemploymentRate" stroke="#ef4444" strokeWidth={2} dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="cpi" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};