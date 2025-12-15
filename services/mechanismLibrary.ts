
import { Agent, WorldState, MarketMechanism, AgentBehavior, Institution, AgentType, ResourceType } from '../types';
import { DeterministicRNG } from './randomService';
import { transferMoney, transferResource } from './accountingService';
import { BASE_NEEDS, SURVIVAL_CONSTRAINTS, DYNAMICS, STABILIZERS, INITIAL_PRICES } from '../constants';

// --- HELPER FUNCTIONS ---
const updateEMA = (currentEMA: number, newValue: number): number => {
  return (currentEMA * (1 - DYNAMICS.EMA_ALPHA)) + (newValue * DYNAMICS.EMA_ALPHA);
};

// ==========================================
// LAYER 2: MARKETS
// ==========================================

export const StandardLaborMarket: MarketMechanism = {
  id: 'standard_labor_market',
  name: '随机匹配劳动力市场 (Random Matching Labor)',
  resolve: (state: WorldState, rng: DeterministicRNG) => {
    const firms = Array.from(state.agents.values()).filter(a => a.type === AgentType.FIRM && a.active);
    const households = Array.from(state.agents.values()).filter(a => a.type === AgentType.HOUSEHOLD && a.active);
    
    // Cleanup Phase: Detach from dead firms
    households.forEach(hh => { 
      if (hh.employedAt && state.agents.get(hh.employedAt)?.active === false) {
        hh.employedAt = null; 
      }
    });

    const shuffledHouseholds = rng.shuffle([...households]);

    firms.forEach(firm => {
      const laborNeeded = firm.productionTarget || 0;
      let laborHired = shuffledHouseholds.filter(h => h.employedAt === firm.id).length;
      const wageOffer = firm.wageExpectation;

      // Firing Logic
      if (laborHired > laborNeeded) {
          const workers = shuffledHouseholds.filter(h => h.employedAt === firm.id);
          const toFire = workers.slice(0, laborHired - laborNeeded);
          toFire.forEach(w => w.employedAt = null);
          laborHired = laborNeeded;
      }

      // Hiring Logic
      for (const hh of shuffledHouseholds) {
        if (laborHired >= laborNeeded) break;
        if (hh.employedAt) continue;

        // Matching Condition: Offer >= Reservation Wage
        if (wageOffer >= hh.wageExpectation) {
          const success = transferMoney(state, firm.id, hh.id, wageOffer, 'WAGE_PAYMENT');
          if (success) {
            hh.employedAt = firm.id;
            laborHired++;
          }
        }
      }
    });
    
    // Production Phase (Immediately follows labor allocation in this model)
    firms.forEach(firm => {
        const employees = households.filter(h => h.employedAt === firm.id);
        let totalSkill = 0;
        employees.forEach(e => totalSkill += (e.skillLevel || 1.0));
        const output = Math.floor(totalSkill * 2.0); 
        firm.inventory[ResourceType.CONSUMER_GOODS] = (firm.inventory[ResourceType.CONSUMER_GOODS] || 0) + output;
    });
  }
};

export const StandardGoodsMarket: MarketMechanism = {
  id: 'standard_goods_market',
  name: '随机匹配商品市场 (Random Matching Goods)',
  resolve: (state: WorldState, rng: DeterministicRNG) => {
    const firms = Array.from(state.agents.values()).filter(a => a.type === AgentType.FIRM && a.active);
    const households = Array.from(state.agents.values()).filter(a => a.type === AgentType.HOUSEHOLD && a.active);
    
    const shuffledFirms = rng.shuffle([...firms]);
    
    households.forEach(hh => {
      const amountNeeded = BASE_NEEDS.FOOD_CONSUMPTION; 
      let amountBought = 0;
      
      const availableFirms = shuffledFirms.filter(f => (f.inventory[ResourceType.CONSUMER_GOODS] || 0) > 0);
      availableFirms.sort((a, b) => (a.salesPrice || 0) - (b.salesPrice || 0)); // Rational buyer sorts by price

      for (const firm of availableFirms) {
        if (amountBought >= amountNeeded) break;
        
        const price = firm.salesPrice || 10;
        if (hh.cash >= price) {
          const transfer = transferMoney(state, hh.id, firm.id, price, 'PURCHASE_GOODS');
          if (transfer) {
            transferResource(state, firm.id, hh.id, ResourceType.CONSUMER_GOODS, 1);
            amountBought++;
            // Note: We don't update metrics here, the engine does that via Ledger analysis
            firm.lastRevenue = (firm.lastRevenue || 0) + price;
          }
        }
      }
    });
  }
};

// ==========================================
// LAYER 3: AGENT BEHAVIORS
// ==========================================

