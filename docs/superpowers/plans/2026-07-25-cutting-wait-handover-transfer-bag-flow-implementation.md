# 裁床待交出仓与中转袋流转实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `docs/superpowers/specs/2026-07-25-cutting-wait-handover-transfer-bag-flow-design.md` 落到代码与检查脚本，明确拆开 `菲票装袋`、`中转袋入仓`、`交出`、`特种工艺回收入仓` 四动作，并把 Web / PDA / 事实账 / 审查记录收口到同一口径。

**架构：** 先收口事实账和数据契约，再改 Web 聚合页与 PDA 执行页，最后补治理脚本和原型审查记录。核心策略是“保留现有投影层，拆开写入动作与页面动作”，避免把原型改成新架构。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla 字符串模板、现有 `src/components/ui/`、本地 mock 数据、脚本治理检查。

---

## 文件结构

| 文件 | 职责 |
| --- | --- |
| `src/data/fcs/cutting/cutting-runtime-event-ledger.ts` | 拆分和补齐待交出仓事件类型与 payload，给 `菲票装袋` / `中转袋入仓` / `交出装袋确认` / `新增交出记录` / `特殊工艺交出` / `特殊工艺回仓` 提供统一事实入口。 |
| `src/pages/process-factory/cutting/wait-handover-runtime.ts` | 把 Web / PDA 共同使用的待交出仓事实投影从“单一入仓事件”改成“装袋 + 入仓”两段式投影，并继续喂给库存、交出、特殊工艺回仓视图。 |
| `src/pages/process-factory/cutting/transfer-bags-model.ts` | 保持袋级 / 菲票级投影兼容，但补足装袋、入仓、混装规则、袋状态与文案的拆分语义。 |
| `src/data/fcs/cutting/handover-orders.ts` | 对齐交出单、交出记录、回写、差异、异议、特殊工艺回仓的状态与汇总口径，确保双阶段交出链路能回写到同一单据体系。 |
| `src/data/fcs/cutting/special-craft-fei-ticket-flow.ts` | 对齐特殊工艺前向流转与回仓候选状态，保证 `已发料 / 已接收 / 加工中 / 已完成待回仓 / 已回仓` 的口径和待交出仓事实一致。 |
| `src/pages/process-factory/cutting/warehouse-hub.ts` | 重排 Web 端待交出仓首页，拆成 `菲票装袋`、`中转袋入仓`、`交出`、`特种工艺回收入仓`、`库区库位` 的可执行块，并收口现有事件处理。 |
| `src/pages/pda-cutting-inbound.ts` | 将 PDA 入仓页从“入仓暂存装袋”拆成先装袋、再入仓的执行流，保留扫码、补录和反馈状态。 |
| `src/pages/pda-cutting-handover.ts` | 将 PDA 交出页明确成 `交出装袋确认` 与 `交出确认` 双阶段，并补齐特殊工艺回仓的整袋 / 逐票二选一。 |
| `src/pages/pda-warehouse-wait-handover.ts` | 把裁床待交出仓 PDA 首页的动作入口改成和 Web 一致的四动作闭环。 |
| `scripts/check-cutting-wait-handover-transfer-bag-flow.ts` | 新增本 feature 专用治理检查，覆盖事件类型、页面动作、状态文案、回仓模式和关键事实链。 |
| `scripts/check-cutting-warehouse-management-switch.ts` | 更新裁床仓库管理切换检查，确保旧入口和旧文案不再回流。 |
| `scripts/check-pda-handover-pages.ts` | 更新 PDA 交接页检查，覆盖交出、回写、异议和特殊工艺回仓的可见信号。 |
| `scripts/check-fcs-handover-domain.ts` | 更新 FCS 交出域检查，确保交出对象、记录状态和回写差异链没有断点。 |
| `scripts/check-handover-writeback-difference-unification.ts` | 核对回写、差异、异议与特殊工艺回仓的统一口径不被这次拆分打穿。 |
| `package.json` | 注册新增检查脚本，方便在实现阶段和验收阶段直接跑。 |
| `docs/prototype-review-records/2026-07-25-cutting-wait-handover-transfer-bag-flow.md` | 记录本次页面 / 交互 / mock 数据 / 路由入口变更的原型审查结论。 |

---

## 设计章节覆盖矩阵

