# 裁床待交出仓与中转袋流转实现计划（修订版）

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 `docs/superpowers/specs/2026-07-25-cutting-wait-handover-transfer-bag-flow-design.md` 落到代码与检查脚本，明确拆开 `菲票装袋`、`中转袋入仓`、`交出`、`特种工艺回收入仓` 四动作，并把 Web / PDA / 事实账 / 审查记录收口到同一口径。

**架构：** 先收口事实账和数据契约，再改 Web 聚合页与 PDA 执行页，最后补治理脚本和原型审查记录。核心策略是“保留现有投影层，拆开写入动作与页面动作”，避免把原型改成新架构。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla 字符串模板、现有 `src/components/ui/`、本地 mock 数据、脚本治理检查。

**最新代码复核：** 2026-07-25 重新同步 CodeGraph 并核查最新 `main`。当前代码仍只有 `菲票入仓暂存` 合并事件；约 40+ 个页面/数据/路由/脚本文件引用旧关键词，必须逐一收口。路由可复用，原则上不新增路由。

---

## 审查遗漏清单

以下从三条审查线交叉核对后得出：

### 一、代码入口遗漏（代码入口审查子代理）

计划原先遗漏的具体文件：

| 遗漏文件 | 原因 |
| --- | --- |
| `src/pages/process-factory/cutting/transfer-bags.ts` | 单文件版本仍有 `open-inbound-pack` 和 "开始入仓暂存装袋" |
| `src/pages/process-factory/cutting/transfer-bags/dialogs.ts` | 弹窗确认按钮 "确认入仓暂存" |
| `src/pages/process-factory/cutting/transfer-bags/state.ts` | 状态键 `inbound-pack` |
| `src/main-handlers/fcs-handlers.ts` | 注册了 `handleCraftCuttingWaitHandoverEvent`；变化后必须复核 |
| `src/pages/process-factory/cutting/fei-tickets.ts` | 列 "特殊工艺回仓状态"、按钮 "查看特殊工艺回仓" |
| `src/pages/process-factory/cutting/cutting-summary.ts` | "特殊工艺回仓差异" 汇总 |
| `src/pages/process-factory/cutting/production-progress.ts` | "特殊工艺回仓汇总" KPI |
| `src/pages/process-factory/cutting/cutting-daily-production-report-model.ts` | "今日特殊工艺交出数量" 指标 |
| `src/pages/process-factory/cutting/meta.ts` | 路由元数据 `special-craft-return` key |
| `src/pages/process-factory/cutting/cut-order-close-records.ts` | 文案 "关闭不删除特殊工艺交出和回仓记录" |
| `src/pages/pda-handover.ts` | "新增交出记录" 按钮 |
| `src/pages/pda-handover-detail.ts` | "新增交出记录" 按钮与拦截逻辑 |
| `tests/cutting-runtime-event-ledger-pda-web.spec.ts` | E2E 测试直接引用旧事件类型 |
| `tests/cutting-stage8-regression.spec.ts` | 回归测试引用 "待新增交出记录"、"特殊工艺回仓" |

### 二、设计覆盖遗漏（设计覆盖审查子代理）

17 类遗漏，归纳如下：

| 类别 | 关键遗漏 |
| --- | --- |
| 装袋规则 | 混装阻断校验、L+颜色组合、装袋不等于入仓状态校验 |
| 入仓前提 | 入仓必须引用已装袋袋码、Web 补录字段、PDA 扫码录入字段 |
| 双阶段交出扫码 | 8 条扫描顺序 + 阻断规则未写入任务 |
| 交出确认 | 库存扣减、回写/差异/异议入口未写入 |
| 接收对象展示优先级 | Web/PDA 首屏三核心对象，仓库/其他兜底后置 |
| 特种工艺前向流转 | 接收→加工中→已完成待回仓→回仓差异→异议 |
| 状态图 8.x | 中转袋、菲票、回仓、交出单、记录、全链路、回写异议状态未逐项验收 |
| 时序图 9.x | 交出双阶段、接收回写差异、特种工艺全链路 |
| Web 弹窗字段 | 菲票装袋/入仓/交出/回仓四个弹窗的必填项 |
| PDA 一页一动作 | 缺少负向断言（不能有管理统计/复杂日志/状态机判断） |
| 数据字段 | hasSpecialCraft、specialCraftCategory、returnMode 等 |
| 在库分类 | 无特殊工艺/未做特殊工艺/加工中/已做特殊工艺 |
| 回仓字段 | transferBagCode、returnedFeiTicketItems、returnStatus |
| 异常防错 13 | 9 条阻断规则未逐项签到页面校验 |
| 验收标准 17 | 追溯、补录、Web=PDA 同账未逐条脚本化 |

