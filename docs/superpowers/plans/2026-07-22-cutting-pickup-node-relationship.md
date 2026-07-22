# 裁床待领节点与多次领料关系实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers-zh:subagent-driven-development`（推荐）或 `superpowers-zh:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）跟踪进度。

**目标：** 将领料管理从“每条已确认配料记录一条待领通知”调整为“每个生产单一个当前待领节点”，并让裁床一次确认生成一条领料主记录及多条物料明细。

**架构：** 保留现有生产单级裁床配料单和物料行数据，不改中转仓内部页面。新增纯函数待领节点模型，以现有已确认未领物料和历史有效已领事实派生唯一活动节点；新增领料主记录，现有行级 `PickupRecord` 保留为主记录下的领料明细，减少对退回、配料详情和其他工艺页面的影响。PC 领料管理和 PDA 领料入仓统一读取待领节点，并通过同一个幂等确认函数完成主记录、明细和节点关闭。

**技术栈：** Vite、TypeScript、Vanilla TypeScript 字符串模板、Tailwind CSS、项目标准列表页组件、Node 检查脚本、Playwright。

---

## 0. 已确认设计与范围

实现前阅读：

- `docs/superpowers/specs/2026-07-22-cutting-pickup-complete-relationship-design.md`
- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`
- `docs/prototype-review-record-template.md`

本计划不修改仓储管理系统的中转仓配料页面，不重新设计打回、退回和按实完结。现有异常流程必须继续可用。

## 1. 文件结构

| 文件 | 动作 | 单一职责 |
| --- | --- | --- |
| `src/data/fcs/cutting/pickup-node-domain.ts` | 创建 | 定义待领节点、领料主记录类型和累计齐套纯函数 |
| `src/data/fcs/cutting/production-material-prep.ts` | 修改 | 派生活动节点，持久化领料主记录，提供幂等确认入口 |
| `src/pages/process-factory/cutting/pickup-management.ts` | 修改 | 按待领节点重做标准列表、详情和历史主记录展示 |
| `src/pages/pda-warehouse-wait-process.ts` | 修改 | 按节点展示全部物料并执行“确认全部领料” |
| `scripts/check-cutting-pickup-node-domain.ts` | 创建 | 验证累计齐套、节点升级和节点顺序 |
| `scripts/check-material-prep-pickup-management.ts` | 修改 | 将旧记录级断言改为节点级、主记录级断言 |
| `scripts/check-pda-pickup-flow.ts` | 修改 | 验证 PDA 不允许部分领取当前节点 |
| `scripts/check-cutting-prep-pickup-return-linkage.ts` | 修改 | 验证行级领料明细继续承接退回关系 |
| `tests/cutting-pickup-node-flow.spec.ts` | 创建 | 浏览器验证列表、确认、幂等和响应时间 |
| `package.json` | 修改 | 注册新增检查命令 |
| `docs/prototype-review-records/2026-07-22-cutting-pickup-node-relationship.md` | 创建 | 记录原型审查结论 |

不修改 `scripts/standard-list-page-baseline.json`。

## 2. 任务 1：建立待领节点纯领域模型

**文件：**

- 创建：`scripts/check-cutting-pickup-node-domain.ts`
- 创建：`src/data/fcs/cutting/pickup-node-domain.ts`
- 修改：`package.json`

- [ ] **步骤 1：先写累计齐套和节点升级失败检查**

创建检查脚本：

```ts
import {
  derivePickupNodeType,
  resolvePickupNodeUpdate,
  type PickupCoverageLine,
} from '../src/data/fcs/cutting/pickup-node-domain.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const stillShort: PickupCoverageLine[] = [
  { key: 'FABRIC-BLACK-150', unit: 'yard', requiredQty: 1000, effectivePickedQty: 700, currentAvailableQty: 200 },
  { key: 'ZIP-BLACK', unit: '条', requiredQty: 2400, effectivePickedQty: 1400, currentAvailableQty: 1000 },
]
const nowComplete = stillShort.map((line) =>
  line.key === 'FABRIC-BLACK-150' ? { ...line, currentAvailableQty: 300 } : line,
)

assert(derivePickupNodeType(stillShort) === 'INCOMPLETE_PICKABLE', '任一物料未满足时必须是未配齐可领')
assert(derivePickupNodeType(nowComplete) === 'READY_TO_PICKUP', '全部物料满足时必须是已配齐待领')

