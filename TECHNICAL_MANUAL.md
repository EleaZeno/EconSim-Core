# EconSim Core: 分布式经济模拟引擎架构规范 (v0.3.0)

**文档密级:** 公开  
**维护者:** 系统架构组  
**适用对象:** 模拟工程师, 经济学研究员, AI 代码审计员

---

## 1. 系统愿景与设计哲学

EconSim Core 是一个**基于离散事件 (Discrete-Event)** 和 **代理人基 (Agent-Based)** 的确定性经济模拟引擎。本系统的设计初衷并非为了构建一个“游戏”，而是为了创建一个具有严格数学边界的实验环境，用于测试制度规则（Institutions）对宏观经济指标的涌现性影响。

### 核心公理 (Core Axioms)

1.  **价值守恒 (Conservation of Value)**: 系统内不存在“魔法”。每一分钱的流动都必须遵循双复式记账（Double-Entry Bookkeeping）原则。除中央银行外，任何代理人不得凭空创造或销毁货币。
2.  **位级确定性 (Bit-Level Determinism)**: 给定相同的初始种子 (Seed) 和配置 (Config)，无论在何种硬件或操作系统上运行，第 $N$ 刻的状态 $S_N$ 必须完全一致。禁止使用非确定性的 `Math.random()`。
3.  **有限理性 (Bounded Rationality)**: 代理人并非全知全能。他们基于局部信息（Memory）和启发式算法（Heuristics）做出决策，允许存在认知偏差和决策噪声。

---

## 2. 系统架构 (Architecture)

系统采用分层架构设计，各层之间通过严格的接口进行交互。

### 2.1 层次模型 (Layer Model)

*   **Layer 0: 内核 (Kernel)** - `simulationEngine.ts`
    *   负责时钟滴答 (Tick) 的推进。
    *   负责状态树 (WorldState) 的不可变更新。
    *   不包含任何经济学逻辑，只负责调度。
*   **Layer 1: 会计层 (Accounting)** - `accountingService.ts`
    *   强制执行资金流动的物理约束。
    *   提供原子化的转账操作 `transferMoney`。
*   **Layer 2: 市场机制 (Markets)** - `mechanismLibrary.ts`
    *   定义买方和卖方如何撮合（例如：随机匹配、拍卖、订单簿）。
*   **Layer 3: 代理人认知 (Agent Cognition)** - `agentLogic.ts` / `mechanismLibrary.ts`
    *   代理人的大脑。读取状态，输出意图 (Intent)。
*   **Layer 4: 制度 (Institutions)** - `institutions.ts`
    *   全系统的规则（税收、破产法、福利）。拥有上帝视角和强制执行权。

---

## 3. 核心数据结构

### 3.1 世界状态 (WorldState)

整个宇宙在某一时刻的快照。

```typescript
export interface WorldState {
  tick: number;               // 离散时间戳
  agents: Map<string, Agent>; // 代理人哈希表
  ledger: LedgerEntry[];      // 总账 (所有交易历史)
  metricsHistory: EconomicMetrics[]; // 宏观指标历史
  config: ExperimentConfig;   // 实验基因 (不可变)
  rngState: number;           // 随机数生成器内部状态 (序列化)
}
```

### 3.2 代理人 (Agent)

系统的原子单位。

```typescript
export interface Agent {
  id: string;
  type: AgentType; // HOUSEHOLD, FIRM, BANK, GOVT, CB
  
  // 资产负债表 (Balance Sheet)
  cash: number;
  inventory: Record<ResourceType, number>;
  
  // 认知模型 (Cognitive Model)
  priceBeliefs: Record<ResourceType, number>; // 价格信念
  memory: AgentMemory; // 平滑后的历史记忆 (EMA)
  
  // 状态标志
  active: boolean; // 是否存活 (破产后为 false)
  insolvencyStreak: number; // 连续资不抵债时长
}
```

---

## 4. 关键算法剖析

### 4.1 会计守恒定律 (The Ledger Law)

这是本系统最关键的代码路径。任何绕过此函数修改 `agent.cash` 的行为均视为**严重违规**。

