import { 
  WorldState, 
  Agent, 
  AgentType, 
  ResourceType, 
  SimulationSettings, 
  EconomicMetrics 
} from '../types';
import { INITIAL_POPULATION_COUNTS, INITIAL_PRICES, INITIAL_SETTINGS } from '../constants';
import { transferMoney, transferResource } from './accountingService';
import { householdDecision, firmDecision } from './agentLogic';
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
    inventory: { [ResourceType.LABOR]: 0, [ResourceType.RAW_MATERIALS]: 0, [ResourceType.CONSUMER_GOODS]: 0, [ResourceType.CAPITAL_EQUIPMENT]: 0 },
    priceBeliefs: { ...emptyPriceBeliefs },
    wageExpectation: 0,
    currentUtility: 0
  });

  const cbId = 'CB_01';
  agents.set(cbId, {
    id: cbId,
    type: AgentType.CENTRAL_BANK,
    cash: 1000000,
    inventory: { [ResourceType.LABOR]: 0, [ResourceType.RAW_MATERIALS]: 0, [ResourceType.CONSUMER_GOODS]: 0, [ResourceType.CAPITAL_EQUIPMENT]: 0 },
    priceBeliefs: { ...emptyPriceBeliefs },
    wageExpectation: 0,
    currentUtility: 0
  });

  // 2. Create Firms
  for (let i = 0; i < INITIAL_POPULATION_COUNTS[AgentType.FIRM]; i++) {
    const id = `FIRM_${i}`;
    agents.set(id, {
      id,
      type: AgentType.FIRM,
      cash: 500,
      inventory: { [ResourceType.LABOR]: 0, [ResourceType.RAW_MATERIALS]: 0, [ResourceType.CONSUMER_GOODS]: 10, [ResourceType.CAPITAL_EQUIPMENT]: 0 },
      priceBeliefs: { ...defaultPriceBeliefs },
      salesPrice: INITIAL_PRICES[ResourceType.CONSUMER_GOODS],
      wageExpectation: INITIAL_PRICES[ResourceType.LABOR],
      productionTarget: 2,
      lastProfit: 0,
      currentUtility: 0
    });
  }

  // 3. Create Households
  for (let i = 0; i < INITIAL_POPULATION_COUNTS[AgentType.HOUSEHOLD]; i++) {
    const id = `HH_${i}`;
    agents.set(id, {
      id,
      type: AgentType.HOUSEHOLD,
      cash: 100,
      inventory: { [ResourceType.LABOR]: 0, [ResourceType.RAW_MATERIALS]: 0, [ResourceType.CONSUMER_GOODS]: 2, [ResourceType.CAPITAL_EQUIPMENT]: 0 },
      priceBeliefs: { ...defaultPriceBeliefs },
      wageExpectation: INITIAL_PRICES[ResourceType.LABOR],
      needsSatisfaction: 1,
      currentUtility: 10
    });
  }

  return {
    tick: 0,
    agents,
    ledger: [],
    metricsHistory: [],
    settings: { ...INITIAL_SETTINGS },
    rngState: seed // Initial Seed
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
  
  // Helper to get mutable agent reference for this tick
  const getAgent = (id: string) => nextState.agents.get(id)!;

  // --- 1. Agent Decision Phase (Parallelizable Candidate) ---
  // Note: agents act based on 'nextState' which currently looks like 'currentState' 
  // until we start applying transactions.
  // In a parallel implementation, we would pass a ReadOnly snapshot.
  nextState.agents.forEach(agent => {
    const mutableAgent = { ...agent, inventory: { ...agent.inventory }, priceBeliefs: { ...agent.priceBeliefs } };
    nextState.agents.set(agent.id, mutableAgent);

    if (agent.type === AgentType.HOUSEHOLD) householdDecision(mutableAgent, nextState, rng);
    if (agent.type === AgentType.FIRM) firmDecision(mutableAgent, nextState, rng);
  });

  // --- 2. Labor Market Clearing (Serial / Matching) ---
  const firms = Array.from(nextState.agents.values()).filter(a => a.type === AgentType.FIRM);
  const households = Array.from(nextState.agents.values()).filter(a => a.type === AgentType.HOUSEHOLD);
  
  // Deterministic Shuffle using RNG (NOT Math.random)
  const shuffledHouseholds = rng.shuffle([...households]);

  // Reset employment
  shuffledHouseholds.forEach(hh => { hh.employedAt = null; });

  firms.forEach(firm => {
    const laborNeeded = firm.productionTarget || 0;
    let laborHired = 0;
    const wageOffer = firm.wageExpectation;

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

  // --- 5. Fiscal Phase ---
  const taxRate = nextState.settings.taxRate;
  const govtId = 'GOVT_01';
  
  households.forEach(hh => {
    if (hh.employedAt) {
      const income = nextState.ledger
        .filter(l => l.toId === hh.id && l.tick === nextState.tick && l.reason === 'WAGE_PAYMENT')
        .reduce((sum, l) => sum + l.amount, 0);

      if (income > 0) {
        const tax = income * taxRate;
        transferMoney(nextState, hh.id, govtId, tax, 'INCOME_TAX');
      }
    }
  });

  // --- 6. Consumption / Metrics Phase ---
  // GDP
  const gdp = totalTransactionValue; 
  const avgPrice = totalTransactionVolume > 0 ? totalTransactionValue / totalTransactionVolume : 0;
  const unemployedCount = households.filter(h => !h.employedAt).length;
  const unemploymentRate = households.length > 0 ? unemployedCount / households.length : 0;
  
  const moneySupply = Array.from(nextState.agents.values())
    .filter(a => a.type !== AgentType.CENTRAL_BANK) 
    .reduce((sum, a) => sum + a.cash, 0);

  const metric: EconomicMetrics = {
    tick: nextState.tick,
    gdp,
    cpi: avgPrice,
    unemploymentRate,
    moneySupply,
    transactionCount: nextState.ledger.filter(l => l.tick === nextState.tick).length,
    avgWage: 0 
  };

  nextState.metricsHistory.push(metric);

  // FINAL STEP: Persist RNG state for next tick
  nextState.rngState = rng.getState();

  return nextState;
};