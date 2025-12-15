export enum AgentType {
  HOUSEHOLD = 'HOUSEHOLD',
  FIRM = 'FIRM',
  BANK = 'BANK',
  GOVERNMENT = 'GOVERNMENT',
  CENTRAL_BANK = 'CENTRAL_BANK'
}

export enum ResourceType {
  LABOR = 'LABOR',
  RAW_MATERIALS = 'RAW_MATERIALS',
  CONSUMER_GOODS = 'CONSUMER_GOODS',
  CAPITAL_EQUIPMENT = 'CAPITAL_EQUIPMENT'
}

// Double-Entry Accounting Record
export interface LedgerEntry {
  tick: number;
  fromId: string;
  toId: string;
  amount: number;
  reason: string;
}

// Base structure for any economic actor
export interface Agent {
  id: string;
  type: AgentType;
  cash: number;
  inventory: Record<ResourceType, number>;
  
  // Beliefs & Strategy (Internal State)
  priceBeliefs: Record<ResourceType, number>; // What they think fair price is
  wageExpectation: number;
  
  // For Firms
  lastProfit?: number;
  productionTarget?: number;
  salesPrice?: number;
  
  // For Households
  // Rationality Contract: Explicit Utility Tracking
  currentUtility: number; 
  needsSatisfaction?: number;
  employedAt?: string | null;
}

export interface MarketOffer {
  sellerId: string;
  resource: ResourceType;
  amount: number;
  pricePerUnit: number;
}

export interface EconomicMetrics {
  tick: number;
  gdp: number; // Aggregate production value
  cpi: number; // Consumer Price Index
  unemploymentRate: number;
  moneySupply: number;
  transactionCount: number;
  avgWage: number;
}

export interface WorldState {
  tick: number;
  agents: Map<string, Agent>;
  ledger: LedgerEntry[]; // History of money flow
  metricsHistory: EconomicMetrics[];
  settings: SimulationSettings;
  // DETERMINISM CONTRACT:
  // The state of the PRNG must be serialized here.
  // Replaying a tick with the same RNG state must yield bit-level identical results.
  rngState: number; 
}

export interface SimulationSettings {
  initialSeed: number; // The master seed
  taxRate: number;
  salesTax: number;
  subsidyRate: number;
  moneyPrintingEnabled: boolean;
}