const first = resolvePickupNodeUpdate({ prepOrderId: 'prep-order-po-001', nextSequence: 1, existingNode: null, coverageLines: stillShort })
assert(first.nodeId === 'pickup-node:prep-order-po-001:1', '首轮节点编号错误')
assert(first.locationPolicy === 'ASSIGN_INCOMPLETE_LOCATION', '未配齐新节点必须分配未配齐货位')

const upgraded = resolvePickupNodeUpdate({ prepOrderId: 'prep-order-po-001', nextSequence: 2, existingNode: first, coverageLines: nowComplete })
assert(upgraded.nodeId === first.nodeId, '未领取前后续到货必须并入原节点')
assert(upgraded.version === 2, '节点更新后版本必须递增')
assert(upgraded.nodeType === 'READY_TO_PICKUP', '累计配齐后原节点必须升级')
assert(upgraded.locationPolicy === 'KEEP_CURRENT_LOCATION', '已有节点升级不得重新分配货位')

const directReady = resolvePickupNodeUpdate({ prepOrderId: 'prep-order-po-001', nextSequence: 2, existingNode: null, coverageLines: nowComplete })
assert(directReady.locationPolicy === 'DIRECT_READY_AREA', '累计配齐的新节点不得进入未配齐货位')
console.log('裁床待领节点领域检查通过')
```

- [ ] **步骤 2：运行并确认模块不存在**

运行：

```bash
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-pickup-node-domain.ts
```

预期：FAIL，报错包含 `Cannot find module ... pickup-node-domain.ts`。

- [ ] **步骤 3：实现纯领域模型**

创建 `pickup-node-domain.ts`：

```ts
export type PickupNodeType = 'INCOMPLETE_PICKABLE' | 'READY_TO_PICKUP'
export type PickupNodeStatus = 'OPEN' | 'CLOSED'
export type PickupNodeLocationPolicy = 'KEEP_CURRENT_LOCATION' | 'ASSIGN_INCOMPLETE_LOCATION' | 'DIRECT_READY_AREA'

export interface PickupCoverageLine {
  key: string
  unit: string
  requiredQty: number
  effectivePickedQty: number
  currentAvailableQty: number
}

export interface PickupNodeIdentity {
  nodeId: string
  version: number
  nodeType: PickupNodeType
  status: PickupNodeStatus
  locationPolicy: PickupNodeLocationPolicy
}

export interface PickupNodeItem {
  nodeItemId: string
  prepLineId: string
  sourcePrepRecordIds: string[]
  materialSku: string
  materialName: string
  materialType: string
  materialImageUrl: string
  color: string
  spec: string
  unit: string
  requiredQty: number
  effectivePickedQty: number
  currentAvailableQty: number
  rollCount: number
  sourceWarehouseName: string
  sourceWarehouseArea: string
  sourceLocationCode: string
}

export interface PickupNodeProjection extends PickupNodeIdentity {
  prepOrderId: string
  prepOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  sequence: number
  updatedAt: string
  itemCount: number
  items: PickupNodeItem[]
}

export interface PickupSession {
  pickupSessionId: string
  pickupSessionNo: string
  pickupNodeId: string
  pickupNodeVersion: number
  prepOrderId: string
  productionOrderId: string
  nodeType: PickupNodeType
  pickupRecordIds: string[]
  receiverName: string
  pickedAt: string
  toWarehouseArea: string
  toLocationCode: string
  status: '本轮已领完'
  warehouseSyncStatus: '已回写' | '回写异常待重试'
  warehouseSyncMessage?: string
}

export function derivePickupNodeType(lines: PickupCoverageLine[]): PickupNodeType {
  return lines.length > 0 && lines.every((line) =>
    line.effectivePickedQty + line.currentAvailableQty >= line.requiredQty
  ) ? 'READY_TO_PICKUP' : 'INCOMPLETE_PICKABLE'
}