### 三、治理覆盖遗漏（治理检查审查子代理）

| 遗漏项 | 说明 |
| --- | --- |
| 未包含 `check:list-page-governance` | `transfer-bags/list.ts` 有 `@page-pattern: list`，必须跑 |
| 未包含 `check:menu-routes` | 菜单 href ↔ route 一致性 |
| 未包含 `check:process-factory-warehouse-menu-consolidation` | 待交出仓菜单项正确性 |
| `check:pda-handover-pages` 不覆盖本次核心 PDA 页 | pda-cutting-inbound/handover/warehouse-wait-handover |
| 原型审查记录过于空泛 | 须写满模板全部检查项逐项结论 |
| 未覆盖 20+ 个旧检查脚本 | 它们引用旧文案，可能被拆事件打穿 |
| `check-cutting-clean-mainline` | 引用旧事件类型和文案 |
| `check-factory-mobile-app-redesign` | 引用旧 "入仓暂存装袋" |
| `check-cutting-sewing-dispatch` | 引用 "特殊工艺回仓" |
| `check-cutting-special-craft-dispatch-return` | 引用 "特殊工艺回仓"、"待交出仓" |

---

## 文件结构（完整版）

| 文件 | 操作 | 职责 |
| --- | --- | --- |
| `src/data/fcs/cutting/cutting-runtime-event-ledger.ts` | 修改 | 拆分事件类型：`菲票装袋`、`中转袋入仓`，保留其余四种，补 payload |
| `src/pages/process-factory/cutting/wait-handover-runtime.ts` | 修改 | 把合并入仓事件拆成装袋+入仓两段投影，保留交出/回仓/回写逻辑 |
| `src/pages/process-factory/cutting/transfer-bags-model.ts` | 修改 | 袋级投影拆分语义：装袋、入仓、混装规则、袋状态文案 |
| `src/pages/process-factory/cutting/transfer-bags.ts` | 修改 | 单文件中转袋页面旧入口改制 |
| `src/pages/process-factory/cutting/transfer-bags/list.ts` | 修改 | 列表页入口按钮从合并改成两段 |
| `src/pages/process-factory/cutting/transfer-bags/handlers.ts` | 修改 | 弹窗标题/反馈/备注由旧合并文案改制 |
| `src/pages/process-factory/cutting/transfer-bags/dialogs.ts` | 修改 | 确认按钮文案改制 |
| `src/pages/process-factory/cutting/transfer-bags/state.ts` | 复核 | `inbound-pack` key 是否有旧消费者需同步 |
| `src/data/fcs/cutting/handover-orders.ts` | 修改 | 交出单/记录/回写/差异/异议/回仓状态与汇总口径 |
| `src/data/fcs/cutting/special-craft-fei-ticket-flow.ts` | 修改 | 前向流转与回仓候选状态对齐 |
| `src/pages/process-factory/cutting/warehouse-hub.ts` | 修改 | Web 首页重排为四动作闭环 |
| `src/pages/process-factory/cutting/fei-tickets.ts` | 复核 | 特殊工艺回仓状态列、按钮文案 |
| `src/pages/process-factory/cutting/cutting-summary.ts` | 复核 | 特殊工艺回仓差异文案 |
| `src/pages/process-factory/cutting/production-progress.ts` | 复核 | 特殊工艺回仓汇总 KPI |
| `src/pages/process-factory/cutting/cutting-daily-production-report-model.ts` | 复核 | 今日特殊工艺交出数量指标 |
| `src/pages/process-factory/cutting/meta.ts` | 复核 | 路由元数据 key 和 canonicalPath |
| `src/pages/process-factory/cutting/cut-order-close-records.ts` | 复核 | 特殊工艺交出和回仓记录文案 |
| `src/pages/process-factory/cutting/handover-orders.ts` | 复核 | Web 交出单详情页，交出对象展示与双阶段文案 |
| `src/pages/process-factory/cutting/transfer-bags-projection.ts` | 复核 | 中转袋投影层，拆事件后视图聚合可能变化 |
| `src/pages/process-factory/cutting/transfer-bag-return-model.ts` | 复核 | 回仓模型引用装袋/入仓状态 |
| `src/pages/process-factory/cutting/transfer-bags/detail.ts` | 复核 | 中转袋详情子组件状态展示 |
| `src/data/fcs/cutting/cutting-mainline-event-ledger.ts` | 修改 | 第 18/177 行引用 `特殊工艺回仓` eventStage，事件拆分后同步 |
| `src/data/fcs/cutting/sewing-dispatch.ts` | 修改 | 大量引用裁床待交出仓库存 + 特殊工艺回仓，分配逻辑依赖事件类型 |
| `src/data/fcs/cutting/transfer-bag-runtime.ts` | 修改 | `裁床待交出仓入仓暂存位`、`入仓暂存袋` 状态名称与 usageStageLabel |
| `src/pages/pda-cutting-inbound.ts` | 修改 | PDA 入仓页拆为先装袋、再入仓 |
| `src/pages/pda-cutting-handover.ts` | 修改 | PDA 交出页明确双阶段+整袋/逐票二选一 |
| `src/pages/pda-warehouse-wait-handover.ts` | 修改 | PDA 待交出仓首页四动作闭环 |
| `src/pages/pda-warehouse.ts` | 修改 | PDA 仓管首页裁床快捷入口改制 |
| `src/pages/pda-handover.ts` | 复核 | "新增交出记录" 按钮不受影响 |
| `src/pages/pda-handover-detail.ts` | 复核 | "新增交出记录" 按钮和拦截不受影响 |
| `src/pages/pda-warehouse-stocktake.ts` | 复核 | 盘点页空态提示引用交出装袋确认 |
| `src/pages/pda-warehouse-inbound-records.ts` | 复核 | 入仓记录展示，依赖入仓事件类型 |
| `src/pages/pda-transfer-bag-detail.ts` | 复核 | PDA 中转袋详情，装袋/入仓状态展示 |
| `src/pages/progress-board/core.ts` | 复核 | 进度总览 "特殊工艺回仓" 联动 |
| `src/pages/print/templates/label-print-template.ts` | 复核 | "特殊工艺交出" 标签打印字段 |
| `src/main-handlers/fcs-handlers.ts` | 复核 | `handleCraftCuttingWaitHandoverEvent` 注册仍有效 |
| `src/main-handlers/pda-handlers.ts` | 复核 | 注册 PDA 入仓/交出/待交出仓事件处理 |
| `src/router/routes-fcs.ts` | 复核 | Web 路由可达性 |
| `src/router/routes-pda.ts` | 复核 | PDA 路由可达性 |
| `src/router/route-renderers.ts` | 复核 | 懒加载注册不变 |
| `src/router/route-renderers-fcs.ts` | 复核 | 懒加载注册不变 |
| `scripts/check-factory-handover-warehouse-linkage.ts` | 修改 | 特殊工艺回仓进入裁床厂待交出仓断言 |
| `scripts/check-progress-statistics-linkage.ts` | 修改 | 特殊工艺回仓口径同步 |
| `scripts/check-cutting-fei-ticket-assembly.ts` | 修改 | 特殊工艺回仓状态断言 |
| `scripts/check-special-craft-task-and-fei-flow-deepening.ts` | 修改 | 特殊工艺回仓状态 allReturned 断言 |
| `scripts/check-mobile-execution-writeback.ts` | 修改 | 特殊工艺完工写回待交出仓断言 |
| `scripts/check-cutting-wait-handover-transfer-bag-flow.ts` | 创建 | 本 feature 专用治理检查 |
| `scripts/check-cutting-warehouse-management-switch.ts` | 修改 | 从旧口径改为新口径 |
| `scripts/check-cutting-clean-mainline.ts` | 修改 | 从旧事件类型/文案改为新口径 |
| `scripts/check-pda-handover-pages.ts` | 修改 | 补本次四个核心 PDA 页 |
| `scripts/check-transfer-bag-mobile-closed-loop.ts` | 修改 | 覆盖 transfer-bags.ts、list.ts、handlers.ts |
| `scripts/check-factory-mobile-app-redesign.ts` | 修改 | 从旧文案改为新文案 |
| `scripts/check-cutting-sewing-dispatch.ts` | 修改 | 从旧文案改为新文案 |
| `scripts/check-cutting-special-craft-dispatch-return.ts` | 修改 | 从旧文案改为新文案 |
| `scripts/check-fcs-handover-domain.ts` | 归入任务 4 | 交出对象/记录状态/回写差异链 |
| `scripts/check-handover-writeback-difference-unification.ts` | 归入任务 4 | 回写/差异/异议口径 |
| `tests/cutting-runtime-event-ledger-pda-web.spec.ts` | 修改 | 事件类型引用更新 |
| `tests/cutting-stage8-regression.spec.ts` | 修改 | 旧事件/文案引用更新 |
| `tests/cutting-transfer-bag-simplified-statuses.spec.ts` | 复核 | 状态展示旧文案可能触发 E2E 失败 |
| `tests/cutting-transfer-bag-detail-header.spec.ts` | 复核 | 详情 headers / summary strip |
| `tests/cutting-transfer-bag-detail-tabs.spec.ts` | 复核 | 详情 tab 切换 |
| `tests/cutting-transfer-bag-bagging-steps.spec.ts` | 复核 | 装袋步骤从一段变两段 |
| `tests/cutting-transfer-bag-navigation.spec.ts` | 复核 | 导航文案旧引用 |
| `tests/cutting-transfer-bag-auto-context.spec.ts` | 复核 | workbench 字段旧引用 |
| `tests/pda-handover-copy-middle-bag.spec.ts` | 复核 | 装袋动作旧文案 |
| `tests/handover-writeback-difference-unification.spec.ts` | 复核 | 特殊工艺交出差异追溯 |
| `tests/factory-mobile-app-redesign.spec.ts` | 复核 | `open-inbound-detail` 引用 |
| `tests/special-craft-web-mobile-action-dialog-and-layout.spec.ts` | 复核 | 特殊工艺完工生成待交出仓 |
| `package.json` | 修改 | 注册新检查脚本 |
| `docs/prototype-review-records/2026-07-25-cutting-wait-handover-transfer-bag-flow.md` | 创建 | 原型审查记录 |

