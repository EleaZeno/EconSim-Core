
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

export interface LedgerEntry {
  tick: number;
  fromId: string;
  toId: string;
  amount: number;
  reason: string;
}

export interface AgentMemory {
  avgRevenue: number;     
  avgProfit: number;      
  avgInventory: number;   
  avgExpenses: number;    
}

export interface Agent {
  id: string;
  type: AgentType;
  cash: number;
  debt: number; 
  bonds: number; 
  inventory: Record<ResourceType, number>;
  active: boolean; 
  
  priceBeliefs: Record<ResourceType, number>; 
  wageExpectation: number;
  
  memory: AgentMemory;

  // Firm specific
  lastProfit?: number;
  lastRevenue?: number; 
  productionTarget?: number;
  salesPrice?: number;
  insolvencyStreak?: number; 
  
  // Household specific
  currentUtility: number; 
  needsSatisfaction?: number;
  employedAt?: string | null;
  starvationStreak?: number;
  skillLevel?: number; 
}

export interface EconomicMetrics {
  tick: number;
  gdp: number; 
  cpi: number; 
  unemploymentRate: number;
  moneySupply: number;
  transactionCount: number;
  avgWage: number;
  activeFirms: number; 
}

// --- LAYER 2: MARKET MECHANISMS ---
// A market mechanism defines how buyers and sellers match and transact
export interface MarketMechanism {
  id: string; // e.g., "standard_goods_market"
  name: string;
  // Execute the market clearing logic
  resolve: (state: WorldState, rng: any) => void;
}

// --- LAYER 3: AGENT BEHAVIORS ---
// A behavior policy defines how an agent perceives state and forms intent
export interface AgentBehavior {
  id: string; // e.g., "rational_firm"
  name: string;
  type: AgentType;
  decide: (agent: Agent, state: WorldState, rng: any) => void;
}

// --- LAYER 4: INSTITUTIONS ---
// An institution defines system-wide rules (taxes, bankruptcy, welfare)
export interface Institution {
  id: string; // e.g., "progressive_tax"
  name: string;
  apply: (state: WorldState) => void;
}

// --- LAYER 5: EXPERIMENT CONFIGURATION ---
// The DNA of a simulation run
export interface ExperimentConfig {
  id: string;
  name: string;
  description: string;
  initialSeed: number;
  
  // Registry Keys for mechanisms to load
  activeMarkets: string[];      // Order matters! e.g., ['labor_market', 'goods_market']
  activeInstitutions: string[]; // e.g., ['bankruptcy_law', 'income_tax']
  
  // Agent Logic Mapping
  agentBehaviors: {
    [key in AgentType]?: string; // e.g., FIRM: 'heuristic_firm'
  };

  // Hyperparameters
  params: {
    taxRate: number;
    salesTax: number;
    subsidyRate: number;
    moneyPrintingEnabled: boolean;
    [key: string]: any; // Allow custom params for specific mechanisms
  };
}

export interface WorldState {
  tick: number;
  agents: Map<string, Agent>;
  ledger: LedgerEntry[]; 
  metricsHistory: EconomicMetrics[];
  
  // Embedded Config for Reproducibility
  config: ExperimentConfig;
  
  rngState: number; 
}
