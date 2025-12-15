
import { Agent, SimulationState, SimulationConfig, INITIAL_AGENTS, CONSTANTS, AuditReport } from './types';

const clone = (obj: any) => JSON.parse(JSON.stringify(obj));

export const getInitialState = (config?: Partial<SimulationConfig>): SimulationState => {
  const finalConfig: SimulationConfig = {
    mode: 'Gold_Standard',
    policy: 'Laissez_Faire',
    baseWage: 5,
    taxRate: 0.1,
    ...config
  };

  const initialState: SimulationState = {
    tick: 0,
    config: finalConfig,
    agents: clone(INITIAL_AGENTS),
    logs: ['系统初始化完成。等待开始...'],
    totalMoney: INITIAL_AGENTS.reduce((sum, a) => sum + a.money, 0),
    govDebt: 0,
    marketPrice: 6, // Initial price
    priceHistory: [6],
    avgPrice: 6,
    totalFood: 5,
    aliveCount: INITIAL_AGENTS.length,
    unemploymentRate: 0,
    audit: {
      giniCoefficient: 0,
      inflationRate: 0,
      integrityCheck: true,
      alerts: [],
      systemStatus: 'NORMAL'
    }
  };
  
  return runAudit(initialState);
};

// 计算基尼系数 (0 = 完全平等, 1 = 完全不平等)
const calculateGini = (agents: Agent[]): number => {
  const aliveAgents = agents.filter(a => a.isAlive);
  if (aliveAgents.length === 0) return 0;

  const wealths = aliveAgents.map(a => a.money).sort((a, b) => a - b);
  const n = wealths.length;
  if (n === 0) return 0;
  
  // 避免所有人都为0的情况
  const sumWealth = wealths.reduce((a, b) => a + b, 0);
  if (sumWealth === 0) return 0;

  let numerator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i + 1) * wealths[i];
  }

  return (2 * numerator) / (n * sumWealth) - (n + 1) / n;
};

// 经济审计子系统
const runAudit = (state: SimulationState): SimulationState => {
  const alerts: string[] = [];
  let status: 'NORMAL' | 'WARNING' | 'CRITICAL' = 'NORMAL';

  // 1. 计算基尼系数
  const gini = calculateGini(state.agents);
  if (gini > 0.6) {
    alerts.push(`贫富差距极大 (Gini: ${gini.toFixed(2)})`);
    status = 'WARNING';
  }

  // 2. 通胀/通缩检测 (基于过去 5 tick)
  const historyLen = state.priceHistory.length;
  let inflationRate = 0;
  if (historyLen >= 5) {
    const oldPrice = state.priceHistory[historyLen - 5];
    if (oldPrice > 0) {
      inflationRate = (state.marketPrice - oldPrice) / oldPrice;
    }
    if (inflationRate > 0.5) {
      alerts.push(`检测到恶性通胀 (+${(inflationRate * 100).toFixed(0)}%)`);
      status = 'CRITICAL';
    } else if (inflationRate < -0.5) {
      alerts.push(`检测到通缩螺旋 (${(inflationRate * 100).toFixed(0)}%)`);
      status = 'WARNING';
    }
  }

  // 3. 系统完整性检查 (Conservation of Energy/Money)
  // 在金本位下，总现金应该恒定 (忽略精度误差)
  // 在法币下，总现金 = 初始现金 + 政府债务
  const currentTotalMoney = state.agents.reduce((sum, a) => sum + a.money, 0);
  let integrityCheck = true;
  
  const initialTotal = INITIAL_AGENTS.reduce((sum, a) => sum + a.money, 0);
  
  // 允许微小的浮点误差
  const tolerance = 0.01;

  if (state.config.mode === 'Gold_Standard') {
      if (Math.abs(currentTotalMoney - initialTotal) > tolerance) {
          integrityCheck = false;
          alerts.push(`系统错误: 资金泄露/凭空产生 (Diff: ${currentTotalMoney - initialTotal})`);
          status = 'CRITICAL';
      }
  } else {
      // 法币模式：当前现金 应该等于 初始 + 债务
      const expectedTotal = initialTotal + state.govDebt;
      if (Math.abs(currentTotalMoney - expectedTotal) > tolerance) {
           integrityCheck = false;
           alerts.push(`系统错误: 法币记账不平 (Diff: ${currentTotalMoney - expectedTotal})`);
           status = 'CRITICAL';
      }
  }

  // 4. 生存危机
  if (state.aliveCount < 3) {
      alerts.push("种群崩溃风险");
      status = 'CRITICAL';
  }

  state.audit = {
      giniCoefficient: gini,
      inflationRate,
      integrityCheck,
      alerts,
      systemStatus: status
  };

  return state;
};

