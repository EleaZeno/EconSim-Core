import { 
  WorldState, 
  Agent, 
  AgentType, 
  ResourceType, 
  SimulationSettings, 
  EconomicMetrics 
} from '../types';
import { 
  INITIAL_POPULATION_COUNTS, 
  INITIAL_PRICES, 
  INITIAL_SETTINGS, 
  MAX_LEDGER_ITEMS, 
  SURVIVAL_CONSTRAINTS 
} from '../constants';
import { transferMoney, transferResource, validateSystemInvariants } from './accountingService';
import { householdDecision, firmDecision, bankDecision } from './agentLogic';
import { applyFiscalPolicy } from './institutions';
import { DeterministicRNG } from './randomService';

/**
 * ARCHITECTURE MANIFESTO (ENGINE)
 * 
 * 1. SERIALIZABILITY: The Engine must run in a strict sequence. The Ledger is a write-ahead log.
 *    ❌ Parallel execution of transactions is forbidden to prevent race conditions (double spend).
 * 
 * 2. DETERMINISM: Given State(T) and Seed(S), State(T+1) must be identical bit-for-bit.
 *    ❌ Math.random() is forbidden. Use DeterministicRNG.
 * 
 * 3. OBSERVABILITY: Every state change must be traceable to a decision or rule.
 */

export const initializeSimulation = (): WorldState => {
  const agents = new Map<string, Agent>();
  
  // Use a temporary RNG for initialization to keep IDs/initial values deterministic if we wanted random starts.
  // For MVP, initialization is static, but we respect the contract.
  const seed = INITIAL_SETTINGS.initialSeed;

  const defaultPriceBeliefs: Record<ResourceType, number> = {
    [ResourceType.LABOR]: INITIAL_PRICES[ResourceType.LABOR],
    [ResourceType.CONSUMER_GOODS]: INITIAL_PRICES[ResourceType.CONSUMER_GOODS],
    [ResourceType.RAW_MATERIALS]: 10,
    [ResourceType.CAPITAL_EQUIPMENT]: 100
  };

  const emptyPriceBeliefs: Record<ResourceType, number> = {
    [ResourceType.LABOR]: 0,
    [ResourceType.CONSUMER_GOODS]: 0,
    [ResourceType.RAW_MATERIALS]: 0,
    [ResourceType.CAPITAL_EQUIPMENT]: 0
  };

  // 1. Create Govt & Central Bank
  const govtId = 'GOVT_01';
  agents.set(govtId, {
    id: govtId,
    type: AgentType.GOVERNMENT,
    cash: 1000,
    debt: 0,
    inventory: { [ResourceType.LABOR]: 0, [ResourceType.RAW_MATERIALS]: 0, [ResourceType.CONSUMER_GOODS]: 0, [ResourceType.CAPITAL_EQUIPMENT]: 0 },
    priceBeliefs: { ...emptyPriceBeliefs },
    wageExpectation: 0,
    currentUtility: 0,
    active: true
  });

  const cbId = 'CB_01';
  agents.set(cbId, {
    id: cbId,
    type: AgentType.CENTRAL_BANK,
    cash: 1000000,
    debt: 0,
    inventory: { [ResourceType.LABOR]: 0, [ResourceType.RAW_MATERIALS]: 0, [ResourceType.CONSUMER_GOODS]: 0, [ResourceType.CAPITAL_EQUIPMENT]: 0 },
    priceBeliefs: { ...emptyPriceBeliefs },
    wageExpectation: 0,
    currentUtility: 0,
    active: true
  });

  // 2. Create Firms
  for (let i = 0; i < INITIAL_POPULATION_COUNTS[AgentType.FIRM]; i++) {
    const id = `FIRM_${i}`;
    agents.set(id, {
      id,
      type: AgentType.FIRM,
      cash: 500,
      debt: 0,
      inventory: { [ResourceType.LABOR]: 0, [ResourceType.RAW_MATERIALS]: 0, [ResourceType.CONSUMER_GOODS]: 10, [ResourceType.CAPITAL_EQUIPMENT]: 0 },
      priceBeliefs: { ...defaultPriceBeliefs },
      salesPrice: INITIAL_PRICES[ResourceType.CONSUMER_GOODS],
      wageExpectation: INITIAL_PRICES[ResourceType.LABOR],
      productionTarget: 2,
      lastProfit: 0,
      currentUtility: 0,
      insolvencyStreak: 0,
      active: true
    });
  }

  // 3. Create Households
  for (let i = 0; i < INITIAL_POPULATION_COUNTS[AgentType.HOUSEHOLD]; i++) {
    const id = `HH_${i}`;
    agents.set(id, {
      id,
      type: AgentType.HOUSEHOLD,
      cash: 100,
      debt: 0,
      inventory: { [ResourceType.LABOR]: 0, [ResourceType.RAW_MATERIALS]: 0, [ResourceType.CONSUMER_GOODS]: 2, [ResourceType.CAPITAL_EQUIPMENT]: 0 },
      priceBeliefs: { ...defaultPriceBeliefs },
      wageExpectation: INITIAL_PRICES[ResourceType.LABOR],
      needsSatisfaction: 1,
      currentUtility: 10,
      starvationStreak: 0,
      active: true
    });
  }

  // 4. Create Commercial Banks
  for (let i = 0; i < INITIAL_POPULATION_COUNTS[AgentType.BANK]; i++) {
    const id = `BANK_${i}`;
    agents.set(id, {
      id,
      type: AgentType.BANK,
      cash: 10000, // Capital
      debt: 0,
      inventory: { [ResourceType.LABOR]: 0, [ResourceType.RAW_MATERIALS]: 0, [ResourceType.CONSUMER_GOODS]: 0, [ResourceType.CAPITAL_EQUIPMENT]: 0 },
      priceBeliefs: { ...emptyPriceBeliefs },
      wageExpectation: 0,
      currentUtility: 0,
      active: true
    });
  }

  return {
    tick: 0,
    agents,
    ledger: [],
    metricsHistory: [],
    settings: { ...INITIAL_SETTINGS },
    rngState: seed, // Initial Seed
    aggregates: {
      totalSalesVolumeLastTick: 0,
      totalWageVolumeLastTick: 0
    }
  };
};