| 设计章节 | 覆盖任务 |
| --- | --- |
| 第 1-3 章：文档信息、背景目标、当前代码核查结论 | 任务 1，先把事实账和事件契约对齐到已核查的代码入口。 |
| 第 4 章：业务口径、术语、四动作定义 | 任务 1、2、3，把术语落到事件类型、页面标题和按钮文案。 |
| 第 5-6 章：角色职责、现状差距 | 任务 2、3，分别收口 Web 和 PDA 的执行面。 |
| 第 7-9 章：总流程图、状态图、时序图 | 任务 1、2、3，确保写入事件、页面动作和状态投影都能支撑图里的路径。 |
| 第 10-11 章：页面设计、数据设计 | 任务 2、3，改 Web / PDA 页面结构和数据展示。 |
| 第 12-13 章：业务规则、异常与防错 | 任务 1、2、3，把混装阻断、目标对象、回仓方式和扫码顺序都落成校验。 |
| 第 14-15 章：代码现状映射、遗漏风险清单 | 任务 1、4，用脚本和审查记录把风险清单逐条消掉。 |
| 第 16-18 章：设计结论、验收标准、结论 | 任务 4，靠检查脚本和最终验证命令收口。 |

---

## 任务 1：事实账和事件契约收口

**文件：**
- 修改：`src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- 修改：`src/pages/process-factory/cutting/wait-handover-runtime.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags-model.ts`
- 修改：`src/data/fcs/cutting/handover-orders.ts`
- 修改：`src/data/fcs/cutting/special-craft-fei-ticket-flow.ts`
- 创建：`scripts/check-cutting-wait-handover-transfer-bag-flow.ts`

- [ ] **步骤 1：先写失败检查，锁定新旧事件口径**

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync('src/data/fcs/cutting/cutting-runtime-event-ledger.ts', 'utf8')

assert(source.includes("'菲票装袋'"), '必须新增菲票装袋事实')
assert(source.includes("'中转袋入仓'"), '必须新增中转袋入仓事实')
assert(source.includes("'交出装袋确认'"), '必须保留交出装袋确认')
assert(source.includes("'新增交出记录'"), '必须保留交出确认记录')
assert(source.includes("'特殊工艺交出'"), '必须保留特殊工艺交出')
assert(source.includes("'特殊工艺回仓'"), '必须保留特殊工艺回仓')
```

- [ ] **步骤 2：运行检查确认当前确实还没完全满足设计**

运行：`node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-wait-handover-transfer-bag-flow.ts`

预期：失败，并指出至少一处 `菲票装袋` / `中转袋入仓` 的事实未拆开，或装袋与入仓仍合并。

- [ ] **步骤 3：最小实现拆分写入事实，不碰无关域**

```ts
export type CuttingRuntimeEventType =
  | '菲票装袋'
  | '中转袋入仓'
  | '交出装袋确认'
  | '新增交出记录'
  | '特殊工艺交出'
  | '特殊工艺回仓'

export function appendWaitHandoverBaggingEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  bagCode: string
  tickets: WaitHandoverRuntimeTicketInput[]
  occurredAt?: string
}): CuttingRuntimeEvent

export function appendWaitHandoverInboundEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  bagCode: string
  warehouseArea: string
  locationCode: string
  occurredAt?: string
}): CuttingRuntimeEvent
```

实现时只做两件事：先把袋内绑定写清，再把袋位写清；不要把交出、回写、特殊工艺流转一起改乱。

- [ ] **步骤 4：运行检查确认事件账和投影能一起过**

运行：`node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-wait-handover-transfer-bag-flow.ts`

预期：PASS。

- [ ] **步骤 5：提交本任务变更**

```bash
git add src/data/fcs/cutting/cutting-runtime-event-ledger.ts src/pages/process-factory/cutting/wait-handover-runtime.ts src/pages/process-factory/cutting/transfer-bags-model.ts src/data/fcs/cutting/handover-orders.ts src/data/fcs/cutting/special-craft-fei-ticket-flow.ts scripts/check-cutting-wait-handover-transfer-bag-flow.ts
git commit -m "feat: split cutting wait handover facts"
```

---

## 任务 2：Web 待交出仓首页和交出单聚合页

