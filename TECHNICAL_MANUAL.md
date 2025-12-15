# EconSim Core: Engineering Specification

## A. Project Snapshot

EconSim Core is a **discrete-event, agent-based economic simulation engine** designed for institutional stress testing and theoretical analysis. It is NOT a game; it is a deterministic state machine that processes economic interactions under strict accounting rules. 

Unlike narrative simulations, EconSim relies on emergent behavior: macro-level phenomena (inflation, recessions) arise solely from micro-level agent optimizations and rigid institutional constraints.

**Key Characteristics:**
- **Architecture:** Sequential, single-threaded Tick loop with Ledger-based state.
- **Reproducibility:** 100% deterministic given a seed (using `Mulberry32` PRNG).
- **Accounting:** Double-entry bookkeeping prevents "mana-bar economics" (money is never destroyed/created implicitly).

---

## B. Hard Constraints & Invariants

These rules are enforced by the engine kernel and cannot be violated by Agent logic.

### 1. Conservation of Value (The Ledger Law)
Every unit of currency must account for its origin and destination.
- **Rule:** $\sum Cash_{agents} + \sum Cash_{Govt} = M_0$.
- **Implementation:** `accountingService.transferMoney` is the *only* way to mutate cash balances.
- **Exception:** Only the `CENTRAL_BANK` agent type can create money (expand $M_0$) or destroy it (contract $M_0$).

### 2. Time Discretization (The Tick)
Time advances in discrete units ($T$). 
- **Rule:** State $S_{t+1} = f(S_t, \text{Institutions}, \text{Agents})$.
- **Invariant:** Agents cannot act "between" ticks. All decisions are based on the snapshot of $S_t$.

### 3. Bit-Level Determinism
- **Rule:** Re-running the simulation with `Seed: 1337` must produce the exact same JSON output on any machine.
- **Implementation:** Usage of `Math.random()` is strictly forbidden. All stochastic processes use the `DeterministicRNG` service, whose internal state is serialized into `WorldState`.

---

## C. Runtime Semantics

The `SimulationEngine` executes the following sequential pipeline for every Tick:

1.  **State Hydration:** Load $S_t$, restore RNG state.
2.  **Solvency Check (Death Phase):**
    *   Identify Firms with `insolvencyStreak > Threshold`.
    *   **Action:** Force liquidation -> Fire employees -> Transfer assets to Govt -> Deactivate.
3.  **Agent Cognition (Parallelizable):**
    *   Agents read $S_t$ (Read-Only).
    *   Agents update internal beliefs (Wage Expectations, Price Models).
    *   Agents output *Intents* (e.g., "I want to hire 5 people", "I want to buy 2 food").
4.  **Labor Market Clearing (Serial):**
    *   Randomly shuffle Job Seekers (using RNG).
    *   Match with Firms based on `WageOffer >= ReservationWage`.
    *   **Write:** Execute `WAGE_PAYMENT` transactions.
5.  **Production Phase:**
    *   Firms convert `Labor` -> `Consumer Goods`.
6.  **Goods Market Clearing (Serial):**
    *   Randomly shuffle Consumers.
    *   Match with Firms based on `Cash >= Price`.
    *   **Write:** Execute `PURCHASE_GOODS` transactions.
7.  **Institutional Layer (Policy):**
    *   **Fiscal:** Calculate Taxes based on tick turnover -> Execute `INCOME_TAX` transfers.
    *   **Monetary:** (Placeholder) Central Bank adjustments.
8.  **Metrics & Pruning:**
    *   Calculate GDP, CPI.
    *   Prune strict Ledger history to constant memory size ($O(1)$ memory usage relative to $T$).

---

## D. Mental Model Examples

### The "Tabletop" Analogy
Imagine a board game where:
1.  **The Agents** are players, but they follow strict algorithm cards (e.g., "If Profit > 0, Try to Expand").
2.  **The Engine** is the Game Master. It rolls the dice (RNG) to shuffle turn order and moves the physical tokens (Money/Resources).
3.  **The Ledger** is a piece of paper recording every token movement.

### The "Starvation" Cycle
1.  **Shock:** A Firm goes bankrupt due to high wages.
2.  **Impact:** Employees lose jobs ($Utility \downarrow$).
3.  **Reaction:** Unemployed agents increase `starvationStreak`.
4.  **Feedback:** As `starvationStreak` rises, agents lower their `wageExpectation` (Desperation).
5.  **Equilibrium:** Other firms see cheap labor -> Hire more -> Economy recovers.

---

## E. Extension Surface

### Adding a New Tax Rule
Do not modify `simulationEngine.ts`.
1.  Open `services/institutions.ts`.
2.  Create a function `applyWealthTax(state)`.
3.  Register it in the `Institutional Layer` step of the engine.

### Adding a New Agent Type (e.g., Investor)
1.  Update `AgentType` enum in `types.ts`.
2.  Create `investorDecision` in `agentLogic.ts`.
3.  Wire logic into the cognition loop.

### Customizing Metrics
The `EconomicMetrics` interface represents the "Dashboard".
- To track **Inequality (Gini Coefficient)**: Add logic in the Metrics Phase of `runTick` to iterate over household cash distribution.
