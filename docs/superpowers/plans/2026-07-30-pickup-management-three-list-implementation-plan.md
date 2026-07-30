# 领料管理三列表实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers-zh:subagent-driven-development`（推荐）或 `superpowers-zh:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 将 PFOS 的“领料管理”提升为一级菜单，落地“已配齐待领料、未配齐配料、已领料”三个独立标准列表页，并让列表直接表达物料、加工完成量、补料、库位/托盘、累计领料及最终是否全部领完。

**架构：** 保留现有生产单级配料单、活动领料节点、领料会话和 PDA 统一领料入口；新增一个只读的“领料管理展示投影”，统一组合正常物料需求、补料记录、染色/印花结果、当前活动节点和历史领料会话。三个页面只筛选同一投影，不各自计算业务口径。当前原型继续使用 Vanilla TypeScript 字符串模板和本地 Mock 数据，不引入后端、React、状态管理或新的基础设施。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有标准列表页组件、Node.js 断言检查、Playwright、CodeGraph。

**设计依据：** `docs/superpowers/specs/2026-07-30-pickup-management-three-list-design.md`

---

## 1. 文件范围与职责

### 新建文件

- `src/pages/process-factory/cutting/pickup-management-projection.ts`
  - 定义领料管理的物料需求行、生产单分组、当前承载位置、领料路径和最终结果。
  - 组合正常需求、补料记录、加工结果、活动节点与历史领料记录。
  - 输出三个列表共用的只读投影。
- `src/pages/process-factory/cutting/pickup-management-list.ts`
  - 使用现有标准列表页组件渲染三个独立页面。
  - 负责筛选、排序、按生产单分页、列设置和局部更新。
  - 不重新计算应配数量、累计领料或最终完成状态。
- `scripts/check-cutting-pickup-three-list.ts`
  - 自动验证菜单、路由、三列表、业务投影、补料、加工口径、库位/托盘和历史最终状态。
- `tests/cutting-pickup-three-list.spec.ts`
  - 在浏览器中验证三个菜单入口、生产单分组、物料行直接可见、未配齐领料入口和已领料结果标签。
- `docs/prototype-review-records/2026-07-30-pickup-management-three-list.md`
  - 记录印尼工厂产品设计规范与原型审查清单的自查结果。

### 修改文件

- `src/data/fcs/cutting/pickup-node-domain.ts`
  - 增加活动节点当前承载方式、无编号托盘和由未配齐升级已配齐的来源事实。
- `src/data/fcs/cutting/production-material-prep.ts`
  - 为活动节点派生当前承载方式。
  - 保持一个库位只属于一个生产单、一个生产单可有多个库位。
  - 保持领取活动节点时必须一次领取该节点全部物料和全部位置。
- `src/pages/process-factory/cutting/pickup-management.ts`
  - 保留详情页与统一事件入口。
  - 将三个列表页渲染和列表交互委托给新列表模块。
  - 旧入口兼容跳转到“已配齐待领料”。
- `src/pages/process-factory/cutting/supplement-management.ts`
  - 仅补充面向领料投影的只读导出类型，不改补料确认、加工单生成和现有页面交互。
- `src/pages/process-factory/cutting/meta.ts`
  - 增加三个领料列表页元数据，保留详情页和旧入口别名。
- `src/data/app-shell-config.ts`
  - 从“裁前准备”移除旧的“领料管理”子菜单。
  - 在“裁床厂管理”下新增独立一级“领料管理”，包含三个二级菜单。
- `src/router/route-renderers-fcs.ts`
  - 注册三个异步页面渲染器。
- `src/router/routes-fcs.ts`
  - 注册三个规范路由，并让旧路由跳转到“已配齐待领料”。
- `src/main-handlers/fcs-handlers.ts`
  - 让三个规范路由共用领料管理事件处理器，并删除重复分支。
- `scripts/check-material-prep-pickup-management.ts`
  - 更新旧检查：未配齐节点必须有当前库位；已配齐节点必须显示托盘承载，不能再强制要求当前库位。
- `scripts/check-cutting-pickup-node-domain.ts`
  - 增加当前承载方式和升级释放库位的断言。
- `scripts/check-cutting-pickup-data-closure.ts`
  - 增加补料重开、逐需求行完成和最终全部领完断言。
- `scripts/check-cutting-pickup-important-regressions.ts`
  - 增加多库位、相同 SKU 多需求来源和单位不可抵消的回归断言。
- `scripts/check-cutting-pickup-ui-closure.ts`
  - 更新页面标题、列表列名、菜单和路由静态闭环检查。
- `tests/cutting-pickup-node-flow.spec.ts`
  - 保留 PDA 统一领料流程，更新从新列表进入 PDA 的入口断言。
- `package.json`
  - 增加三列表专项检查和 Playwright 命令。

### 明确不修改

- 不改变 PDA 的统一“领料任务”入口。
- 不把三个 Web 列表拆成三套活动节点或领料会话数据。
- 不新增托盘编号必填规则；当前展示“待领托盘（暂未编号）”。
- 不修改补料的确认规则、冻结技术包校验或染色/印花加工单事务。
- 不做数据库、接口、权限或状态管理体系设计。

---

## 2. 统一业务契约

实现前先固定以下类型，后续页面、检查和 Mock 数据都使用同一口径：

