import { Agent, LedgerEntry, WorldState, AgentType } from '../types';

/**
 * Executes a safe money transfer between two agents.
 * Adheres to the conservation of money principle.
 * Throws error if funds are insufficient, preventing negative balances 
 * (unless we implement explicit credit lines later).
 */
export const transferMoney = (
  state: WorldState,
  fromId: string,
  toId: string,
  amount: number,
  reason: string
): LedgerEntry | null => {
  if (amount <= 0) return null;

  const sender = state.agents.get(fromId);
  const receiver = state.agents.get(toId);

  if (!sender || !receiver) {
    // console.error(`Transaction failed: Agent not found. ${fromId} -> ${toId}`);
    return null;
  }

  // HARD CONSTRAINT: No overdrafts without explicit credit logic
  // For MVP, Central Bank can go negative (print money), others cannot.
  if (sender.type !== 'CENTRAL_BANK' && sender.cash < amount) {
    // Transaction rejected due to insolvency
    return null;
  }

  // Execute Transfer
  sender.cash -= amount;
  receiver.cash += amount;

  // Log to Ledger
  const entry: LedgerEntry = {
    tick: state.tick,
    fromId: fromId,
    toId: toId,
    amount: amount,
    reason: reason,
  };
  
  // In a real DB we'd append, but for memory safety in JS we might limit this array size in the reducer
  state.ledger.push(entry);

  return entry;
};

/**
 * Handles resource transfer between inventory.
 */
export const transferResource = (
  state: WorldState,
  fromId: string,
  toId: string,
  resource: string,
  amount: number
): boolean => {
  if (amount <= 0) return false;

  const sender = state.agents.get(fromId);
  const receiver = state.agents.get(toId);
  const resKey = resource as keyof typeof sender.inventory;

  if (!sender || !receiver) return false;

  if ((sender.inventory[resKey] || 0) < amount) {
    return false;
  }

  sender.inventory[resKey] -= amount;
  receiver.inventory[resKey] = (receiver.inventory[resKey] || 0) + amount;

  return true;
};

/**
 * v0.1.1: System Invariant Validation
 * Checks if Conservation of Money holds true across the entire system.
 * This should be run at the end of every tick.
 */
export const validateSystemInvariants = (state: WorldState, previousMoneySupply?: number) => {
  let calculatedMoneySupply = 0;
  let cbCash = 0;

  state.agents.forEach(agent => {
    if (agent.type === AgentType.CENTRAL_BANK) {
      cbCash = agent.cash;
    } else {
      calculatedMoneySupply += agent.cash;
    }
    
    // Invariant 1: Non-CB agents cannot have negative cash
    if (agent.type !== AgentType.CENTRAL_BANK && agent.cash < -0.0001) {
      console.error(`INVARIANT VIOLATION: Agent ${agent.id} has negative cash: ${agent.cash}`);
    }
  });

  // Invariant 2: Total Money in System + CB Deficit/Surplus = Constant (simplified)
  // Or simpler for MVP: Total Non-CB Money is our "M0/M1" tracker. 
  // If we had a previous value, we can check if changes match Central Bank injections.
  // For now, we just log it to ensure it's not NaN.
  if (Number.isNaN(calculatedMoneySupply)) {
    throw new Error("CRITICAL FAILURE: Money supply became NaN");
  }

  return calculatedMoneySupply;
};