import { Agent, AgentType, ResourceType, WorldState } from '../types';
import { BASE_NEEDS, SURVIVAL_CONSTRAINTS } from '../constants';
import { DeterministicRNG } from './randomService';
import { transferMoney as execTransfer } from './accountingService';

/**
 * ARCHITECTURE NOTE: AGENT RATIONALITY
 * 
 * Agents must not contain "plot armor" or script-driven behavior.
 * Decisions must be derived from an optimization function:
 * 1. Households: Maximize Utility(Consumption, Leisure) s.t. Budget
 * 2. Firms: Maximize Profit(Output * Price - Input * Cost)
 * 
 * Execution context: 
 * - Inputs: Read-only view of Market State + Internal Beliefs
 * - Outputs: Desired Actions (to be executed by the Engine/Ledger)
 * 
 * Threading Constraint: ❌ NO SHARED MUTABLE STATE during decision phase.
 * This logic allows for future parallelization (Web Workers/GPU).
 */

// --- Household Logic ---

/**
 * Calculates current utility based on consumption.
 * Utility Function: U = ln(Consumption + 1) + 0.5 * Leisure (Simplified)
 */
const calculateHouseholdUtility = (foodConsumed: number, isEmployed: boolean): number => {
  const consumptionUtility = Math.log(foodConsumed + 1) * 10;
  // Leisure utility: If not employed, higher leisure. 
  // (In this model, unemployment sucks because no money, but purely time-wise it has utility)
  const leisureUtility = isEmployed ? 0 : 2; 
  return consumptionUtility + leisureUtility;
};

export const householdDecision = (agent: Agent, state: WorldState, rng: DeterministicRNG) => {
  if (!agent.active) return;

  // 1. Consumption Logic (Survival Constraint > Utility Maximization)
  const foodAvailable = agent.inventory[ResourceType.CONSUMER_GOODS] || 0;
  const needed = BASE_NEEDS.FOOD_CONSUMPTION;
  
  // Decide how much to consume based on diminishing returns? 
  // For MVP: Rigid demand (survival).
  const actualConsumption = Math.min(foodAvailable, needed);
  
  // Update Inventory (State Mutation - strictly local to agent)
  agent.inventory[ResourceType.CONSUMER_GOODS] -= actualConsumption;
  
  // v0.1.1: STARVATION LOGIC
  if (actualConsumption < needed) {
    agent.starvationStreak = (agent.starvationStreak || 0) + 1;
  } else {
    agent.starvationStreak = 0;
  }

  // Update Utility Metric
  agent.currentUtility = calculateHouseholdUtility(actualConsumption, !!agent.employedAt);

  // Update Satisfaction Metric
  agent.needsSatisfaction = needed > 0 ? actualConsumption / needed : 1;
  
  // 2. Wage/Labor Strategy (Expectation Adaptation)
  // Adaptive Expectations Hypothesis: Agents update beliefs based on past errors.
  
  if (!agent.employedAt) {
    // If unemployed, the marginal utility of high wage is 0 (since probability of hire drops).
    // Decay wage expectation to increase probability of employment.
    
    // v0.1.1: PANIC MODE
    // If starving, the agent becomes desperate and slashes reservation wage drastically.
    let decayFactor = 0.90 + (rng.next() * 0.10); // Normal decay
    
    if ((agent.starvationStreak || 0) >= SURVIVAL_CONSTRAINTS.STARVATION_THRESHOLD) {
      decayFactor = 0.5; // Desperation collapse
    }

    agent.wageExpectation = Math.max(1, agent.wageExpectation * decayFactor);
  } else {
    // If employed, utility is high. Agent might test market power.
    // Sticky wages: rises slower than it falls.
    if (agent.currentUtility > 5) { // Arbitrary utility threshold for "happy"
       const riseFactor = 1.00 + (rng.next() * 0.05); // 1.00 - 1.05
       agent.wageExpectation *= riseFactor;
    }
  }
};

// --- Firm Logic ---

export const firmDecision = (agent: Agent, state: WorldState, rng: DeterministicRNG) => {
  if (!agent.active) return;

  // Profit Maximization Goal
  // Profit = (P * Q) - (W * L)
  
  const inventory = agent.inventory[ResourceType.CONSUMER_GOODS] || 0;
  const lastProfit = agent.lastProfit || 0;

  // v0.1.1: INSOLVENCY TRACKING
  if (agent.cash < SURVIVAL_CONSTRAINTS.FIRM_MIN_CASH || lastProfit < 0) {
    agent.insolvencyStreak = (agent.insolvencyStreak || 0) + 1;
  } else {
    agent.insolvencyStreak = Math.max(0, (agent.insolvencyStreak || 0) - 1);
  }

  // 1. Pricing Strategy (Market Clearing)
  // Heuristic: If Inventory high, Price too high.
  // Formalism: Agents estimate Demand Curve elasticity locally.
  
  if (inventory > 10) {
    // Excess supply -> Cut price
    agent.salesPrice = Math.max(1, (agent.salesPrice || 10) * 0.95);
  } else if (inventory < 2) {
    // Excess demand -> Raise price
    agent.salesPrice = (agent.salesPrice || 10) * 1.05;
  }

  // 2. Production Planning (Labor Demand)
  // If Profitable, expand. If Loss, contract.
  // "Animal Spirits" / Confidence factor modeled via RNG.
  
  if (lastProfit > 0) {
    // Confidence boost
    if (rng.next() > 0.3) {
      agent.productionTarget = (agent.productionTarget || 1) + 1;
    }
  } else {
    // Cost cutting
    agent.productionTarget = Math.max(1, (agent.productionTarget || 1) - 1);
  }
};

// --- Bank Logic (v0.1.2) ---

export const bankDecision = (agent: Agent, state: WorldState, rng: DeterministicRNG) => {
    if (!agent.active) return;

    // MVP Bank Logic: Liquidity Balancer
    // If Bank has excess cash (from future interest payments), it distributes dividends to Government
    // to put money back into circulation (Simulating generic "profit" distribution).
    
    const SAFE_CAPITAL_BUFFER = 5000;
    
    if (agent.cash > SAFE_CAPITAL_BUFFER) {
        const dividend = agent.cash - SAFE_CAPITAL_BUFFER;
        execTransfer(state, agent.id, 'GOVT_01', dividend, 'SUBSIDY'); // Using Subsidy as proxy for Dividend for now
    }
    
    // Future v0.2: Scan for Firms with high profit but low cash and offer LOANS.
};