**文件：**
- 修改：`src/pages/process-factory/cutting/warehouse-hub.ts`
- 修改：`scripts/check-cutting-warehouse-management-switch.ts`

- [ ] **步骤 1：先写失败检查，锁定页面动作和文案**

```ts
const html = renderCraftCuttingWarehouseManagementWaitHandoverPage()

assert(html.includes('菲票装袋'), 'Web 待交出仓首页必须有菲票装袋入口')
assert(html.includes('中转袋入仓'), 'Web 待交出仓首页必须有中转袋入仓入口')
assert(html.includes('交出装袋确认'), 'Web 待交出仓首页必须保留交出装袋确认')
assert(html.includes('特种工艺回收入仓'), 'Web 待交出仓首页必须保留特种工艺回收入仓')
assert(!html.includes('入仓暂存装袋'), '旧合并文案不得继续出现')
```

- [ ] **步骤 2：运行检查确认现在还是旧结构**

运行：`npm run check:cutting-warehouse-management-switch`

预期：失败，指出首页仍把装袋和入仓揉在一起，或仍有旧 tab / 旧按钮文案。

- [ ] **步骤 3：重排 Web 首页为四动作闭环**

```ts
const tabs = [
  { key: 'inventory', label: '库存明细' },
  { key: 'bagging', label: '菲票装袋' },
  { key: 'inbound', label: '中转袋入仓' },
  { key: 'handover', label: '交出' },
  { key: 'special-craft-return', label: '特种工艺回收入仓' },
  { key: 'locations', label: '库区库位' },
]
```

页面内只做一个方向：先让一线看到当前该做什么，再把明细、库存和回写链路挂上去，不增加新的管理型抽象。

- [ ] **步骤 4：运行检查确认 Web 首页和交出单联动通过**

运行：`npm run check:cutting-warehouse-management-switch`

预期：PASS。

- [ ] **步骤 5：提交本任务变更**

```bash
git add src/pages/process-factory/cutting/warehouse-hub.ts scripts/check-cutting-warehouse-management-switch.ts
git commit -m "feat: rework cutting wait handover web hub"
```

---

## 任务 3：PDA 入仓、交出、回仓三端闭环

**文件：**
- 修改：`src/pages/pda-cutting-inbound.ts`
- 修改：`src/pages/pda-cutting-handover.ts`
- 修改：`src/pages/pda-warehouse-wait-handover.ts`
- （如页面动作路由需要显式分离再改）修改：`src/pages/process-factory/cutting/wait-handover-runtime.ts`
- （如页面状态源需要显式分离再改）修改：`src/pages/pda-cutting-context.ts`
- 修改：`scripts/check-pda-handover-pages.ts`

- [ ] **步骤 1：先写失败检查，锁定 PDA 的四动作可见性**

```ts
const html = renderPdaWarehouseWaitHandoverPage()

assert(html.includes('菲票装袋'), 'PDA 待交出仓首页必须能直接进入菲票装袋')
assert(html.includes('中转袋入仓'), 'PDA 待交出仓首页必须能直接进入中转袋入仓')
assert(html.includes('交出装袋确认'), 'PDA 待交出仓首页必须保留交出装袋确认')
assert(html.includes('特殊工艺回收入仓'), 'PDA 待交出仓首页必须保留特殊工艺回收入仓')
assert(!html.includes('入仓暂存装袋'), '旧合并入口不得继续出现')
```

- [ ] **步骤 2：运行检查确认 PDA 侧现在仍有旧合并路径**

运行：`npm run check:pda-handover-pages`

预期：失败，指出入仓、交出、回写或特殊工艺回仓至少一处仍是旧口径。

- [ ] **步骤 3：把入仓页拆成“先装袋、再入仓”**

```ts
// 先扫袋和菲票，生成袋内事实
// 再单独补库区、库位，写入中转袋入仓事实
```

实现时要保持三件事：扫码顺序清楚、反馈短句化、重复扫码立即阻断。不要把一屏塞成管理后台。

- [ ] **步骤 4：把交出页显式收口成双阶段**

```ts
// 阶段一：交出装袋确认
// 阶段二：交出确认
// 特种工艺回仓：整袋 / 逐票二选一
```

交出页要继续承接 `车缝厂 / 辅助工艺厂 / 特种工艺厂 / 仓库 / 其他对象`，但一线首屏只突出最常用对象。

