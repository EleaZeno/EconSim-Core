import { Agent, AgentType, ResourceType, WorldState } from '../types';
import { BASE_NEEDS, SURVIVAL_CONSTRAINTS, STABILIZERS, DYNAMICS } from '../constants';
import { DeterministicRNG } from './randomService';
import { transferMoney as execTransfer } from './accountingService';

/**
 * HELPER: Exponential Moving Average
 * Updates a belief based on new data with a smoothing factor (Alpha).
 */
const updateEMA = (currentEMA: number, newValue: number): number => {
  return (currentEMA * (1 - DYNAMICS.EMA_ALPHA)) + (newValue * DYNAMICS.EMA_ALPHA);
};

/**
 * HELPER: Bounded Rationality / Noise
 * Adds deterministic noise to a decision target.
 * e.g., target 100 -> returns 90 to 110.
 */
const fuzzDecision = (value: number, rng: DeterministicRNG): number => {
  const noise = (rng.next() - 0.5) * 2 * DYNAMICS.DECISION_NOISE; // -0.1 to +0.1
  return value * (1 + noise);
};

// --- Household Logic ---

const calculateHouseholdUtility = (foodConsumed: number, isEmployed: boolean): number => {
  const consumptionUtility = Math.log(foodConsumed + 1) * 10;
  const leisureUtility = isEmployed ? 0 : 2; 
  return consumptionUtility + leisureUtility;
};

export const householdDecision = (agent: Agent, state: WorldState, rng: DeterministicRNG) => {
  if (!agent.active) return;

  // 1. Skill Dynamics (Feature #3: Heterogeneity & Scarrring)
  // Skill changes happen BEFORE market action to reflect previous tick's status
  if (agent.employedAt) {
    agent.skillLevel = Math.min(DYNAMICS.MAX_SKILL, (agent.skillLevel || 1.0) + DYNAMICS.SKILL_LEARN_RATE);
  } else {
    // Scarring effect: Unemployment erodes skills
    agent.skillLevel = Math.max(DYNAMICS.MIN_SKILL, (agent.skillLevel || 1.0) - DYNAMICS.SKILL_DECAY_RATE);
  }

  // 2. Consumption Logic
  const foodAvailable = agent.inventory[ResourceType.CONSUMER_GOODS] || 0;
  const needed = BASE_NEEDS.FOOD_CONSUMPTION;
  const actualConsumption = Math.min(foodAvailable, needed);
  
  agent.inventory[ResourceType.CONSUMER_GOODS] -= actualConsumption;
  
  if (actualConsumption < needed) {
    agent.starvationStreak = (agent.starvationStreak || 0) + 1;
  } else {
    agent.starvationStreak = 0;
  }

  agent.currentUtility = calculateHouseholdUtility(actualConsumption, !!agent.employedAt);
  agent.needsSatisfaction = needed > 0 ? actualConsumption / needed : 1;
  
  // 3. Wage Expectation (Adaptive)
  if (!agent.employedAt) {
    // Decay depends on Desperation (Starvation) and Skill level (Confidence)
    let decayFactor = 0.95; 
    
    if ((agent.starvationStreak || 0) >= SURVIVAL_CONSTRAINTS.STARVATION_THRESHOLD) {
      decayFactor = 0.8; // Panic
    }
    
    // Lower skill agents lose confidence faster
    if ((agent.skillLevel || 1) < 0.8) {
        decayFactor -= 0.05;
    }

    agent.wageExpectation = Math.max(1, agent.wageExpectation * decayFactor);
  } else {
    // Sticky wages, but rises if utility is high
    if (agent.currentUtility > 5) { 
       const riseFactor = 1.01 + (rng.next() * 0.02);
       agent.wageExpectation *= riseFactor;
    }
  }

  // 4. Asset Allocation (Feature #4: Bonds)
  // If cash > 3x Needs, buy bonds (Save)
  const estimatedCostOfLiving = (state.metricsHistory[state.metricsHistory.length-1]?.cpi || 10) * needed;
  const safetyBuffer = estimatedCostOfLiving * 3;

  if (agent.cash > safetyBuffer) {
      const surplus = agent.cash - safetyBuffer;
      const investmentAmount = surplus * DYNAMICS.HOUSEHOLD_SAVINGS_RATIO;
      
      // "Buy" bonds from Govt (Govt issues debt, Agent gets Bond asset)
      // We implement this as a direct transfer to Govt, and Agent.bonds += amount
      // This mimics Open Market Operations or Treasury Direct.
      const txn = execTransfer(state, agent.id, 'GOVT_01', investmentAmount, 'BOND_PURCHASE');
      if (txn) {
          agent.bonds = (agent.bonds || 0) + investmentAmount;
      }
  } else if (agent.cash < estimatedCostOfLiving && (agent.bonds || 0) > 0) {
      // Liquidate bonds if desperate
      const liquidationAmount = Math.min(agent.bonds, estimatedCostOfLiving - agent.cash);
      // Govt buys back (Assumption: Bonds are liquid)
      const txn = execTransfer(state, 'GOVT_01', agent.id, liquidationAmount, 'BOND_REDEMPTION');
      if (txn) {
          agent.bonds -= liquidationAmount;
      }
  }
};

