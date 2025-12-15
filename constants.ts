
import { AgentType, ResourceType, ExperimentConfig } from './types';

// Default Global Params
export const DEFAULT_PARAMS = {
  taxRate: 0.15,
  salesTax: 0.05,
  subsidyRate: 0.0,
  moneyPrintingEnabled: false,
};

export const INITIAL_POPULATION_COUNTS = {
  [AgentType.HOUSEHOLD]: 50,
  [AgentType.FIRM]: 10,
  [AgentType.BANK]: 1,
  [AgentType.GOVERNMENT]: 1,
  [AgentType.CENTRAL_BANK]: 1,
};

export const BASE_NEEDS = {
  FOOD_CONSUMPTION: 1, 
};

export const INITIAL_PRICES = {
  [ResourceType.CONSUMER_GOODS]: 10,
  [ResourceType.LABOR]: 20, 
};

export const MAX_HISTORY_LENGTH = 100; 
export const MAX_LEDGER_ITEMS = 1000;  

export const SURVIVAL_CONSTRAINTS = {
  STARVATION_THRESHOLD: 3, 
  INSOLVENCY_THRESHOLD: 3, 
  FIRM_MIN_CASH: 50,       
};

export const STABILIZERS = {
  WEALTH_TAX_THRESHOLD: 3000, 
  WEALTH_TAX_RATE: 0.02,      
  FIRE_SALE_INVENTORY_MULT: 4 
};

export const DYNAMICS = {
  EMA_ALPHA: 0.2, 
  SKILL_DECAY_RATE: 0.02, 
  SKILL_LEARN_RATE: 0.01, 
  MIN_SKILL: 0.5,
  MAX_SKILL: 2.0,
  BOND_YIELD_RATE: 0.005, 
  HOUSEHOLD_SAVINGS_RATIO: 0.3, 
  DECISION_NOISE: 0.1, 
  GOVT_POLICY_LAG: 4 
};

// --- LAYER 5: EXPERIMENT PRESETS ---

export const EXPERIMENTS: Record<string, ExperimentConfig> = {
  BASELINE: {
    id: 'baseline_mixed_economy',
    name: '基准模型：混合经济 (Mixed Economy)',
    description: '标准模型。包含摩擦性劳动力市场、基础破产法和适度的税收调节。模拟现代西方经济体的常规运行状态。',
    initialSeed: 1337,
    activeMarkets: ['standard_labor_market', 'standard_goods_market'],
    activeInstitutions: ['bond_yield_payout', 'standard_bankruptcy', 'income_tax', 'wealth_tax_stabilizer'],
    agentBehaviors: {
      [AgentType.HOUSEHOLD]: 'bounded_rational_household',
      [AgentType.FIRM]: 'heuristic_firm',
      [AgentType.BANK]: 'passive_bank'
    },
    params: {
      ...DEFAULT_PARAMS
    }
  },
  LAISSEZ_FAIRE: {
    id: 'laissez_faire',
    name: '实验：自由放任 (Laissez-Faire)',
    description: '休克疗法。无税收、无福利、无财富稳定器。纯粹的“适者生存”环境，观察财富集中度与市场波动。',
    initialSeed: 1337,
    activeMarkets: ['standard_labor_market', 'standard_goods_market'],
    activeInstitutions: ['bond_yield_payout', 'standard_bankruptcy'], // Removed taxes/welfare
    agentBehaviors: {
      [AgentType.HOUSEHOLD]: 'bounded_rational_household',
      [AgentType.FIRM]: 'heuristic_firm',
      [AgentType.BANK]: 'passive_bank'
    },
    params: {
      taxRate: 0.0,
      salesTax: 0.0,
      subsidyRate: 0.0,
      moneyPrintingEnabled: false
    }
  },
  WELFARE_STATE: {
    id: 'welfare_state',
    name: '实验：福利国家 (Welfare State)',
    description: '高税收 (30%)、全民基本生存保障、激进的财富再分配策略。旨在消除极端贫困，但可能抑制企业扩张动力。',
    initialSeed: 1337,
    activeMarkets: ['standard_labor_market', 'standard_goods_market'],
    activeInstitutions: ['bond_yield_payout', 'forgiving_bankruptcy', 'income_tax', 'wealth_tax_stabilizer', 'emergency_welfare'],
    agentBehaviors: {
      [AgentType.HOUSEHOLD]: 'bounded_rational_household',
      [AgentType.FIRM]: 'heuristic_firm',
      [AgentType.BANK]: 'passive_bank'
    },
    params: {
      taxRate: 0.30,
      salesTax: 0.10,
      subsidyRate: 0.0,
      moneyPrintingEnabled: true
    }
  }
};