---

## 设计章节覆盖矩阵

| 设计章节 | 关键内容 | 任务落点 |
| --- | --- | --- |
| 第 1-3 章 | 文档信息、背景目标、核查结论 | 任务 1 |
| 第 4.0-4.1 | 术语约定、菲票装袋（L+颜色、混装规则） | 任务 1、3 |
| 第 4.2 | 中转袋入仓（前置装袋、库区库位绑定） | 任务 1、2、3 |
| 第 4.3-4.3.2 | 交出双阶段模型、8 条扫码规则、交出确认、接收对象五类 | 任务 1、3、4 |
| 第 4.4-4.5 | 特种工艺回仓二选一、前向流转五状态 | 任务 1、4 |
| 第 5-6 章 | 角色职责、现状差距 | 任务 2、3 |
| 第 7 章 | 总流程图 | 任务 1 |
| 第 8.1-8.7 | 七个状态图（中转袋/菲票/回仓/交出单/记录/全链路/回写异议） | 任务 1、4 |
| 第 9.1-9.5 | 五个时序图（装袋+入仓/交出/回仓/全链路/回写差异） | 任务 1、3、4 |
| 第 10.1-10.3 | Web 首页+KPI + 弹窗字段；PDA 一页一动作 | 任务 2、3 |
| 第 11.1-11.4 | 事实账三层 + 关键字段 + 在库分类 + 回仓字段 | 任务 1、2、4 |
| 第 12.1-12.4 | 四动作业务规则 | 任务 1、3 |
| 第 13 章 | 9 条异常防错 | 任务 1、3、4 |
| 第 14-15 章 | 代码现状映射、遗漏风险清单 | 任务 1、4 |
| 第 16-17 章 | 验收标准（追溯/补录/Web=PDA/工艺/回写差异） | 任务 4 |
| 第 18 章 | 结论 | 任务 4 |

