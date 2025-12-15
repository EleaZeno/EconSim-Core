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
  active: boolean; // v0.1.1: Lifecycle flag
  
  // Beliefs & Strategy (Internal State)
  priceBeliefs: Record<ResourceType, number>; // What they think fair price is
  wageExpectation: number;
  
  // For Firms
  lastProfit?: number;
  productionTarget?: number;
  salesPrice?: number;
  insolvencyStreak?: number; // v0.1.1: Count ticks of distress
  
  // For Households
  // Rationality Contract: Explicit Utility Tracking
  currentUtility: number; 
  needsSatisfaction?: number;
  employedAt?: string | null;
  starvationStreak?: number; // v0.1.1: Count ticks of 0 consumption
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
  activeFirms: number; // v0.1.1
}

// v0.1.1: Optimization for non-ledger based calculations
export interface GlobalAggregates {
  totalWageVolumeLastTick: number;
  totalSalesVolumeLastTick: number;
}

export interface WorldState {
  tick: number;
  agents: Map<string, Agent>;
  ledger: LedgerEntry[]; // History of money flow (Pruned in v0.1.1)
  metricsHistory: EconomicMetrics[];
  settings: SimulationSettings;
  aggregates: GlobalAggregates; // v0.1.1: Caching layer
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