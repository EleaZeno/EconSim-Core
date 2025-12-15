# EconSim 核心模拟引擎技术文档 (v0.1.1 Beta)

## 1. 项目概述

EconSim 是一个基于离散时间（Discrete-time）和代理人模型（Agent-Based Model, ABM）的经济模拟引擎。
该系统的核心设计目标是**可复现性（Reproducibility）**、**可解释性（Explainability）**和**会计严谨性（Accounting Integrity）**。

## 2. 核心设计原则 (The Hard Constraints)

### 2.1 确定性与可复现性 (Determinism)
系统严禁使用 `Math.random()`。所有的随机性必须来源于一个自定义的伪随机数生成器（PRNG），本系统采用 **Mulberry32** 算法。
*   **状态包含 RNG:** RNG 的种子（Seed）和当前内部状态是 `WorldState` 的一部分。
*   **推论:** 给定状态 $S_t$ 和种子配置，计算 $S_{t+1}$ 的过程是纯函数式的，结果在位（bit）级别上永久一致。

### 2.2 资产负债守恒 (Conservation of Value)
系统采用复式记账法（Double-Entry Bookkeeping）的思想追踪货币流向。
*   **原子化交易:** 所有的资金转移必须通过 `accountingService` 执行。
*   **系统不变量 (v0.1.1):** 每 Tick 结束时，引擎会执行 `validateSystemInvariants`，确保 $\sum Cash_{agents}$ 恒定（除非央行主动铸币）。
*   **内存安全 (v0.1.1):** 账本（Ledger）会自动截断（Pruning），仅保留最近 `MAX_LEDGER_ITEMS` 条记录，聚合数据存储于 `metricsHistory`。

### 2.3 明确的系统边界
*   **决策与执行分离:** Agent 的决策函数只读取状态，输出意图，不直接修改全局 Ledger。
*   **串行化结算:** 市场结算按确定性顺序串行执行，避免竞态条件。

---

## 3. 核心循环架构 (Simulation Loop)

引擎以 `Tick` 为时间单位推进，每一 Tick 代表一个逻辑周期（如一个月）。

1.  **环境初始化:** 恢复 RNG 状态，克隆 State。
2.  **破产清算 (v0.1.1):** 
    *   检查 `insolvencyStreak` 超过阈值的企业。
    *   解雇员工 -> 剩余资产上缴国库 -> 标记为 `active: false`。
3.  **代理人决策:** 
    *   Household: 计算生存压力（Starvation Streak），调整保留工资。
    *   Firm: 依据库存和利润，调整价格和生产目标。
4.  **劳动力市场结算:** 随机匹配求职者与企业。
5.  **生产阶段:** 投入劳动力产出商品。
6.  **商品市场结算:** 随机匹配消费者与企业。
7.  **财政阶段:** 扣除所得税。
8.  **观测与指标:** 计算 GDP, CPI, 失业率, 存活企业数。

---

## 4. 代理人逻辑模型 (Agent Models)

### 4.1 家庭 (Household)
*   **目标:** 生存优先，其次最大化效用。
*   **恐慌机制 (v0.1.1):**
    *   连续 `STARVATION_THRESHOLD` 周期无法满足最低食物需求 -> 触发恐慌。
    *   恐慌状态下，工资期望（Reservation Wage）呈指数级下跌（Desperation）。

### 4.2 企业 (Firm)
*   **目标:** 生存优先，其次最大化利润。
*   **破产机制 (v0.1.1):**
    *   连续 `INSOLVENCY_THRESHOLD` 周期现金流不足或亏损 -> 触发破产。
    *   破产后永久退出市场。

---

## 5. 数据结构规范 (Types)

```typescript
// 世界状态快照
interface WorldState {
  tick: number;
  agents: Map<string, Agent>;
  ledger: LedgerEntry[];    // 自动截断
  metricsHistory: EconomicMetrics[];
  aggregates: GlobalAggregates; // v0.1.1 性能优化缓存
  rngState: number;
}

// 代理人
interface Agent {
  // ...
  active: boolean;          // v0.1.1 生命周期标志
  insolvencyStreak?: number; // v0.1.1 破产倒计时
  starvationStreak?: number; // v0.1.1 饥饿倒计时
}
```

## 6. 目录结构

```text
/
├── components/          # React UI 组件 (Dashboard)
├── services/
│   ├── accountingService.ts # 会计、转账与不变量检查
│   ├── agentLogic.ts        # 决策函数 (Utility/Profit max)
│   ├── randomService.ts     # Mulberry32 确定性 RNG
│   └── simulationEngine.ts  # 主循环与阶段控制
├── types.ts             # 类型定义
├── constants.ts         # 初始参数配置
└── App.tsx              # 应用入口
```