import { WorldState, AgentType } from '../types';
import { transferMoney } from './accountingService';

/**
 * INSTITUTION MODULES
 * 
 * This layer represents the "Rules of the Game".
 * Unlike Agents (who optimize for themselves), Institutions execute 
 * system-wide logic based on legislation or monetary policy.
 */

/**
 * Standard Fiscal Policy (Taxation)
 * - Iterates through transaction history to find taxable income.
 * - Transfers calculated tax from Households to Government.
 */
export const applyFiscalPolicy = (state: WorldState) => {
  const govtId = 'GOVT_01';
  const taxRate = state.settings.taxRate;
  
  // Optimization: Filter ledger once for the current tick
  const currentTickTransactions = state.ledger.filter(l => l.tick === state.tick);

  // 1. Income Tax Collection
  // Definition: Tax applied to WAGE_PAYMENT events received by Households
  state.agents.forEach(agent => {
    if (agent.type === AgentType.HOUSEHOLD && agent.active) {
      const income = currentTickTransactions
        .filter(l => l.toId === agent.id && l.reason === 'WAGE_PAYMENT')
        .reduce((sum, l) => sum + l.amount, 0);

      if (income > 0) {
        const taxAmount = Math.floor(income * taxRate * 100) / 100; // Round to 2 decimals
        if (taxAmount > 0) {
          transferMoney(state, agent.id, govtId, taxAmount, 'INCOME_TAX');
        }
      }
    }
  });

  // Future expansion: Corporate Tax, VAT, Welfare Subsidies
};

/**
 * Standard Monetary Policy (Central Bank)
 * - Currently a placeholder for Interest Rate setting and OMO (Open Market Operations).
 */
export const applyMonetaryPolicy = (state: WorldState) => {
    // Placeholder for v0.2: Adjust base interest rates based on Inflation (Taylor Rule)
};