/**
 * Single Time Step execution
 */
export const runTick = (currentState: WorldState): WorldState => {
  // 0. Initialize RNG from previous state (CONTINUITY)
  const rng = new DeterministicRNG(currentState.rngState);

  // Deep clone state
  const nextState: WorldState = {
    ...currentState,
    tick: currentState.tick + 1,
    ledger: [...currentState.ledger], 
    metricsHistory: [...currentState.metricsHistory],
    agents: new Map(currentState.agents),
    // rngState will be updated at the very end
  };
  
  const govtId = 'GOVT_01';

  // --- v0.1.1: Bankruptcy & Market Exit Phase ---
  // We process this BEFORE decisions, so dead firms don't hire.
  
  nextState.agents.forEach(agent => {
    if (agent.type === AgentType.FIRM && agent.active) {
       // Check for insolvency
       if ((agent.insolvencyStreak || 0) >= SURVIVAL_CONSTRAINTS.INSOLVENCY_THRESHOLD) {
         // BANKRUPTCY EVENT
         agent.active = false;
         
         // 1. Fire all employees
         nextState.agents.forEach(other => {
           if (other.employedAt === agent.id) {
             other.employedAt = null;
             // other.wageExpectation *= 0.8; // Shock
           }
         });

         // 2. Liquidate remaining cash to Govt (Conservation of Money)
         if (agent.cash > 0) {
           transferMoney(nextState, agent.id, govtId, agent.cash, 'BANKRUPTCY_LIQUIDATION');
         }
       }
    }
  });

  // --- 1. Agent Decision Phase (Parallelizable Candidate) ---
  // Note: agents act based on 'nextState' which currently looks like 'currentState' 
  // until we start applying transactions.
  nextState.agents.forEach(agent => {
    if (!agent.active) return;

    const mutableAgent = { ...agent, inventory: { ...agent.inventory }, priceBeliefs: { ...agent.priceBeliefs } };
    nextState.agents.set(agent.id, mutableAgent);

    if (agent.type === AgentType.HOUSEHOLD) householdDecision(mutableAgent, nextState, rng);
    if (agent.type === AgentType.FIRM) firmDecision(mutableAgent, nextState, rng);
    if (agent.type === AgentType.BANK) bankDecision(mutableAgent, nextState, rng);
  });

  // --- 2. Labor Market Clearing (Serial / Matching) ---
  const firms = Array.from(nextState.agents.values()).filter(a => a.type === AgentType.FIRM && a.active);
  const households = Array.from(nextState.agents.values()).filter(a => a.type === AgentType.HOUSEHOLD && a.active);
  
  // Deterministic Shuffle using RNG (NOT Math.random)
  const shuffledHouseholds = rng.shuffle([...households]);

  // Cleanup: Ensure no one works for a dead firm
  shuffledHouseholds.forEach(hh => { 
    if (hh.employedAt && nextState.agents.get(hh.employedAt)?.active === false) {
      hh.employedAt = null; 
    }
  });

  firms.forEach(firm => {
    const laborNeeded = firm.productionTarget || 0;
    // Count currently employed (who are still active)
    let laborHired = shuffledHouseholds.filter(h => h.employedAt === firm.id).length;
    const wageOffer = firm.wageExpectation;

    // Firing logic if target reduced
    if (laborHired > laborNeeded) {
        const workers = shuffledHouseholds.filter(h => h.employedAt === firm.id);
        const toFire = workers.slice(0, laborHired - laborNeeded);
        toFire.forEach(w => w.employedAt = null);
        laborHired = laborNeeded;
    }

    // Hiring logic
    for (const hh of shuffledHouseholds) {
      if (laborHired >= laborNeeded) break;
      if (hh.employedAt) continue;

      // Rationality check: Accepts if Wage > Reservation Wage
      if (wageOffer >= hh.wageExpectation) {
        const success = transferMoney(nextState, firm.id, hh.id, wageOffer, 'WAGE_PAYMENT');
        if (success) {
          hh.employedAt = firm.id;
          laborHired++;
        }
      }
    }
  });

  // --- 3. Production Phase (Internal) ---
  firms.forEach(firm => {
    const employees = households.filter(h => h.employedAt === firm.id).length;
    // Production Function: Y = A * L (A=3)
    const output = employees * 3;
    firm.inventory[ResourceType.CONSUMER_GOODS] = (firm.inventory[ResourceType.CONSUMER_GOODS] || 0) + output;
  });

  // --- 4. Goods Market Clearing (Serial / Matching) ---
  const shuffledFirms = rng.shuffle([...firms]);
  let totalTransactionVolume = 0;
  let totalTransactionValue = 0;

  households.forEach(hh => {
    const amountNeeded = 2; 
    let amountBought = 0;

    for (const firm of shuffledFirms) {
      if (amountBought >= amountNeeded) break;
      if (hh.cash <= 0.1) break;

      const price = firm.salesPrice || 10;
      const firmStock = firm.inventory[ResourceType.CONSUMER_GOODS] || 0;

      if (firmStock > 0 && hh.cash >= price) {
        const transfer = transferMoney(nextState, hh.id, firm.id, price, 'PURCHASE_GOODS');
        if (transfer) {
          transferResource(nextState, firm.id, hh.id, ResourceType.CONSUMER_GOODS, 1);
          amountBought++;
          totalTransactionVolume++;
          totalTransactionValue += price;
        }
      }
    }
  });

  // --- 5. Institutional/Fiscal Phase (Pluggable) ---
  // Replaced hardcoded logic with modular call
  applyFiscalPolicy(nextState);

  // --- 6. Consumption / Metrics Phase ---
  // v0.1.1: Calculate metrics using current tick data BEFORE pruning ledger
  
  const currentTickTransactions = nextState.ledger.filter(l => l.tick === nextState.tick);
  
  const gdp = totalTransactionValue; 
  const avgPrice = totalTransactionVolume > 0 ? totalTransactionValue / totalTransactionVolume : 0;
  const unemployedCount = households.filter(h => !h.employedAt).length;
  const unemploymentRate = households.length > 0 ? unemployedCount / households.length : 0;
  
  const moneySupply = validateSystemInvariants(nextState);

  const metric: EconomicMetrics = {
    tick: nextState.tick,
    gdp,
    cpi: avgPrice,
    unemploymentRate,
    moneySupply,
    transactionCount: currentTickTransactions.length,
    avgWage: 0, // Placeholder
    activeFirms: firms.length // v0.1.1 metric
  };

  nextState.metricsHistory.push(metric);

  // v0.1.1: Aggregates Caching
  nextState.aggregates = {
      totalSalesVolumeLastTick: totalTransactionValue,
      totalWageVolumeLastTick: 0 // TODO: Sum from ledger
  };

  // v0.1.1: MEMORY SAFETY - Ledger Pruning
  if (nextState.ledger.length > MAX_LEDGER_ITEMS) {
      // Keep only the most recent items
      nextState.ledger = nextState.ledger.slice(-MAX_LEDGER_ITEMS);
  }

  // FINAL STEP: Persist RNG state for next tick
  nextState.rngState = rng.getState();

  return nextState;
};