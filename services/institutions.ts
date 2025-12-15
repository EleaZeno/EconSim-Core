import { WorldState, AgentType, Agent } from '../types';
import { transferMoney } from './accountingService';
import { STABILIZERS, DYNAMICS } from '../constants';

/**
 * INSTITUTION MODULES
 * 
 * This layer represents the "Rules of the Game".
 * Unlike Agents (who optimize for themselves), Institutions execute 
 * system-wide logic based on legislation or monetary policy.
 */

export const applyFiscalPolicy = (state: WorldState) => {
  const govtId = 'GOVT_01';
  
  // Feature #6: Political Lag
  // Decisions are based on data from N ticks ago.
  // If simulation is too young, use current/initial.
  const lookbackIndex = Math.max(0, state.metricsHistory.length - 1 - DYNAMICS.GOVT_POLICY_LAG);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const perceivedState = state.metricsHistory[lookbackIndex];
  
  // Example of Dynamic Policy:
  // If Perceived Unemployment > 10%, lower taxes? (Not implemented in MVP, but this is where it goes)
  
  const taxRate = state.config.params.taxRate;
  
  const currentTickTransactions = state.ledger.filter(l => l.tick === state.tick);

  // 1. Income Tax Collection
  state.agents.forEach(agent => {
    if (agent.type === AgentType.HOUSEHOLD && agent.active) {
      const income = currentTickTransactions
        .filter(l => l.toId === agent.id && l.reason === 'WAGE_PAYMENT')
        .reduce((sum, l) => sum + l.amount, 0);

      if (income > 0) {
        const taxAmount = Math.floor(income * taxRate * 100) / 100; 
        if (taxAmount > 0) {
          transferMoney(state, agent.id, govtId, taxAmount, 'INCOME_TAX');
        }
      }
    }
  });

  // 2. Wealth Tax (Stabilizer)
  state.agents.forEach(agent => {
      if (!agent.active) return;
      if (agent.type === AgentType.GOVERNMENT || agent.type === AgentType.CENTRAL_BANK) return;

      if (agent.cash > STABILIZERS.WEALTH_TAX_THRESHOLD) {
          const taxableAmount = agent.cash - STABILIZERS.WEALTH_TAX_THRESHOLD;
          const tax = taxableAmount * STABILIZERS.WEALTH_TAX_RATE;
          if (tax > 1) {
              transferMoney(state, agent.id, govtId, tax, 'WEALTH_TAX');
          }
      }
  });
};

export const processInsolvency = (state: WorldState, agent: Agent) => {
    const govtId = 'GOVT_01';
    agent.active = false;

    state.agents.forEach(other => {
        if (other.employedAt === agent.id) {
            other.employedAt = null;
        }
    });

    if (agent.cash > 0) {
        transferMoney(state, agent.id, govtId, agent.cash, 'BANKRUPTCY_LIQUIDATION');
    }
};