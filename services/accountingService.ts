import { Agent, LedgerEntry, WorldState } from '../types';

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
    console.error(`Transaction failed: Agent not found. ${fromId} -> ${toId}`);
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