```ts
export type PickupListKind = 'READY' | 'INCOMPLETE' | 'HISTORY'
export type PickupDemandSource = 'NORMAL' | 'SUPPLEMENT'
export type PickupProcessRoute = 'NONE' | 'DYE' | 'DYE_PRINT'
export type PickupCarrierType = 'WAREHOUSE_LOCATIONS' | 'PALLET'
export type PickupReadySource = 'DIRECT_READY' | 'UPGRADED_FROM_INCOMPLETE'
export type PickupHistoryPath = 'READY_PICKUP' | 'INCOMPLETE_PICKUP'
export type PickupFinalResult =
  | 'ALL_PICKED'
  | 'NOT_ALL_PICKED'
  | 'NEW_SUPPLEMENT_WAIT_PICKUP'

export interface PickupMaterialDemandRow {
  demandLineId: string
  demandSource: PickupDemandSource
  demandSourceNo: string
  demandSequence: number
  supplementReason: string
  materialSku: string
  materialName: string
  materialImageUrl: string
  materialType: string
  color: string
  spec: string
  unit: string
  processRoute: PickupProcessRoute
  processBasisLabel: string
  requiredQty: number
  preparedQty: number
  pickedQty: number
  remainingPickupQty: number
  currentAvailableQty: number
  currentLocations: PickupNodeSourceLocation[]
}

export interface PickupOrderGroup {
  productionOrderId: string
  productionOrderNo: string
  prepOrderId: string
  prepOrderNo: string
  listKind: PickupListKind
  materialRows: PickupMaterialDemandRow[]
  carrierType: PickupCarrierType
  palletId: string
  palletDisplayLabel: string
  readySource: PickupReadySource | null
  historyPath: PickupHistoryPath | null
  finalResult: PickupFinalResult | null
  pickupSessionCount: number
  latestPickedAt: string
}
```

强制不变量：

- 正常需求和每一次补料都是独立需求行；相同 SKU 不合并。
- 无加工时，应配数量取计划数量。
- 只染色时，应配数量取染色最终完成数量。
- 先染色再印花时，应配数量取印花最终完成数量。
- 染色和印花都只接受一次性完成结果；过程中的部分产量不能成为应配数量。
- 未配齐列表的当前位置必须是中转仓库位；一个库位只能属于一个生产单。
- 同一生产单可以有多个库位；同一物料可以分布在多个库位。
- 已配齐列表的当前承载方式必须是托盘；无编号时显示“待领托盘（暂未编号）”。
- 从未配齐升级已配齐后，旧库位不再作为当前位置展示。
- 一次领料必须领取活动节点全部物料、全部数量和全部当前库位，不提供行级、数量级或库位级勾选。
- 历史列表按生产单分组；分页对象是生产单，不能把一个生产单的物料行拆到两页。
- 历史路径和最终结果是两个不同字段：“未配齐先领”可以最终“全部领完”。
- 新增有效补料后，即使原需求已全部领完，生产单最终结果也要重开为“新增补料待领”。
- 所有数量必须携带单位；不同单位不得相加或互相抵消。

---

## 3. 实施任务

### 任务 1：先建立三列表专项检查和投影契约

**文件：**

- 新建：`scripts/check-cutting-pickup-three-list.ts`
- 新建：`src/pages/process-factory/cutting/pickup-management-projection.ts`
- 修改：`package.json`

- [ ] 1.1 在 `package.json` 增加专项命令：

```json
"check:cutting-pickup-three-list": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-pickup-three-list.ts",
"check:cutting-pickup-three-list-e2e": "playwright test tests/cutting-pickup-three-list.spec.ts"
```

- [ ] 1.2 先创建失败检查，导入尚未存在的投影函数并声明核心场景：

```ts
import {
  listPickupOrderGroups,
  type PickupOrderGroup,
} from '../src/pages/process-factory/cutting/pickup-management-projection.ts'

const readyGroups = listPickupOrderGroups('READY')
const incompleteGroups = listPickupOrderGroups('INCOMPLETE')
const historyGroups = listPickupOrderGroups('HISTORY')

assert(readyGroups.length > 0, '必须存在已配齐待领料生产单')
assert(incompleteGroups.length > 0, '必须存在未配齐可领生产单')
assert(historyGroups.length > 0, '必须存在已领料生产单')
assert(
  [...readyGroups, ...incompleteGroups, ...historyGroups]
    .every((group: PickupOrderGroup) => group.materialRows.length > 0),
  '每个生产单分组必须直接带出物料需求行',
)
```

- [ ] 1.3 运行检查并确认先失败：

```bash
npm run check:cutting-pickup-three-list
```

预期：因 `pickup-management-projection.ts` 尚未导出完整实现而失败。

- [ ] 1.4 在 `pickup-management-projection.ts` 写入第 2 节的类型，并先实现只读函数签名：

```ts
export function listPickupOrderGroups(
  listKind: PickupListKind,
  storage: Storage | null = typeof localStorage === 'undefined' ? null : localStorage,
): PickupOrderGroup[] {
  return buildPickupOrderGroups(listKind, storage)
}
```

- [ ] 1.5 只接入现有 `listMaterialPrepOrderProjections()`、`listActivePickupNodes()` 和领料会话，先让三类分组有稳定主键：

```ts
const groupKey = (productionOrderId: string) => productionOrderId
```

禁止用领料会话号作为历史列表行主键，否则同一生产单会出现多组。

- [ ] 1.6 运行专项检查，确认基础分组断言通过。

- [ ] 1.7 提交：

```bash
git add package.json scripts/check-cutting-pickup-three-list.ts src/pages/process-factory/cutting/pickup-management-projection.ts
git commit -m "test: 建立领料三列表投影契约"
```

---

### 任务 2：实现正常需求、加工结果和多次补料的应配数量

**文件：**

- 修改：`src/pages/process-factory/cutting/pickup-management-projection.ts`
- 修改：`src/pages/process-factory/cutting/supplement-management.ts`
- 修改：`scripts/check-cutting-pickup-three-list.ts`

