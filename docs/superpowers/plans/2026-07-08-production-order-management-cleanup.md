# 生产单管理计划/状态/交付仓清理实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 从 FCS 生产单管理中彻底删除「生产单计划」「状态管理」「交付仓配置」三个概念及其底层字段。

**架构：** 先增加一个失败的清洁检查脚本，锁定菜单、路由、页面模块、事件动作、类型字段和关键展示文案不得残留。再按依赖顺序删除导航路由、页面模块、事件状态、生产单数据字段和下游展示，最后更新既有检查脚本与原型审查记录。

**技术栈：** Vite + TypeScript + Vanilla TS 字符串模板；检查脚本使用 `node --experimental-strip-types --experimental-specifier-resolution=node` 或现有 `tsx`。

---

## 文件职责

- 创建 `scripts/check-production-order-management-cleanup.ts`：集中断言三个概念已经从菜单、路由、页面模块、事件、类型和主要展示位置删除。
- 修改 `package.json`：新增 `check:production-order-management-cleanup` 脚本。
- 修改 `src/data/app-shell-config.ts`：删除三个菜单项。
- 修改 `src/router/routes-fcs.ts`、`src/router/route-renderers-fcs.ts`、`src/router/route-renderers.ts`：删除三个路由 renderer 的导入、导出和路由项。
- 删除 `src/pages/production/plan-domain.ts`、`src/pages/production/status-domain.ts`、`src/pages/production/delivery-domain.ts`。
- 修改 `src/pages/production/context.ts`：删除计划表单、交付仓表单、生命周期状态标签/样式/筛选、导出绑定。
- 修改 `src/pages/production/events.ts`：删除计划、交付仓、生命周期状态专属事件分支。
- 修改 `src/data/fcs/production-orders.ts`：从 `ProductionOrder`、`ProductionOrderSeed`、mock seeds 中删除 `plan*`、`deliveryWarehouse*`、`lifecycle*` 字段。
- 修改受影响展示文件：删除只展示计划、交付仓、生命周期状态的 UI。
  - `src/pages/print/templates/production-material-confirmation-template.ts`
  - `src/pages/capacity.ts`
  - `src/pages/production-order-progress-tracking.ts`
  - `src/pages/production/detail-domain.ts`
  - `src/components/production-object-overview.ts`
- 修改检查脚本：
  - `scripts/check-production-preparation-timing.ts`
  - `scripts/check-production-order-tech-pack-column.ts`
  - `scripts/check-production-order-ledger-row.ts`
  - `scripts/check-production-order-identity-column.ts`
- 创建 `docs/prototype-review-records/2026-07-08-production-order-management-cleanup.md`：记录本次原型治理自查。

## 任务 1：添加失败的清洁检查

**文件：**
- 创建：`scripts/check-production-order-management-cleanup.ts`
- 修改：`package.json`

- [ ] **步骤 1：编写失败检查脚本**

创建 `scripts/check-production-order-management-cleanup.ts`：

