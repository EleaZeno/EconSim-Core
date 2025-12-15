
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeSimulation, runTick } from './services/simulationEngine';
import { WorldState } from './types';
import { EXPERIMENTS } from './constants';
import { MetricsDashboard } from './components/MetricsDashboard';
import { Play, Pause, RefreshCw, Save, FlaskConical } from 'lucide-react';

const translateType = (type: string) => {
  const map: Record<string, string> = {
    'HOUSEHOLD': '家庭',
    'FIRM': '企业',
    'BANK': '银行',
    'GOVERNMENT': '政府',
    'CENTRAL_BANK': '央行'
  };
  return map[type] || type;
};

const translateReason = (reason: string) => {
  const map: Record<string, string> = {
    'WAGE_PAYMENT': '支付工资',
    'PURCHASE_GOODS': '购买商品',
    'INCOME_TAX': '个人所得税',
    'WEALTH_TAX': '财富税',
    'SUBSIDY': '一般补贴',
    'EMERGENCY_WELFARE': '生存低保',
    'BANKRUPTCY_LIQUIDATION': '破产清算',
    'BOND_INTEREST': '国债利息',
    'BOND_PURCHASE': '购买国债',
    'BOND_REDEMPTION': '赎回国债'
  };
  return map[reason] || reason;
};

