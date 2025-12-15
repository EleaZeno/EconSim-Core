# EconSim 核心模拟引擎技术文档 (v0.1.0 MVP)

## 1. 项目概述

EconSim 是一个基于离散时间（Discrete-time）和代理人模型（Agent-Based Model, ABM）的经济模拟引擎。
该系统的核心设计目标是**可复现性（Reproducibility）**、**可解释性（Explainability）**和**会计严谨性（Accounting Integrity）**。它不是一个叙事游戏，而是一个用于测试经济制度（如货币政策、税收规则）和市场行为的实验环境。

## 2. 核心设计原则 (The Hard Constraints)

### 2.1 确定性与可复现性 (Determinism)
系统严禁使用 `Math.random()`。所有的随机性必须来源于一个自定义的伪随机数生成器（PRNG），本系统采用 **Mulberry32** 算法。
*   **状态包含 RNG:** RNG 的种子（Seed）和当前内部状态是 `WorldState` 的一部分。
*   **推论:** 给定状态 $S_t$ 和种子配置，计算 $S_{t+1}$ 的过程是纯函数式的，结果在位（bit）级别上永久一致。这允许系统实现“时光倒流”和“平行宇宙”对比实验。

### 2.2 资产负债守恒 (Conservation of Value)
系统采用复式记账法（Double-Entry Bookkeeping）的思想追踪货币流向。
*   **原子化交易:** 所有的资金转移必须通过 `accountingService` 执行。
*   **零和约束:** 除了中央银行（Central Bank）具有法币发行权（凭空创造资产）外，任何代理人之间的交易必定满足 `Sender.Cash - Amount = Receiver.Cash + Amount`。
*   **不可透支:** MVP 版本中，非央行账户不允许余额为负（即不存在隐性信贷）。

### 2.3 明确的系统边界 (System Boundaries)
*   **决策与执行分离:** Agent 的决策函数（Decision Function）只读取状态，输出意图（Intent），不直接修改全局 Ledger。
*   **串行化结算:** 尽管决策可以并行计算，但市场结算（Clearing）和资金划转必须按确定的顺序串行执行，以避免竞态条件（Race Conditions）。

---

## 3. 核心循环架构 (Simulation Loop)

引擎以 `Tick` 为时间单位推进，每一 Tick 代表一个逻辑周期（如一个月）。`runTick(State_t) -> State_t+1` 的执行流程如下：

1.  **环境初始化 (Context Init):**
    *   从 `State_t` 中恢复 RNG 状态。
    *   深度克隆 State 以保证不可变性（Immutability）。

2.  **代理人决策阶段 (Agent Decision Phase):**
    *   遍历所有 Agent。
    *   **Household:** 计算当前效用，更新工资期望，决定消费预算。
    *   **Firm:** 依据库存和上期利润，调整价格（Pricing Strategy）和生产目标（Production Target）。
    *   *注: 此阶段只修改 Agent 内部意图状态，不发生交互。*

3.  **劳动力市场结算 (Labor Market Clearing):**
    *   随机打乱（基于 PRNG）求职者顺序。
    *   Firms 发布招聘需求。
    *   匹配逻辑: 若 `Firm.WageOffer >= Household.ReservationWage`，则达成雇佣契约，立即执行工资转账。

4.  **生产阶段 (Production Phase):**
    *   Firms 根据雇佣人数进行生产。
    *   生产函数 (MVP): $Output = Labor \times Productivity(常数)$。
    *   产出计入 Firm 库存。

5.  **商品市场结算 (Goods Market Clearing):**
    *   随机打乱 Firm 顺序。
    *   Households 根据需求遍历市场。
    *   匹配逻辑: 若 `Household.Cash >= Firm.Price` 且 `Firm.Stock > 0`，则执行购买。
    *   更新 Ledger 和双方库存。

6.  **财政阶段 (Fiscal Phase):**
    *   计算所得税（基于 Ledger 中的工资流水）。
    *   执行税收转账：Household -> Government。

7.  **观测与指标 (Metrics & Observability):**
    *   计算 GDP（本周期总交易额）、CPI（加权平均价格）、失业率、M1 货币供应量。
    *   生成快照存入历史记录。
    *   持久化 RNG 状态。

---

## 4. 代理人逻辑模型 (Agent Models)

### 4.1 家庭 (Household)
*   **目标:** 最大化效用 (Utility)。
*   **效用函数:** $U = \ln(Consumption + 1) \times 10 + (LeisureUtility)$。
    *   若失业，LeisureUtility 较高（时间充裕），但在缺乏收入的生存压力下，边际效用递减。
*   **适应性预期 (Adaptive Expectations):**
    *   若失业，每回合降低工资期望（Desperation）。
    *   若就业且效用高，尝试提高工资期望（Bargaining Power）。

### 4.2 企业 (Firm)
*   **目标:** 最大化利润 (Profit)。
*   **定价策略:**
    *   库存积压 -> 降价。
    *   供不应求 -> 涨价。
*   **生产策略:**
    *   盈利 -> 扩张（增加雇佣目标，受 "Animal Spirits" 随机因子影响）。
    *   亏损 -> 裁员/收缩。

---

## 5. 数据结构规范 (Types Definition)

核心数据结构定义在 `types.ts` 中：

```typescript
// 世界状态快照
interface WorldState {
  tick: number;
  agents: Map<string, Agent>;
  ledger: LedgerEntry[];    // 交易流水日志
  metricsHistory: EconomicMetrics[];
  settings: SimulationSettings;
  rngState: number;         // 确定性随机数种子状态
}

// 代理人通用接口
interface Agent {
  id: string;
  type: AgentType; // HOUSEHOLD | FIRM | BANK | GOVT | CB
  cash: number;
  inventory: Record<ResourceType, number>;
  
  // 内部信念与状态
  priceBeliefs: Record<ResourceType, number>;
  wageExpectation: number; // 保留工资 / 报价
  
  // 状态追踪
  currentUtility: number; 
  needsSatisfaction?: number; // 需求满足度 (0-1)
  employedAt?: string | null;
}

// 会计分录
interface LedgerEntry {
  tick: number;
  fromId: string;
  toId: string;
  amount: number;
  reason: string; // WAGE_PAYMENT, PURCHASE_GOODS, TAX...
}
```

---

## 6. 目录结构

```text
/
├── components/          # React UI 组件 (Dashboard)
├── services/
│   ├── accountingService.ts # 会计与转账逻辑 (Ledger Write)
│   ├── agentLogic.ts        # 代理人决策函数 (AI/Math)
│   ├── randomService.ts     # Mulberry32 确定性 RNG
│   └── simulationEngine.ts  # 主循环与阶段控制
├── types.ts             # 类型定义
├── constants.ts         # 初始参数配置
└── App.tsx              # 应用入口
```

## 7. 下一步演进路线 (Roadmap)

1.  **信贷系统:** 引入商业银行，允许基于准备金率的信贷创造（Money Creation via Credit）。
2.  **企业破产机制:** 允许资不抵债的企业退出市场，并清理坏账。
3.  **中央银行策略:** 实现泰勒规则（Taylor Rule）自动调整利率或进行量化宽松。
4.  **空间/网络拓扑:** 限制交易仅能在特定的网络连接中发生（非全连接市场）。