- [ ] 2.1 在补料页只读导出 `SupplementMaterialDemand` 和 `SupplementLine`，不移动现有状态：

```ts
export interface SupplementMaterialDemand {
  key: string
  materialPatternMappingId: string
  sourceBomItemId: string
  techPackVersionId: string
  materialSku: string
  materialName: string
  materialTypeLabel: string
  materialImageUrl: string
  materialAlias: string
  materialRole: SupplementMaterialRole
  roleSource: SupplementRoleSource
  roleConfirmStatus: SupplementRoleConfirmStatus
  patternId: string
  patternName: string
  requiredQty: number
  unit: string
  printRequired: boolean
  dyeRequired: boolean
  processNote: string
  originalCutOrderId: string
  originalCutOrderNo: string
}

export interface SupplementLine extends SupplementSizeColorRow {
  supplementQty: number
  basis: SupplementAbAnalysisRow
  isManualAdjusted: boolean
  adjustReason: string
  actualMissingPieceQty?: number
  piecesPerGarment?: number
}
```

- [ ] 2.2 先补失败断言，覆盖三种加工路径：

```ts
assert(
  allMaterialRows.some((row) =>
    row.processRoute === 'NONE'
    && row.processBasisLabel === '按计划数量'
    && row.requiredQty > 0
  ),
  '无加工物料必须按计划数量形成应配数量',
)
assert(
  allMaterialRows.some((row) =>
    row.processRoute === 'DYE'
    && row.processBasisLabel.includes('染色完成')
  ),
  '只染色物料必须按染色最终完成数量形成应配数量',
)
assert(
  allMaterialRows.some((row) =>
    row.processRoute === 'DYE_PRINT'
    && row.processBasisLabel.includes('印花完成')
  ),
  '染色后印花物料必须按印花最终完成数量形成应配数量',
)
```

- [ ] 2.3 在投影中使用现有平台结果视图，不复制染色/印花完成量算法：

```ts
const dyeResultsById = new Map(
  listPlatformDyeResultViews().map((view) => [view.sourceId, view]),
)
const printResultsById = new Map(
  listPlatformPrintResultViews().map((view) => [view.sourceId, view]),
)
```

- [ ] 2.4 实现统一的应配数量函数：

```ts
function resolveRequiredQty(input: {
  plannedQty: number
  unit: string
  processRoute: PickupProcessRoute
  dyeWorkOrderId: string
  printWorkOrderId: string
}): { qty: number; basisLabel: string } {
  if (input.processRoute === 'DYE_PRINT') {
    const result = printResultsById.get(input.printWorkOrderId)
    return {
      qty: result?.completedObjectQty ?? 0,
      basisLabel: result
        ? `按印花完成 ${formatQty(result.completedObjectQty, input.unit)}`
        : '等待印花一次性完成',
    }
  }
  if (input.processRoute === 'DYE') {
    const result = dyeResultsById.get(input.dyeWorkOrderId)
    return {
      qty: result?.completedObjectQty ?? 0,
      basisLabel: result
        ? `按染色完成 ${formatQty(result.completedObjectQty, input.unit)}`
        : '等待染色一次性完成',
    }
  }
  return { qty: input.plannedQty, basisLabel: '按计划数量' }
}
```

`formatQty()` 必须保留单位；如果结果视图单位与需求单位不一致，投影将该行标记为异常并阻止领料，不能换算或静默使用。

- [ ] 2.5 将每一条已确认补料记录映射为独立需求行：

```ts
function buildSupplementDemandLineId(
  supplementRecordId: string,
  materialPatternMappingId: string,
): string {
  return `SUPPLEMENT:${supplementRecordId}:${materialPatternMappingId}`
}
```

排序固定为：正常需求在前；补料按 `createdAt`、`recordNo`、`materialPatternMappingId` 升序。相同 SKU 的两次补料不得合并。

- [ ] 2.6 补充多次补料断言：

```ts
const supplementRows = allMaterialRows.filter((row) => row.demandSource === 'SUPPLEMENT')
assert(supplementRows.length >= 2, 'Mock 必须覆盖多次补料')
assert(
  new Set(supplementRows.map((row) => row.demandLineId)).size === supplementRows.length,
  '每次补料的每个物料需求必须有独立需求行',
)
assert(
  supplementRows.every((row) => row.demandSourceNo && row.supplementReason),
  '补料需求行必须显示补料单号和补料原因',
)
```

- [ ] 2.7 增加无效加工结果检查：

```ts
assert(
  allMaterialRows.every((row) =>
    Number.isFinite(row.requiredQty)
    && row.requiredQty >= 0
    && Boolean(row.unit)
  ),
  '应配数量必须是带单位的非负有限数',
)
```

- [ ] 2.8 运行：

```bash
npm run check:cutting-pickup-three-list
npm run check:cutting-supplement-process-work-orders
```

预期：正常需求、染色、染色后印花和多次补料断言全部通过，补料加工单原有检查不回归。

- [ ] 2.9 提交：

```bash
git add src/pages/process-factory/cutting/pickup-management-projection.ts src/pages/process-factory/cutting/supplement-management.ts scripts/check-cutting-pickup-three-list.ts
git commit -m "feat: 统一领料应配数量与补料投影"
```

---

### 任务 3：实现库位、无编号托盘和升级释放位置

**文件：**

- 修改：`src/data/fcs/cutting/pickup-node-domain.ts`
- 修改：`src/data/fcs/cutting/production-material-prep.ts`
- 修改：`src/pages/process-factory/cutting/pickup-management-projection.ts`
- 修改：`scripts/check-material-prep-pickup-management.ts`
- 修改：`scripts/check-cutting-pickup-node-domain.ts`
- 修改：`scripts/check-cutting-pickup-important-regressions.ts`

