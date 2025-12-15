
import { 
  WorldState, 
  Agent, 
  AgentType, 
  ResourceType, 
  EconomicMetrics,
  ExperimentConfig
} from '../types';
import { 
  INITIAL_POPULATION_COUNTS, 
  INITIAL_PRICES, 
  MAX_LEDGER_ITEMS, 
  EXPERIMENTS
} from '../constants';
import { validateSystemInvariants } from './accountingService';
import { DeterministicRNG } from './randomService';
import { MechanismRegistry } from './mechanismLibrary';

/**
 * ENGINE ARCHITECTURE v0.3.0 (Kernel)
 * 
 * The Kernel is now "dumb". It does not know about Economics.
 * It knows about:
 * 1. Configuration (The Recipe)
 * 2. Registry (The Ingredients)
 * 3. Execution Order (The Cooking Process)
 * 
 * Flow:
 * - Load Config
 * - Pre-Tick Institutions (Assets)
 * - Agent Decisions (Cognition)
 * - Market Clearing (Interaction)
 * - Post-Tick Institutions (Fiscal/Regulatory)
 * - Metrics & Cleanup
 */

export const initializeSimulation = (configProfileId: string = 'BASELINE'): WorldState => {
  const config: ExperimentConfig = EXPERIMENTS[configProfileId] || EXPERIMENTS['BASELINE'];
  
  const agents = new Map<string, Agent>();
  const rng = new DeterministicRNG(config.initialSeed);

  const defaultPriceBeliefs: Record<ResourceType, number> = {
    [ResourceType.LABOR]: INITIAL_PRICES[ResourceType.LABOR],
    [ResourceType.CONSUMER_GOODS]: INITIAL_PRICES[ResourceType.CONSUMER_GOODS],
    [ResourceType.RAW_MATERIALS]: 10,
    [ResourceType.CAPITAL_EQUIPMENT]: 100
  };

  const emptyMemory = { avgRevenue: 0, avgProfit: 0, avgInventory: 0, avgExpenses: 0 };

  // 1. Structural Layer (Fixed Consensus) - Gov & CB
  agents.set('GOVT_01', {
    id: 'GOVT_01', type: AgentType.GOVERNMENT, cash: 5000, debt: 0, bonds: 0,
    inventory: { [ResourceType.LABOR]: 0, [ResourceType.RAW_MATERIALS]: 0, [ResourceType.CONSUMER_GOODS]: 0, [ResourceType.CAPITAL_EQUIPMENT]: 0 },
    priceBeliefs: { ...defaultPriceBeliefs }, wageExpectation: 0, memory: { ...emptyMemory }, currentUtility: 0, active: true
  });

  agents.set('CB_01', {
    id: 'CB_01', type: AgentType.CENTRAL_BANK, cash: 1000000, debt: 0, bonds: 0,
    inventory: { [ResourceType.LABOR]: 0, [ResourceType.RAW_MATERIALS]: 0, [ResourceType.CONSUMER_GOODS]: 0, [ResourceType.CAPITAL_EQUIPMENT]: 0 },
    priceBeliefs: { ...defaultPriceBeliefs }, wageExpectation: 0, memory: { ...emptyMemory }, currentUtility: 0, active: true
  });

  // 2. Agents
  for (let i = 0; i < INITIAL_POPULATION_COUNTS[AgentType.FIRM]; i++) {
    const id = `FIRM_${i}`;
    agents.set(id, {
      id, type: AgentType.FIRM, cash: 800, debt: 0, bonds: 0,
      inventory: { [ResourceType.LABOR]: 0, [ResourceType.RAW_MATERIALS]: 0, [ResourceType.CONSUMER_GOODS]: 10, [ResourceType.CAPITAL_EQUIPMENT]: 0 },
      priceBeliefs: { ...defaultPriceBeliefs }, wageExpectation: INITIAL_PRICES[ResourceType.LABOR],
      productionTarget: 2, lastProfit: 0, lastRevenue: 0, memory: { ...emptyMemory, avgInventory: 10 },
      salesPrice: INITIAL_PRICES[ResourceType.CONSUMER_GOODS], currentUtility: 0, insolvencyStreak: 0, active: true
    });
  }

  for (let i = 0; i < INITIAL_POPULATION_COUNTS[AgentType.HOUSEHOLD]; i++) {
    const id = `HH_${i}`;
    const initialSkill = 0.8 + (rng.next() * 0.4);
    agents.set(id, {
      id, type: AgentType.HOUSEHOLD, cash: 150, debt: 0, bonds: 0,
      inventory: { [ResourceType.LABOR]: 0, [ResourceType.RAW_MATERIALS]: 0, [ResourceType.CONSUMER_GOODS]: 2, [ResourceType.CAPITAL_EQUIPMENT]: 0 },
      priceBeliefs: { ...defaultPriceBeliefs }, wageExpectation: INITIAL_PRICES[ResourceType.LABOR] * initialSkill,
      memory: { ...emptyMemory }, skillLevel: initialSkill, needsSatisfaction: 1, currentUtility: 10, starvationStreak: 0, active: true
    });
  }

  for (let i = 0; i < INITIAL_POPULATION_COUNTS[AgentType.BANK]; i++) {
    const id = `BANK_${i}`;
    agents.set(id, {
      id, type: AgentType.BANK, cash: 10000, debt: 0, bonds: 0,
      inventory: { [ResourceType.LABOR]: 0, [ResourceType.RAW_MATERIALS]: 0, [ResourceType.CONSUMER_GOODS]: 0, [ResourceType.CAPITAL_EQUIPMENT]: 0 },
      priceBeliefs: { ...defaultPriceBeliefs }, wageExpectation: 0, memory: { ...emptyMemory }, currentUtility: 0, active: true
    });
  }

  return {
    tick: 0,
    agents,
    ledger: [],
    metricsHistory: [],
    config: config, // Store the experiment config in the state
    rngState: rng.getState()
  };
};

