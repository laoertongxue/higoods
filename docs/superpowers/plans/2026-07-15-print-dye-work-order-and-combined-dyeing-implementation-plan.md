# 染色 / 印花加工单直连生产单与合并染色实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 删除独立的染色 / 印花需求单，让正式生产单自动生成唯一的染色 / 印花加工单，并新增一次性完成、按生产单下单时间自动分配产出的“合并染色”任务。

**架构：** 平台加工单领域是加工单 `id` 与加工单号的唯一事实源；平台页面、PFOS Web 页面和 PDA 只投影同一对象，工厂端禁止生成或改写加工单号。生产单正式生成时调用幂等的加工单生成服务；合并染色作为独立协同对象，只锁定多张加工单并记录一次实际投入、实际产出、系统分配、删除和更正历史，不生成父加工单。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、Node/tsx 检查脚本、Playwright、CodeGraph。

---

## 执行前置与已知基线

- 实现必须在独立 worktree 中完成；开始前将实现分支更新到届时最新 `main`，保留用户已有的共享染色事实整理，不得覆盖或回退。
- 在设计提交 `35a34380` 的干净基线上，`npm run build`、`npm run check:dyeing-workflow`、`npm run check:printing-workflow` 通过；`npm run check:process-work-order-unification` 因旧染色 mock 在工厂端追加 `-07` 至 `-11` 后缀而失败。
- 该失败不是测试口径问题。必须保留并加强以下硬约束：
  - 平台加工单 `id` 是唯一 `id`。
  - 平台加工单号是唯一加工单号。
  - 工厂端 / PFOS / PDA 只能引用平台端的 `id` 和加工单号。
  - 禁止工厂端本地生成、重编号、追加后缀或维护平行加工单集合。
- 若更新后的 `main` 已通过编号一致性断言，仍执行任务 1 的回归加固；不要因当前结果已绿而跳过该约束。
- 开始和结束均运行 `codegraph sync && codegraph status`；若 CLI 不可用，记录原因并至少运行 CodeGraph status MCP，不得假装已同步。

## 文件范围

### 新建文件

- `src/data/fcs/production-process-work-order-service.ts`：从正式生产单快照幂等生成 / 同步染色、印花加工单。
- `src/data/fcs/combined-dyeing-domain.ts`：合并染色任务、成员快照、一次完成、自动分配、更正、软删除和有效满足量。
- `src/pages/process-factory/dyeing/combined-dyeing.ts`：合并染色列表、创建、详情、完成、更正、删除界面及局部渲染。
- `scripts/check-production-process-work-order-generation.ts`：自动生成、唯一性、待分配工厂、按备货来源检查。
- `scripts/check-combined-dyeing.ts`：合并条件、锁定、分配、更正、删除与历史留痕检查。
- `tests/combined-dyeing.spec.ts`：菜单、列表、创建、完成、更正、删除和加工单联动浏览器验收。
- `docs/prototype-review-records/2026-07-15-print-dye-work-order-and-combined-dyeing.md`：本次原型治理审查记录。

### 修改文件

- `src/data/fcs/process-work-order-domain.ts`：统一加工单来源类型和生产单快照；保持单一平台身份。
- `src/data/fcs/dyeing-task-domain.ts`：去除需求单生成和工厂端重新编号；增加生产单 / 备货创建入口及合并染色投影。
- `src/data/fcs/printing-task-domain.ts`：去除需求单生成；增加生产单 / 备货创建入口。
- `src/data/fcs/page-adapters/process-prep-pages-adapter.ts`：平台列表只映射统一加工单，不再从需求物料独立造单。
- `src/pages/production/demand-domain.ts`：正式生产单落库后调用加工单自动生成服务。
- `src/data/fcs/production-order-change-workflow.ts`：变更成功后触发未执行加工单同步，已执行 / 已入合并任务保留快照和影响提示。
- `src/pages/process-dye-orders.ts`、`src/pages/process-print-orders.ts`：删除“按需求创建”，保留“生产单自动生成 / 按备货创建”展示和备货创建入口。
- `src/pages/process-factory/dyeing/work-orders.ts`、`src/pages/process-factory/dyeing/work-order-detail.ts`：展示合并染色任务、当前有效分配、满足状态和变更影响。
- `src/pages/process-factory/dyeing/events.ts`：接入合并染色事件分派。
- `src/data/app-shell-config.ts`：删除需求单菜单；在“染色加工单”后增加“合并染色”。
- `src/router/route-renderers-fcs.ts`、`src/router/routes-fcs.ts`：删除需求单路由，增加合并染色路由。
- `src/main-handlers/fcs-handlers.ts`：删除需求单处理器，接入合并染色处理器。
- `scripts/check-process-work-order-unification.ts`：加强平台 / 工厂身份一致性，移除“必须有需求单号”的旧断言。
- `scripts/check-dyeing-workflow.ts`、`scripts/check-printing-workflow.ts`：替换旧需求单创建口径。
- `package.json`：登记两个新增检查命令和合并染色 E2E 命令。
- `docs/fcs-process-work-order-unification.md`：更新为生产单直连加工单和平台身份唯一来源。