- [ ] 3.1 先在检查中声明承载方式：

```ts
assert(
  incompleteGroups.every((group) =>
    group.carrierType === 'WAREHOUSE_LOCATIONS'
    && group.materialRows.some((row) => row.currentLocations.length > 0)
  ),
  '未配齐列表必须展示当前中转仓库位',
)
assert(
  readyGroups.every((group) =>
    group.carrierType === 'PALLET'
    && group.palletDisplayLabel === '待领托盘（暂未编号）'
  ),
  '已配齐列表必须按无编号待领托盘展示',
)
```

- [ ] 3.2 扩展活动节点：

```ts
export interface PickupNodeProjection {
  nodeId: string
  nodeType: PickupNodeType
  carrierType: PickupCarrierType
  palletId: string
  palletDisplayLabel: string
  readySource: PickupReadySource | null
  prepOrderId: string
  prepOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  sequence: number
  version: number
  updatedAt: string
  itemCount: number
  items: PickupNodeItem[]
}
```

- [ ] 3.3 在 `production-material-prep.ts` 派生当前承载方式：

```ts
function derivePickupNodeCarrier(input: {
  nodeType: PickupNodeType
  previousNodeType: PickupNodeType | null
}): Pick<
  PickupNodeProjection,
  'carrierType' | 'palletId' | 'palletDisplayLabel' | 'readySource'
> {
  if (input.nodeType === 'INCOMPLETE_PICKABLE') {
    return {
      carrierType: 'WAREHOUSE_LOCATIONS',
      palletId: '',
      palletDisplayLabel: '',
      readySource: null,
    }
  }
  return {
    carrierType: 'PALLET',
    palletId: '',
    palletDisplayLabel: '待领托盘（暂未编号）',
    readySource: input.previousNodeType === 'INCOMPLETE_PICKABLE'
      ? 'UPGRADED_FROM_INCOMPLETE'
      : 'DIRECT_READY',
  }
}
```

- [ ] 3.4 保留 `sourceLocations` 作为领料追溯来源快照，但投影只在 `carrierType === 'WAREHOUSE_LOCATIONS'` 时把它作为“当前位置”输出。已配齐托盘节点的 `currentLocations` 必须为空。

- [ ] 3.5 增加库位归属检查：

```ts
const locationOwners = new Map<string, string>()
for (const group of incompleteGroups) {
  for (const row of group.materialRows) {
    for (const location of row.currentLocations) {
      const key = [
        location.sourceWarehouseName,
        location.sourceWarehouseArea,
        location.sourceLocationCode,
      ].join('::')
      const existingOwner = locationOwners.get(key)
      assert(
        !existingOwner || existingOwner === group.productionOrderId,
        `库位 ${key} 同时属于两个生产单`,
      )
      locationOwners.set(key, group.productionOrderId)
    }
  }
}
```

- [ ] 3.6 增加同一生产单多库位、同一物料多库位检查：

```ts
assert(
  incompleteGroups.some((group) =>
    new Set(group.materialRows.flatMap((row) =>
      row.currentLocations.map((location) => location.sourceLocationCode)
    )).size >= 2
  ),
  'Mock 必须覆盖一个生产单对应多个库位',
)
assert(
  incompleteGroups.some((group) =>
    group.materialRows.some((row) => row.currentLocations.length >= 2)
  ),
  'Mock 必须覆盖一个物料分布在多个库位',
)
```

- [ ] 3.7 修改旧检查，将原来的“所有活动节点都必须有来源库位”改成：

```ts
assert(
  activeNodes
    .filter((node) => node.nodeType === 'INCOMPLETE_PICKABLE')
    .every((node) => node.items.every((item) => item.sourceLocations.length > 0)),
  '未配齐节点物料必须保留当前来源库位',
)
assert(
  activeNodes
    .filter((node) => node.nodeType === 'READY_TO_PICKUP')
    .every((node) => node.carrierType === 'PALLET'),
  '已配齐节点必须转为托盘承载',
)
```

- [ ] 3.8 运行：

```bash
npm run check:material-prep-pickup-management
npm run check:cutting-pickup-node-domain
npm run check:cutting-pickup-important-regressions
npm run check:cutting-pickup-three-list
```

预期：库位排他、多库位、托盘承载和升级释放当前位置全部通过。

- [ ] 3.9 提交：

```bash
git add src/data/fcs/cutting/pickup-node-domain.ts src/data/fcs/cutting/production-material-prep.ts src/pages/process-factory/cutting/pickup-management-projection.ts scripts/check-material-prep-pickup-management.ts scripts/check-cutting-pickup-node-domain.ts scripts/check-cutting-pickup-important-regressions.ts
git commit -m "feat: 区分未配齐库位与已配齐托盘"
```

---

### 任务 4：实现历史路径、最终结果和补料重开

**文件：**

- 修改：`src/pages/process-factory/cutting/pickup-management-projection.ts`
- 修改：`scripts/check-cutting-pickup-three-list.ts`
- 修改：`scripts/check-cutting-pickup-data-closure.ts`

- [ ] 4.1 先写失败断言，历史列表必须同时表达路径和最终结果：

```ts
assert(
  historyGroups.some((group) =>
    group.historyPath === 'READY_PICKUP'
    && group.finalResult === 'ALL_PICKED'
  ),
  '历史必须覆盖已配齐后领料且全部领完',
)
assert(
  historyGroups.some((group) =>
    group.historyPath === 'INCOMPLETE_PICKUP'
    && group.finalResult === 'ALL_PICKED'
  ),
  '历史必须覆盖未配齐先领且最终全部领完',
)
assert(
  historyGroups.some((group) =>
    group.historyPath === 'INCOMPLETE_PICKUP'
    && group.finalResult === 'NOT_ALL_PICKED'
  ),
  '历史必须覆盖未配齐先领且尚未全部领完',
)
```