```typescript
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

function read(path: string): string {
  assert.ok(existsSync(path), `${path} 不存在`)
  return readFileSync(path, 'utf8')
}

function assertNotIncludes(path: string, text: string, reason: string): void {
  assert.ok(!read(path).includes(text), reason)
}

function assertMissing(path: string): void {
  assert.ok(!existsSync(path), `${path} 应删除`)
}

const removedLabels = ['生产单计划', '状态管理', '交付仓配置']
const removedRoutes = ['/fcs/production/plan', '/fcs/production/status', '/fcs/production/delivery']
const removedFields = [
  'planStartDate',
  'planEndDate',
  'planStatus',
  'planQty',
  'planFactoryId',
  'planFactoryName',
  'planRemark',
  'planUpdatedAt',
  'planUpdatedBy',
  'deliveryWarehouseId',
  'deliveryWarehouseName',
  'deliveryWarehouseStatus',
  'deliveryWarehouseRemark',
  'deliveryWarehouseUpdatedAt',
  'deliveryWarehouseUpdatedBy',
  'lifecycleStatus',
  'lifecycleStatusRemark',
  'lifecycleUpdatedAt',
  'lifecycleUpdatedBy',
]
const removedActions = [
  'open-plan-edit',
  'save-plan-edit',
  'release-plan',
  'open-delivery-edit',
  'save-delivery-edit',
  'open-status-change',
  'save-status-change',
]

assertMissing('src/pages/production/plan-domain.ts')
assertMissing('src/pages/production/status-domain.ts')
assertMissing('src/pages/production/delivery-domain.ts')

for (const label of removedLabels) {
  assertNotIncludes('src/data/app-shell-config.ts', label, `菜单仍包含 ${label}`)
  assertNotIncludes('src/router/routes-fcs.ts', label, `路由仍包含 ${label}`)
}

for (const route of removedRoutes) {
  assertNotIncludes('src/data/app-shell-config.ts', route, `菜单仍包含 ${route}`)
  assertNotIncludes('src/router/routes-fcs.ts', route, `路由仍包含 ${route}`)
}

for (const field of removedFields) {
  assertNotIncludes('src/data/fcs/production-orders.ts', field, `生产单数据仍包含 ${field}`)
  assertNotIncludes('src/pages/production/context.ts', field, `生产上下文仍包含 ${field}`)
}

for (const action of removedActions) {
  assertNotIncludes('src/pages/production/events.ts', action, `生产事件仍包含 ${action}`)
}

for (const path of [
  'src/pages/print/templates/production-material-confirmation-template.ts',
  'src/pages/capacity.ts',
  'src/pages/production-order-progress-tracking.ts',
  'src/pages/production/detail-domain.ts',
  'src/components/production-object-overview.ts',
]) {
  for (const label of ['交付仓', '计划状态', '生命周期']) {
    assertNotIncludes(path, label, `${path} 仍展示 ${label}`)
  }
}

console.log('production order management cleanup check passed')
```

- [ ] **步骤 2：把脚本接入 package.json**

在 `package.json` 的 `scripts` 中加入：

```json
"check:production-order-management-cleanup": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-production-order-management-cleanup.ts"
```

- [ ] **步骤 3：运行检查验证失败**

运行：

```bash
npm run check:production-order-management-cleanup
```

预期：FAIL，至少报 `src/pages/production/plan-domain.ts 应删除` 或菜单仍包含「生产单计划」。

- [ ] **步骤 4：Commit**

```bash
git add package.json scripts/check-production-order-management-cleanup.ts
git commit -m "test: guard production order cleanup"
```

## 任务 2：删除菜单和路由入口

**文件：**
- 修改：`src/data/app-shell-config.ts`
- 修改：`src/router/routes-fcs.ts`
- 修改：`src/router/route-renderers-fcs.ts`
- 修改：`src/router/route-renderers.ts`

- [ ] **步骤 1：删除菜单项**

在 `src/data/app-shell-config.ts` 的 `fcs-platform-production` 分组中删除 key 或 title 对应以下入口的对象：

```typescript
'production-plan'
'production-delivery-warehouse'
'production-status'
```

同时删除 href：

```typescript
'/fcs/production/plan'
'/fcs/production/delivery'
'/fcs/production/status'
```

- [ ] **步骤 2：删除路由 renderer 绑定**

在 `src/router/routes-fcs.ts` 删除三个 exact route：

```typescript
'/fcs/production/plan': () => renderProductionPlanPage()
'/fcs/production/delivery': () => renderProductionDeliveryPage()
'/fcs/production/status': () => renderProductionStatusPage()
```

并删除对应 import。实际函数名以文件当前导出为准，用以下命令定位：

```bash
rg -n "renderProduction.*(Plan|Delivery|Status)" src/router src/pages/production
```

- [ ] **步骤 3：删除聚合导出**

从 `src/router/route-renderers-fcs.ts` 和 `src/router/route-renderers.ts` 删除三个 renderer 的导入和导出行。删除后运行：

```bash
rg -n "renderProduction.*(Plan|Delivery|Status)|/fcs/production/(plan|delivery|status)" src/router src/data/app-shell-config.ts
```

预期：无输出。

- [ ] **步骤 4：运行菜单路由检查**

运行：

```bash
npm run check:menu-routes
```