### 删除文件

- `src/pages/process-dye-requirements.ts`
- `src/pages/process-print-requirements.ts`

## 领域不变量

实现过程中所有测试都围绕以下不变量，不得用兼容分支绕开：

1. `生产单 + 工艺类型` 最多一张加工单；重复触发返回已有对象。
2. 生产单来源加工单恰好一个生产单；备货来源加工单没有生产单和需求单假编号。
3. 平台、PFOS Web、PDA 的加工单 `id` 和加工单号逐条完全相等。
4. 未分配工厂不阻止生成，加工单状态为“待分配工厂”。
5. 合并染色只接收生产单来源染色加工单；至少两张；只校验同厂、同面料、同目标颜色、同工艺和未占用。
6. 合并任务创建即锁定成员，不能增删改成员；只允许删除整个任务。
7. 一个任务只有一次完成登记，不建立投缸记录列表；只填实际投入总量、实际产出总量和可选备注。
8. 分配顺序固定为生产单下单时间升序、生产单号升序，不允许人工调整。
9. 短产直接记部分满足 / 未满足并结束，不自动补染；超产只记超出数量。
10. 更正只修改实际投入 / 产出，按原顺序重算，保留前后版本。
11. 任务始终可软删除，执行与分配历史永久保留；已形成的满足量不撤销，部分 / 未满足成员解除占用。

## 任务 1：先锁死平台加工单身份唯一来源

**文件：**

- 修改：`scripts/check-process-work-order-unification.ts`
- 修改：`src/data/fcs/page-adapters/process-prep-pages-adapter.ts`
- 修改：`src/data/fcs/process-work-order-domain.ts`
- 修改：`src/data/fcs/dyeing-task-domain.ts`
- 修改：`src/data/fcs/printing-task-domain.ts`

- [ ] **步骤 1：先补会失败的身份一致性断言**

在 `scripts/check-process-work-order-unification.ts` 中把加工单逐条比较，不只比较排序后的单号数组：

```ts
function assertSamePlatformAndFactoryIdentity(
  processLabel: string,
  platformOrders: Array<{ workOrderId: string; orderNo: string }>,
  factoryOrders: Array<{ workOrderId: string; orderNo: string }>,
): void {
  assert.deepEqual(
    platformOrders.map((item) => [item.workOrderId, item.orderNo]).sort(),
    factoryOrders.map((item) => [item.workOrderId, item.orderNo]).sort(),
    `${processLabel}工厂端只能使用平台加工单 ID 和加工单号`,
  )
}
```

同时增加断言：加工单号唯一；工厂端不存在平台集合之外的 `id`；不得出现为解决冲突而追加的派生后缀。

- [ ] **步骤 2：运行检查并确认失败原因仍是双重造单 / 改号**

运行：

```bash
npm run check:process-work-order-unification
```

预期：修改前在旧基线上失败，错误明确指向“染色工厂端只能使用平台加工单 ID 和加工单号”；若最新 `main` 已修复，则记录现有通过证据，继续检查代码中没有第二生成路径。

- [ ] **步骤 3：移除平台 adapter 和工厂 domain 的平行编号逻辑**

在 `process-prep-pages-adapter.ts` 中让 `listPrepProcessOrders('PRINT' | 'DYE')` 只从 `listProcessWorkOrders()` 映射；不得再从需求 artifact 构造独立 `orderNo`。

在 `dyeing-task-domain.ts` 删除 `toGeneratedDyeWorkOrder()` 中这类逻辑：

```ts
`${baseWorkOrderNo}-${String(index + 1).padStart(2, '0')}`
```

`printing-task-domain.ts` 同样不得用列表下标重新决定平台加工单号。`process-work-order-domain.ts` 只做对象投影，保持原始 `workOrderId/workOrderNo`。

- [ ] **步骤 4：运行统一性检查**

运行：

