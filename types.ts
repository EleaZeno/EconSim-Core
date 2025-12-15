
export type Role = '工人' | '生产者' | '资本家' | '政府';

export type EconomicMode = 'Gold_Standard' | 'Fiat_Currency';
export type PolicyType = 'Laissez_Faire' | 'Keynesian_Intervention';

export interface Agent {
  id: string;
  name: string; 
  role: Role;
  money: number;
  inventory: number; // 食物
  isAlive: boolean;
  isEmployed: boolean; 
  lastAction: string; 
}

export interface SimulationConfig {
  mode: EconomicMode;
  policy: PolicyType;
  baseWage: number;
  taxRate: number;
}

// 系统警报级别
export type AlertLevel = 'NORMAL' | 'WARNING' | 'CRITICAL';

// 经济审计报告
export interface AuditReport {
  giniCoefficient: number; // 基尼系数 (0-1)
  inflationRate: number; // 相比 5 tick 前的价格变化率
  integrityCheck: boolean; // 系统资金守恒检查
  alerts: string[]; // 具体的警告信息
  systemStatus: AlertLevel;
}

export interface SimulationState {
  tick: number;
  config: SimulationConfig;
  agents: Agent[];
  logs: string[];
  totalMoney: number;
  govDebt: number; // track fiat money printing
  marketPrice: number; // Dynamic price
  priceHistory: number[]; // 用于计算通胀
  avgPrice: number; // For CPI tracking
  totalFood: number;
  aliveCount: number;
  unemploymentRate: number;
  audit: AuditReport; // 实时审计结果
}

// 初始常量
export const CONSTANTS = {
  FOOD_NEED: 1,      
  INITIAL_CASH: {
    WORKER: 10,
    PRODUCER: 20,
    EMPLOYER: 100,    
    GOVT: 0
  }
};

export const INITIAL_AGENTS: Agent[] = [
  { id: 'A', name: '工人 A', role: '工人', money: CONSTANTS.INITIAL_CASH.WORKER, inventory: 0, isAlive: true, isEmployed: false, lastAction: '就绪' },
  { id: 'B', name: '工人 B', role: '工人', money: CONSTANTS.INITIAL_CASH.WORKER, inventory: 0, isAlive: true, isEmployed: false, lastAction: '就绪' },
  { id: 'C', name: '工人 C', role: '工人', money: CONSTANTS.INITIAL_CASH.WORKER, inventory: 0, isAlive: true, isEmployed: false, lastAction: '就绪' },
  { id: 'D', name: '工人 D', role: '工人', money: CONSTANTS.INITIAL_CASH.WORKER, inventory: 0, isAlive: true, isEmployed: false, lastAction: '就绪' },
  { id: 'E', name: '工人 E', role: '工人', money: CONSTANTS.INITIAL_CASH.WORKER, inventory: 0, isAlive: true, isEmployed: false, lastAction: '就绪' },
  { id: 'F', name: '工人 F', role: '工人', money: CONSTANTS.INITIAL_CASH.WORKER, inventory: 0, isAlive: true, isEmployed: false, lastAction: '就绪' },
  { id: 'G', name: '生产者 G', role: '生产者', money: CONSTANTS.INITIAL_CASH.PRODUCER, inventory: 0, isAlive: true, isEmployed: false, lastAction: '就绪' },
  { id: 'H', name: '生产者 H', role: '生产者', money: CONSTANTS.INITIAL_CASH.PRODUCER, inventory: 0, isAlive: true, isEmployed: false, lastAction: '就绪' },
  { id: 'I', name: '资本家 I', role: '资本家', money: CONSTANTS.INITIAL_CASH.EMPLOYER, inventory: 5, isAlive: true, isEmployed: true, lastAction: '就绪' }, 
  { id: 'J', name: '政府 J', role: '政府', money: CONSTANTS.INITIAL_CASH.GOVT, inventory: 0, isAlive: true, isEmployed: true, lastAction: '就绪' },
];
