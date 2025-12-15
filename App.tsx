import React, { useState, useEffect, useRef, useCallback } from 'react';
import { initializeSimulation, runTick } from './services/simulationEngine';
import { WorldState } from './types';
import { MetricsDashboard } from './components/MetricsDashboard';
import { Play, Pause, RefreshCw, Save } from 'lucide-react';

// --- Translation Helpers ---
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
    'SUBSIDY': '补贴',
    'BANKRUPTCY_LIQUIDATION': '破产清算'
  };
  return map[reason] || reason;
};

const App: React.FC = () => {
  const [worldState, setWorldState] = useState<WorldState | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [tickSpeed, setTickSpeed] = useState(500); // ms per tick
  const timerRef = useRef<number | null>(null);

  // Initialize
  useEffect(() => {
    setWorldState(initializeSimulation());
  }, []);

  const handleTick = useCallback(() => {
    setWorldState(prev => {
      if (!prev) return null;
      return runTick(prev);
    });
  }, []);

  // Loop control
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
    setWorldState(initializeSimulation());
  };

  const handleExport = () => {
    if (!worldState) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(worldState.metricsHistory, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `econ_sim_export_tick_${worldState.tick}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  if (!worldState) return <div className="p-10 text-white">正在加载模拟引擎...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans">
      <header className="border-b border-slate-800 bg-slate-900 p-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center font-bold text-slate-900">
            E
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">EconSim 模拟核心 <span className="text-xs font-normal text-slate-400">v0.1.1 Beta</span></h1>
            <div className="text-xs text-slate-400 font-mono">当前周期 (Tick): {worldState.tick.toString().padStart(6, '0')}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 bg-slate-800 rounded px-2 py-1 border border-slate-700">
             <span className="text-xs text-slate-400">速度 (ms)</span>
             <input 
               type="range" 
               min="50" 
               max="2000" 
               step="50"
               value={tickSpeed}
               onChange={(e) => setTickSpeed(Number(e.target.value))}
               className="w-24 accent-emerald-500"
             />
           </div>

           <div className="flex gap-2">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`flex items-center gap-2 px-4 py-2 rounded font-medium transition-colors ${
                isRunning 
                  ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/50' 
                  : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/50'
              }`}
            >
              {isRunning ? <Pause size={16} /> : <Play size={16} />}
              {isRunning ? (isRunning ? '暂停' : '继续') : '运行'}
            </button>
            
            <button
              onClick={handleTick}
              disabled={isRunning}
              className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 disabled:opacity-50"
            >
              单步
            </button>

            <button
              onClick={handleReset}
              className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-400 hover:text-white"
              title="重置模拟"
            >
              <RefreshCw size={16} />
            </button>
            
            <button
              onClick={handleExport}
              className="px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-400 hover:text-white"
              title="导出数据 (JSON)"
            >
              <Save size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="container mx-auto py-6">
        <MetricsDashboard state={worldState} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 px-4 mt-6">
          {/* Agent Sample Inspector */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">代理人 (Agent) 样本观察</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto font-mono text-xs">
              <div className="grid grid-cols-12 gap-2 px-2 py-1 text-slate-500 border-b border-slate-800 mb-2">
                 <div className="col-span-2">ID</div>
                 <div className="col-span-2">类型</div>
                 <div className="col-span-2 text-right">现金</div>
                 <div className="col-span-3 text-right">库存/状态</div>
                 <div className="col-span-3 text-right">市场信号</div>
              </div>
              {Array.from(worldState.agents.values()).slice(0, 8).map(agent => (
                <div key={agent.id} className={`grid grid-cols-12 gap-2 p-2 rounded border items-center ${
                    !agent.active ? 'bg-red-950/30 border-red-900/50 text-slate-500' : 'bg-slate-950/50 border-slate-800/50 hover:border-slate-700'
                  }`}>
                  <div className={`col-span-2 font-bold truncate ${!agent.active ? 'text-red-500' : 'text-emerald-400'}`} title={agent.id}>
                    {agent.id}
                  </div>
                  <div className="col-span-2 text-slate-500">
                    {translateType(agent.type)} 
                    {!agent.active && <span className="text-[10px] ml-1 bg-red-900 text-red-200 px-1 rounded">破产</span>}
                  </div>
                  <div className="col-span-2 text-right text-white">${agent.cash.toFixed(1)}</div>
                  <div className="col-span-3 text-right text-amber-400">
                    {agent.type === 'FIRM' 
                      ? (agent.active ? `存货: ${agent.inventory.CONSUMER_GOODS} | 目标: ${agent.productionTarget}` : '已清算')
                      : `存货: ${agent.inventory.CONSUMER_GOODS} | 满足度: ${(agent.needsSatisfaction! * 100).toFixed(0)}%`}
                  </div>
                  <div className="col-span-3 text-right text-blue-400">
                    {agent.employedAt 
                      ? '已就业' 
                      : (agent.type === 'FIRM' 
                          ? (agent.active ? `售价: $${agent.salesPrice?.toFixed(1)}` : '-')
                          : `期望工资: $${agent.wageExpectation.toFixed(1)}`)}
                  </div>
                </div>
              ))}
              <div className="text-center text-slate-600 italic py-2">... 还有 {Math.max(0, worldState.agents.size - 8)} 个代理人 ...</div>
            </div>
          </div>

          {/* Ledger / Log */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
            <h3 className="text-sm font-bold text-slate-400 mb-3 uppercase tracking-wider">近期交易账本 (Ledger)</h3>
            <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
               <div className="flex justify-between px-2 py-1 text-slate-500 border-b border-slate-800 mb-2">
                  <span className="w-16">时间</span>
                  <span className="w-24">付款方</span>
                  <span className="w-4"></span>
                  <span className="w-24 text-right">收款方</span>
                  <span className="w-16 text-right">金额</span>
                  <span className="flex-1 text-right">备注</span>
               </div>
              {[...worldState.ledger].reverse().slice(0, 20).map((entry, idx) => (
                <div key={idx} className="flex justify-between p-2 bg-slate-950/50 rounded border-b border-slate-800/50">
                  <span className="text-slate-500 w-16">Tick {entry.tick}</span>
                  <span className="text-blue-300 w-24 truncate" title={entry.fromId}>{entry.fromId}</span>
                  <span className="text-slate-600">→</span>
                  <span className="text-emerald-300 w-24 text-right truncate" title={entry.toId}>{entry.toId}</span>
                  <span className="text-white font-bold w-16 text-right">${entry.amount.toFixed(1)}</span>
                  <span className="text-slate-400 text-right flex-1">{translateReason(entry.reason)}</span>
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