```bash
npm run check:process-work-order-unification
```

预期：`[check-process-work-order-unification] PASS`，平台与工厂端逐条身份一致。若随后暴露独立状态覆盖失败（例如旧基线的“转印中”），单独修正 mock 状态覆盖，禁止回退身份断言。

- [ ] **步骤 5：提交**

```bash
git add scripts/check-process-work-order-unification.ts src/data/fcs/page-adapters/process-prep-pages-adapter.ts src/data/fcs/process-work-order-domain.ts src/data/fcs/dyeing-task-domain.ts src/data/fcs/printing-task-domain.ts
git commit -m "fix: unify platform and factory work order identity"
```

## 任务 2：建立生产单自动生成加工单的幂等服务

**文件：**

- 新建：`src/data/fcs/production-process-work-order-service.ts`
- 新建：`scripts/check-production-process-work-order-generation.ts`
- 修改：`src/data/fcs/process-work-order-domain.ts`
- 修改：`src/data/fcs/dyeing-task-domain.ts`
- 修改：`src/data/fcs/printing-task-domain.ts`
- 修改：`src/pages/production/demand-domain.ts`
- 修改：`package.json`

- [ ] **步骤 1：写失败检查，固定一对一、幂等和待分配工厂**

检查脚本至少构造三种正式生产单快照：仅染色、仅印花、染色加印花。定义输入为：

```ts
export interface FormalProductionOrderProcessSnapshot {
  productionOrderId: string
  productionOrderNo: string
  orderedAt: string
  techPackVersionId: string
  techPackVersionLabel: string
  materialId: string
  materialName: string
  targetColor: string
  plannedQty: number
  qtyUnit: string
  processCodes: Array<'DYE' | 'PRINT'>
  dyeProcessName?: string
  printProcessName?: string
  factoryId?: string
  factoryName?: string
}
```

断言：

- 首次触发按工艺各生成一张。
- 第二次传入同一 `productionOrderId` 不增加数量，返回同一 `id/单号`。
- 一张加工单只保存一个 `sourceProductionOrderId`。
- 未传工厂仍生成，状态标签为“待分配工厂”。
- 不生成任何染色需求单号或印花需求单号。

- [ ] **步骤 2：运行新增检查并确认失败**

运行：

```bash
npx tsx scripts/check-production-process-work-order-generation.ts
```

预期：因服务和注册入口尚不存在而失败。

- [ ] **步骤 3：实现最小幂等生成服务**

在 `production-process-work-order-service.ts` 导出：

```ts
export function ensureProcessWorkOrdersForFormalProductionOrder(
  snapshot: FormalProductionOrderProcessSnapshot,
): { dyeWorkOrderId?: string; printWorkOrderId?: string }
```

实现要求：

- 先按 `sourceProductionOrderId + processType` 查询已有加工单。
- 已有则返回，不重新编号。
- 新建编号只在平台领域入口生成一次，再原样注册给工厂任务 / PDA。
- 工厂为空时使用明确的待分配字段和状态，不能伪造测试工厂。
- 保存正式技术包、BOM 面料、目标颜色、工艺、数量、单位和 `orderedAt` 快照。

在 `applyCreatedProductionOrderGroups()` 把 `item.order` 转为上述快照后调用服务；调用应发生在生产单写入 `state.orders` 后、打开详情页前。

- [ ] **步骤 4：运行生成检查和原流程检查**

运行：

```bash
npx tsx scripts/check-production-process-work-order-generation.ts
npm run check:dyeing-workflow
npm run check:printing-workflow
npm run check:process-work-order-unification
```

预期：四条均通过；自动生成后的加工单在平台、PFOS 和 PDA 使用同一个 `id/单号`。

- [ ] **步骤 5：登记命令并提交**

在 `package.json` 增加：

```json
"check:production-process-work-order-generation": "tsx scripts/check-production-process-work-order-generation.ts"
```

提交：

```bash
git add src/data/fcs/production-process-work-order-service.ts scripts/check-production-process-work-order-generation.ts src/data/fcs/process-work-order-domain.ts src/data/fcs/dyeing-task-domain.ts src/data/fcs/printing-task-domain.ts src/pages/production/demand-domain.ts package.json
git commit -m "feat: generate process work orders from formal production orders"
```

## 任务 3：删除染色 / 印花需求单创建链路，保留备货创建

**文件：**