export function resolvePickupNodeUpdate(input: {
  prepOrderId: string
  nextSequence: number
  existingNode: PickupNodeIdentity | null
  coverageLines: PickupCoverageLine[]
}): PickupNodeIdentity {
  const nodeType = derivePickupNodeType(input.coverageLines)
  if (input.existingNode?.status === 'OPEN') {
    return { ...input.existingNode, version: input.existingNode.version + 1, nodeType, locationPolicy: 'KEEP_CURRENT_LOCATION' }
  }
  return {
    nodeId: `pickup-node:${input.prepOrderId}:${input.nextSequence}`,
    version: 1,
    nodeType,
    status: 'OPEN',
    locationPolicy: nodeType === 'READY_TO_PICKUP' ? 'DIRECT_READY_AREA' : 'ASSIGN_INCOMPLETE_LOCATION',
  }
}
```

- [ ] **步骤 4：注册并运行检查**

在 `package.json` 加入：

```json
"check:cutting-pickup-node-domain": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-pickup-node-domain.ts"
```

运行 `npm run check:cutting-pickup-node-domain`，预期 PASS。

- [ ] **步骤 5：Commit**

```bash
git add src/data/fcs/cutting/pickup-node-domain.ts scripts/check-cutting-pickup-node-domain.ts package.json
git commit -m "feat(裁床): 建立待领节点领域模型"
```

## 3. 任务 2：从现有配料事实派生唯一活动节点

**文件：**

- 修改：`src/data/fcs/cutting/production-material-prep.ts:228-395,2458-2508,2690-3050,3371-3418`
- 修改：`scripts/check-material-prep-pickup-management.ts:220-360`

- [ ] **步骤 1：先写节点级失败断言**

```ts
const activeNodes = listActivePickupNodes(null)
assert(activeNodes.length > 0, '已确认未领物料必须形成待领节点')
assert(new Set(activeNodes.map((node) => node.prepOrderId)).size === activeNodes.length, '同一生产单只能有一个活动节点')
assert(activeNodes.every((node) => node.items.length > 0), '活动节点必须包含全部可领明细')
assert(activeNodes.some((node) => node.nodeType === 'INCOMPLETE_PICKABLE'), 'Mock 缺少未配齐可领节点')
assert(activeNodes.some((node) => node.nodeType === 'READY_TO_PICKUP'), 'Mock 缺少已配齐待领节点')
assert(activeNodes.some((node) => node.items.some((item) => item.sourcePrepRecordIds.length >= 2)), '多条配料记录未归并到同一节点')
```

- [ ] **步骤 2：运行 `npm run check:material-prep-pickup-management` 并确认失败**

预期：FAIL，报错包含 `listActivePickupNodes` 未导出。

- [ ] **步骤 3：保留行级明细，新增主记录存储**

给 `PickupRecord` 增加可选字段：

```ts
pickupSessionId?: string
pickupNodeId?: string
sourcePrepRecordIds?: string[]
```

给 `ProductionMaterialPrepWorkflowStore` 增加：

```ts
pickupSessions: PickupSession[]
```

新 Store 初始化为空数组；旧本地数据反序列化使用：

```ts
pickupSessions: Array.isArray(parsed.pickupSessions) ? cloneRecord(parsed.pickupSessions) : [],
```

- [ ] **步骤 4：实现节点明细归并和活动节点列表**

新增函数签名：

```ts
function buildPickupNodeItems(
  projection: MaterialPrepOrderProjection,
  candidates: PrepRecordPickupCandidate[],
): PickupNodeItem[]

