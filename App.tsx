import React, { useReducer, useState, useEffect } from 'react';
import { getInitialState, runTick } from './engine';
import { Agent, CONSTANTS } from './types';

const AgentCard = ({ agent }: { agent: Agent }) => {
  const getRoleColor = (role: string) => {
    switch(role) {
      case 'Worker': return 'border-blue-500 text-blue-100';
      case 'Producer': return 'border-amber-500 text-amber-100';
      case 'Employer': return 'border-green-500 text-green-100';
      case 'Government': return 'border-purple-500 text-purple-100';
      default: return 'border-gray-500';
    }
  };

  return (
    <div className={`p-3 border-2 rounded bg-gray-800 ${agent.isAlive ? getRoleColor(agent.role) : 'border-gray-700 opacity-50 grayscale'}`}>
      <div className="flex justify-between items-center mb-2">
        <span className="font-bold text-sm">{agent.name}</span>
        <span className="text-xs uppercase tracking-wider opacity-75">{agent.role}</span>
      </div>
      
      {!agent.isAlive ? (
        <div className="text-red-500 font-bold text-center py-2">DECEASED</div>
      ) : (
        <div className="space-y-1 text-sm font-mono">
          <div className="flex justify-between">
            <span>Cash:</span>
            <span className={agent.money < CONSTANTS.PRICE ? "text-red-400" : "text-green-400"}>
              ${agent.money}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Food:</span>
            <span className={agent.inventory === 0 ? "text-red-400" : "text-blue-400"}>
              {agent.inventory}
            </span>
          </div>
          <div className="mt-2 text-xs text-gray-400 h-4 overflow-hidden text-right italic">
             {agent.lastAction}
          </div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [state, dispatch] = useReducer((state: any, action: any) => {
    switch (action.type) {
      case 'RESET': return getInitialState();
      case 'TICK': return runTick(state);
      default: return state;
    }
  }, null, getInitialState);

  const [autoPlay, setAutoPlay] = useState(false);

  useEffect(() => {
    let interval: any;
    if (autoPlay && state.aliveCount > 0) {
      interval = setInterval(() => {
        dispatch({ type: 'TICK' });
      }, 800);
    }
    return () => clearInterval(interval);
  }, [autoPlay, state.aliveCount]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 p-6 font-sans">
      <header className="mb-6 flex justify-between items-end border-b border-gray-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">EconSim <span className="text-blue-500">MRE v0.1</span></h1>
          <p className="text-xs text-gray-400">Minimal Reproducible Economy (10 Agents)</p>
        </div>
        
        <div className="flex gap-4 text-sm font-mono">
           <div className="bg-gray-900 px-3 py-1 rounded border border-gray-700">
             Tick: <span className="text-white font-bold">{state.tick}</span>
           </div>
           <div className="bg-gray-900 px-3 py-1 rounded border border-gray-700">
             Alive: <span className={state.aliveCount < 10 ? "text-red-400" : "text-green-400"}>{state.aliveCount}/10</span>
           </div>
           <div className="bg-gray-900 px-3 py-1 rounded border border-gray-700">
             Money Supply: <span className="text-yellow-400">${state.totalMoney}</span>
           </div>
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Col: Controls & Rules */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-gray-900 p-4 rounded border border-gray-800">
            <h2 className="text-sm font-bold text-gray-400 uppercase mb-3">Controls</h2>
            <div className="flex gap-2">
              <button 
                onClick={() => dispatch({ type: 'TICK' })}
                disabled={autoPlay || state.aliveCount === 0}
                className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white py-2 rounded font-bold transition-colors"
              >
                Step Tick
              </button>
              <button 
                onClick={() => setAutoPlay(!autoPlay)}
                disabled={state.aliveCount === 0}
                className={`flex-1 py-2 rounded font-bold transition-colors border ${autoPlay ? 'bg-red-900 border-red-700 text-red-100' : 'bg-gray-800 border-gray-700 hover:bg-gray-700'}`}
              >
                {autoPlay ? 'Pause' : 'Auto'}
              </button>
              <button 
                onClick={() => { setAutoPlay(false); dispatch({ type: 'RESET' }); }}
                className="px-4 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white rounded"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="bg-gray-900 p-4 rounded border border-gray-800 text-sm">
             <h2 className="text-sm font-bold text-gray-400 uppercase mb-3">Model Parameters</h2>
             <ul className="space-y-2 font-mono text-gray-300">
                <li className="flex justify-between"><span>Wage</span> <span>${CONSTANTS.WAGE}</span></li>
                <li className="flex justify-between"><span>Food Price</span> <span>${CONSTANTS.PRICE}</span></li>
                <li className="flex justify-between"><span>Tax Rate</span> <span>{CONSTANTS.TAX_RATE * 100}%</span></li>
                <li className="flex justify-between"><span>Survival Need</span> <span>{CONSTANTS.FOOD_NEED} Unit</span></li>
             </ul>
             <div className="mt-4 text-xs text-gray-500 border-t border-gray-800 pt-2">
               Logic: Employer (I) hires Workers (A-F) to help Producers (G-H). 
               1 Worker + 1 Producer = 1 Food.
               Employer owns Food and sells at Market Price.
             </div>
          </div>

          <div className="bg-gray-900 p-4 rounded border border-gray-800 h-64 overflow-hidden flex flex-col">
             <h2 className="text-sm font-bold text-gray-400 uppercase mb-2">Event Log</h2>
             <div className="flex-1 overflow-y-auto font-mono text-xs space-y-1 pr-2">
                {state.logs.map((log: string, i: number) => (
                  <div key={i} className={`pb-1 border-b border-gray-800 ${log.includes('Tick') ? 'text-blue-400 mt-2 font-bold' : log.includes('DEATH') || log.includes('CRITICAL') ? 'text-red-400' : 'text-gray-400'}`}>
                    {log}
                  </div>
                ))}
             </div>
          </div>
        </div>

        {/* Right Col: The 10 Agents Grid */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 gap-3">
            {state.agents.map((agent: Agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>
          
          <div className="mt-6 bg-gray-900 p-4 rounded border border-gray-800">
             <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">Macro Analysis</h3>
             <div className="text-sm text-gray-400">
                {state.tick === 0 && "Simulation pending start."}
                {state.tick > 0 && state.aliveCount < 10 && (
                   <span className="text-red-400">Warning: Population collapse initiated. Check affordability.</span>
                )}
                {state.tick > 0 && state.aliveCount === 10 && (
                   <span className="text-green-400">Economy Stable. Circulation active.</span>
                )}
             </div>
          </div>
        </div>

      </main>
    </div>
  );
}