---

## 任务 1：事实账和事件契约收口

**文件：**
- 修改：`src/data/fcs/cutting/cutting-runtime-event-ledger.ts`
- 修改：`src/pages/process-factory/cutting/wait-handover-runtime.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags-model.ts`
- 修改：`src/data/fcs/cutting/handover-orders.ts`
- 修改：`src/data/fcs/cutting/special-craft-fei-ticket-flow.ts`
- 创建：`scripts/check-cutting-wait-handover-transfer-bag-flow.ts`

### 步骤 1：先写失败检查

新脚本 `scripts/check-cutting-wait-handover-transfer-bag-flow.ts` 必须覆盖：

```ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path: string): string { return readFileSync(path, 'utf8') }

// — 事件类型 —
const ledgerSource = read('src/data/fcs/cutting/cutting-runtime-event-ledger.ts')
assert(ledgerSource.includes("'菲票装袋'"), '必须新增菲票装袋')
assert(ledgerSource.includes("'中转袋入仓'"), '必须新增中转袋入仓')
assert(ledgerSource.includes("'交出装袋确认'"), '必须保留交出装袋确认')
assert(ledgerSource.includes("'新增交出记录'"), '必须保留新增交出记录')
assert(ledgerSource.includes("'特殊工艺交出'"), '必须保留特殊工艺交出')
assert(ledgerSource.includes("'特殊工艺回仓'"), '必须保留特殊工艺回仓')

// — 写入函数 —
const runtimeSource = read('src/pages/process-factory/cutting/wait-handover-runtime.ts')
assert(runtimeSource.includes('appendWaitHandoverBaggingEvent'), '必须有菲票装袋写入函数')
assert(/#{2,} 菲票装袋/.test(runtimeSource) || runtimeSource.includes("'菲票装袋'"), 'runtime 必须引用菲票装袋')
assert(runtimeSource.includes("'中转袋入仓'"), 'runtime 必须引用中转袋入仓')

// — 交出双阶段 —
const handoverSource = read('src/data/fcs/cutting/handover-orders.ts')
assert(handoverSource.includes('交出装袋确认'), 'handover-orders 必须保留交出装袋确认')
assert(handoverSource.includes('新增交出记录'), 'handover-orders 必须保留新增交出记录')
assert(handoverSource.includes('仓库') && handoverSource.includes('其他对象'), '接收对象必须覆盖兜底')

// — 特殊工艺前向状态 —
const specialCraftSource = read('src/data/fcs/cutting/special-craft-fei-ticket-flow.ts')
for (const status of ['已发料', '已接收', '加工中', '已完成待回仓', '已回仓']) {
  assert(specialCraftSource.includes(status), `special-craft-fei-ticket-flow 缺少状态 ${status}`)
}

// — 状态图落点 —
for (const status of ['装袋中', '已装袋待入仓', '已入待交出仓', '已交出待回收']) {
  assert(runtimeSource.includes(status) || read('src/pages/process-factory/cutting/transfer-bags-model.ts').includes(status), `缺少中转袋状态 ${status}`)
}

// — 关键字段 —
for (const field of ['hasSpecialCraft', 'specialCraftCategory', 'receiverType', 'returnMode', 'sourceHandoverRecordNo']) {
  assert(ledgerSource.includes(field) || handoverSource.includes(field) || specialCraftSource.includes(field), `关键字段 ${field} 未在数据层声明`)
}

// — 9条异常防错 —
for (const rule of ['未打印', '作废', '重复入仓', '混装', '已占用', '对象不明确', '未回仓却交出', '来源记录不符', '数量 <= 0']) {
  assert(runtimeSource.includes(rule) || read('src/pages/pda-cutting-inbound.ts').includes(rule) || read('src/pages/pda-cutting-handover.ts').includes(rule), `异常防错 ${rule} 未落地`)
}

// — 在库分类 —
for (const cat of ['无特殊工艺', '未做特殊工艺', '特殊工艺加工中', '已做特殊工艺']) {
  assert(read('src/pages/process-factory/cutting/warehouse-hub.ts').includes(cat), `Web 库存明细缺少分类 ${cat}`)
}
```