export const runTick = (currentState: SimulationState): SimulationState => {
  const nextState = clone(currentState) as SimulationState;
  nextState.tick += 1;
  const tickLog: string[] = [`--- 第 ${nextState.tick} 周期 ---`];
  
  const { config, agents } = nextState;
  const getAgent = (id: string) => agents.find(a => a.id === id)!;

  const employer = getAgent('I');
  const govt = getAgent('J');
  const workers = agents.filter(a => a.role === '工人' && a.isAlive);
  const producers = agents.filter(a => a.role === '生产者' && a.isAlive);

  // 0. 重置状态
  agents.forEach(a => {
    a.isEmployed = false;
    a.lastAction = '';
  });

  if (!employer.isAlive) {
    tickLog.push("严重警告: 资本家已死亡，经济循环终止。");
    return finalizeState(nextState, tickLog);
  }

  // --- 1. 宏观调控 ---
  let stimulusAmount = 0;
  if (config.mode === 'Fiat_Currency' && config.policy === 'Keynesian_Intervention') {
    const poorCount = agents.filter(a => a.isAlive && a.money < nextState.marketPrice).length;
    // 增加：防止恶性通胀时继续无脑印钞，只有在通胀不高时才救助
    const isHyperInflation = currentState.audit.inflationRate > 1.0;

    if (!isHyperInflation && (poorCount > 3 || nextState.unemploymentRate > 0.3)) {
        stimulusAmount = 3; 
        agents.forEach(a => {
            if (a.isAlive && a.role !== '政府') {
                a.money += stimulusAmount;
            }
        });
        nextState.govDebt += stimulusAmount * (agents.length - 1);
        tickLog.push(`凯恩斯干预: 经济低迷，政府印钞发放补贴 $${stimulusAmount}/人。`);
    }
  }

  // --- 2. 价格发现机制 ---
  const lastInventory = employer.inventory;
  if (lastInventory > 5) {
      nextState.marketPrice = Math.max(1, nextState.marketPrice - 1);
      tickLog.push(`市场信号: 库存积压 (${lastInventory})，价格下调至 $${nextState.marketPrice}`);
  } else if (lastInventory === 0) {
      nextState.marketPrice += 1; // 稀缺
      tickLog.push(`市场信号: 库存售罄，价格上调至 $${nextState.marketPrice}`);
  }

  // --- 3. 生产决策 ---
  const productionCost = config.baseWage * 2;
  const potentialRevenue = nextState.marketPrice;
  
  let willProduce = potentialRevenue >= productionCost;
  if (employer.inventory === 0) willProduce = true;

  if (willProduce) {
      const maxAffordable = Math.floor(employer.money / productionCost);
      const target = Math.min(producers.length, maxAffordable, workers.length);

      for (let i = 0; i < target; i++) {
        const worker = workers[i];
        const producer = producers[i];

        employer.money -= config.baseWage;
        worker.money += config.baseWage;
        worker.isEmployed = true;

        employer.money -= config.baseWage;
        producer.money += config.baseWage;
        producer.isEmployed = true;

        employer.inventory += 1;
      }
      if (target > 0) tickLog.push(`生产: 雇佣了 ${target} 组劳动力，产出 ${target} 单位食物。`);
  } else {
      tickLog.push(`停产: 利润不足 (成本$${productionCost} vs 售价$${potentialRevenue})`);
  }

  // --- 4. 税收 ---
  let taxRevenue = 0;
  agents.forEach(agent => {
    if (agent.isEmployed && agent.role !== '资本家') {
        const tax = Math.floor(config.baseWage * config.taxRate);
        if (tax > 0 && agent.money >= tax) {
            agent.money -= tax;
            govt.money += tax;
            taxRevenue += tax;
        }
    }
  });

  // --- 5. 消费市场 ---
  agents.forEach(consumer => {
    if (!consumer.isAlive) return;
    if (consumer.inventory < CONSTANTS.FOOD_NEED) {
        if (employer.inventory > 0) {
            if (consumer.id === employer.id) {
                 employer.inventory -= 1;
                 consumer.inventory += 1;
            } else {
                if (consumer.money >= nextState.marketPrice) {
                    consumer.money -= nextState.marketPrice;
                    employer.money += nextState.marketPrice;
                    employer.inventory -= 1;
                    consumer.inventory += 1;
                    consumer.lastAction = `购入 (-$${nextState.marketPrice})`;
                } else {
                    consumer.lastAction = `买不起 (缺$${nextState.marketPrice - consumer.money})`;
                }
            }
        } else {
            consumer.lastAction = `无货可买`;
        }
    }
  });

  // --- 6. 政府基本消费 ---
  if (govt.inventory < CONSTANTS.FOOD_NEED && govt.isAlive) {
      if (employer.inventory > 0 && govt.money >= nextState.marketPrice) {
          govt.money -= nextState.marketPrice;
          employer.money += nextState.marketPrice;
          employer.inventory -= 1;
          govt.inventory += 1;
          tickLog.push("政府购粮维持生存。");
      } else if (config.mode === 'Fiat_Currency') {
          if (employer.inventory > 0) {
              employer.inventory -= 1;
              govt.inventory += 1;
              nextState.govDebt += nextState.marketPrice;
              employer.money += nextState.marketPrice;
              tickLog.push("法币特权: 政府印钞购粮。");
          }
      }
  }

  // --- 7. 生存判定 ---
  agents.forEach(agent => {
    if (!agent.isAlive) return;
    if (agent.inventory >= CONSTANTS.FOOD_NEED) {
        agent.inventory -= CONSTANTS.FOOD_NEED;
    } else {
        agent.isAlive = false;
        agent.lastAction = "饿死";
        tickLog.push(`死亡: ${agent.name} 饿死了。`);
    }
  });

  // 统计
  const aliveAgents = agents.filter(a => a.isAlive);
  nextState.aliveCount = aliveAgents.length;
  const laborForce = aliveAgents.filter(a => a.role === '工人' || a.role === '生产者');
  const unemployed = laborForce.filter(a => !a.isEmployed).length;
  nextState.unemploymentRate = laborForce.length > 0 ? unemployed / laborForce.length : 0;
  
  // 更新价格历史 (保持最近 20 个 tick)
  nextState.priceHistory = [...nextState.priceHistory, nextState.marketPrice].slice(-20);

  return finalizeState(nextState, tickLog);
};

const finalizeState = (state: SimulationState, newLogs: string[]): SimulationState => {
    state.logs = [...newLogs, ...state.logs].slice(0, 50);
    state.totalMoney = state.agents.reduce((sum, a) => sum + a.money, 0);
    state.totalFood = state.agents.reduce((sum, a) => sum + a.inventory, 0);
    
    // 执行审计
    return runAudit(state);
}