- [ ] 4.2 历史路径按生产单所有有效领料会话派生：

```ts
function deriveHistoryPath(sessions: PickupSession[]): PickupHistoryPath | null {
  if (!sessions.length) return null
  return sessions.some((session) => session.pickupNodeType === 'INCOMPLETE_PICKABLE')
    ? 'INCOMPLETE_PICKUP'
    : 'READY_PICKUP'
}
```

- [ ] 4.3 最终结果必须逐需求行判断，不能按生产单总数量相抵：

```ts
function deriveFinalResult(
  materialRows: PickupMaterialDemandRow[],
  latestAllPickedAt: string,
): PickupFinalResult {
  const openSupplement = materialRows.some((row) =>
    row.demandSource === 'SUPPLEMENT'
    && row.pickedQty < row.requiredQty
    && row.demandCreatedAt > latestAllPickedAt
  )
  if (openSupplement) return 'NEW_SUPPLEMENT_WAIT_PICKUP'
  return materialRows.every((row) => row.pickedQty >= row.requiredQty)
    ? 'ALL_PICKED'
    : 'NOT_ALL_PICKED'
}
```

为此在 `PickupMaterialDemandRow` 增加 `demandCreatedAt: string`；正常需求使用生产单需求生效时间，补料使用补料记录 `createdAt`。

- [ ] 4.4 同一生产单有历史会话且仍有当前节点时：

- 历史列表保留该生产单，表达已经领过的事实。
- 已配齐待领料或未配齐配料列表同时保留该生产单，表达当前仍需执行的任务。
- 两处都使用相同的 `productionOrderId`，但页面行主键分别加上列表类型前缀。

- [ ] 4.5 增加补料重开断言：

```ts
const reopened = historyGroups.find((group) =>
  group.finalResult === 'NEW_SUPPLEMENT_WAIT_PICKUP'
)
assert(reopened, '原需求领完后新增补料必须重开为新增补料待领')
assert(
  [...readyGroups, ...incompleteGroups].some((group) =>
    group.productionOrderId === reopened.productionOrderId
  ),
  '新增补料待领的生产单必须同时出现在当前任务列表',
)
```

- [ ] 4.6 增加多单位不可抵消断言：

```ts
assert(
  historyGroups.every((group) =>
    group.finalResult !== 'ALL_PICKED'
    || group.materialRows.every((row) => row.pickedQty >= row.requiredQty)
  ),
  '全部领完必须逐需求行成立，不得跨物料或跨单位抵消',
)
```

- [ ] 4.7 运行：

```bash
npm run check:cutting-pickup-data-closure
npm run check:cutting-pickup-three-list
```

预期：已配齐领料、未配齐领料、最终全部领完、尚未全部领完和补料重开全部有样例且断言通过。

- [ ] 4.8 提交：

```bash
git add src/pages/process-factory/cutting/pickup-management-projection.ts scripts/check-cutting-pickup-three-list.ts scripts/check-cutting-pickup-data-closure.ts
git commit -m "feat: 派生领料路径与最终完成结果"
```

---

### 任务 5：拆出三个独立标准列表页和一级菜单

**文件：**

- 新建：`src/pages/process-factory/cutting/pickup-management-list.ts`
- 修改：`src/pages/process-factory/cutting/pickup-management.ts`
- 修改：`src/pages/process-factory/cutting/meta.ts`
- 修改：`src/data/app-shell-config.ts`
- 修改：`src/router/route-renderers-fcs.ts`
- 修改：`src/router/routes-fcs.ts`
- 修改：`src/main-handlers/fcs-handlers.ts`
- 修改：`scripts/check-cutting-pickup-three-list.ts`
- 修改：`scripts/check-cutting-pickup-ui-closure.ts`

- [ ] 5.1 在专项检查中先固定三个规范路由和菜单层级：

```ts
const READY_PATH = '/fcs/craft/cutting/pickup-management/ready'
const INCOMPLETE_PATH = '/fcs/craft/cutting/pickup-management/incomplete'
const HISTORY_PATH = '/fcs/craft/cutting/pickup-management/history'

assert(appShellConfig.includes("title: '已配齐待领料'"), '缺少已配齐待领料菜单')
assert(appShellConfig.includes("title: '未配齐配料'"), '缺少未配齐配料菜单')
assert(appShellConfig.includes("title: '已领料'"), '缺少已领料菜单')
assert(routesFcs.includes(READY_PATH), '缺少已配齐待领料路由')
assert(routesFcs.includes(INCOMPLETE_PATH), '缺少未配齐配料路由')
assert(routesFcs.includes(HISTORY_PATH), '缺少已领料路由')
```

- [ ] 5.2 在 `app-shell-config.ts` 删除“裁前准备”中的旧子菜单，并在“裁床厂管理”的 `items` 中新增：

```ts
{
  key: 'pfos-cutting-pickup',
  title: '领料管理',
  icon: 'PackageCheck',
  children: [
    {
      key: 'pfos-cutting-pickup-ready',
      title: '已配齐待领料',
      icon: 'PackageCheck',
      href: '/fcs/craft/cutting/pickup-management/ready',
    },
    {
      key: 'pfos-cutting-pickup-incomplete',
      title: '未配齐配料',
      icon: 'MapPin',
      href: '/fcs/craft/cutting/pickup-management/incomplete',
    },
    {
      key: 'pfos-cutting-pickup-history',
      title: '已领料',
      icon: 'History',
      href: '/fcs/craft/cutting/pickup-management/history',
    },
  ],
}
```