- 修改：`src/data/fcs/process-work-order-domain.ts`
- 修改：`src/data/fcs/dyeing-task-domain.ts`
- 修改：`src/data/fcs/printing-task-domain.ts`
- 修改：`src/data/fcs/page-adapters/process-prep-pages-adapter.ts`
- 修改：`src/pages/process-dye-orders.ts`
- 修改：`src/pages/process-print-orders.ts`
- 修改：`scripts/check-dyeing-workflow.ts`
- 修改：`scripts/check-printing-workflow.ts`
- 修改：`scripts/check-process-work-order-unification.ts`

- [ ] **步骤 1：先把旧需求口径改成新来源口径**

在检查脚本中删除“每张加工单必须有 `sourceDemandIds`”断言，替换为互斥来源：

```ts
if (order.sourceType === 'PRODUCTION_ORDER') {
  assert(order.sourceProductionOrderId, `${order.workOrderNo} 缺少生产单来源`)
  assert(!order.stockMaterialId, `${order.workOrderNo} 不应同时存在备货来源`)
} else {
  assert(order.stockMaterialId, `${order.workOrderNo} 缺少备货物料来源`)
  assert(!order.sourceProductionOrderId, `${order.workOrderNo} 不得伪造生产单来源`)
}
```

检查页面源码不再出现“按需求创建”“选择染色需求”“选择印花需求”或染色 / 印花需求单号。

- [ ] **步骤 2：运行检查并确认旧页面失败**

运行：

```bash
npm run check:dyeing-workflow
npm run check:printing-workflow
npm run check:process-work-order-unification
```

预期：旧 `sourceDemandIds`、`linkedDemands` 和“按需求创建”仍存在，因此失败。

- [ ] **步骤 3：收敛领域来源模型**

把加工单来源统一为：

```ts
type ProcessWorkOrderSourceType = 'PRODUCTION_ORDER' | 'STOCK'
```

生产单来源保存单值 `sourceProductionOrderId/sourceProductionOrderNo/productionOrderOrderedAt`；备货来源保存 `stockMaterialId/stockMaterialName`。删除工艺需求单 `sourceDemandIds` 和面向需求单的 `linkedDemands` 展示。

将 `createDyeWorkOrderFromDemands()` 替换为明确的 `createDyeWorkOrderFromStock()`；印花侧同样只保留 `createPrintWorkOrderFromStock()`。备货创建不生成假的生产单 ID、需求 ID 或 `sourceType: 'PRODUCTION_ORDER'`。

- [ ] **步骤 4：简化平台创建 UI**

`process-dye-orders.ts` 和 `process-print-orders.ts`：

- 列表来源徽标只显示“生产单自动生成”或“按备货创建”。
- 创建弹窗固定为按备货创建，不提供创建模式切换。
- 生产单来源加工单只读展示来源生产单和快照。
- 备货创建仍填写备货物料、计划量、工厂、计划完成时间和工艺要求。
- 工厂端加工单号字段只读，直接显示平台单号。

- [ ] **步骤 5：运行检查并提交**

运行：

```bash
npm run check:dyeing-workflow
npm run check:printing-workflow
npm run check:process-work-order-unification
npm run build
```

预期：全部通过，页面源码无旧需求创建文案。

提交：

```bash
git add src/data/fcs/process-work-order-domain.ts src/data/fcs/dyeing-task-domain.ts src/data/fcs/printing-task-domain.ts src/data/fcs/page-adapters/process-prep-pages-adapter.ts src/pages/process-dye-orders.ts src/pages/process-print-orders.ts scripts/check-dyeing-workflow.ts scripts/check-printing-workflow.ts scripts/check-process-work-order-unification.ts
git commit -m "refactor: remove process demand based work order creation"
```

## 任务 4：删除需求单页面、菜单、路由和处理器

**文件：**

- 删除：`src/pages/process-dye-requirements.ts`
- 删除：`src/pages/process-print-requirements.ts`
- 修改：`src/data/app-shell-config.ts`
- 修改：`src/router/route-renderers-fcs.ts`
- 修改：`src/router/routes-fcs.ts`
- 修改：`src/main-handlers/fcs-handlers.ts`
- 修改：`scripts/check-process-work-order-unification.ts`

- [ ] **步骤 1：增加导航删除检查**

在 `check-process-work-order-unification.ts` 断言：

- 菜单不含“染色需求单”“印花需求单”。
- 路由不含 `/fcs/process/dye-requirements`、`/fcs/process/print-requirements`。
- handler 和 renderer 不导入已删除页面。
- 染色加工单和印花加工单菜单仍存在。

- [ ] **步骤 2：运行检查确认失败**