预期：PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/data/app-shell-config.ts src/router/routes-fcs.ts src/router/route-renderers-fcs.ts src/router/route-renderers.ts
git commit -m "fix: remove obsolete production order routes"
```

## 任务 3：删除三个专属页面模块

**文件：**
- 删除：`src/pages/production/plan-domain.ts`
- 删除：`src/pages/production/status-domain.ts`
- 删除：`src/pages/production/delivery-domain.ts`
- 修改：`src/pages/production/context.ts`
- 修改：`src/pages/production/events.ts`

- [ ] **步骤 1：删除页面文件**

运行：

```bash
rm src/pages/production/plan-domain.ts src/pages/production/status-domain.ts src/pages/production/delivery-domain.ts
```

- [ ] **步骤 2：删除 context 中的页面导出引用**

在 `src/pages/production/context.ts` 删除对三个 domain 的导入、导出对象挂载和 render 分发引用。用命令确认：

```bash
rg -n "plan-domain|status-domain|delivery-domain|renderProductionPlan|renderProductionStatus|renderProductionDelivery" src/pages/production/context.ts src/pages/production/events.ts
```

预期：无输出。

- [ ] **步骤 3：删除 events 中的页面模块引用**

在 `src/pages/production/events.ts` 删除对三个页面相关 helper 的 import。删除后运行：

```bash
rg -n "Plan|Delivery|Status" src/pages/production/events.ts
```

预期：只允许保留与生产单基础 `status`、生产单变更或其他有效业务相关的命中；不得出现 `planForm`、`deliveryForm`、`lifecycleStatusLabel`、`statusDialogOpen`。

- [ ] **步骤 4：运行清洁检查验证仍失败在字段和事件**

运行：

```bash
npm run check:production-order-management-cleanup
```

预期：FAIL，剩余错误应集中在 `ProductionOrder` 字段、`events.ts` 动作或下游展示。

- [ ] **步骤 5：Commit**

```bash
git add src/pages/production/context.ts src/pages/production/events.ts
git rm src/pages/production/plan-domain.ts src/pages/production/status-domain.ts src/pages/production/delivery-domain.ts
git commit -m "fix: remove production order auxiliary pages"
```

## 任务 4：清理生产页面状态和事件动作

**文件：**
- 修改：`src/pages/production/context.ts`
- 修改：`src/pages/production/events.ts`

- [ ] **步骤 1：删除 context 状态类型**

从 `src/pages/production/context.ts` 删除以下接口、常量、状态字段和导出：

```typescript
interface PlanForm
interface DeliveryForm
const PLAN_EMPTY_FORM
const DELIVERY_EMPTY_FORM
const lifecycleStatusLabel
const lifecycleStatusClass
planStatusFilter
planEditOrderId
planForm
deliveryEditOrderId
deliveryForm
statusFilter
statusDialogOpen
statusSelectedOrderId
statusNext
statusRemark
```

如果 `statusFilter` 同时被生产单列表基础状态使用，不删除基础状态筛选，只删除生命周期状态管理页专属字段。用 `rg -n "statusFilter" src/pages/production` 区分调用点。

- [ ] **步骤 2：删除生命周期 helper**

删除只服务「状态管理」页的 helper：

```typescript
deriveLifecycleStatus
lifecycleAllowedNext
```

保留生产单基础 `status` 的 label/config。

- [ ] **步骤 3：删除 events 动作分支**

从 `src/pages/production/events.ts` 删除以下 `if (action === ...)` 分支：

```typescript
open-plan-edit
close-plan-edit
save-plan-edit
release-plan
open-delivery-edit
close-delivery-edit
save-delivery-edit
open-status-change
close-status-change
save-status-change
```

并删除只服务这些分支的 helper import 或局部函数，例如计划工厂选项、`deriveLifecycleStatus`、`lifecycleAllowedNext`。

- [ ] **步骤 4：运行 TypeScript 构建定位残留引用**

运行：

```bash
npm run build
```

预期：如果失败，只允许是已删除状态/函数的引用错误。按错误逐个删除残留调用，不引入新抽象或空值兜底。

- [ ] **步骤 5：运行清洁检查**

运行：

```bash
npm run check:production-order-management-cleanup
```

预期：仍可能 FAIL 在 `src/data/fcs/production-orders.ts` 和下游展示文件，不应再 FAIL 在 `src/pages/production/context.ts` 或 `src/pages/production/events.ts`。

- [ ] **步骤 6：Commit**

```bash
git add src/pages/production/context.ts src/pages/production/events.ts
git commit -m "fix: remove production order plan and status actions"
```

## 任务 5：删除生产单数据字段和 mock seed

**文件：**
- 修改：`src/data/fcs/production-orders.ts`
- 修改：`src/pages/production/demand-domain.ts`

- [ ] **步骤 1：从类型删除字段**

在 `src/data/fcs/production-orders.ts` 中，从 `ProductionOrder` 和 `ProductionOrderSeed` 删除规格列出的 `plan*`、`deliveryWarehouse*`、`lifecycle*` 字段。保留 `status: ProductionOrderStatus`。

- [ ] **步骤 2：从 mock seed 删除字段**

运行：

```bash
rg -n "plan(StartDate|EndDate|Status|Qty|Factory|Remark|Updated)|deliveryWarehouse|lifecycle" src/data/fcs/production-orders.ts
```

删除所有命中字段赋值。预期该命令最终无输出。

- [ ] **步骤 3：调整需求转生产单默认值**

在 `src/pages/production/demand-domain.ts` 中删除创建生产单时写入的字段：

```typescript
planStatus: 'UNPLANNED'
deliveryWarehouseStatus: 'UNSET'
lifecycleStatus: 'PLANNED'
```

删除后运行：

```bash
rg -n "planStatus|deliveryWarehouseStatus|lifecycleStatus" src/pages/production/demand-domain.ts
```

预期：无输出。

- [ ] **步骤 4：运行领域相关检查**

运行：

```bash
npm run check:fcs-upstream-cutting-chain
npm run check:fcs-task-generation-rules
npm run check:production-order-changes
```

预期：全部 PASS。若失败原因是测试仍断言已删字段，更新测试删除对应断言；若失败原因是生产单核心状态 `status` 被误删，恢复 `status`。

- [ ] **步骤 5：Commit**

```bash
git add src/data/fcs/production-orders.ts src/pages/production/demand-domain.ts
git commit -m "fix: remove production order planning fields"
```

## 任务 6：删除下游页面和模板中的展示

**文件：**
- 修改：`src/pages/print/templates/production-material-confirmation-template.ts`
- 修改：`src/pages/capacity.ts`
- 修改：`src/pages/production-order-progress-tracking.ts`
- 修改：`src/pages/production/detail-domain.ts`
- 修改：`src/components/production-object-overview.ts`

- [ ] **步骤 1：删除打印模板展示**

在 `src/pages/print/templates/production-material-confirmation-template.ts` 删除仅展示交付仓、交付方式、生命周期状态的字段块，例如：

```typescript
{ label: '交付仓', value: order.deliveryWarehouseName || '待确认' }
{ label: '交付方式', value: order.deliveryWarehouseStatus === 'SET' ? '交付仓已设置' : '待跟单确认' }
```

保留生产单基础状态展示：

```typescript
{ label: '生产单状态', value: productionOrderStatusConfig[order.status]?.label || order.status }
```

- [ ] **步骤 2：删除产能页展示**

在 `src/pages/capacity.ts` 删除读取 `order.deliveryWarehouse*`、`order.plan*`、`order.lifecycle*` 的列、卡片或详情行。保留工厂、任务、工艺、产能负载相关展示。

- [ ] **步骤 3：删除进度页展示**

在 `src/pages/production-order-progress-tracking.ts` 删除 `deliveryWarehouse` 字段及展示行。若 mock 记录类型包含：

```typescript
deliveryWarehouse: string
```

删除类型字段、mock 数据赋值和渲染位置。

- [ ] **步骤 4：删除详情与生产对象概览展示**

在 `src/pages/production/detail-domain.ts` 和 `src/components/production-object-overview.ts` 删除「交付仓」「计划状态」「生命周期」相关展示。保留需求、主工厂、任务拆解、技术包、交接、仓储事实。

- [ ] **步骤 5：确认无字段残留**

运行：

```bash
rg -n "plan(StartDate|EndDate|Status|Qty|Factory|Remark|Updated)|deliveryWarehouse|lifecycleStatus|生产单计划|交付仓配置|状态管理|计划状态|生命周期|交付仓" src scripts
```

预期：只允许历史无关脚本或已更新检查脚本中出现“不得包含”的断言；源码页面和数据文件不得继续使用这些字段或展示文案。

- [ ] **步骤 6：运行构建**

运行：

```bash
npm run build
```

预期：PASS。

- [ ] **步骤 7：Commit**

```bash
git add src/pages/print/templates/production-material-confirmation-template.ts src/pages/capacity.ts src/pages/production-order-progress-tracking.ts src/pages/production/detail-domain.ts src/components/production-object-overview.ts
git commit -m "fix: remove obsolete production order displays"
```

## 任务 7：更新检查脚本和治理记录

**文件：**
- 修改：`scripts/check-production-preparation-timing.ts`
- 修改：`scripts/check-production-order-tech-pack-column.ts`
- 修改：`scripts/check-production-order-ledger-row.ts`
- 修改：`scripts/check-production-order-identity-column.ts`
- 创建：`docs/prototype-review-records/2026-07-08-production-order-management-cleanup.md`

- [ ] **步骤 1：更新生产准备时效菜单断言**

在 `scripts/check-production-preparation-timing.ts` 中删除对 `production-plan`、`production-delivery-warehouse` 的存在和排序断言。替换为：

```typescript
const demandIndex = productionMenu.indexOf('production-demands')
const ordersIndex = productionMenu.indexOf('production-orders')
const timingIndex = productionMenu.indexOf('production-preparation-timing')
const timingStatsIndex = productionMenu.indexOf('production-preparation-timing-statistics')
const changesIndex = productionMenu.indexOf('production-changes')
assert.ok(demandIndex >= 0, '生产单管理菜单缺少生产需求单')
assert.ok(ordersIndex >= 0, '生产单管理菜单缺少生产单管理')
assert.ok(timingIndex >= 0, '生产单管理菜单缺少生产准备时效')
assert.ok(timingStatsIndex >= 0, '生产单管理菜单缺少生产准备时效统计')
assert.ok(changesIndex >= 0, '生产单管理菜单缺少生产单变更')
assert.ok(
  ordersIndex < timingIndex && timingIndex < timingStatsIndex && timingStatsIndex < changesIndex,
  '生产准备时效统计必须位于生产准备时效之后、生产单变更之前',
)
```

- [ ] **步骤 2：补充生产单管理旧概念不得出现的断言**

在三个生产单管理检查脚本中加入：

```typescript
;['生产单计划', '交付仓配置', '状态管理', '计划状态', '生命周期', '交付仓'].forEach((label) => {
  assert(!html.includes(label), `生产单管理不得展示：${label}`)
})
```

只加在已经拥有 `html = renderProductionOrdersPage()` 的脚本中；没有渲染 HTML 的脚本用 `readFileSync` 检查页面源码。

- [ ] **步骤 3：新增原型审查记录**

创建 `docs/prototype-review-records/2026-07-08-production-order-management-cleanup.md`，内容：

```markdown
# HiGood 原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-08 |
| 相关需求 / 任务 | 删除生产单计划、状态管理、交付仓配置 |
| 涉及系统 | FCS |
| 涉及页面路径 | `/fcs/production/orders`、生产单管理菜单 |
| 端类型 | 管理端 / 主管端 |
| 主要角色 | 跟单、生产管理、工厂协同主管 |
| 主要任务 | 聚焦生产单真实链路，删除不再维护的计划、生命周期状态和交付仓配置能力 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 删除无效管理入口，保留生产单管理和生产单变更等有效入口。 |
| 任务清晰度 | 通过 | 菜单不再暴露不维护的计划、状态、交付仓配置任务。 |
| 信息架构与导航 | 通过 | 删除死入口，保留生产准备时效和生产单变更。 |
| 页面模式 | 通过 | 不新增页面模式。 |
| 信息负荷 | 通过 | 减少无效字段和入口。 |
| 文案 | 通过 | 删除不再使用的页面文案。 |
| 数量与状态 | 通过 | 保留生产单基础状态和任务事实，不展示生命周期状态。 |
| 扫码与识别 | 通过 | 不涉及扫码。 |
| 防错 | 通过 | 避免用户进入无效配置页产生错误理解。 |
| UI 样式 | 通过 | 不新增样式。 |
| 组件交互 | 通过 | 删除无效表单和动作。 |
| 协作关系 | 通过 | 保留生产单、任务、变更、准备、交接等真实协作事实。 |
| 异常与追溯 | 通过 | 不删除生产单变更和任务追溯。 |
| 现场设备可用性 | 通过 | 菜单更短，低分辨率入口负担降低。 |