### 步骤 2：运行失败检查

```bash
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-wait-handover-transfer-bag-flow.ts
```

预期：因 `菲票装袋` / `中转袋入仓` 未定义而失败。

### 步骤 3：最小实现——拆分事件与 payload

只改 `cutting-runtime-event-ledger.ts` 和 `wait-handover-runtime.ts`：

- 新增 `菲票装袋` 事件类型及 payload `FeiTicketBaggingPayload`。
- 新增 `中转袋入仓` 事件类型及 payload `TransferBagInboundPayload`。
- 旧 `菲票入仓暂存` 保留但迁移所有消费者到新事件，旧事件 mock 数据随之迁移。
- `appendWaitHandoverInboundEvent` 继续可用但内部拆成两步（先 `菲票装袋` 后 `中转袋入仓`），或拆为两个独立函数。
- 交出/回写/特殊工艺回仓事件不变。

### 步骤 4：运行并通过检查

```bash
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-wait-handover-transfer-bag-flow.ts
```

预期：PASS。

### 步骤 5：复核现有消费者

```bash
npm run check:cutting-runtime-boundary
npm run check:cutting-clean-mainline
npm run check:cutting-warehouse-writeback-chain
```

预期：PASS 或只报需要同步改文案/事件引用的可修错误。

---

## 任务 2：Web 端入口收口

**文件：**
- 修改：`src/pages/process-factory/cutting/warehouse-hub.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags/list.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags/handlers.ts`
- 修改：`src/pages/process-factory/cutting/transfer-bags/dialogs.ts`
- 复核：`src/pages/process-factory/cutting/transfer-bags/state.ts`
- 复核：`src/pages/process-factory/cutting/fei-tickets.ts`
- 复核：`src/pages/process-factory/cutting/cutting-summary.ts`
- 复核：`src/pages/process-factory/cutting/production-progress.ts`
- 复核：`src/pages/process-factory/cutting/cutting-daily-production-report-model.ts`
- 复核：`src/pages/process-factory/cutting/meta.ts`
- 复核：`src/pages/process-factory/cutting/cut-order-close-records.ts`
- 复核：`src/router/routes-fcs.ts`
- 复核：`src/main-handlers/fcs-handlers.ts`
- 修改：`scripts/check-cutting-warehouse-management-switch.ts`