- [ ] 5.3 在 `meta.ts` 新增三个 key：

```ts
| 'pickup-ready'
| 'pickup-incomplete'
| 'pickup-history'
```

三者 `menuGroupTitle` 都是“领料管理”，标题分别与菜单一致。旧 `pickup-management` 只保留详情或兼容入口，不再作为菜单页面。

- [ ] 5.4 在 `pickup-management-list.ts` 顶部声明：

```ts
// @page-pattern: list
```

并复用：

```ts
renderStandardListPage
renderStandardListStats
renderStandardListTable
renderTablePagination
renderStandardListColumnSettings
```

- [ ] 5.5 导出三个薄渲染函数：

```ts
export function renderCraftCuttingPickupReadyPage(): string {
  return renderPickupManagementListPage('READY')
}

export function renderCraftCuttingPickupIncompletePage(): string {
  return renderPickupManagementListPage('INCOMPLETE')
}

export function renderCraftCuttingPickupHistoryPage(): string {
  return renderPickupManagementListPage('HISTORY')
}
```

- [ ] 5.6 为三个路由设置独立列偏好键：

```ts
const PREFERENCE_KEYS: Record<PickupListKind, string> = {
  READY: 'standard-list:/fcs/craft/cutting/pickup-management/ready',
  INCOMPLETE: 'standard-list:/fcs/craft/cutting/pickup-management/incomplete',
  HISTORY: 'standard-list:/fcs/craft/cutting/pickup-management/history',
}
```

当前页和排序不持久化；列显示、顺序、冻结和每页条数按路由持久化。

- [ ] 5.7 标准列表的分页对象必须是 `PickupOrderGroup`：

```ts
const paging = paginateStandardListRows(
  sortedOrderGroups,
  state.page,
  state.pageSize,
)
```

每一组内部物料行全部渲染，禁止先展开为物料行再分页。

- [ ] 5.8 三张列表都用生产单作为首列和冻结必需列，物料列也设为必需列；操作列设为右侧固定必需列：

```ts
const COMMON_COLUMNS: StandardListColumn<PickupOrderGroup>[] = [
  {
    key: 'productionOrder',
    title: PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
    width: 220,
    required: true,
    freezeable: true,
    sortable: true,
    render: renderProductionOrderCell,
  },
  {
    key: 'materials',
    title: '物料明细',
    width: 620,
    required: true,
    freezeable: true,
    render: renderMaterialRowsCell,
  },
]
```

- [ ] 5.9 物料列一行一个需求行，直接展示缩略图、名称、编码、来源/补料单号、加工标记、应配数量、当前配料数量、累计领料数量和单位：

```ts
function renderMaterialRowsCell(group: PickupOrderGroup): string {
  return `<div class="divide-y">
    ${group.materialRows.map((row) => renderPickupMaterialRow(row, group.listKind)).join('')}
  </div>`
}
```

不使用“仅显示前三项”或“进入详情查看全部”的收起方式。

- [ ] 5.10 “未配齐配料”增加必需列“中转仓库位”，每个物料行列出所有库位及各自数量；操作列提供“去领料”：

```ts
const pdaHref = `/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup&pickupNodeId=${encodeURIComponent(group.pickupNodeId)}&version=${group.pickupNodeVersion}`
```

按钮文案必须明确“一次领取本节点全部物料”，页面不出现复选框和数量输入框。

- [ ] 5.11 “已配齐待领料”显示：

- `直接配齐` 或 `由未配齐升级`
- `待领托盘（暂未编号）`
- 不显示已释放的旧中转仓库位
- “去领料”仍进入同一 PDA 领料入口

- [ ] 5.12 “已领料”同时显示：

- 领料路径：`已配齐后领料`、`未配齐先领`
- 最终结果：`全部领完`、`未完成全部领料`、`新增补料待领`
- 领料次数和最近领料时间
- 每个物料需求行的应配数量、累计领料数量和剩余待领数量

- [ ] 5.13 在 `routes-fcs.ts` 注册三个页面；旧路由使用已有 `renderRouteRedirect()`：

```ts
'/fcs/craft/cutting/pickup-management': () =>
  renderRouteRedirect(
    '/fcs/craft/cutting/pickup-management/ready',
    '正在进入已配齐待领料',
  ),
```

详情路由 `/fcs/craft/cutting/pickup-management-detail` 保留。

- [ ] 5.14 在 `fcs-handlers.ts` 保留一个路由前缀判断：

```ts
if (pathname.startsWith('/fcs/craft/cutting/pickup-management')) {
  return handleCraftCuttingPickupManagementEvent(target, event)
}
```

删除当前重复的第二个相同判断。

- [ ] 5.15 列表轻交互只更新筛选区、表格区、分页区或列设置弹层；不得用 `root.innerHTML` 重绘整页。输入筛选使用现有跳过重渲染或 debounce 方式。

- [ ] 5.16 运行：

```bash
npm run check:cutting-pickup-three-list
npm run check:cutting-pickup-ui-closure
npm run check:list-page-governance
npm run check:prototype-design-governance
```

预期：三个页面均通过标准列表门禁，旧路由可兼容进入，菜单层级正确。

- [ ] 5.17 提交：

```bash
git add src/pages/process-factory/cutting/pickup-management-list.ts src/pages/process-factory/cutting/pickup-management.ts src/pages/process-factory/cutting/meta.ts src/data/app-shell-config.ts src/router/route-renderers-fcs.ts src/router/routes-fcs.ts src/main-handlers/fcs-handlers.ts scripts/check-cutting-pickup-three-list.ts scripts/check-cutting-pickup-ui-closure.ts
git commit -m "feat: 拆分领料管理三个独立列表"
```

---