- [ ] **步骤 5：运行检查确认 PDA 端全部通过**

运行：`npm run check:pda-handover-pages`

预期：PASS。

- [ ] **步骤 6：提交本任务变更**

```bash
git add src/pages/pda-cutting-inbound.ts src/pages/pda-cutting-handover.ts src/pages/pda-warehouse-wait-handover.ts scripts/check-pda-handover-pages.ts
git commit -m "feat: split cutting pda wait handover flow"
```

---

## 任务 4：治理脚本、原型审查记录和最终验收

**文件：**
- 修改：`scripts/check-fcs-handover-domain.ts`
- 修改：`scripts/check-handover-writeback-difference-unification.ts`
- 修改：`package.json`
- 创建：`docs/prototype-review-records/2026-07-25-cutting-wait-handover-transfer-bag-flow.md`

- [ ] **步骤 1：先写失败检查，把设计文档遗漏点变成脚本断言**

```ts
const source = read('src/data/fcs/cutting/handover-orders.ts')

assert(source.includes('交出装袋确认'), '必须显式存在交出装袋确认')
assert(source.includes('新增交出记录'), '必须显式存在交出确认记录')
assert(source.includes('特殊工艺回仓'), '必须显式存在特殊工艺回仓')
assert(source.includes('仓库') && source.includes('其他对象'), '接收对象必须覆盖兜底场景')
```

- [ ] **步骤 2：补齐原型审查记录**

文件内容要按模板写满这几项：

```md
## 1. 基本信息
## 2. 参考规范
## 3. 自查结论
## 4. 问题标签
## 5. 主要问题与处理
## 6. 最终结论
```

结论默认写清：本次已参考 `docs/higood-indonesia-factory-product-design-guidelines.md` 和 `docs/higood-indonesia-factory-prototype-review-checklist.md`，并说明是否有例外。

- [ ] **步骤 3：注册脚本并跑全量治理**

```json
{
  "scripts": {
    "check:cutting-wait-handover-transfer-bag-flow": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-wait-handover-transfer-bag-flow.ts"
  }
}
```

运行：

```bash
npm run check:cutting-wait-handover-transfer-bag-flow
npm run check:cutting-warehouse-management-switch
npm run check:fcs-handover-domain
npm run check:pda-handover-pages
npm run check:handover-writeback-difference-unification
npm run check:prototype-design-governance
npm run check:prototype-design-governance -- --all
npm run build
```

预期：全部 PASS。

- [ ] **步骤 4：提交收口变更**

```bash
git add package.json scripts/check-fcs-handover-domain.ts scripts/check-handover-writeback-difference-unification.ts docs/prototype-review-records/2026-07-25-cutting-wait-handover-transfer-bag-flow.md
git commit -m "chore: close cutting wait handover governance"
```

---

## 自检清单

- [ ] 设计文档第 1-18 章都能在上面的任务里找到落点。
- [ ] `菲票装袋`、`中转袋入仓`、`交出`、`特种工艺回收入仓` 四个动作都有代码入口和检查脚本。
- [ ] `交出装袋确认` 与 `交出确认` 没有被合并回单一动作。
- [ ] 接收对象覆盖 `车缝厂`、`辅助工艺厂`、`特种工艺厂`、`仓库`、`其他对象`。
- [ ] 特种工艺回仓保留整袋 / 逐票二选一。
- [ ] Web、PDA、事实账、审查记录、治理脚本都在同一份计划里。
- [ ] 没有使用“待定”“TODO”“后续再说”之类的空话占位。

## 执行前置说明

本计划已按设计文档逐章核查，并对照这些代码入口确认范围：

- `src/pages/process-factory/cutting/warehouse-hub.ts`
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
- `src/pages/process-factory/cutting/transfer-bags-model.ts`
- `src/pages/pda-cutting-inbound.ts`
- `src/pages/pda-cutting-handover.ts`
- `src/pages/pda-warehouse-wait-handover.ts`
- `src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- `src/data/fcs/cutting/handover-orders.ts`
- `src/data/fcs/cutting/special-craft-fei-ticket-flow.ts`

如果实现过程中发现某个文件已经被别的任务改过，只在当前范围内继续收口，不要回退他人改动。