// --- Firm Logic ---

export const firmDecision = (agent: Agent, state: WorldState, rng: DeterministicRNG) => {
  if (!agent.active) return;

  const inventory = agent.inventory[ResourceType.CONSUMER_GOODS] || 0;
  const lastProfit = agent.lastProfit || 0;

  // 0. Update Perceptions (Feature #1: Time Lag / Smoothing)
  // We use the EMA memory instead of raw current values for decisions
  agent.memory.avgProfit = updateEMA(agent.memory.avgProfit, lastProfit);
  agent.memory.avgInventory = updateEMA(agent.memory.avgInventory, inventory);
  // Assume avgRevenue was updated in engine after sales
  
  // Insolvency Check
  if (agent.cash < SURVIVAL_CONSTRAINTS.FIRM_MIN_CASH || agent.memory.avgProfit < -5) {
    agent.insolvencyStreak = (agent.insolvencyStreak || 0) + 1;
  } else {
    agent.insolvencyStreak = Math.max(0, (agent.insolvencyStreak || 0) - 1);
  }

  // 1. Pricing Strategy (Feature #2: Price as Belief)
  // Heuristic: Win-Stay, Lose-Shift based on SMOOTHED profit and inventory
  
  const currentPrice = agent.salesPrice || 10;
  const inventoryWeeks = agent.memory.avgInventory / (agent.productionTarget || 1);
  
  let newPrice = currentPrice;

  if (inventory > (agent.productionTarget || 1) * STABILIZERS.FIRE_SALE_INVENTORY_MULT) {
      // Emergency: Fire Sale still bypasses belief (Panic is instant)
      newPrice = currentPrice * 0.8; 
  } else {
      // Standard adjustment based on Inventory Belief
      if (inventoryWeeks > 3) {
          // Bloated inventory -> Lower Price
          newPrice = currentPrice * 0.98; 
      } else if (inventoryWeeks < 0.5) {
          // Scarcity -> Raise Price
          newPrice = currentPrice * 1.02;
      }
      
      // Profit feedback: If profit is dropping, try changing price direction?
      // (Simplified for now: Inventory dominance)
  }

  agent.salesPrice = Math.max(0.1, newPrice);

  // 2. Production Planning (Feature #5: Bounded Rationality)
  
  let rawTarget = agent.productionTarget || 1;
  
  // Decision based on SMOOTHED inventory, not current
  if (agent.memory.avgInventory > rawTarget * 2) {
      // Cut production
      rawTarget = Math.max(1, rawTarget - 1);
  } else if (agent.memory.avgInventory < rawTarget * 0.5 && agent.cash > 200) {
      // Expand
      rawTarget += 1;
  }

  // Apply Noise (Bounded Rationality)
  // Even if logic says "Produce 10", manager might produce 9 or 11 due to error/optimism.
  // We apply this to the wage expectation or hiring budget mostly, but let's apply to target intent.
  // Integer target needs probabilistic rounding if we really want noise, but let's stick to simple logic:
  if (rng.next() < DYNAMICS.DECISION_NOISE) {
      // 10% chance to act irrationally (random +/- 1)
      rawTarget += (rng.next() > 0.5 ? 1 : -1);
  }
  
  agent.productionTarget = Math.max(0, Math.round(rawTarget));
};

// --- Bank Logic ---

export const bankDecision = (agent: Agent, state: WorldState, rng: DeterministicRNG) => {
    if (!agent.active) return;
    // Commercial banks are passive in this version (Govt handles bonds)
};