运行：

```bash
npm run check:process-work-order-unification
```

预期：旧菜单 / 路由仍存在而失败。

- [ ] **步骤 3：删除完整入口链**

删除两个页面文件，同时删除 `app-shell-config.ts` 菜单、`route-renderers-fcs.ts` 异步 renderer、`routes-fcs.ts` 静态 / 动态路由以及 `fcs-handlers.ts` 导入和事件分派。不要保留跳转到加工单的兼容路由，因为产品结论是删除独立业务对象。

- [ ] **步骤 4：运行路由、构建和残留搜索**

运行：

```bash
npm run check:process-work-order-unification
npm run build
rg -n "染色需求单|印花需求单|process/dye-requirements|process/print-requirements" src scripts
```

预期：前两条通过；`rg` 无业务入口残留。若只剩迁移说明或历史文档，逐条确认不是运行时入口。

- [ ] **步骤 5：提交**

```bash
git add -A src/pages/process-dye-requirements.ts src/pages/process-print-requirements.ts src/data/app-shell-config.ts src/router/route-renderers-fcs.ts src/router/routes-fcs.ts src/main-handlers/fcs-handlers.ts scripts/check-process-work-order-unification.ts
git commit -m "refactor: remove dye and print requirement pages"
```

## 任务 5：用纯领域函数实现合并染色分配

**文件：**

- 新建：`src/data/fcs/combined-dyeing-domain.ts`
- 新建：`scripts/check-combined-dyeing.ts`
- 修改：`package.json`

- [ ] **步骤 1：写分配算法失败测试**

在检查脚本构造三个加工单：A 600 Yard、B 400 Yard、C 200 Yard；A 下单最早，B/C 同时但 B 生产单号更小。检查纯函数：

```ts
export function allocateCombinedDyeingOutput(
  members: CombinedDyeingMemberSnapshot[],
  actualOutputQty: number,
): CombinedDyeingAllocation[]
```

至少覆盖：

- 产出 800：A=600、B=200、C=0。
- 产出 1300：A=600、B=400、C=200，超出 100。
- 输入成员顺序打乱，结果仍按下单时间、生产单号排序。
- 负数、NaN、单位不一致拒绝。
- 分配结果不允许外部传入或人工覆盖。

- [ ] **步骤 2：运行并确认失败**

```bash
npx tsx scripts/check-combined-dyeing.ts
```

预期：模块不存在或导出不存在而失败。

- [ ] **步骤 3：实现最小领域类型和纯算法**

核心类型：

```ts
export type CombinedDyeingTaskStatus = 'WAIT_DYEING' | 'COMPLETED' | 'DELETED'
export type CombinedDyeingSatisfaction = 'FULL' | 'PARTIAL' | 'UNMET'

export interface CombinedDyeingMemberSnapshot {
  dyeWorkOrderId: string
  dyeWorkOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  productionOrderOrderedAt: string
  requiredQty: number
  effectiveSatisfiedQtyBeforeTask: number
  qtyUnit: string
}
```

算法使用 `remainingNeed = max(requiredQty - effectiveSatisfiedQtyBeforeTask, 0)`，排序键固定为 `productionOrderOrderedAt`、`productionOrderNo`。返回每单分配量、满足状态、未满足量和总超出量，所有数量最多到加工单需求量。

- [ ] **步骤 4：运行纯领域检查**

```bash
npx tsx scripts/check-combined-dyeing.ts
```

预期：输出 `[check-combined-dyeing] PASS`。

- [ ] **步骤 5：登记命令并提交**

在 `package.json` 增加：

```json
"check:combined-dyeing": "tsx scripts/check-combined-dyeing.ts"
```

提交：

```bash
git add src/data/fcs/combined-dyeing-domain.ts scripts/check-combined-dyeing.ts package.json
git commit -m "feat: add combined dyeing allocation domain"
```

## 任务 6：实现合并任务创建、完成、更正和软删除

**文件：**

- 修改：`src/data/fcs/combined-dyeing-domain.ts`
- 修改：`scripts/check-combined-dyeing.ts`
- 修改：`src/data/fcs/dyeing-task-domain.ts`

- [ ] **步骤 1：补全生命周期失败测试**

检查以下行为：