### 任务 6：补足 Mock 场景、浏览器验收和原型审查记录

**文件：**

- 修改：`src/data/fcs/cutting/production-material-prep.ts`
- 修改：`src/pages/process-factory/cutting/pickup-management-projection.ts`
- 新建：`tests/cutting-pickup-three-list.spec.ts`
- 修改：`tests/cutting-pickup-node-flow.spec.ts`
- 新建：`docs/prototype-review-records/2026-07-30-pickup-management-three-list.md`

- [ ] 6.1 让 Mock 数据明确覆盖以下生产单，不增加无意义大批量数据：

| 场景 | 必须展示的事实 |
| --- | --- |
| 直接一次配齐 | 已配齐待领、直接配齐、无编号托盘、无当前库位 |
| 未配齐可领 | 至少两个当前库位、可进入领料 |
| 同一物料多库位 | 每个库位分别显示数量和同一单位 |
| 由未配齐升级配齐 | 升级来源、无编号托盘、旧库位已释放 |
| 已配齐后全部领完 | 路径和最终结果同时显示 |
| 未配齐先领且全部领完 | 多次领料、累计数量逐行满足 |
| 未配齐先领但尚未领完 | 有历史领料且仍有当前任务 |
| 多次补料 | 相同 SKU 的两次补料分别成行 |
| 原需求领完后新增补料 | 历史显示新增补料待领，当前任务列表同时出现 |
| 无加工、只染色、染色后印花 | 应配依据分别正确 |

- [ ] 6.2 在新 Playwright 用例中验证三个菜单入口可达：

```ts
await page.goto('/fcs/craft/cutting/pickup-management/ready')
await expect(page.getByRole('heading', { name: '已配齐待领料' })).toBeVisible()

await page.goto('/fcs/craft/cutting/pickup-management/incomplete')
await expect(page.getByRole('heading', { name: '未配齐配料' })).toBeVisible()

await page.goto('/fcs/craft/cutting/pickup-management/history')
await expect(page.getByRole('heading', { name: '已领料' })).toBeVisible()
```

- [ ] 6.3 验证列表直接看到物料，不进入详情：

```ts
await expect(page.locator('[data-pickup-material-row]').first()).toBeVisible()
await expect(page.locator('[data-pickup-material-image]').first()).toBeVisible()
await expect(page.locator('[data-pickup-material-code]').first()).not.toHaveText('')
await expect(page.locator('[data-pickup-required-qty]').first()).not.toHaveText('')
await expect(page.locator('[data-pickup-picked-qty]').first()).not.toHaveText('')
```

- [ ] 6.4 验证未配齐列表直接展示多个库位并可领料：

```ts
const incompleteGroup = page.locator('[data-pickup-order-group]').filter({
  has: page.locator('[data-pickup-location]'),
}).first()
await expect(incompleteGroup.locator('[data-pickup-location]')).toHaveCount(2)
await expect(incompleteGroup.getByRole('link', { name: '去领料' })).toBeVisible()
```

若 Mock 中该组超过两个位置，改用 `toHaveCount()` 对应实际稳定数量，不使用大于判断掩盖缺项。

- [ ] 6.5 验证已配齐页面不显示虚构编号：

```ts
await expect(page.getByText('待领托盘（暂未编号）').first()).toBeVisible()
await expect(page.getByText(/托盘码：TP-/)).toHaveCount(0)
```

- [ ] 6.6 验证历史列表中的两维状态：

```ts
await expect(page.getByText('未配齐先领').first()).toBeVisible()
await expect(page.getByText('全部领完').first()).toBeVisible()
await expect(page.getByText('未完成全部领料').first()).toBeVisible()
await expect(page.getByText('新增补料待领').first()).toBeVisible()
```

- [ ] 6.7 更新原 PDA 流程用例：从“未配齐配料”或“已配齐待领料”点击“去领料”，继续断言 PDA 确认的是同一个 `pickupNodeId` 和版本，且按钮仍为“确认全部领料”。

- [ ] 6.8 浏览器验证交互响应：

- 筛选输入不触发整页闪烁。
- 切页保持页面滚动和菜单状态。
- 列设置只打开局部弹层。
- 操作列横向滚动时固定在右侧。
- 1366×768 下主体不横向溢出；宽表只在表格容器内部滚动。
- 1280×720 下物料缩略图、名称、编码、数量和主操作仍可读。

- [ ] 6.9 按模板填写审查记录，逐项写明：

- 主要角色：裁床仓管、裁床领料人员、裁床主管。
- 管理端与 PDA 的分工。
- 未配齐可领的防错方式。
- 无编号托盘是当前现场事实，不是系统缺失。
- 库位排他关系与多库位展示。
- 多次补料和加工完成量的追溯。
- 三个列表都按生产单分页，组内物料不拆页。
- 例外：当前托盘没有编号，系统保留未来扫码能力但本次不要求录入。

- [ ] 6.10 运行：

```bash
npm run check:cutting-pickup-three-list-e2e
npm run check:cutting-pickup-node-e2e
npm run check:prototype-design-governance
```

预期：浏览器用例通过，审查记录被治理检查识别。

- [ ] 6.11 提交：

```bash
git add src/data/fcs/cutting/production-material-prep.ts src/pages/process-factory/cutting/pickup-management-projection.ts tests/cutting-pickup-three-list.spec.ts tests/cutting-pickup-node-flow.spec.ts docs/prototype-review-records/2026-07-30-pickup-management-three-list.md
git commit -m "test: 覆盖领料三列表现场场景"
```

---

### 任务 7：完整回归、CodeGraph 同步和任务收据

**文件：**

- 修改：仅修复本任务验证发现的直接相关问题。
- 生成：临时目录中的验证收据，不提交临时文件。