### 步骤 1：先写失败检查

在 `scripts/check-cutting-warehouse-management-switch.ts` 中把旧口径断言改成新口径：

```ts
// 旧：assertIncludes(waitHandoverHtml, '入仓暂存装袋', ...)
// 新：
assertIncludes(waitHandoverHtml, '菲票装袋', 'Web 首页必须有菲票装袋入口')
assertIncludes(waitHandoverHtml, '中转袋入仓', 'Web 首页必须有中转袋入仓入口')
assertIncludes(waitHandoverHtml, '交出装袋确认', 'Web 首页必须保留交出装袋确认')
assertIncludes(waitHandoverHtml, '特种工艺回收入仓', 'Web 首页必须有特种工艺回收入仓')
assertNotIncludes(waitHandoverHtml, '入仓暂存装袋', '旧合并文案不得继续出现')

// 中转袋页面
const transferBagsPage = read('src/pages/process-factory/cutting/transfer-bags.ts')
const transferBagsList = read('src/pages/process-factory/cutting/transfer-bags/list.ts')
const transferBagsHandlers = read('src/pages/process-factory/cutting/transfer-bags/handlers.ts')
assertNotIncludes(transferBagsPage, '开始入仓暂存装袋', '中转袋单文件不得保留旧合并动作')
assertNotIncludes(transferBagsList, '开始入仓暂存装袋', '中转袋列表不得保留旧合并动作')
assertNotIncludes(transferBagsHandlers, "return '入仓暂存装袋'", '中转袋弹窗标题不得保留旧合并')
```

### 步骤 2：运行失败检查

```bash
npm run check:cutting-warehouse-management-switch
```

预期：因旧文案仍在输出而失败。

### 步骤 3：改制 Web 首页

- tab 改成 `库存明细 / 菲票装袋 / 中转袋入仓 / 交出 / 特种工艺回收入仓 / 库区库位`。
- 按钮改成四动作入口，PDA 快捷链接不变。
- `renderWaitHandoverInboundTempUseTable` 改为展示入仓记录；
- 增加菲票装袋记录展示区。
- 首页 KPI 卡片调整为展示当前待交出仓库存、中转袋状态、当前交出对象、特殊工艺回仓待处理数量。
- 交出弹窗字段包含：接收对象类型/名称、交出单号/记录号、中转袋列表、菲票列表。
- 特种工艺回仓弹窗字段包含：回仓模式二选一、来源交出记录、袋码或菲票、库区、库位、实回数量。

### 步骤 4：改制中转袋页面

- `transfer-bags.ts`、`transfer-bags/list.ts`：按钮从 "开始入仓暂存装袋" 改为两个轻动作入口 `菲票装袋` / `中转袋入仓`。
- `transfer-bags/handlers.ts`：`getDialogTitle()` 从 `return '入仓暂存装袋'` 改为按场景返回 `菲票装袋` / `中转袋入仓`；提交反馈/备注文案同步更新。
- `transfer-bags/dialogs.ts`：确认按钮文案同步更新。

### 步骤 5：复核只读页面

- `fei-tickets.ts`：列名 "特殊工艺回仓状态" 保留，跳转链接复核。
- `cutting-summary.ts`：保留原有汇总，复核差异文案与回仓链路一致性。
- `production-progress.ts`：保留原有 KPI，复核数据源是否受事件拆分影响。
- `cutting-daily-production-report-model.ts`：指标口径复核。
- `meta.ts`：`special-craft-return` key 和 canonicalPath 复核。
- `cut-order-close-records.ts`：文案复核。
- `routes-fcs.ts`：路由可达性复核，不新增。
- `main-handlers/fcs-handlers.ts`：`handleCraftCuttingWaitHandoverEvent` 注册仍有效，复核。

### 步骤 6：运行并通过合并检查

```bash
npm run check:cutting-warehouse-management-switch
npm run check:transfer-bag-mobile-closed-loop
npm run check:process-factory-warehouse-menu-consolidation
npm run check:menu-routes
```

预期：全部 PASS。

---

## 任务 3：PDA 入仓、交出、回仓三端闭环

**文件：**
- 修改：`src/pages/pda-cutting-inbound.ts`
- 修改：`src/pages/pda-cutting-handover.ts`
- 修改：`src/pages/pda-warehouse-wait-handover.ts`
- 修改：`src/pages/pda-warehouse.ts`
- 复核：`src/pages/pda-handover.ts`
- 复核：`src/pages/pda-handover-detail.ts`
- 复核：`src/router/routes-pda.ts`
- 修改：`scripts/check-pda-handover-pages.ts`

### 步骤 1：先写失败检查

在 `scripts/check-pda-handover-pages.ts` 中加入本次四核心 PDA 页：