- 少于两张拒绝。
- 备货来源拒绝。
- 不同染厂、面料、目标颜色、染色工艺分别拒绝。
- 不校验“可投缸”、备料完成或执行状态。
- 创建后成员快照不可修改；成员不能加入另一未删除任务。
- 完成只登记一次 `actualInputQty/actualOutputQty/remark/completedBy/completedAt`。
- 短产完成后不生成后续投缸或补染记录。
- 更正只接受投入、产出和说明，生成新分配版本，旧版本保留。
- 待染色和已完成任务均可软删除；历史记录仍可查。
- 删除已完成任务不撤回已形成的有效满足量；部分 / 未满足成员解除占用。

- [ ] **步骤 2：运行检查并确认失败**

```bash
npm run check:combined-dyeing
```

预期：生命周期 API 未实现而失败。

- [ ] **步骤 3：实现不可变成员与版本化分配**

导出这些明确入口：

```ts
createCombinedDyeingTask(input)
completeCombinedDyeingTask(input)
correctCombinedDyeingResult(input)
deleteCombinedDyeingTask(input)
listCombinedDyeingTasks(options?)
getCombinedDyeingTaskById(taskId)
getActiveCombinedDyeingMembership(dyeWorkOrderId)
getEffectiveDyeingFulfillment(dyeWorkOrderId)
```

成员存入独立快照数组且只暴露克隆值。完成 / 更正创建 `allocationVersion`，旧版本标记非当前但不删除。删除记录 `deletedBy/deletedAt/deleteReason`；列表默认排除已删除，可显式筛选。

- [ ] **步骤 4：在染色加工单投影合并结果**

`dyeing-task-domain.ts` 只读取合并领域：

- 当前合并任务 `id/单号`。
- 当前有效分配量。
- 满足状态、未满足量。
- 是否被未删除任务占用。

不得复制任务状态，不得给工厂端生成新的加工单号。

- [ ] **步骤 5：运行并提交**

```bash
npm run check:combined-dyeing
npm run check:dyeing-workflow
npm run check:process-work-order-unification
git add src/data/fcs/combined-dyeing-domain.ts scripts/check-combined-dyeing.ts src/data/fcs/dyeing-task-domain.ts
git commit -m "feat: add combined dyeing task lifecycle"
```

## 任务 7：处理生产单变更后的自动同步与快照保护

**文件：**

- 修改：`src/data/fcs/production-order-change-workflow.ts`
- 修改：`src/data/fcs/production-process-work-order-service.ts`
- 修改：`src/data/fcs/combined-dyeing-domain.ts`
- 修改：`scripts/check-production-order-changes.ts`
- 修改：`scripts/check-production-process-work-order-generation.ts`

- [ ] **步骤 1：写变更分流失败测试**

同一生产单准备三张场景加工单：未执行、已开始执行、已加入合并染色。断言：

- 未执行且未入合并任务：面料、颜色、工艺、数量、技术包版本自动同步。
- 已开始执行：保留原快照，增加变更影响提示。
- 已入合并任务：保留原快照，任务和加工单均增加变更影响提示。
- 未完成合并任务删除后：解除占用，再同步最新生产单快照。
- 变更不会改变加工单 `id/加工单号`。

- [ ] **步骤 2：运行并确认失败**

```bash
npm run check:production-order-changes
npm run check:production-process-work-order-generation
```

预期：尚未有加工单同步策略而失败。

- [ ] **步骤 3：实现同步判定**

在生成服务导出：

```ts
syncProcessWorkOrdersAfterProductionOrderChange(snapshot)
```

判定“已执行”以真实执行节点 / 状态为准，不新增“可投缸”门槛。未执行且没有活动合并成员关系时覆盖业务快照；否则仅写 `changeImpact`：变更前、变更后、影响原因、建议动作、记录时间。

在 `executeProductionChange()` 成功持久化分支之后调用同步入口；回滚和事实过期分支不得调用。

- [ ] **步骤 4：运行检查**

```bash
npm run check:production-order-changes
npm run check:production-process-work-order-generation
npm run check:combined-dyeing
npm run check:process-work-order-unification
```

预期：全部通过，加工单身份始终不变。

- [ ] **步骤 5：提交**

```bash
git add src/data/fcs/production-order-change-workflow.ts src/data/fcs/production-process-work-order-service.ts src/data/fcs/combined-dyeing-domain.ts scripts/check-production-order-changes.ts scripts/check-production-process-work-order-generation.ts
git commit -m "feat: sync work orders after production order changes"
```

## 任务 8：新增“合并染色”菜单、页面、路由和局部交互

**文件：**