export const BoundedRationalHousehold: AgentBehavior = {
  id: 'bounded_rational_household',
  name: '家庭：有限理性 (Bounded Rationality)',
  type: AgentType.HOUSEHOLD,
  decide: (agent: Agent, state: WorldState, rng: DeterministicRNG) => {
    // 1. Skill Dynamics
    if (agent.employedAt) {
      agent.skillLevel = Math.min(DYNAMICS.MAX_SKILL, (agent.skillLevel || 1.0) + DYNAMICS.SKILL_LEARN_RATE);
    } else {
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

    const isEmployed = !!agent.employedAt;
    agent.currentUtility = (Math.log(foodAvailable + 1) * 10) + (isEmployed ? 0 : 2);
    
    // 3. Wage Expectation (Adaptive)
    if (!agent.employedAt) {
      let decayFactor = 0.95; 
      if ((agent.starvationStreak || 0) >= SURVIVAL_CONSTRAINTS.STARVATION_THRESHOLD) decayFactor = 0.8;
      agent.wageExpectation = Math.max(1, agent.wageExpectation * decayFactor);
    } else {
      if (agent.currentUtility > 5) { 
         const riseFactor = 1.01 + (rng.next() * 0.02);
         agent.wageExpectation *= riseFactor;
      }
    }

    // 4. Savings (Bonds)
    const estimatedCostOfLiving = (state.metricsHistory[state.metricsHistory.length-1]?.cpi || 10) * needed;
    const safetyBuffer = estimatedCostOfLiving * 3;

    if (agent.cash > safetyBuffer) {
        const surplus = agent.cash - safetyBuffer;
        const investmentAmount = surplus * DYNAMICS.HOUSEHOLD_SAVINGS_RATIO;
        const txn = transferMoney(state, agent.id, 'GOVT_01', investmentAmount, 'BOND_PURCHASE');
        if (txn) agent.bonds = (agent.bonds || 0) + investmentAmount;
    } else if (agent.cash < estimatedCostOfLiving && (agent.bonds || 0) > 0) {
        const liquidationAmount = Math.min(agent.bonds, estimatedCostOfLiving - agent.cash);
        const txn = transferMoney(state, 'GOVT_01', agent.id, liquidationAmount, 'BOND_REDEMPTION');
        if (txn) agent.bonds -= liquidationAmount;
    }
  }
};

export const HeuristicFirm: AgentBehavior = {
  id: 'heuristic_firm',
  name: '企业：启发式决策 (Heuristic Firm)',
  type: AgentType.FIRM,
  decide: (agent: Agent, state: WorldState, rng: DeterministicRNG) => {
    const inventory = agent.inventory[ResourceType.CONSUMER_GOODS] || 0;
    const lastProfit = agent.lastProfit || 0;

    // 0. Update Memory
    agent.memory.avgProfit = updateEMA(agent.memory.avgProfit, lastProfit);
    agent.memory.avgInventory = updateEMA(agent.memory.avgInventory, inventory);

    // Insolvency Tracking (Internal view)
    if (agent.cash < SURVIVAL_CONSTRAINTS.FIRM_MIN_CASH || agent.memory.avgProfit < -5) {
      agent.insolvencyStreak = (agent.insolvencyStreak || 0) + 1;
    } else {
      agent.insolvencyStreak = Math.max(0, (agent.insolvencyStreak || 0) - 1);
    }

    // 1. Pricing Strategy
    const currentPrice = agent.salesPrice || 10;
    const inventoryWeeks = agent.memory.avgInventory / (agent.productionTarget || 1);
    let newPrice = currentPrice;

    if (inventory > (agent.productionTarget || 1) * STABILIZERS.FIRE_SALE_INVENTORY_MULT) {
        newPrice = currentPrice * 0.8; 
    } else {
        if (inventoryWeeks > 3) newPrice = currentPrice * 0.98; 
        else if (inventoryWeeks < 0.5) newPrice = currentPrice * 1.02;
    }
    agent.salesPrice = Math.max(0.1, newPrice);

    // 2. Production Planning
    let rawTarget = agent.productionTarget || 1;
    if (agent.memory.avgInventory > rawTarget * 2) rawTarget = Math.max(1, rawTarget - 1);
    else if (agent.memory.avgInventory < rawTarget * 0.5 && agent.cash > 200) rawTarget += 1;

    // Noise
    if (rng.next() < DYNAMICS.DECISION_NOISE) {
        rawTarget += (rng.next() > 0.5 ? 1 : -1);
    }
    agent.productionTarget = Math.max(0, Math.round(rawTarget));
  }
};

export const PassiveBank: AgentBehavior = {
  id: 'passive_bank',
  name: '商业银行：被动存管 (Passive Bank)',
  type: AgentType.BANK,
  decide: () => {} // No logic for MVP banks
};

// ==========================================
// LAYER 4: INSTITUTIONS
// ==========================================

export const BondYieldPayout: Institution = {
  id: 'bond_yield_payout',
  name: '国债利息支付 (Sovereign Bond Yield)',
  apply: (state: WorldState) => {
    const govtId = 'GOVT_01';
    state.agents.forEach(agent => {
      if ((agent.bonds || 0) > 0) {
          const interest = agent.bonds * DYNAMICS.BOND_YIELD_RATE;
          transferMoney(state, govtId, agent.id, interest, 'BOND_INTEREST');
      }
    });
  }
};

export const StandardBankruptcy: Institution = {
  id: 'standard_bankruptcy',
  name: '标准破产清算法 (State Liquidation)',
  apply: (state: WorldState) => {
     state.agents.forEach(agent => {
      if (agent.type === AgentType.FIRM && agent.active) {
         if ((agent.insolvencyStreak || 0) >= SURVIVAL_CONSTRAINTS.INSOLVENCY_THRESHOLD) {
           // BANKRUPTCY EXECUTION
           agent.active = false;
           
           // Fire all
           state.agents.forEach(other => {
             if (other.employedAt === agent.id) other.employedAt = null;
           });

           // Liquidate to Govt
           if (agent.cash > 0) {
             transferMoney(state, agent.id, 'GOVT_01', agent.cash, 'BANKRUPTCY_LIQUIDATION');
           }
         }
      }
    });
  }
};

// Alternative Bankruptcy that is more forgiving
export const ForgivingBankruptcy: Institution = {
  id: 'forgiving_bankruptcy',
  name: '宽容破产法 (Forgiving Bankruptcy)',
  apply: (state: WorldState) => {
     state.agents.forEach(agent => {
      if (agent.type === AgentType.FIRM && agent.active) {
         // Needs 6 ticks of insolvency instead of 3
         if ((agent.insolvencyStreak || 0) >= 6) {
           agent.active = false;
           state.agents.forEach(other => {
             if (other.employedAt === agent.id) other.employedAt = null;
           });
           if (agent.cash > 0) {
             transferMoney(state, agent.id, 'GOVT_01', agent.cash, 'BANKRUPTCY_LIQUIDATION');
           }
         }
      }
    });
  }
};

export const IncomeTax: Institution = {
  id: 'income_tax',
  name: '统一所得税 (Flat Income Tax)',
  apply: (state: WorldState) => {
    const taxRate = state.config.params.taxRate;
    if (taxRate <= 0) return;

    const currentTickTransactions = state.ledger.filter(l => l.tick === state.tick);
    
    state.agents.forEach(agent => {
      if (agent.type === AgentType.HOUSEHOLD && agent.active) {
        const income = currentTickTransactions
          .filter(l => l.toId === agent.id && l.reason === 'WAGE_PAYMENT')
          .reduce((sum, l) => sum + l.amount, 0);

        if (income > 0) {
          const taxAmount = Math.floor(income * taxRate * 100) / 100; 
          if (taxAmount > 0) {
            transferMoney(state, agent.id, 'GOVT_01', taxAmount, 'INCOME_TAX');
          }
        }
      }
    });
  }
};

export const WealthTaxStabilizer: Institution = {
  id: 'wealth_tax_stabilizer',
  name: '财富税调节器 (Wealth Tax Stabilizer)',
  apply: (state: WorldState) => {
    state.agents.forEach(agent => {
        if (!agent.active) return;
        if (agent.type === AgentType.GOVERNMENT || agent.type === AgentType.CENTRAL_BANK) return;

        if (agent.cash > STABILIZERS.WEALTH_TAX_THRESHOLD) {
            const taxableAmount = agent.cash - STABILIZERS.WEALTH_TAX_THRESHOLD;
            const tax = taxableAmount * STABILIZERS.WEALTH_TAX_RATE;
            if (tax > 1) {
                transferMoney(state, agent.id, 'GOVT_01', tax, 'WEALTH_TAX');
            }
        }
    });
  }
};

export const EmergencyWelfare: Institution = {
  id: 'emergency_welfare',
  name: '紧急福利救助 (Emergency Welfare)',
  apply: (state: WorldState) => {
     // Check for starving households
     state.agents.forEach(hh => {
        if (hh.type === AgentType.HOUSEHOLD && hh.active) {
           const estimatedFoodCost = 10; // Simplify lookup
           if (hh.cash < estimatedFoodCost) {
               const subsidy = estimatedFoodCost - hh.cash;
               transferMoney(state, 'GOVT_01', hh.id, subsidy, 'EMERGENCY_WELFARE');
           }
        }
     });
  }
};

// ==========================================
// REGISTRY
// ==========================================
// Maps string IDs from Config to actual implementations

export const MechanismRegistry = {
  Markets: {
    'standard_labor_market': StandardLaborMarket,
    'standard_goods_market': StandardGoodsMarket
  } as Record<string, MarketMechanism>,
  
  Behaviors: {
    'bounded_rational_household': BoundedRationalHousehold,
    'heuristic_firm': HeuristicFirm,
    'passive_bank': PassiveBank
  } as Record<string, AgentBehavior>,
  
  Institutions: {
    'bond_yield_payout': BondYieldPayout,
    'standard_bankruptcy': StandardBankruptcy,
    'forgiving_bankruptcy': ForgivingBankruptcy,
    'income_tax': IncomeTax,
    'wealth_tax_stabilizer': WealthTaxStabilizer,
    'emergency_welfare': EmergencyWelfare
  } as Record<string, Institution>
};
