
import React, { useReducer, useState, useEffect, useRef } from 'react';
import { getInitialState, runTick } from './engine';
import { Agent, SimulationConfig, SimulationState } from './types';

// --- Components ---

const AgentCard = ({ agent }: { agent: Agent }) => {
  const getRoleColor = (role: string) => {
    switch(role) {
      case '工人': return 'border-blue-500/50 text-blue-100 bg-blue-900/10';
      case '生产者': return 'border-amber-500/50 text-amber-100 bg-amber-900/10';
      case '资本家': return 'border-green-500/50 text-green-100 bg-green-900/10';
      case '政府': return 'border-purple-500/50 text-purple-100 bg-purple-900/10';
      default: return 'border-gray-500';
    }
  };

  return (
    <div className={`p-2 border rounded transition-all duration-300 relative ${agent.isAlive ? getRoleColor(agent.role) : 'border-gray-800 bg-gray-900 opacity-40 grayscale'}`}>
      <div className="flex justify-between items-center mb-1">
        <span className="font-bold text-xs truncate w-16">{agent.name}</span>
        <span className="text-[10px] uppercase tracking-wider opacity-75">{agent.role}</span>
      </div>
      
      {!agent.isAlive ? (
        <div className="text-red-900 font-bold text-center py-2 text-xs">DEAD</div>
      ) : (
        <div className="space-y-0.5 text-xs font-mono">
          <div className="flex justify-between">
            <span className="text-gray-500">Cash</span>
            <span className={agent.money < 5 ? "text-red-400" : "text-green-400"}>
              ${agent.money.toFixed(0)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Food</span>
            <span className={agent.inventory === 0 ? "text-red-400" : "text-blue-400"}>
              {agent.inventory}
            </span>
          </div>
          <div className="mt-1 pt-1 border-t border-white/10 text-gray-400 h-4 overflow-hidden text-right italic text-[10px] whitespace-nowrap text-ellipsis">
             {agent.lastAction || '-'}
          </div>
        </div>
      )}
    </div>
  );
};

const AuditPanel = ({ state }: { state: SimulationState }) => {
    const { audit } = state;
    
    const getStatusColor = (level: string) => {
        if (level === 'CRITICAL') return 'bg-red-500 animate-pulse';
        if (level === 'WARNING') return 'bg-yellow-500';
        return 'bg-green-500';
    }

    return (
        <div className="bg-gray-900 p-3 rounded border border-gray-800 h-full">
            <div className="flex justify-between items-center mb-2">
                <h2 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-2">
                    经济审计员
                    <span className={`w-2 h-2 rounded-full ${getStatusColor(audit.systemStatus)}`}></span>
                </h2>
                <span className="text-[10px] bg-gray-800 px-1 rounded text-gray-400">RUNTIME CHECK</span>
            </div>

            <div className="space-y-2 text-xs">
                <div className="flex justify-between items-center border-b border-gray-800 pb-1">
                    <span className="text-gray-400">基尼系数 (Gini)</span>
                    <span className={`font-mono ${audit.giniCoefficient > 0.5 ? 'text-red-400' : 'text-green-400'}`}>
                        {audit.giniCoefficient.toFixed(3)}
                    </span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-800 pb-1">
                    <span className="text-gray-400">通胀率 (5 ticks)</span>
                    <span className={`font-mono ${Math.abs(audit.inflationRate) > 0.2 ? 'text-red-400' : 'text-gray-200'}`}>
                        {(audit.inflationRate * 100).toFixed(1)}%
                    </span>
                </div>
                <div className="flex justify-between items-center border-b border-gray-800 pb-1">
                    <span className="text-gray-400">资金一致性</span>
                    <span className={`font-mono ${audit.integrityCheck ? 'text-green-500' : 'text-red-500 font-bold'}`}>
                        {audit.integrityCheck ? 'PASS' : 'FAIL'}
                    </span>
                </div>
            </div>

            {audit.alerts.length > 0 && (
                <div className="mt-2 bg-red-900/20 border border-red-900/50 p-2 rounded">
                    <div className="text-[10px] font-bold text-red-500 mb-1">系统警报</div>
                    <ul className="list-disc list-inside text-[10px] text-red-300 space-y-1">
                        {audit.alerts.map((alert, i) => (
                            <li key={i}>{alert}</li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}

const Workbench = ({ state, onReset }: { state: SimulationState, onReset: () => void }) => {
    const [copied, setCopied] = useState(false);

    const generateReport = () => {
        const report = {
            tick: state.tick,
            mode: state.config.mode,
            policy: state.config.policy,
            audit: state.audit,
            agents: state.agents.map(a => `${a.name}(${a.role}): $${a.money.toFixed(1)}`),
            totalMoney: state.totalMoney,
            recentLogs: state.logs.slice(0, 5)
        };
        return `\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\``;
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(generateReport());
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 p-2 flex justify-between items-center z-50">
             <div className="flex items-center gap-4 text-xs">
                <span className="font-bold text-gray-500 uppercase">System Workbench</span>
                <span className="text-gray-600">Tick Time: {new Date().toLocaleTimeString()}</span>
             </div>
             <div className="flex gap-2">
                <button 
                    onClick={onReset}
                    className="px-3 py-1 bg-red-900/30 hover:bg-red-900/50 text-red-200 border border-red-900 rounded text-xs transition-colors"
                >
                    Hard Reset
                </button>
                <button 
                    onClick={handleCopy}
                    className="px-3 py-1 bg-blue-900/30 hover:bg-blue-900/50 text-blue-200 border border-blue-900 rounded text-xs transition-colors flex items-center gap-2"
                >
                    {copied ? '已复制到剪贴板' : '导出状态快照 (Issue Report)'}
                </button>
             </div>
        </div>
    );
}

// --- Main App ---

export default function App() {
  const [config, setConfig] = useState<SimulationConfig>({
    mode: 'Gold_Standard',
    policy: 'Laissez_Faire',
    baseWage: 5,
    taxRate: 0.1
  });

  const [state, dispatch] = useReducer((state: any, action: any) => {
    switch (action.type) {
      case 'RESET': return getInitialState(action.payload);
      case 'TICK': return runTick(state);
      default: return state;
    }
  }, null, () => getInitialState(config));

  const handleConfigChange = (newConfig: Partial<SimulationConfig>) => {
      const updated = { ...config, ...newConfig };
      setConfig(updated);
      dispatch({ type: 'RESET', payload: updated });
  };

  // Time Dilation Module
  const [speedMs, setSpeedMs] = useState<number | null>(null); // null = paused

  useEffect(() => {
    let interval: any;
    if (speedMs !== null && state.aliveCount > 0) {
      interval = setInterval(() => {
        dispatch({ type: 'TICK' });
      }, speedMs);
    }
    return () => clearInterval(interval);
  }, [speedMs, state.aliveCount]);

  return (
    <div className="h-screen bg-gray-950 text-gray-200 font-sans flex flex-col overflow-hidden pb-12">
      {/* Header / HUD */}
      <header className="px-4 py-3 border-b border-gray-800 flex justify-between items-center bg-gray-950/80 backdrop-blur shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            ECON<span className="text-blue-500">SIM</span> <span className="text-gray-600 font-normal text-xs">Architect Edition v1.0</span>
          </h1>
        </div>
        
        {/* Time Control Module */}
        <div className="flex items-center gap-1 bg-gray-900 p-1 rounded border border-gray-800">
           <span className="text-[10px] font-bold text-gray-500 px-2 uppercase">Time Scale</span>
           <button 
             onClick={() => setSpeedMs(null)}
             className={`px-3 py-1 text-xs rounded ${speedMs === null ? 'bg-red-900 text-white' : 'hover:bg-gray-700 text-gray-400'}`}
           >
             PAUSE
           </button>
           <button 
             onClick={() => setSpeedMs(1000)}
             className={`px-2 py-1 text-xs rounded ${speedMs === 1000 ? 'bg-blue-700 text-white' : 'hover:bg-gray-700 text-gray-400'}`}
           >
             1x
           </button>
           <button 
             onClick={() => setSpeedMs(500)}
             className={`px-2 py-1 text-xs rounded ${speedMs === 500 ? 'bg-blue-700 text-white' : 'hover:bg-gray-700 text-gray-400'}`}
           >
             2x
           </button>
           <button 
             onClick={() => setSpeedMs(100)}
             className={`px-2 py-1 text-xs rounded ${speedMs === 100 ? 'bg-blue-700 text-white' : 'hover:bg-gray-700 text-gray-400'}`}
           >
             MAX
           </button>
           <div className="w-px h-4 bg-gray-700 mx-1"></div>
           <button 
             onClick={() => dispatch({ type: 'TICK' })}
             disabled={speedMs !== null || state.aliveCount === 0}
             className="px-2 py-1 text-xs rounded hover:bg-gray-700 text-green-400 disabled:opacity-30 disabled:hover:bg-transparent"
           >
             STEP &rarr;
           </button>
        </div>

        <div className="hidden md:flex gap-4 text-xs font-mono">
           <div className="text-right">
             <div className="text-gray-500">M2 Supply</div>
             <div className="text-yellow-400 font-bold">${state.totalMoney.toFixed(0)}</div>
           </div>
           <div className="text-right">
             <div className="text-gray-500">Market Price</div>
             <div className="text-blue-400 font-bold">${state.marketPrice}</div>
           </div>
           <div className="text-right">
             <div className="text-gray-500">Population</div>
             <div className="text-white font-bold">{state.aliveCount}/10</div>
           </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden p-4 grid grid-cols-1 lg:grid-cols-4 gap-4">
        
        {/* Left Column: Config & Audit */}
        <div className="space-y-4 flex flex-col h-full overflow-y-auto pr-1">
          {/* Audit Panel */}
          <AuditPanel state={state} />

          {/* Config Panel */}
          <div className="bg-gray-900 p-3 rounded border border-gray-800">
            <h2 className="text-xs font-bold text-gray-500 uppercase mb-3">System Parameters</h2>
            <div className="space-y-3">
                <div>
                    <label className="text-[10px] text-gray-400 block mb-1 uppercase">Standard</label>
                    <div className="grid grid-cols-2 gap-1">
                        <button 
                            onClick={() => handleConfigChange({ mode: 'Gold_Standard' })}
                            className={`text-xs p-2 rounded border ${config.mode === 'Gold_Standard' ? 'bg-amber-900/30 border-amber-500/50 text-amber-100' : 'bg-gray-950 border-gray-800 text-gray-500'}`}
                        >
                            Gold
                        </button>
                        <button 
                            onClick={() => handleConfigChange({ mode: 'Fiat_Currency' })}
                            className={`text-xs p-2 rounded border ${config.mode === 'Fiat_Currency' ? 'bg-indigo-900/30 border-indigo-500/50 text-indigo-100' : 'bg-gray-950 border-gray-800 text-gray-500'}`}
                        >
                            Fiat
                        </button>
                    </div>
                </div>

                <div>
                    <label className="text-[10px] text-gray-400 block mb-1 uppercase">Governance</label>
                    <div className="grid grid-cols-2 gap-1">
                        <button 
                            onClick={() => handleConfigChange({ policy: 'Laissez_Faire' })}
                            className={`text-xs p-2 rounded border ${config.policy === 'Laissez_Faire' ? 'bg-green-900/30 border-green-500/50 text-green-100' : 'bg-gray-950 border-gray-800 text-gray-500'}`}
                        >
                            Laissez-Faire
                        </button>
                        <button 
                            onClick={() => handleConfigChange({ policy: 'Keynesian_Intervention' })}
                            className={`text-xs p-2 rounded border ${config.policy === 'Keynesian_Intervention' ? 'bg-purple-900/30 border-purple-500/50 text-purple-100' : 'bg-gray-950 border-gray-800 text-gray-500'}`}
                        >
                            Keynesian
                        </button>
                    </div>
                </div>
            </div>
          </div>
          
          {/* Quick Stats */}
          <div className="bg-gray-900 p-3 rounded border border-gray-800 flex-1">
             <h2 className="text-xs font-bold text-gray-500 uppercase mb-2">Metrics</h2>
             <ul className="space-y-1 text-[10px] font-mono text-gray-400">
                <li className="flex justify-between">
                    <span>Unemployment</span>
                    <span className={state.unemploymentRate > 0.2 ? 'text-red-400' : 'text-gray-300'}>
                        {(state.unemploymentRate * 100).toFixed(0)}%
                    </span>
                </li>
                <li className="flex justify-between">
                    <span>Gov Debt</span>
                    <span>${state.govDebt}</span>
                </li>
                 <li className="flex justify-between">
                    <span>Total Food</span>
                    <span>{state.totalFood}</span>
                </li>
             </ul>
          </div>
        </div>

        {/* Center: Agent Grid */}
        <div className="lg:col-span-2 bg-gray-900/30 rounded border border-gray-800/50 flex flex-col h-full overflow-hidden">
           <div className="p-3 border-b border-gray-800/50 bg-gray-900/50 flex justify-between items-center">
              <h3 className="text-xs font-bold text-gray-500 uppercase">
                  Agent State Matrix
              </h3>
              <div className="flex gap-2 text-[10px]">
                 <div className="flex items-center gap-1"><div className="w-2 h-2 bg-blue-900 border border-blue-500 rounded-sm"></div>Worker</div>
                 <div className="flex items-center gap-1"><div className="w-2 h-2 bg-amber-900 border border-amber-500 rounded-sm"></div>Producer</div>
                 <div className="flex items-center gap-1"><div className="w-2 h-2 bg-green-900 border border-green-500 rounded-sm"></div>Capital</div>
              </div>
           </div>
           
           <div className="p-3 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 auto-rows-min">
             {state.agents.map((agent: Agent) => (
               <AgentCard key={agent.id} agent={agent} />
             ))}
           </div>
        </div>

        {/* Right: Console Logs */}
        <div className="bg-black rounded border border-gray-800 flex flex-col h-full overflow-hidden font-mono text-xs">
            <div className="p-2 border-b border-gray-800 bg-gray-900/80 text-gray-500 font-bold text-[10px] uppercase">
                System Log /var/log/sim
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {state.logs.map((log: string, i: number) => (
                <div key={i} className={`border-l-2 pl-2 ${
                    log.includes('Tick') ? 'border-gray-700 text-gray-500 mt-2 mb-1' : 
                    log.includes('死亡') || log.includes('停产') ? 'border-red-900 text-red-400' : 
                    log.includes('干预') || log.includes('错误') ? 'border-purple-900 text-purple-300' :
                    log.includes('价格') ? 'border-yellow-900 text-yellow-500' :
                    'border-transparent text-gray-400'
                }`}>
                    {log}
                </div>
                ))}
            </div>
        </div>
      </main>

      <Workbench state={state} onReset={() => dispatch({ type: 'RESET', payload: config })} />
    </div>
  );
}
