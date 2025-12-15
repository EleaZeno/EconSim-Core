import { AgentType, ResourceType, SimulationSettings } from './types';

export const INITIAL_SETTINGS: SimulationSettings = {
  initialSeed: 1337, // Fixed seed for reproducibility by default
  taxRate: 0.15, // 15% Income Tax
  salesTax: 0.05, // 5% Sales Tax
  subsidyRate: 0.0,
  moneyPrintingEnabled: false,
};

export const INITIAL_POPULATION_COUNTS = {
  [AgentType.HOUSEHOLD]: 50,
  [AgentType.FIRM]: 10,
  [AgentType.BANK]: 1,
  [AgentType.GOVERNMENT]: 1,
  [AgentType.CENTRAL_BANK]: 1,
};

export const BASE_NEEDS = {
  FOOD_CONSUMPTION: 1, // Units of CONSUMER_GOODS per tick
};

export const INITIAL_PRICES = {
  [ResourceType.CONSUMER_GOODS]: 10,
  [ResourceType.LABOR]: 20, // Wage
};

// --- v0.1.1 Constraints ---

export const MAX_HISTORY_LENGTH = 100; // Keep last 100 ticks of metrics for UI
export const MAX_LEDGER_ITEMS = 1000;  // Hardcap ledger size to prevent memory leaks

export const SURVIVAL_CONSTRAINTS = {
  STARVATION_THRESHOLD: 3, // Ticks without food before panic sets in
  INSOLVENCY_THRESHOLD: 5, // Ticks with negative profit/low cash before bankruptcy
  FIRM_MIN_CASH: 50,       // Minimum cash buffer for a firm to feel safe
};