- 新建：`src/pages/process-factory/dyeing/combined-dyeing.ts`
- 修改：`src/data/app-shell-config.ts`
- 修改：`src/router/route-renderers-fcs.ts`
- 修改：`src/router/routes-fcs.ts`
- 修改：`src/pages/process-factory/dyeing/events.ts`
- 修改：`src/main-handlers/fcs-handlers.ts`
- 修改：`scripts/check-combined-dyeing.ts`

- [ ] **步骤 1：先写导航和页面源码检查**

检查：

- “染厂管理”中“合并染色”紧跟“染色加工单”。
- `/fcs/craft/dyeing/combined-dyeing` 可达。
- 页面包含“创建合并染色”“完成染色”“更正染色结果”“删除任务”“查看已删除任务”。
- 页面使用 `renderTablePagination()`，列表默认每页 10 条。
- 创建表格明确显示平台加工单号，且没有加工单号输入框。

- [ ] **步骤 2：运行检查确认失败**

```bash
npm run check:combined-dyeing
```

预期：菜单 / 页面 / 路由尚不存在而失败。

- [ ] **步骤 3：实现列表、创建和详情**

页面结构：

- 顶部：标题、状态摘要、创建按钮、已删除筛选。
- 列表：任务号、染厂、面料、目标颜色、工艺、成员数、需求合计、实际产出、状态、创建 / 完成时间、操作。
- 创建抽屉：手工勾选生产单来源染色加工单；首张确定四项兼容条件，其余不兼容项展示原因并禁选；不显示“可投缸”校验。
- 详情抽屉：不可变成员、生产单顺序、需求量、有效分配、满足状态、未满足量、超出量、执行记录、更正历史、删除历史。

使用现有 `button.ts`、`badge.ts`、`drawer.ts`、`dialog.ts`、`table.ts`、`form.ts`、`pagination.ts`、`toast.ts`，不要引入 React 或新状态框架。

- [ ] **步骤 4：实现局部事件更新**

在页面根节点使用 `data-combined-dyeing-*` 属性。打开 / 关闭抽屉、选择成员、完成、更正、删除和翻页只替换对应列表 / 抽屉区域；输入事件不得触发 `root.innerHTML` 整页重绘。成功操作后局部刷新并 hydrate 新插入区域图标。

- [ ] **步骤 5：运行检查和构建并提交**

```bash
npm run check:combined-dyeing
npm run build
git add src/pages/process-factory/dyeing/combined-dyeing.ts src/data/app-shell-config.ts src/router/route-renderers-fcs.ts src/router/routes-fcs.ts src/pages/process-factory/dyeing/events.ts src/main-handlers/fcs-handlers.ts scripts/check-combined-dyeing.ts
git commit -m "feat: add combined dyeing workspace"
```

## 任务 9：在染色加工单列表和详情展示合并染色结果

**文件：**

- 修改：`src/pages/process-factory/dyeing/work-orders.ts`
- 修改：`src/pages/process-factory/dyeing/work-order-detail.ts`
- 修改：`src/pages/process-factory/dyeing/events.ts`
- 修改：`scripts/check-dyeing-workflow.ts`

- [ ] **步骤 1：增加联动展示失败检查**

检查加工单列表 / 详情必须展示：

- “已加入合并染色”徽标和任务号链接。
- 当前有效分配量。
- 已满足 / 部分满足 / 未满足。
- 未满足数量。
- 生产单变更影响提示。

同时断言加工单号只读且等于平台加工单号。

- [ ] **步骤 2：运行检查并确认失败**

```bash
npm run check:dyeing-workflow
```

预期：尚未展示合并信息而失败。

- [ ] **步骤 3：实现列表和详情投影**

列表增加紧凑徽标和任务链接，不增加第二套加工单状态。详情增加“合并染色”区块，展示任务事实和分配版本；已删除任务的历史只在历史区展示，不伪装成当前占用。

- [ ] **步骤 4：运行检查和构建**

```bash
npm run check:dyeing-workflow
npm run check:combined-dyeing
npm run check:process-work-order-unification
npm run build
```

预期：全部通过。

- [ ] **步骤 5：提交**

```bash
git add src/pages/process-factory/dyeing/work-orders.ts src/pages/process-factory/dyeing/work-order-detail.ts src/pages/process-factory/dyeing/events.ts scripts/check-dyeing-workflow.ts
git commit -m "feat: show combined dyeing results on work orders"
```

## 任务 10：浏览器验收、治理记录和文档收口

**文件：**

- 新建：`tests/combined-dyeing.spec.ts`
- 新建：`docs/prototype-review-records/2026-07-15-print-dye-work-order-and-combined-dyeing.md`
- 修改：`package.json`
- 修改：`docs/fcs-process-work-order-unification.md`