## 4. 问题标签

- `协作断裂`
- `状态抽象`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 生产单计划、状态管理、交付仓配置已不作为有效协作链路维护。 | `协作断裂` | 跟单、生产管理 | 删除入口、页面、事件和数据字段。 | 否 |
| 生命周期状态与生产单基础状态、任务事实并存，容易制造抽象状态噪音。 | `状态抽象` | 跟单、主管 | 删除生命周期状态展示，保留真实任务和变更事实。 | 否 |

## 6. 最终结论

结论：通过

说明：

- 本次删除无效配置能力，不新增替代页面。
- 生产单管理继续围绕生产单、需求、任务拆解、生产准备和变更事实演示。
```

- [ ] **步骤 4：运行检查脚本**

运行：

```bash
npm run check:production-preparation-timing
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-production-order-tech-pack-column.ts
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-production-order-ledger-row.ts
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-production-order-identity-column.ts
npm run check:production-order-management-cleanup
npm run check:prototype-design-governance -- --all
```

预期：全部 PASS。

- [ ] **步骤 5：Commit**

```bash
git add scripts/check-production-preparation-timing.ts scripts/check-production-order-tech-pack-column.ts scripts/check-production-order-ledger-row.ts scripts/check-production-order-identity-column.ts docs/prototype-review-records/2026-07-08-production-order-management-cleanup.md
git commit -m "test: update production order cleanup checks"
```

## 任务 8：最终验证和浏览器检查

**文件：**
- 修改：无，除非验证发现遗漏

- [ ] **步骤 1：同步 CodeGraph**

运行：

```bash
codegraph sync && codegraph status
```

预期：`Index is up to date`。

- [ ] **步骤 2：运行最终命令**

运行：

```bash
npm run check:menu-routes
npm run check:production-order-management-cleanup
npm run check:production-order-changes
npm run check:fcs-upstream-cutting-chain
npm run check:prototype-design-governance -- --all
npm run build
```

预期：全部 PASS。

- [ ] **步骤 3：启动本地预览**

运行：

```bash
npm run preview -- --host 127.0.0.1 --port 4173
```

预期：输出 `Local: http://127.0.0.1:4173/`。