```typescript
// source: services/accountingService.ts

export const transferMoney = (
  state: WorldState,
  fromId: string,
  toId: string,
  amount: number,
  reason: string
): LedgerEntry | null => {
  // 1. 物理约束
  if (amount <= 0) return null;

  const sender = state.agents.get(fromId);
  const receiver = state.agents.get(toId);

  // 2. 偿付能力检查 (Solvency Check)
  // 政府和央行拥有无限流动性 (Sovereign Immunity)，其他代理人必须有足够现金。
  const isSovereign = sender.type === AgentType.CENTRAL_BANK || sender.type === AgentType.GOVERNMENT;
  if (!isSovereign && sender.cash < amount) {
    return null; // 交易拒绝：资金不足
  }

  // 3. 原子化执行 (Atomic Execution)
  sender.cash -= amount;
  receiver.cash += amount;

  // 4. 审计日志 (Audit Logging)
  const entry: LedgerEntry = {
    tick: state.tick,
    fromId, toId, amount, reason
  };
  state.ledger.push(entry);

  return entry;
};
```

### 4.2 确定性随机数 (Deterministic RNG)

为了保证实验的可复现性，我们实现了 Mulberry32 算法，并将其状态序列化在 `WorldState` 中。

```typescript
// source: services/randomService.ts

export class DeterministicRNG {
  // 禁止使用 Math.random()
  next(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}
```

### 4.3 市场出清机制 (Market Clearing: Standard Random Matching)

本版本采用**随机配对 (Random Matching)** 机制来模拟劳动力和商品市场。这是一种简化的 Walrasian 过程。

**算法流程:**
1.  **洗牌**: 使用 RNG 将买方（如寻找工作的家庭）随机排序。
2.  **遍历**: 买方依次尝试与卖方（如招聘的企业）进行匹配。
3.  **交易**: 如果满足条件（如 `WageOffer >= ReservationWage`），则调用会计层执行转账。

```typescript
// source: services/mechanismLibrary.ts (StandardLaborMarket)

const shuffledHouseholds = rng.shuffle([...households]); // 随机化消除顺序偏差

firms.forEach(firm => {
  // ... 确定招聘名额 ...
  for (const hh of shuffledHouseholds) {
     if (isFull) break;
     // 匹配逻辑：企业的出价 >= 工人的保留工资
     if (firm.wageExpectation >= hh.wageExpectation) {
        transferMoney(state, firm.id, hh.id, firm.wageExpectation, 'WAGE_PAYMENT');
        hh.employedAt = firm.id;
     }
  }
});
```

---

## 5. 经济动力学模型

### 5.1 家庭效用函数 (Household Utility)

$$ U = \alpha \cdot \ln(C + 1) + \beta \cdot L $$

*   $C$: 消费品数量 (Consumption)
*   $L$: 闲暇 (Leisure, 失业为1，就业为0)
*   行为推论：如果工资不足以弥补闲暇的损失，家庭可能选择“躺平”。但饥饿（Starvation）会强制降低保留工资。

### 5.2 企业定价策略 (Firm Heuristic)

企业不解微分方程，而是使用 **Win-Stay, Lose-Shift** 策略：

1.  **库存过剩 (Inventory Bloat)**: $I > Target \rightarrow P_{t+1} = P_t \times 0.98$ (降价去库存)
2.  **库存短缺 (Scarcity)**: $I \approx 0 \rightarrow P_{t+1} = P_t \times 1.02$ (涨价获利)
3.  **恐慌抛售 (Fire Sale)**: 濒临破产时，无视利润，大幅折价回笼现金。

---

## 6. 扩展指南 (Extension Guide)

若要添加新的税收制度（例如：增值税 VAT）：

1.  不要修改 `simulationEngine.ts`。
2.  在 `services/institutions.ts` 中新建 `const ValueAddedTax: Institution = { ... }`。
3.  实现 `apply(state)` 函数，遍历 Ledger 计算应税额并调用 `transferMoney`。
4.  在 `MechanismRegistry` 中注册该制度。
5.  在 `EXPERIMENTS` 配置中将 ID 添加到 `activeInstitutions` 数组。

---

**审阅检查点 (For Reviewer):**
1.  检查所有 `state.agents` 的修改是否发生在深拷贝对象上（Immutability）。
2.  检查所有涉及金额的计算是否使用了 `transferMoney`。
3.  验证 `runTick` 函数是否是纯函数（Pure Function），除日志外无副作用。