export const runTick = (currentState: WorldState): WorldState => {
  const rng = new DeterministicRNG(currentState.rngState);
  
  // Clone State
  const nextState: WorldState = {
    ...currentState,
    tick: currentState.tick + 1,
    ledger: [...currentState.ledger], 
    metricsHistory: [...currentState.metricsHistory],
    agents: new Map(currentState.agents),
    // Config is immutable
  };

  const { config } = nextState;

  // --- LAYER 4: PRE-TICK INSTITUTIONS (e.g. Asset Payouts, Bankruptcy) ---
  // Convention: "bond_yield_payout" and "standard_bankruptcy" usually go here
  // In a stricter system, we might separate Institutions into "Pre" and "Post" lists.
  // For now, we run all institutions that are conceptually "Maintenance" here.
  
  const maintenanceInstitutions = ['bond_yield_payout', 'standard_bankruptcy', 'forgiving_bankruptcy'];
  maintenanceInstitutions.forEach(instId => {
      if (config.activeInstitutions.includes(instId)) {
          const inst = MechanismRegistry.Institutions[instId];
          if (inst) inst.apply(nextState);
      }
  });

  // --- LAYER 3: AGENT COGNITION ---
  nextState.agents.forEach(agent => {
    if (!agent.active) return;
    
    // Create mutable copies of nested objects for safety
    const mutableAgent = { 
        ...agent, 
        inventory: { ...agent.inventory }, 
        memory: { ...agent.memory } 
    };
    nextState.agents.set(agent.id, mutableAgent);

    // Resolve Behavior
    const behaviorId = config.agentBehaviors[agent.type];
    if (behaviorId) {
        const behavior = MechanismRegistry.Behaviors[behaviorId];
        if (behavior) {
            behavior.decide(mutableAgent, nextState, rng);
        }
    }
  });

  // --- LAYER 2: MARKETS ---
  config.activeMarkets.forEach(marketId => {
      const market = MechanismRegistry.Markets[marketId];
      if (market) {
          market.resolve(nextState, rng);
      } else {
          console.warn(`Market mechanism not found: ${marketId}`);
      }
  });

  // --- LAYER 4: POST-TICK INSTITUTIONS (Fiscal Policy) ---
  const fiscalInstitutions = ['income_tax', 'wealth_tax_stabilizer', 'emergency_welfare'];
  fiscalInstitutions.forEach(instId => {
      if (config.activeInstitutions.includes(instId)) {
          const inst = MechanismRegistry.Institutions[instId];
          if (inst) inst.apply(nextState);
      }
  });

  // --- METRICS & CLEANUP ---
  const currentTickTransactions = nextState.ledger.filter(l => l.tick === nextState.tick);
  
  // Basic Metrics Calculation
  const salesTxns = currentTickTransactions.filter(t => t.reason === 'PURCHASE_GOODS');
  const gdp = salesTxns.reduce((sum, t) => sum + t.amount, 0);
  
  const prevCpi = nextState.metricsHistory.length > 0 ? nextState.metricsHistory[nextState.metricsHistory.length - 1].cpi : INITIAL_PRICES[ResourceType.CONSUMER_GOODS];
  const avgPrice = salesTxns.length > 0 ? gdp / salesTxns.length : prevCpi;
  
  const households = Array.from(nextState.agents.values()).filter(a => a.type === AgentType.HOUSEHOLD && a.active);
  const unemployedCount = households.filter(h => !h.employedAt).length;
  const unemploymentRate = households.length > 0 ? unemployedCount / households.length : 0;
  
  const firms = Array.from(nextState.agents.values()).filter(a => a.type === AgentType.FIRM && a.active);
  
  const moneySupply = validateSystemInvariants(nextState);

  const wageTxns = currentTickTransactions.filter(t => t.reason === 'WAGE_PAYMENT');
  const avgWage = wageTxns.length > 0 
    ? wageTxns.reduce((sum, t) => sum + t.amount, 0) / wageTxns.length 
    : (nextState.metricsHistory.length > 0 ? nextState.metricsHistory[nextState.metricsHistory.length - 1].avgWage : 0);

  const metric: EconomicMetrics = {
    tick: nextState.tick,
    gdp,
    cpi: avgPrice,
    unemploymentRate,
    moneySupply,
    transactionCount: currentTickTransactions.length,
    avgWage,
    activeFirms: firms.length
  };

  nextState.metricsHistory.push(metric);

  // Accounting Cleanup
  firms.forEach(f => {
      const expenses = nextState.ledger
        .filter(l => l.tick === nextState.tick && l.fromId === f.id)
        .reduce((sum, l) => sum + l.amount, 0);
      const revenue = f.lastRevenue || 0;
      f.lastProfit = revenue - expenses;
      f.lastRevenue = 0; 
  });

  if (nextState.ledger.length > MAX_LEDGER_ITEMS) {
      nextState.ledger = nextState.ledger.slice(-MAX_LEDGER_ITEMS);
  }

  nextState.rngState = rng.getState();
  return nextState;
};