const App: React.FC = () => {
  const [selectedExperiment, setSelectedExperiment] = useState<string>('BASELINE');
  const [worldState, setWorldState] = useState<WorldState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [tickSpeed, setTickSpeed] = useState(500); 
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setWorldState(initializeSimulation(selectedExperiment));
  }, [selectedExperiment]);

  const handleTick = useCallback(() => {
    setWorldState(prev => {
      if (!prev) return null;
      return runTick(prev);
    });
  }, []);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = window.setInterval(handleTick, tickSpeed);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, tickSpeed, handleTick]);

  const handleReset = () => {
    setIsRunning(false);
    setWorldState(initializeSimulation(selectedExperiment));
  };

  const handleExport = () => {
    if (!worldState) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(worldState.metricsHistory, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `econ_sim_${selectedExperiment}_tick_${worldState.tick}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  if (!worldState) return <div className="p-10 text-white">正在初始化实验环境...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      <header className="border-b border-slate-800 bg-slate-900 p-4 flex flex-col md:flex-row items-center justify-between sticky top-0 z-10 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded flex items-center justify-center font-bold text-slate-900 shadow-lg shadow-emerald-900/50">
            <FlaskConical size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              EconSim Core <span className="text-xs bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-emerald-400">v0.3.0 Modular</span>
            </h1>
            <div className="text-xs text-slate-400 font-mono flex gap-2">
               <span>时刻 (Tick): {worldState.tick.toString().padStart(6, '0')}</span>
               <span className="text-slate-600">|</span>
               <span>{worldState.config.name.split(' (')[0]}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 flex-wrap justify-center">
           {/* Experiment Selector */}
           <div className="flex items-center gap-2">
             <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">实验配置:</span>
             <select 
               value={selectedExperiment}
               onChange={(e) => {
                 setIsRunning(false);
                 setSelectedExperiment(e.target.value);
               }}
               className="bg-slate-950 border border-slate-700 text-xs rounded px-2 py-1.5 focus:border-emerald-500 outline-none w-48"
             >
               {Object.values(EXPERIMENTS).map(exp => (
                 <option key={exp.id} value={Object.keys(EXPERIMENTS).find(key => EXPERIMENTS[key].id === exp.id)}>
                   {exp.name}
                 </option>
               ))}
             </select>
           </div>

           <div className="h-6 w-px bg-slate-800 hidden md:block"></div>

           <div className="flex items-center gap-2 bg-slate-950 rounded px-2 py-1 border border-slate-700">
             <span className="text-xs text-slate-400">FPS</span>
             <input 
               type="range" 
               min="50" 
               max="2000" 
               step="50"
               value={tickSpeed}
               onChange={(e) => setTickSpeed(Number(e.target.value))}
               className="w-16 accent-emerald-500 h-1"
             />
           </div>

           <div className="flex gap-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded font-medium transition-colors border text-sm ${
                isRunning 
                  ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/50' 
                  : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/50'
              }`}
            >
              {isRunning ? <Pause size={14} /> : <Play size={14} />}
              {isRunning ? '暂停' : '运行'}
            </button>
            
            <button onClick={handleTick} disabled={isRunning} className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 disabled:opacity-50 text-sm">
              单步
            </button>

            <button onClick={handleReset} className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-400 hover:text-white" title="重置环境">
              <RefreshCw size={14} />
            </button>
            
            <button onClick={handleExport} className="px-2 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-400 hover:text-white" title="导出 JSON 数据">
              <Save size={14} />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-6 px-4">
        {/* Experiment Info Banner */}
        <div className="mb-6 p-4 bg-slate-900/50 border border-slate-800 rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
               <h2 className="text-emerald-400 font-bold text-sm mb-1">活跃机制堆栈 (Mechanism Stack)</h2>
               <div className="flex flex-wrap gap-2">
                  {worldState.config.activeMarkets.map(m => (
                    <span key={m} className="text-[10px] bg-blue-900/30 text-blue-300 border border-blue-800 px-2 py-0.5 rounded">{m}</span>
                  ))}
                  {worldState.config.activeInstitutions.map(i => (
                    <span key={i} className="text-[10px] bg-purple-900/30 text-purple-300 border border-purple-800 px-2 py-0.5 rounded">{i}</span>
                  ))}
               </div>
            </div>
            <div className="text-xs text-slate-400 max-w-md text-right italic">
              "{worldState.config.description}"
            </div>
        </div>

        <MetricsDashboard state={worldState} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider flex justify-between">
              <span>代理人状态监控 (Agents)</span>
              <span className="text-emerald-500">共 {worldState.agents.size} 个体</span>
            </h3>
            <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-xs pr-2">
              <div className="grid grid-cols-12 gap-2 px-2 py-1 text-slate-500 border-b border-slate-800 mb-2 font-bold bg-slate-950">
                 <div className="col-span-2">ID</div>
                 <div className="col-span-2">类型</div>
                 <div className="col-span-2 text-right">现金余额</div>
                 <div className="col-span-3 text-right">核心指标</div>
                 <div className="col-span-3 text-right">策略输出</div>
              </div>
              {Array.from(worldState.agents.values()).slice(0, 8).map(agent => (
                <div key={agent.id} className={`grid grid-cols-12 gap-2 p-2 rounded border items-center transition-colors ${
                    !agent.active ? 'bg-red-950/20 border-red-900/30 text-slate-600' : 'bg-slate-950/30 border-slate-800/50 hover:bg-slate-800'
                  }`}>
                  <div className={`col-span-2 font-bold truncate ${!agent.active ? 'text-red-500' : 'text-emerald-400'}`} title={agent.id}>
                    {agent.id}
                  </div>
                  <div className="col-span-2 text-slate-500 truncate">
                    {translateType(agent.type)} 
                  </div>
                  <div className={`col-span-2 text-right ${agent.cash < 0 ? 'text-red-400' : 'text-slate-200'}`}>${agent.cash.toFixed(0)}</div>
                  <div className="col-span-3 text-right text-amber-400">
                    {agent.type === 'FIRM' 
                      ? (agent.active ? `存:${agent.inventory.CONSUMER_GOODS} E:${agent.memory.avgProfit.toFixed(0)}` : '已破产')
                      : `技:${agent.skillLevel?.toFixed(2)}`}
                  </div>
                  <div className="col-span-3 text-right text-blue-400">
                    {agent.employedAt 
                      ? '在职' 
                      : (agent.type === 'FIRM' 
                          ? (agent.active ? `$${agent.salesPrice?.toFixed(1)}` : '-')
                          : `期望:$${agent.wageExpectation.toFixed(0)}`)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <h3 className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">实时交易账本 (Transaction Ledger)</h3>
            <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs pr-2">
               <div className="flex justify-between px-2 py-1 text-slate-500 border-b border-slate-800 mb-2 font-bold bg-slate-950">
                  <span className="w-12">Tick</span>
                  <span className="w-20">转出方</span>
                  <span className="w-4"></span>
                  <span className="w-20 text-right">转入方</span>
                  <span className="w-16 text-right">金额</span>
                  <span className="flex-1 text-right">交易类型</span>
               </div>
              {[...worldState.ledger].reverse().slice(0, 20).map((entry, idx) => (
                <div key={idx} className="flex justify-between p-2 bg-slate-950/30 rounded border-b border-slate-800/30 hover:bg-slate-900">
                  <span className="text-slate-600 w-12">{entry.tick}</span>
                  <span className="text-blue-300 w-20 truncate" title={entry.fromId}>{entry.fromId}</span>
                  <span className="text-slate-700">→</span>
                  <span className="text-emerald-300 w-20 text-right truncate" title={entry.toId}>{entry.toId}</span>
                  <span className="text-white font-bold w-16 text-right">${entry.amount.toFixed(0)}</span>
                  <span className="text-slate-400 text-right flex-1 truncate">{translateReason(entry.reason)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
