import { Agent, SimulationState, CONSTANTS, INITIAL_AGENTS } from './types';

// Helper to clone state for immutability
const clone = (obj: any) => JSON.parse(JSON.stringify(obj));

export const getInitialState = (): SimulationState => {
  return {
    tick: 0,
    agents: clone(INITIAL_AGENTS),
    logs: ['Simulation initialized. Waiting for Tick 1...'],
    totalMoney: INITIAL_AGENTS.reduce((sum, a) => sum + a.money, 0),
    totalFood: INITIAL_AGENTS.reduce((sum, a) => sum + a.inventory, 0),
    aliveCount: INITIAL_AGENTS.length
  };
};

export const runTick = (currentState: SimulationState): SimulationState => {
  const nextState = clone(currentState) as SimulationState;
  nextState.tick += 1;
  const tickLog: string[] = [`--- Tick ${nextState.tick} ---`];

  // Map for easy access
  const agents = nextState.agents;
  const getAgent = (id: string) => agents.find(a => a.id === id)!;

  const employer = getAgent('I');
  const govt = getAgent('J');
  const workers = agents.filter(a => a.role === 'Worker' && a.isAlive);
  const producers = agents.filter(a => a.role === 'Producer' && a.isAlive);

  // 1. CLEAR FLAGS
  agents.forEach(a => {
    a.isEmployed = false;
    a.lastAction = '';
  });

  if (!employer.isAlive) {
    tickLog.push("CRITICAL: Employer is dead. Economy halted.");
    return finalizeState(nextState, tickLog);
  }

  // 2. PRODUCTION PLANNING (Employer I Logic)
  // Employer hires Workers to operate Producers.
  // Capacity = Number of Alive Producers.
  // Cost = Wage per Worker + Fee to Producer (Simplification: Producer gets Wage too).
  
  let productionCount = 0;
  const productionCapacity = producers.length; // 1 Producer needs 1 Worker to make 1 Food
  
  // Employer needs to pay: Worker Wage + Producer Wage (Assume Producers act as specialized labor for simplicity in v0.1)
  const costPerUnit = CONSTANTS.WAGE * 2; // 1 Worker + 1 Producer

  // Employer decides how many to make based on Capital
  // Very dumb logic: Produce max possible given money and capacity
  const maxAffordable = Math.floor(employer.money / costPerUnit);
  const targetProduction = Math.min(productionCapacity, maxAffordable, workers.length);

  tickLog.push(`Plan: Employer wants to produce ${targetProduction} units (Cap: ${productionCapacity}, Funds: ${employer.money})`);

  // 3. EXECUTE PRODUCTION & WAGES
  for (let i = 0; i < targetProduction; i++) {
    const worker = workers[i];
    const producer = producers[i];

    // Transaction: Employer pays Worker
    employer.money -= CONSTANTS.WAGE;
    worker.money += CONSTANTS.WAGE;
    worker.isEmployed = true;

    // Transaction: Employer pays Producer
    employer.money -= CONSTANTS.WAGE;
    producer.money += CONSTANTS.WAGE;
    producer.isEmployed = true;

    // Output: Employer gets Food
    employer.inventory += 1;
    productionCount++;
    
    tickLog.push(`Prod: ${worker.name} & ${producer.name} prod 1 Food. Employer paid ${CONSTANTS.WAGE}x2.`);
  }

  // 4. TAXATION (Government J)
  // Tax 10% of all income generated this tick (Wages)
  // Only people who worked got income
  agents.forEach(agent => {
    if (agent.isEmployed && agent.role !== 'Employer') {
        // Income was CONSTANTS.WAGE
        const tax = Math.floor(CONSTANTS.WAGE * CONSTANTS.TAX_RATE);
        if (tax > 0 && agent.money >= tax) {
            agent.money -= tax;
            govt.money += tax;
            // tickLog.push(`Tax: ${agent.name} paid ${tax}.`);
        }
    }
  });

  // 5. CONSUMPTION MARKET (The Trading Phase)
  // Everyone (including Employer and Govt) needs to eat.
  // They try to buy from Employer I if they have no food.
  
  agents.forEach(consumer => {
    if (!consumer.isAlive) return;

    // Do I have food?
    if (consumer.inventory < CONSTANTS.FOOD_NEED) {
        // Need to buy
        if (employer.inventory > 0) {
            if (consumer.id === employer.id) {
                 // Employer consumes their own stock (Accounting: implicitly free or opportunity cost? Just take it)
                 // No money transfer
            } else {
                // Try to buy
                if (consumer.money >= CONSTANTS.PRICE) {
                    consumer.money -= CONSTANTS.PRICE;
                    employer.money += CONSTANTS.PRICE;
                    employer.inventory -= 1;
                    consumer.inventory += 1;
                    consumer.lastAction = `Bought Food (-${CONSTANTS.PRICE})`;
                } else {
                    consumer.lastAction = `Can't afford Food`;
                }
            }
        } else {
            consumer.lastAction = `Market Empty`;
        }
    }
  });

  // 6. SURVIVAL CHECK
  agents.forEach(agent => {
    if (!agent.isAlive) return;

    if (agent.inventory >= CONSTANTS.FOOD_NEED) {
        agent.inventory -= CONSTANTS.FOOD_NEED;
        // Alive
    } else {
        agent.isAlive = false;
        agent.lastAction = "DIED OF STARVATION";
        tickLog.push(`DEATH: ${agent.name} died.`);
    }
  });

  return finalizeState(nextState, tickLog);
};

const finalizeState = (state: SimulationState, newLogs: string[]): SimulationState => {
    state.logs = [...newLogs, ...state.logs].slice(0, 50); // Keep last 50 logs
    state.totalMoney = state.agents.reduce((sum, a) => sum + a.money, 0);
    state.totalFood = state.agents.reduce((sum, a) => sum + a.inventory, 0);
    state.aliveCount = state.agents.filter(a => a.isAlive).length;
    return state;
}