- [ ] **步骤 1：先写 E2E 场景**

`tests/combined-dyeing.spec.ts` 覆盖：

1. 菜单进入合并染色列表。
2. 创建时只能选择生产单来源；不兼容项有明确原因；加工单号来自平台且不可编辑。
3. 选择两张合计 1000 Yard 的加工单，完成填写投入与产出 800 Yard。
4. 验证按生产单时间先满足第一张，再给第二张 200 Yard，任务直接完成且无“继续染 / 补染”入口。
5. 更正产出后分配重算，旧版本仍在历史。
6. 删除已完成任务后历史仍可查，部分 / 未满足成员可重新选择。
7. 平台加工单列表与工厂端详情显示同一加工单号。

- [ ] **步骤 2：运行 E2E，确认缺失点再最小修正**

在 `package.json` 增加：

```json
"test:combined-dyeing:e2e": "playwright test tests/combined-dyeing.spec.ts"
```

运行：

```bash
npm run test:combined-dyeing:e2e
```

预期：首次运行暴露选择器或页面联动缺口；只修复与本计划验收场景直接相关的问题。

- [ ] **步骤 3：按项目规范完成审查记录**

阅读并逐项核对：

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`
- `docs/prototype-review-record-template.md`

审查记录至少说明：染厂主管角色、Web 管理端、加工单身份防错、四项兼容校验、短产终止、更正与删除留痕、分页、中文状态、局部更新和异常提示。不得把后台真实状态机或数据库设计写进原型记录。

- [ ] **步骤 4：运行完整验证**

```bash
npm run check:production-process-work-order-generation
npm run check:process-work-order-unification
npm run check:printing-workflow
npm run check:dyeing-workflow
npm run check:combined-dyeing
npm run check:production-order-changes
npm run check:prototype-design-governance
npm run build
npm run test:process-work-order-unification:e2e
npm run test:combined-dyeing:e2e
codegraph sync
codegraph status
git status --short
```

预期：所有检查、构建和 E2E 通过；CodeGraph 无 pending sync；`git status --short` 只显示本任务有意修改，提交后为空。

- [ ] **步骤 5：进行真实页面人工验收**

启动：

```bash
npm run dev -- --host 0.0.0.0 --port 4173
```

用浏览器实际检查：

- `/fcs/process/dye-orders`
- `/fcs/process/print-orders`
- `/fcs/craft/dyeing/work-orders`
- `/fcs/craft/dyeing/combined-dyeing`

确认菜单、分页、抽屉 / 弹窗、输入过程、完成 / 更正 / 删除、返回列表、加工单任务链接均无整页闪烁和滚动丢失，交互响应不超过 200ms。再用局域网 IP 访问并 `curl -I` 验证 200。

- [ ] **步骤 6：更新文档并提交**

`docs/fcs-process-work-order-unification.md` 明确写入：

```text
生产单 -> 平台染色 / 印花加工单 -> PFOS Web / PDA 共用同一加工单 ID 和加工单号
```

并说明合并染色只合并执行动作，不合并加工单。

提交：

```bash
git add tests/combined-dyeing.spec.ts docs/prototype-review-records/2026-07-15-print-dye-work-order-and-combined-dyeing.md docs/fcs-process-work-order-unification.md package.json
git commit -m "test: verify combined dyeing workflow"
```

## 完成前自检

- [ ] 文件范围与任务步骤一一对应，没有待办占位符、占位路径或未定义的“相关文件”。
- [ ] 新旧类型名称一致：生产单来源 / 备货来源、待分配工厂、待染色 / 已完成 / 已删除、已满足 / 部分满足 / 未满足。
- [ ] 没有重新引入染色需求单、印花需求单或需求单号。
- [ ] 没有允许一张加工单关联多个生产单，也没有允许同一生产单拆多张同类加工单。
- [ ] 没有“多次投缸”“继续染”“补染”或人工调整分配顺序。
- [ ] 没有为工厂端新增加工单编号函数；所有工厂页面 / PDA 均消费平台 `id/单号`。
- [ ] 按备货创建仍可用，但不能参加合并染色且不伪造生产单。
- [ ] 已执行事实、更正前后、删除和分配历史均可追溯。
- [ ] 页面列表有分页，输入不整页重绘，中文状态无英文码直出。
- [ ] 原型治理检查、构建、领域检查、E2E、真实页面和 CodeGraph 同步均有新鲜证据。