```ts
const inboundHtml = fs.readFileSync('src/pages/pda-cutting-inbound.ts', 'utf8')
const handoverHtml = fs.readFileSync('src/pages/pda-cutting-handover.ts', 'utf8')
const waitHandoverHtml = fs.readFileSync('src/pages/pda-warehouse-wait-handover.ts', 'utf8')
const warehouseHtml = fs.readFileSync('src/pages/pda-warehouse.ts', 'utf8')

// 四动作可见
for (const label of ['菲票装袋', '中转袋入仓', '交出装袋确认', '特种工艺回收入仓']) {
  assert(waitHandoverHtml.includes(label), `PDA 待交出仓首页缺少 ${label}`)
}

// PDA 仓管首页
assert(!warehouseHtml.includes('入仓暂存装袋'), 'PDA 仓管首页不得保留旧合并入口')
assert(warehouseHtml.includes('菲票装袋'), 'PDA 仓管首页必须有菲票装袋')

// PDA 入仓页
assert(!inboundHtml.includes('入仓暂存装袋') || !inboundHtml.includes('title: \'入仓暂存装袋\''), 'PDA 入仓页标题不得保留旧合并')
assert(inboundHtml.includes('菲票装袋') || inboundHtml.includes('中转袋入仓'), 'PDA 入仓页必须拆分')

// PDA 交出页
assert(handoverHtml.includes('交出装袋确认'), 'PDA 交出页必须保留交出装袋确认')
assert(handoverHtml.includes('特殊工艺回收入仓') || handoverHtml.includes('整袋回仓') || handoverHtml.includes('逐菲票回仓'), 'PDA 交出页必须有回仓模式')

// PDA 一页一动作
assert(!waitHandoverHtml.includes('管理统计') || !waitHandoverHtml.includes('状态流转'), 'PDA 首页不得展示管理统计')
```

### 步骤 2：运行失败检查

```bash
npm run check:pda-handover-pages
```

预期：因旧文案仍存在而失败。

### 步骤 3：改制 PDA 入仓页

- 标题和按钮从 "入仓暂存装袋" 拆成两步：
  - 先扫袋和菲票，写入 `菲票装袋` 事件。
  - 再独立补库区、库位，写入 `中转袋入仓` 事件。
- 实时展示袋内明细：菲票号、生产单、部位、片数、是否有特殊工艺。
- 混装阻断：扫到普通与特殊工艺混装时即时阻断并提示。
- 重复扫码立即阻断。

### 步骤 4：改制 PDA 交出页

- 阶段一交出装袋确认：保留现有扫码流（任务码→来源袋→菲票→目标袋），校验八条规则。
- 阶段二交出确认：扫交出单、扫中转袋、扫菲票 → 写入 `新增交出记录`。
- 特殊工艺回仓：支持整袋 / 逐票二选一。
  - 整袋回仓：扫袋码 → 扫菲票获取裁片部位 → 扫库区库位。
  - 逐菲票回仓：逐张扫菲票 → 手工确认回仓数量 → 扫库区库位。

### 步骤 5：改制 PDA 待交出仓首页和仓管首页

- `pda-warehouse-wait-handover.ts`：`CUTTING_WAIT_HANDOVER_ACTIONS` 从四动作改为四动作命名；最近记录标题从 "入仓暂存装袋" 改为分别显示 "最近菲票装袋" 和 "最近中转袋入仓"。
- `pda-warehouse.ts`：裁床工厂场景下快捷入口至少显示 `菲票装袋` 与 `中转袋入仓` 两个动作；毛织/印花/染色逻辑不改。
- `pda-handover.ts` 和 `pda-handover-detail.ts`：只复核，现有按钮不受事件拆分影响。

### 步骤 6：运行并通过 PDA 全量检查

```bash
npm run check:pda-handover-pages
```

预期：PASS。

---

## 任务 4：治理脚本、原型审查记录和最终验收

**文件：**
- 创建：`docs/prototype-review-records/2026-07-25-cutting-wait-handover-transfer-bag-flow.md`
- 修改：`scripts/check-cutting-clean-mainline.ts`
- 修改：`scripts/check-factory-mobile-app-redesign.ts`
- 修改：`scripts/check-cutting-sewing-dispatch.ts`
- 修改：`scripts/check-cutting-special-craft-dispatch-return.ts`
- 修改：`scripts/check-fcs-handover-domain.ts`
- 修改：`scripts/check-handover-writeback-difference-unification.ts`
- 修改：`tests/cutting-runtime-event-ledger-pda-web.spec.ts`（E2E 事件引用更新）
- 修改：`tests/cutting-stage8-regression.spec.ts`（回归文案/事件引用更新）
- 修改：`package.json`