- [ ] 7.1 运行领料主链路检查：

```bash
npm run check:cutting-pickup-three-list
npm run check:material-prep-pickup-management
npm run check:cutting-pickup-node-domain
npm run check:cutting-pickup-data-closure
npm run check:cutting-pickup-important-regressions
npm run check:cutting-pickup-ui-closure
npm run check:cutting-prep-pickup-return-linkage
```

- [ ] 7.2 运行页面治理和构建：

```bash
npm run check:list-page-governance
npm run check:prototype-design-governance
npm run build
```

- [ ] 7.3 运行浏览器验收：

```bash
npm run check:cutting-pickup-three-list-e2e
npm run check:cutting-pickup-node-e2e
```

- [ ] 7.4 检查工作区只包含本任务文件，保留用户原有未提交文件：

```bash
git status --short
git diff --check
```

不得加入或覆盖以下用户工作区内容：

- `docs/product-design/裁片单补料管理产品需求文档.md`
- `.codex/`
- `docs/product-design/补料业务产品需求说明文档.md`

- [ ] 7.5 同步 CodeGraph：

```bash
codegraph sync
codegraph status
```

预期：无 `Pending sync`，无 worktree mismatch。

- [ ] 7.6 按实际执行方式追加结构化阶段轨迹：

- 触发原因。
- `superpowers-zh:brainstorming` 实际调用。
- `superpowers-zh:writing-plans` 实际调用。
- `superpowers-zh:test-driven-development` 实际调用。
- `superpowers-zh:subagent-driven-development` 或 `superpowers-zh:executing-plans` 实际调用。
- 设计规格和实现计划产物。
- 当前实现 Git 版本。
- 最终验证收据。

若执行方式要求两阶段审查，再追加规格审查和代码质量审查收据，并在最终验证时加 `--require-two-stage-review`。

- [ ] 7.7 在最后一次实质改动和提交之后生成任务收据：

```bash
pickup_receipt_dir=$(mktemp -d)
npm run workflow:verify -- \
  --output "$pickup_receipt_dir/task-receipt.json" \
  --stage-trace /tmp/higoods-pickup-management-implementation-stage-trace.json \
  --required-skills superpowers-zh:brainstorming,superpowers-zh:writing-plans,superpowers-zh:test-driven-development
```

如果选择子代理驱动执行，将 `superpowers-zh:subagent-driven-development` 加入 `--required-skills`；如果选择当前会话执行，将 `superpowers-zh:executing-plans` 加入。只有收据状态为 `verified` 才能宣称验证闭环。

- [ ] 7.8 如果验证产生必要修正，先用 `git diff --name-only` 核对文件，再只从第 1 节列出的本任务文件中逐个执行 `git add`，提交：

```bash
git commit -m "chore: 收口领料三列表验证"
```

禁止使用 `git add .` 或 `git add -A`。只有确有验证修正且已经逐个暂存时才创建该提交；没有修正时不创建空提交。

---

## 4. 实现自查清单

### 规格覆盖

- [ ] “领料管理”已从“裁前准备”移出并成为独立一级菜单。
- [ ] 三个二级菜单是三个独立路由，不是页签伪装。
- [ ] 未配齐配料列表可以去领料。
- [ ] 未配齐配料列表显示当前中转仓库位及各库位数量。
- [ ] 一个库位只属于一个生产单；一个生产单可以有多个库位。
- [ ] 列表物料一行一个需求行，直接显示缩略图、名称、编码、应配、配料、累计领料和单位。
- [ ] 正常需求和多次补料分行展示，相同 SKU 不合并。
- [ ] 染色、印花标记和应配数量来源清晰。
- [ ] 染色后印花固定以印花最终完成量为应配数量。
- [ ] 已配齐直接配齐和由未配齐升级两种来源都可识别。
- [ ] 当前无编号托盘显示“待领托盘（暂未编号）”，没有虚构托盘码。
- [ ] 升级已配齐后不再显示已释放库位。
- [ ] 已领料列表同时展示领料路径和最终完成结果。
- [ ] 未配齐先领可以最终显示全部领完。
- [ ] 原需求领完后新增补料会重开当前任务和最终状态。
- [ ] 历史列表按生产单分页，生产单物料组不跨页。
- [ ] PDA 仍只有一个统一领料入口，并使用同一活动节点。

### 页面与性能

- [ ] 三个文件都满足 `// @page-pattern: list` 的治理要求。
- [ ] 统计卡是 48px 单行布局。
- [ ] 排序列显示未排序、升序、降序三态图标。
- [ ] 必需列不可隐藏。
- [ ] 普通冻结列固定在左侧。
- [ ] 操作列固定在右侧。
- [ ] 三个路由的列偏好分别持久化。
- [ ] 筛选输入不触发整页重绘。
- [ ] 弹层、列设置、翻页只更新必要区域。
- [ ] 1366×768 和 1280×720 可用。

### 数据与防错

- [ ] 不同单位不相加、不抵消。
- [ ] 物料、数量、单位、库位、节点版本不一致时阻止领料。
- [ ] 不存在部分物料、部分数量、部分库位领料入口。
- [ ] 无效或尚未最终完成的染色/印花结果不会产生可领应配数量。
- [ ] 作废补料保留历史但不计入有效应配数量。
- [ ] 同一生产单可以同时有历史记录和当前待领任务。

### 交付证据

- [ ] 专项检查通过。
- [ ] 原领料链路回归检查通过。
- [ ] 标准列表治理通过。
- [ ] 原型设计治理通过。
- [ ] 构建通过。
- [ ] Playwright 通过。
- [ ] CodeGraph 已同步且无待同步文件。
- [ ] 任务收据状态为 `verified`。
