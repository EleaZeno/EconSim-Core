export type Role = 'Worker' | 'Producer' | 'Employer' | 'Government';

export interface Agent {
  id: string;
  name: string; // The specific names A-J
  role: Role;
  money: number;
  inventory: number; // Food count
  isAlive: boolean;
  isEmployed: boolean; // Reset every tick
  lastAction: string; // For observability
}

export interface SimulationState {
  tick: number;
  agents: Agent[];
  logs: string[];
  totalMoney: number;
  totalFood: number;
  aliveCount: number;
}

// v0.1 Economic Constants
export const CONSTANTS = {
  WAGE: 4,           // Pay per tick for work
  PRICE: 5,          // Cost of 1 Food
  TAX_RATE: 0.1,     // 10% income tax
  FOOD_NEED: 1,      // Survival requirement per tick
  INITIAL_CASH: {
    WORKER: 10,
    PRODUCER: 20,
    EMPLOYER: 50,    // Employer needs capital to pay wages initially
    GOVT: 0
  }
};

export const INITIAL_AGENTS: Agent[] = [
  { id: 'A', name: 'Worker A', role: 'Worker', money: CONSTANTS.INITIAL_CASH.WORKER, inventory: 0, isAlive: true, isEmployed: false, lastAction: 'Ready' },
  { id: 'B', name: 'Worker B', role: 'Worker', money: CONSTANTS.INITIAL_CASH.WORKER, inventory: 0, isAlive: true, isEmployed: false, lastAction: 'Ready' },
  { id: 'C', name: 'Worker C', role: 'Worker', money: CONSTANTS.INITIAL_CASH.WORKER, inventory: 0, isAlive: true, isEmployed: false, lastAction: 'Ready' },
  { id: 'D', name: 'Worker D', role: 'Worker', money: CONSTANTS.INITIAL_CASH.WORKER, inventory: 0, isAlive: true, isEmployed: false, lastAction: 'Ready' },
  { id: 'E', name: 'Worker E', role: 'Worker', money: CONSTANTS.INITIAL_CASH.WORKER, inventory: 0, isAlive: true, isEmployed: false, lastAction: 'Ready' },
  { id: 'F', name: 'Worker F', role: 'Worker', money: CONSTANTS.INITIAL_CASH.WORKER, inventory: 0, isAlive: true, isEmployed: false, lastAction: 'Ready' },
  { id: 'G', name: 'Producer G', role: 'Producer', money: CONSTANTS.INITIAL_CASH.PRODUCER, inventory: 0, isAlive: true, isEmployed: false, lastAction: 'Ready' },
  { id: 'H', name: 'Producer H', role: 'Producer', money: CONSTANTS.INITIAL_CASH.PRODUCER, inventory: 0, isAlive: true, isEmployed: false, lastAction: 'Ready' },
  { id: 'I', name: 'Employer I', role: 'Employer', money: CONSTANTS.INITIAL_CASH.EMPLOYER, inventory: 2, isAlive: true, isEmployed: true, lastAction: 'Ready' }, // Starts with some stock to prevent instant famine
  { id: 'J', name: 'Govt J', role: 'Government', money: CONSTANTS.INITIAL_CASH.GOVT, inventory: 0, isAlive: true, isEmployed: true, lastAction: 'Ready' },
];