### 步骤 1：补齐原型审查记录

按 `docs/prototype-review-record-template.md` 填满：

- 基本信息：涉及 FCS/PFOS，管理端+员工执行端，裁床仓管/操作员/接收方/主管角色。
- 参考规范：`docs/higood-indonesia-factory-product-design-guidelines.md`、`docs/higood-indonesia-factory-prototype-review-checklist.md`。
- 自查结论：13 项检查逐项结论。
- 问题标签：命中项+说明。
- 主要问题与处理：按本次变更逐条填写。
- 最终结论：通过 / 有条件通过 / 不通过。

### 步骤 2：将所有旧检查脚本从旧口径改为新口径

- `check-cutting-clean-mainline.ts`：事件类型/文案更新。
- `check-factory-mobile-app-redesign.ts`：旧文案更新。
- `check-cutting-sewing-dispatch.ts`：旧文案更新。
- `check-cutting-special-craft-dispatch-return.ts`：旧文案更新。
- `check-fcs-handover-domain.ts`：交出对象/记录状态/回写差异链口径更新。
- `check-handover-writeback-difference-unification.ts`：回写/差异/异议口径更新。

### 步骤 3：更新 E2E 测试

- `tests/cutting-runtime-event-ledger-pda-web.spec.ts`：事件类型从旧名称改为 `菲票装袋` / `中转袋入仓`。
- `tests/cutting-stage8-regression.spec.ts`：文案/事件引用更新。

### 步骤 4：注册脚本并跑全量治理

```json
{
  "scripts": {
    "check:cutting-wait-handover-transfer-bag-flow": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-wait-handover-transfer-bag-flow.ts"
  }
}
```

全量验收命令：

```bash
# 本 feature 专用
npm run check:cutting-wait-handover-transfer-bag-flow

# Web / PDA / 中转袋 页面口径
npm run check:cutting-warehouse-management-switch
npm run check:transfer-bag-mobile-closed-loop
npm run check:pda-handover-pages

# 治理总闸
npm run check:list-page-governance
npm run check:menu-routes
npm run check:process-factory-warehouse-menu-consolidation
npm run check:prototype-design-governance -- --all
npm run check:prototype-design-governance

# 事实账边界
npm run check:cutting-runtime-boundary
npm run check:cutting-clean-mainline
npm run check:cutting-warehouse-writeback-chain

# 交出/回写/差异
npm run check:fcs-handover-domain
npm run check:handover-writeback-difference-unification
npm run check:factory-handover-warehouse-linkage

# 特殊工艺
npm run check:cutting-special-craft-dispatch-return
npm run check:cutting-sewing-dispatch

# 移动端
npm run check:factory-mobile-app-redesign

# 构建
npm run build
```

预期：全部 PASS。

---

## 自检清单

- [ ] 设计文档 1-17 章逐条有任务/步骤/脚本落点。
- [ ] 四动作名称均有代码入口和检查脚本断言。
- [ ] `交出装袋确认` 与 `交出确认` 没有被合并回单一动作。
- [ ] 交出双阶段 8 条扫码校验逐条落地。
- [ ] 接收对象五类，Web/PDA 首屏只突出前三类，仓库/其他兜底后置。
- [ ] 特种工艺前向流转五状态有数据定义和脚本断言。
- [ ] 状态图 8.1-8.7 均有数据形态或脚本断言。
- [ ] 时序图 9.1-9.5 均有对应事件写入和投影落点。
- [ ] Web 首页 KPI 四个、四个弹窗字段完整。
- [ ] PDA 一页一动作，无管理统计/日志/状态机暴露。
- [ ] 关键字段 11 类均有事件 payload 或数据声明。
- [ ] 在库分类四种有 Web 页面展示和脚本断言。
- [ ] 9 条异常防错均有校验代码和阻断提示。
- [ ] 验收标准 17 章逐条有脚本或审查记录落点。
- [ ] 40+ 文件中 20+ 个检查脚本均已同步修改。
- [ ] E2E 测试文件事件引用已更新。
- [ ] 原型审查记录按模板 6 节填满。
- [ ] `npm run build` + 全量治理命令 PASS。
- [ ] 无占位词（TODO/待定/后续再说）。

---

## 执行前置说明

本计划已按设计文档逐章核查，结合三条审查线（设计覆盖/代码入口/治理覆盖）核对约 40+ 个文件引用，补齐全部遗漏入口。核心策略仍是“保留现有投影层、拆写入动作与页面动作”，不引入新架构、新框架或跨域重构。

如果实现过程中发现计划外的旧引用，原则是：只做最小必要同步修改，不扩大到无关模块。