- [ ] **步骤 4：用 Playwright 验证生产单管理**

运行：

```bash
node --input-type=module <<'NODE'
import { chromium } from 'playwright'
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(message.text())
})
await page.goto('http://127.0.0.1:4173/fcs/production/orders', { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => (document.querySelector('#app')?.textContent || '').includes('生产单管理'), null, { timeout: 10000 })
const text = await page.locator('#app').innerText()
await browser.close()
for (const label of ['生产单计划', '交付仓配置', '状态管理', '计划状态', '生命周期', '交付仓']) {
  if (text.includes(label)) throw new Error(`页面仍出现 ${label}`)
}
if (errors.length) throw new Error(errors.join(' | '))
console.log('browser production order cleanup check passed')
NODE
```

预期：输出 `browser production order cleanup check passed`。

- [ ] **步骤 5：关闭预览服务**

停止 `npm run preview` 进程，确认没有遗留必须结束的终端会话。

- [ ] **步骤 6：最终确认**

如果浏览器检查导致补充修复，先用下列命令查看实际变更文件：

```bash
git status --short
```

把 `git status --short` 输出中的源码、脚本或文档文件按实际路径显式加入暂存区，不使用 `git add -A`。例如只修复生产单详情和检查脚本时运行：

```bash
git add src/pages/production/detail-domain.ts scripts/check-production-order-management-cleanup.ts
git commit -m "fix: finish production order cleanup"
```

如果没有新变更，运行：

```bash
git status --short
```

预期：工作区干净。