export function listActivePickupNodes(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PickupNodeProjection[]
```

实现规则：

1. 先按 `prepOrderId` 分组旧 `listPickupCandidates()` 结果。
2. 同一 `prepLineId` 的多个候选合并为一个节点明细，累计 `currentAvailableQty` 和 `rollCount`，保存全部 `sourcePrepRecordIds`。
3. `effectivePickedQty = max(line.pickedQty - line.returnedQty, 0)`。
4. 按所有物料行调用 `derivePickupNodeType()`，不能汇总不同单位后判断。
5. `nodeId = pickup-node:<prepOrderId>:<已完成主记录数+1>`。
6. 节点版本由已确认记录编号、确认时间、物料行和可领数量生成稳定快照版本；相同快照重复读取版本不变，明细变化后版本变化，禁止使用 `Date.now()`。
7. 每个 `prepOrderId` 最多返回一个节点。

- [ ] **步骤 5：调整现有 Mock 覆盖两类节点**

只调整现有订单种子：至少一条未配齐可领、一条已配齐待领、一条由两条已确认配料记录归并。不得新增与流程无关的订单。

- [ ] **步骤 6：运行检查**

```bash
npm run check:cutting-pickup-node-domain
npm run check:material-prep-pickup-management
```

预期：PASS，旧“一条记录一条通知”断言已删除。

- [ ] **步骤 7：Commit**

```bash
git add src/data/fcs/cutting/production-material-prep.ts scripts/check-material-prep-pickup-management.ts
git commit -m "feat(裁床): 按生产单派生唯一待领节点"
```

## 4. 任务 3：实现一节点一主记录的幂等确认

**文件：**

- 修改：`src/data/fcs/cutting/production-material-prep.ts:3671-3723`
- 修改：`scripts/check-material-prep-pickup-management.ts`
- 修改：`scripts/check-cutting-prep-pickup-return-linkage.ts`

- [ ] **步骤 1：先写主记录、明细和幂等失败检查**

```ts
const node = listActivePickupNodes(storage)[0]
assert(node, '缺少可确认活动节点')
const session = appendPickupSessionFromNode({
  pickupNodeId: node.nodeId,
  pickupNodeVersion: node.version,
  receiverName: '裁床 李明',
  warehouseArea: '待加工仓 A 区',
  locationCode: 'FAB-A-09',
  waitProcessLedgerEventId: 'check-node-session',
}, storage)
assert(session.status === '本轮已领完', '领料主记录状态错误')
assert(session.pickupRecordIds.length === node.items.length, '节点每条物料必须形成一条领料明细')
assert(!listActivePickupNodes(storage).some((item) => item.nodeId === node.nodeId), '确认后节点必须关闭')

const duplicate = appendPickupSessionFromNode({
  pickupNodeId: node.nodeId,
  pickupNodeVersion: node.version,
  receiverName: '裁床 李明',
  warehouseArea: '待加工仓 A 区',
  locationCode: 'FAB-A-09',
  waitProcessLedgerEventId: 'check-node-session-retry',
}, storage)
assert(duplicate.pickupSessionId === session.pickupSessionId, '重复确认必须返回原主记录')
```

另用旧节点版本提交，断言错误文本为：

```text
当前待领物料已更新，请重新核对全部物料后再确认领料。
```

- [ ] **步骤 2：运行检查并确认 `appendPickupSessionFromNode` 不存在**

运行 `npm run check:material-prep-pickup-management`，预期 FAIL。

- [ ] **步骤 3：实现原子确认函数**

函数签名：

```ts
export function appendPickupSessionFromNode(
  input: {
    pickupNodeId: string
    pickupNodeVersion: number
    receiverName: string
    warehouseArea: string
    locationCode: string
    waitProcessLedgerEventId: string
  },
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PickupSession
```

实现顺序必须固定：

1. 先按 `pickupNodeId` 查 `pickupSessions`；存在则直接返回，保证幂等。
2. 重新读取当前活动节点并校验版本；节点不存在或版本不同则抛出已确认提示。
3. 生成确定性的 `pickupSessionId = pickup-session:<pickupNodeId>`。
4. 遍历 `node.items` 生成行级 `PickupRecord`，全部带相同 `pickupSessionId` 和 `pickupNodeId`。
5. 每条明细的 `pickedQty` 等于节点明细 `currentAvailableQty`，不得接收前端输入数量。
6. 在同一个 Store 变更中写入主记录和全部明细，只调用一次 `persistProductionMaterialPrepStore()`。

主记录构造：

```ts
const session: PickupSession = {
  pickupSessionId: `pickup-session:${node.nodeId}`,
  pickupSessionNo: `领料-${node.productionOrderNo}-${String(node.sequence).padStart(2, '0')}`,
  pickupNodeId: node.nodeId,
  pickupNodeVersion: node.version,
  prepOrderId: node.prepOrderId,
  productionOrderId: node.productionOrderId,
  nodeType: node.nodeType,
  pickupRecordIds: details.map((detail) => detail.pickupRecordId),
  receiverName: input.receiverName,
  pickedAt,
  toWarehouseArea: input.warehouseArea,
  toLocationCode: input.locationCode,
  status: '本轮已领完',
  warehouseSyncStatus: '已回写',
}
```

保留 `appendPickupRecordFromPrepRecord()` 给既有兼容调用；PC 和 PDA 新流程必须改用节点函数。

新增 `recordPickupSessionWarehouseSyncResult(pickupSessionId, result, storage)`，只更新既有主记录的 `warehouseSyncStatus` 和错误信息。仓储清位/回写失败时标记为“回写异常待重试”；重试成功改为“已回写”。任何重试都不得再次创建主记录或累计明细数量。原型只表达同步结果与防重规则，不实现 WLS 页面或真实接口。

- [ ] **步骤 4：验证退回仍关联行级明细**

给 `MaterialPrepOrderProjection` 增加 `pickupSessions`，但 `MaterialPickupReturnRecord.pickupRecordId` 不变。在退回检查脚本中断言每条退回仍能找到对应的主记录明细。

- [ ] **步骤 5：运行数据闭环检查**

```bash
npm run check:material-prep-pickup-management
npm run check:cutting-prep-pickup-return-linkage
```

预期：PASS；重复确认不新增主记录，退回仍能定位物料明细。

- [ ] **步骤 6：Commit**

```bash
git add src/data/fcs/cutting/production-material-prep.ts scripts/check-material-prep-pickup-management.ts scripts/check-cutting-prep-pickup-return-linkage.ts
git commit -m "feat(裁床): 一次确认生成领料主记录与明细"
```

## 5. 任务 4：将领料管理迁移为待领节点标准列表

**文件：**

- 修改：`src/pages/process-factory/cutting/pickup-management.ts`
- 修改：`scripts/check-material-prep-pickup-management.ts`

- [ ] **步骤 1：先写标准列表和业务文案失败断言**

```ts
assertIncludes(pickupManagementSource, '// @page-pattern: list', '领料管理必须声明标准列表页')
assertIncludes(pickupManagementSource, 'renderStandardListPage', '缺少标准列表骨架')
assertIncludes(pickupManagementSource, 'renderStandardListTable', '缺少标准列表表格')
assertIncludes(pickupManagementSource, 'renderTablePagination', '缺少标准分页')
assertIncludes(pickupPageHtml, '未配齐清单', '页面必须区分未配齐可领节点')
assertIncludes(pickupPageHtml, '已配齐待领', '页面必须区分收尾节点')
assertIncludes(pickupPageHtml, '历史有效已领', '页面缺少累计已领口径')
assertNotIncludes(pickupPageHtml, '一条已确认配料记录对应一条裁床待领料通知', '不得保留旧口径')
assertNotIncludes(pickupPageHtml, '暂不领', '等待不能成为裁床操作')
assertNotIncludes(pickupPageHtml, '标记部分领料', '裁床不得选择上游汇总状态')
```

- [ ] **步骤 2：运行专项和列表门禁并确认失败**

```bash
npm run check:material-prep-pickup-management
npm run check:list-page-governance:static
```

- [ ] **步骤 3：接入标准列表组件**

文件顶部加入 `// @page-pattern: list`，并复用：

```ts
renderStandardListPage
renderStandardListTable
renderTablePagination
renderStandardListColumnSettings
loadListColumnPreferences
saveListColumnPreferences
sortStandardListRows
paginateStandardListRows
```

偏好键固定为：

```ts
const pickupListPreferenceKey = 'standard-list:/fcs/craft/cutting/pickup-management'
const pickupListPageSizes = [10, 20, 50]
```

列显示、顺序、冻结和每页条数持久化；当前页和排序不持久化。

- [ ] **步骤 4：定义节点级标准列**

```ts
const pickupNodeColumns: Array<StandardListColumn<PickupNodeProjection>> = [
  { key: 'nodeType', title: '当前领料节点', width: 150, required: true, sortable: true, render: renderNodeTypeCell },
  { key: 'productionOrder', title: PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE, width: 220, required: true, sortable: true, render: renderNodeOrderCell },
  { key: 'materials', title: '当前节点全部物料', width: 420, required: true, render: renderNodeMaterialsCell },
  { key: 'picked', title: '历史有效已领', width: 180, sortable: true, render: renderEffectivePickedCell },
  { key: 'shortage', title: '领后剩余缺口', width: 190, sortable: true, render: renderRemainingShortageCell },
  { key: 'sourceLocation', title: '中转仓承载位置', width: 220, required: true, render: renderNodeSourceLocationCell },
  { key: 'updatedAt', title: '节点更新时间', width: 170, sortable: true, render: (node) => escapeHtml(node.updatedAt) },
  { key: 'actions', title: '操作', width: 150, required: true, sticky: 'right', render: renderNodeActions },
]
```

必需列和操作列不可隐藏；操作列固定右侧。

- [ ] **步骤 5：实现节点统计、筛选和操作**

48px 单行统计：未配齐清单、已配齐待领、当前可领节点。筛选保留关键词、物料关键词并增加节点类型。操作仅保留：查看当前节点、办理领料入库、查看生产单领料历史。

- [ ] **步骤 6：实现局部刷新**

排序、分页、列设置和筛选只刷新 `stats/table/pagination/overlay` 四个 `data-pickup-region`。为局部按钮加 `data-skip-page-rerender="true"`；输入不在每次 `input` 时整页重绘。

- [ ] **步骤 7：运行列表检查**

```bash
npm run check:material-prep-pickup-management
npm run check:list-page-governance
```

预期：PASS，且未修改列表基线 JSON。

- [ ] **步骤 8：Commit**

```bash
git add src/pages/process-factory/cutting/pickup-management.ts scripts/check-material-prep-pickup-management.ts
git commit -m "feat(裁床): 按待领节点重做领料管理列表"
```

## 6. 任务 5：改造节点详情与历史领料主记录

**文件：**

- 修改：`src/pages/process-factory/cutting/pickup-management.ts`
- 修改：`scripts/check-material-prep-pickup-management.ts`
- 修改：`scripts/check-cutting-prep-pickup-return-linkage.ts`

- [ ] **步骤 1：先写详情失败断言**

```ts
assertIncludes(detailHtml, '当前节点全部物料', '详情必须按节点展示')
assertIncludes(detailHtml, '历史有效已领', '详情缺少累计口径')
assertIncludes(detailHtml, '仍缺物料', '未配齐节点必须展示缺口')
assertIncludes(detailHtml, '本轮全部领取', '主动作必须表达领取整个节点')
assertIncludes(historyHtml, '领料主记录', '历史必须按一次交接展示')
assertIncludes(historyHtml, '领料明细', '主记录必须可展开明细')
assertNotIncludes(detailHtml, '请输入领料数量', '不得要求裁床决定部分领取数量')
```

- [ ] **步骤 2：运行检查并确认失败**

运行 `npm run check:material-prep-pickup-management`，预期 FAIL。

- [ ] **步骤 3：详情改为节点级核对**

详情参数改为 `pickupNodeId`。展示节点类型、版本、生产单、配料单、全部物料、每条需求/历史有效已领/当前可领/领后剩余、来源位置和裁床接收位置。

未配齐节点显示仍缺物料但无“暂不领”；已配齐节点显示“本轮为收尾领料”。现有打回入口按来源配料记录保留，不扩展新异常规则。

- [ ] **步骤 4：历史按主记录展开行级明细**

使用 `projection.pickupSessions` 渲染领料主记录；通过 `session.pickupRecordIds` 找行级明细。主记录显示“本轮已领完”和仓储回写状态；回写异常显示“回写异常待重试”，但不得重新执行领料。行级明细继续提供现有退回入口。

- [ ] **步骤 5：运行详情与退回检查**

```bash
npm run check:material-prep-pickup-management
npm run check:cutting-prep-pickup-return-linkage
```

预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add src/pages/process-factory/cutting/pickup-management.ts scripts/check-material-prep-pickup-management.ts scripts/check-cutting-prep-pickup-return-linkage.ts
git commit -m "feat(裁床): 补齐节点详情与领料主记录"
```

## 7. 任务 6：把 PDA 领料改为“确认当前节点全部领取”

**文件：**

- 修改：`src/pages/pda-warehouse-wait-process.ts:850-930`
- 修改：`src/pages/pda-warehouse-wait-process.ts:2115-2198`
- 修改：`src/pages/process-factory/cutting/pickup-management.ts`
- 修改：`scripts/check-pda-pickup-flow.ts`
- 修改：`scripts/check-material-prep-pickup-management.ts`

- [ ] **步骤 1：先写 PDA 失败断言**

```ts
assertIncludes(pageSource, 'pickupNodeId', 'PC 到 PDA 必须传待领节点标识')
assertIncludes(pageSource, 'pickupNodeVersion', 'PC 到 PDA 必须传节点版本')
assertIncludes(pageSource, 'appendPickupSessionFromNode', '确认动作必须创建节点级领料主记录')
assertIncludes(pdaHtml, '确认全部领料', '主动作必须明确领取当前节点全部物料')
assertNotIncludes(pdaHtml, '请输入实领数量', '不得让裁床决定部分领取数量')
```

- [ ] **步骤 2：运行检查并确认失败**

```bash
npm run check:pda-pickup-flow
npm run check:material-prep-pickup-management
```

预期：至少一项 FAIL，证明旧页面仍按配料记录或可编辑数量办理。

- [ ] **步骤 3：PC 跳转携带节点身份与版本**

`buildWaitProcessClaimHref()` 改为传递：

```ts
pickupNodeId: node.pickupNodeId,
pickupNodeVersion: String(node.version),
productionOrderId: node.productionOrderId,
materialPrepOrderId: node.materialPrepOrderId,
```

保留来源配料记录 ID 仅用于追溯，不再作为领料操作主键。

- [ ] **步骤 4：PDA 展示只读的整节点物料清单**

按节点展示生产单、节点类型、来源货位，以及每条物料的当前可领数量。物料数量、卷件数均不可编辑；仅保留裁床待加工仓库区域、货位等现有接收位置字段。主按钮统一为“确认全部领料”。

- [ ] **步骤 5：确认时原子创建主记录与明细**

确认处理函数调用：

```ts
appendPickupSessionFromNode({
  pickupNodeId,
  pickupNodeVersion,
  receiverName: operator.name,
  warehouseArea: destination.warehouseArea,
  locationCode: destination.locationCode,
  waitProcessLedgerEventId,
})
```

成功后运行时事件记录 `pickupSessionId`、`pickupNodeId`、`pickupRecordIds` 和 `warehouseSyncStatus`；不得根据表单输入重新计算领料数量。版本冲突时显示“当前待领物料已更新，请重新核对全部物料后再确认领料。”

- [ ] **步骤 6：运行 PDA 与节点检查**

```bash
npm run check:pda-pickup-flow
npm run check:material-prep-pickup-management
```

预期：PASS。

- [ ] **步骤 7：Commit**

```bash
git add src/pages/pda-warehouse-wait-process.ts src/pages/process-factory/cutting/pickup-management.ts scripts/check-pda-pickup-flow.ts scripts/check-material-prep-pickup-management.ts
git commit -m "feat(裁床): 按待领节点确认全部领料"
```

## 8. 任务 7：补充端到端浏览器验收

**文件：**

- 新建：`tests/cutting-pickup-node-flow.spec.ts`
- 修改：`package.json`

- [ ] **步骤 1：先写核心关系场景**

在 `tests/cutting-pickup-node-flow.spec.ts` 中覆盖：

```ts
test('同一生产单任何时刻最多一个可操作节点', async ({ page }) => {})
test('仍未配齐时形成新的未配齐节点并一次全部领取', async ({ page }) => {})
test('累计已配齐时直接形成已配齐待领节点', async ({ page }) => {})
test('确认节点生成一条领料主记录和多条物料明细', async ({ page }) => {})
test('重复确认同一节点不会生成第二条主记录', async ({ page }) => {})
test('仓储回写失败只标记异常且重试不重复领料', async ({ page }) => {})
```

每个场景必须同时断言页面结果与持久化 Mock store 结果，不能只断言按钮可点击。

- [ ] **步骤 2：补列表交互与分辨率场景**

覆盖：

- 1366×768 与 1280×720 下页面主体无横向溢出，宽表仅在表格容器内滚动。
- 操作列横向滚动后仍固定右侧；用户冻结列保持固定左侧。
- 排序、显示列、冻结列和分页可用；只有列偏好与每页条数被持久化。
- 筛选、分页、列设置不替换页面根节点，不造成整页闪烁或滚动位置丢失。
- 打开节点详情、进入 PDA、确认领料等关键点击到反馈均低于 200ms。

- [ ] **步骤 3：注册测试脚本**

在 `package.json` 增加：

```json
"check:cutting-pickup-node-e2e": "playwright test tests/cutting-pickup-node-flow.spec.ts"
```

- [ ] **步骤 4：先运行并确认失败，再完成最小修正**

```bash
npm run check:cutting-pickup-node-e2e
```

首次预期：FAIL。仅修正本任务页面与数据实现，不扩大到无关模块。

- [ ] **步骤 5：运行并确认通过**

```bash
npm run check:cutting-pickup-node-e2e
```

预期：PASS。

- [ ] **步骤 6：Commit**

```bash
git add tests/cutting-pickup-node-flow.spec.ts package.json
git commit -m "test(裁床): 覆盖待领节点完整流程"
```

## 9. 任务 8：完成原型审查记录与交付验证

**文件：**

- 新建：`docs/prototype-review-records/2026-07-22-cutting-pickup-node-relationship.md`
- 参考：`docs/higood-indonesia-factory-product-design-guidelines.md`
- 参考：`docs/higood-indonesia-factory-prototype-review-checklist.md`
- 参考：`docs/prototype-review-record-template.md`

- [ ] **步骤 1：按模板写审查记录**

记录至少包括：裁床操作角色、PC 管理端与 PDA 执行端职责、弱网/重复点击防错、节点版本冲突提示、中文状态口径、整节点领取规则、标准列表分页与列治理、1280×720 最低分辨率、交互响应检查，以及“中转仓配料不在本仓库实现范围”的例外边界。

- [ ] **步骤 2：运行全部专项检查**

```bash
npm run check:pickup-node-domain
npm run check:material-prep-pickup-management
npm run check:pda-pickup-flow
npm run check:cutting-prep-pickup-return-linkage
npm run check:list-page-governance
npm run check:prototype-design-governance
npm run check:cutting-pickup-node-e2e
```

预期：全部 PASS。

- [ ] **步骤 3：运行构建检查**

```bash
npm run build
```

预期：列表治理前置检查、TypeScript 编译和 Vite 构建全部通过。

- [ ] **步骤 4：浏览器人工复核完整业务链路**

依次验证：

1. 首次未配齐到货形成一个“未配齐清单”节点。
2. 节点未领取前再次到货，合并到同一活动节点并更新版本。
3. 裁床确认后，当前节点全部物料进入待加工仓，并生成一条主记录。
4. 后续到货后累计仍未配齐，出现新的未配齐节点。
5. 再次确认后形成第二条独立主记录。
6. 最后一批到货使累计数量配齐，直接出现“已配齐待领”节点，不经过未配齐货架。
7. 最终确认后页面呈现“全部配齐、全部领料”；历史中可展开三次主记录的物料明细。
8. 整个过程中页面不存在“暂不领”动作，也不存在可编辑的部分领料数量。
9. 模拟仓储清位回写失败后，原领料主记录标记“回写异常待重试”；重试成功只更新同步状态，不新增主记录或领料明细。

- [ ] **步骤 5：检查改动边界**

```bash
git diff --check
git status --short
```

确认未修改 `scripts/standard-list-page-baseline.json`，未引入后端、接口层、状态管理框架或无关重构。

- [ ] **步骤 6：同步 CodeGraph 索引**

```bash
codegraph sync
codegraph status
```

预期：索引健康，无待同步文件。

- [ ] **步骤 7：Commit**

```bash
git add docs/prototype-review-records/2026-07-22-cutting-pickup-node-relationship.md
git commit -m "docs(裁床): 记录待领节点原型审查"
```

## 10. 完成定义

只有同时满足以下条件，才能声明实现完成：

- 一个生产单始终只有一张裁床配料单；任何时刻最多一个活动待领节点。
- 未领取节点遇到后续到货时合并更新，不重复生成可操作节点。
- 已领取后再次到货，先按物料行计算“历史有效已领 + 当前可领”是否达到需求。
- 累计仍未配齐才形成新的未配齐节点；累计已配齐直接形成已配齐待领节点。
- 裁床确认必定领取当前节点全部物料，一次确认对应一条领料主记录和多条物料明细。
- 裁床页面只表达“本轮已领完”；“部分领料”仅作为 WLS 整张配料单的派生汇总状态。
- 最后一轮确认后同时满足“全部配齐”和“全部领料”。
- PC、PDA、历史、退回链路、标准列表、治理检查、端到端测试和构建均通过。
- 仓储清位/回写异常只改变既有领料主记录的同步状态，重试不会重复领料。
- 中转仓配料算法及其操作页面没有被纳入本仓库的实现范围。
