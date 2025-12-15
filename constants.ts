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

export const MAX_HISTORY_LENGTH = 100; // Keep last 100 ticks in memory for UI