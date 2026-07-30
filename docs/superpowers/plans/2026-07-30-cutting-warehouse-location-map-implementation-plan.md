# 裁床仓库库位图实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers-zh:subagent-driven-development`（推荐）或 `superpowers-zh:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在现有裁床待加工仓和待交出仓中落地二维库位图，让主管完成一次性库位编排，让仓管查看空闲/占用分布，并在领料入仓时选择同一货架内连续相邻的多个空闲库位。

**架构：** 继续使用现有“仓库—库区—货架—库位”主数据和现有两个仓库页面，不新增仓储路由或另一套库存账。主数据补充稳定显示顺序与未编排库位；一个共享投影把待加工物料和待交出中转袋事实归集为库位占用；一个字符串模板组件同时服务 PFOS 查看/编排和 PDA 选位。原有库区、货架、库位文本字段继续保留作兼容显示，新写入事实同时保存稳定库位 ID。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有本地 Mock/运行时事件账、Node.js 断言检查、Playwright、CodeGraph。

**设计依据：** `docs/superpowers/specs/2026-07-30-cutting-warehouse-location-map-design.md`

---

## 1. 文件范围与职责

### 新建文件

- `src/pages/process-factory/cutting/warehouse-location-map-model.ts`
  - 定义库位图、占用明细、未定位库存和选位校验类型。
  - 按稳定顺序生成库区卡片、货架行和库位格。
  - 将待加工仓库存与待交出仓中转袋事实归集到稳定库位 ID。
  - 判断多选库位是否同库区、同货架、连续且空闲。
- `src/components/ui/warehouse-location-map.ts`
  - 渲染“空闲/占用”两态库位图、占用详情、选位反馈和编排按钮。
  - 保证货架行内部横向滚动，页面主体不横向溢出。
  - 只输出通用展示和 `data-*` 契约，不直接读业务 Store。
- `src/pages/process-factory/cutting/warehouse-location-map.ts`
  - 组合主数据、库存事实和共享库位图组件。
  - 提供 PFOS 查看模式、编排模式、占用详情与局部交互处理。
  - 编排保存后只局部刷新库位图区，不触发整页重绘。
- `scripts/check-cutting-warehouse-location-map.ts`
  - 校验稳定排序、两态投影、占用详情、相邻多选、编号变更和页面集成。
- `tests/cutting-warehouse-location-map.spec.ts`
  - 在浏览器中验证待加工/待交出库位图、占用详情、编排和 PDA 选位。
- `docs/prototype-review-records/2026-07-30-cutting-warehouse-location-map.md`
  - 记录角色、任务、文案、状态、防错、协作和低分辨率自查结论。

### 修改文件

- `src/data/fcs/factory-internal-warehouse.ts`
  - 为库区、货架、库位补充稳定 `displayOrder`。
  - 为仓库补充 `unassignedLocationList`，只承接尚未归入货架的既有库位。
  - 增加编排顺序、编号修改和未编排库位归入货架的最小变更函数。
  - 库位 ID 保持不变，编号修改不改变占用和顺序。
- `src/data/fcs/cutting/production-material-prep.ts`
  - 领料会话和领料记录保存 `toLocationIds`。
  - 保留 `toWarehouseArea`、`toLocationCode` 作为兼容摘要，取第一选中库位。
- `src/pages/process-factory/cutting/wait-handover-runtime.ts`
  - 中转袋入仓事件保存稳定 `locationId`。
  - 继续保存 `warehouseArea` 和 `locationCode`，兼容现有表格与历史记录。
- `src/pages/process-factory/cutting/warehouse-hub.ts`
  - 将两个仓库页面“库区库位”页签中的静态库位行替换为共享库位图。
  - 保留库存、领料、装袋、入仓、交出等既有页签和动作。
- `src/main-handlers/fcs-handlers.ts`
  - 接入库位图局部交互处理器。
- `src/pages/pda-warehouse-wait-process.ts`
  - 在裁床“中转仓领料”确认页用库位图替代库区/库位下拉。
  - 支持同一货架连续空闲库位多选，并把稳定 ID 写入领料会话。
- `src/pages/pda-cutting-inbound.ts`
  - “中转袋入仓”继续保留扫码库位能力，同时提供可视化空闲库位选择。
  - 单选占用库位时阻断；确认后写入同一待交出仓运行时事实。
- `src/pages/pda-warehouse-shared.ts`
  - 保留现有三级下拉兼容函数。
  - 增加按稳定 ID 解析库位路径的共享 helper，不复制查找逻辑。
- `scripts/check-factory-internal-warehouse-model.ts`
  - 增加显示顺序、未编排库位和编号变更不改 ID 的断言。
- `scripts/check-cutting-warehouse-management-switch.ts`
  - 将“库区库位”页签的静态行检查更新为库位图契约。
- `package.json`
  - 增加库位图专项检查和浏览器验收命令。

### 明确不修改

- 不新增“库位组”。
- 不新增仓储菜单、仓库路由或 PDA 一级入口。
- 不改变库存、装袋、交出和盘点的既有业务动作。
- 不让人员手工切换“空闲/占用”。
- 不引入 React、拖拽框架、图表库、状态管理或后端接口。
- 不把本功能扩展到印花、染色、毛织或特殊工艺仓库页面。

---

## 2. 统一业务契约

实现前先固定以下类型，后续数据、页面和检查都使用同一命名：

```ts
export type CuttingWarehouseMapKind = 'WAIT_PROCESS' | 'WAIT_HANDOVER'
export type WarehouseLocationBusinessStatus = 'EMPTY' | 'OCCUPIED'
export type WarehouseLocationMapMode = 'VIEW' | 'SELECT' | 'LAYOUT'

export interface WarehouseLocationMapOccupancy {
  occupancyId: string
  locationId: string
  warehouseKind: CuttingWarehouseMapKind
  sourceKind: 'MATERIAL' | 'TRANSFER_BAG'
  productionOrderNo: string
  objectNo: string
  objectName: string
  colorOrSpec: string
  qty: number
  unit: string
  inboundBy: string
  inboundAt: string
}

export interface WarehouseLocationMapCell {
  locationId: string
  locationNo: string
  locationName: string
  displayOrder: number
  businessStatus: WarehouseLocationBusinessStatus
  occupancies: WarehouseLocationMapOccupancy[]
}

export interface WarehouseLocationMapShelf {
  shelfId: string
  shelfNo: string
  shelfName: string
  displayOrder: number
  locations: WarehouseLocationMapCell[]
}

export interface WarehouseLocationMapArea {
  areaId: string
  areaName: string
  displayOrder: number
  shelves: WarehouseLocationMapShelf[]
}

export interface CuttingWarehouseLocationMapProjection {
  warehouseId: string
  warehouseKind: CuttingWarehouseMapKind
  warehouseName: string
  totalLocationCount: number
  emptyLocationCount: number
  occupiedLocationCount: number
  areas: WarehouseLocationMapArea[]
  unassignedLocations: WarehouseLocationMapCell[]
  unlocatedOccupancies: WarehouseLocationMapOccupancy[]
}

export interface WarehouseLocationSelectionResult {
  ok: boolean
  message: string
  selectedLocationIds: string[]
}
```

强制不变量：

- 页面层级只能是仓库、库区、货架、库位。
- `locationId` 是稳定身份；`locationNo` 和 `locationName` 可以修改。
- 库区、货架、库位都按 `displayOrder` 排列，不根据编号实时重排。
- 日常库位图只输出 `EMPTY` 和 `OCCUPIED` 两种业务状态。
- `STOPPED` 库位以及所属库区或货架已停用的库位不进入日常图和统计。
- “本次已选”只是一种 CSS 选中效果，不进入投影状态。
- 待加工仓只有有效在库数量大于 0 的物料才形成占用。
- 待交出仓只有已入仓且尚未交出的中转袋才形成占用。
- 一个库位允许归集多条占用事实；只要仍有一条有效事实就显示占用。
- 多选只能发生在待加工仓入仓场景。
- 多选必须同仓、同库区、同货架，并且 `displayOrder` 连续。
- 占用、停用、未编排库位不能进入本次选择。
- Web、PDA 都调用同一个投影和同一个相邻校验函数。

---

## 3. 实施任务

### 任务 1：先建立专项检查和稳定编排主数据

**文件：**

- 新建：`scripts/check-cutting-warehouse-location-map.ts`
- 修改：`src/data/fcs/factory-internal-warehouse.ts`
- 修改：`scripts/check-factory-internal-warehouse-model.ts`
- 修改：`package.json`

- [ ] 1.1 在 `package.json` 增加专项命令：

```json
"check:cutting-warehouse-location-map": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-cutting-warehouse-location-map.ts",
"check:cutting-warehouse-location-map-e2e": "playwright test tests/cutting-warehouse-location-map.spec.ts"
```

- [ ] 1.2 先创建失败检查，导入尚不存在的编排能力：

```ts
import assert from 'node:assert/strict'
import {
  buildDefaultFactoryInternalWarehouses,
  findFactoryInternalWarehouseByFactoryAndKind,
  moveFactoryWarehouseArea,
  moveFactoryWarehouseLocation,
  moveFactoryWarehouseShelf,
  renameFactoryWarehouseLocation,
} from '../src/data/fcs/factory-internal-warehouse.ts'

const warehouses = buildDefaultFactoryInternalWarehouses()
const cuttingWaitProcess = warehouses.find(
  (item) => item.factoryKind === 'CENTRAL_CUTTING' && item.warehouseKind === 'WAIT_PROCESS',
)
assert(cuttingWaitProcess, '缺少裁床待加工仓')
assert(cuttingWaitProcess.areaList.every((area) => Number.isInteger(area.displayOrder)), '库区缺少稳定顺序')
assert(
  cuttingWaitProcess.areaList.every((area) =>
    area.shelfList.every((shelf) =>
      Number.isInteger(shelf.displayOrder)
      && shelf.locationList.every((location) => Number.isInteger(location.displayOrder)),
    ),
  ),
  '货架或库位缺少稳定顺序',
)
assert.deepEqual(cuttingWaitProcess.unassignedLocationList, [], '默认仓库未编排区必须可读取')
```

- [ ] 1.3 运行检查确认失败：

```bash
npm run check:cutting-warehouse-location-map
```

预期：TypeScript 报告 `displayOrder`、`unassignedLocationList` 或移动函数尚不存在。

- [ ] 1.4 在仓库主数据类型中增加稳定顺序和未编排列表：

```ts
export interface FactoryWarehouseLocation {
  locationId: string
  locationNo: string
  locationName: string
  displayOrder: number
  status: FactoryWarehouseLocationStatus
  remark?: string
}

export interface FactoryWarehouseShelf {
  shelfId: string
  shelfNo: string
  shelfName: string
  displayOrder: number
  locationList: FactoryWarehouseLocation[]
  status: FactoryWarehouseLocationStatus
  remark?: string
}

export interface FactoryWarehouseArea {
  areaId: string
  areaName: string
  displayOrder: number
  shelfList: FactoryWarehouseShelf[]
  status: FactoryWarehouseLocationStatus
  remark?: string
}

export interface FactoryInternalWarehouse {
  // 保留现有字段
  areaList: FactoryWarehouseArea[]
  unassignedLocationList: FactoryWarehouseLocation[]
}
```

- [ ] 1.5 让默认数据和新增节点都写入从 1 开始的顺序：

```ts
function normalizeDisplayOrders<T extends { displayOrder: number }>(items: T[]): void {
  items
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .forEach((item, index) => {
      item.displayOrder = index + 1
    })
}
```

默认仓库生成时必须设置：

```ts
areaList: areaList.map((area, areaIndex) => ({
  ...area,
  displayOrder: areaIndex + 1,
  shelfList: area.shelfList.map((shelf, shelfIndex) => ({
    ...shelf,
    displayOrder: shelfIndex + 1,
    locationList: shelf.locationList.map((location, locationIndex) => ({
      ...location,
      displayOrder: locationIndex + 1,
    })),
  })),
})),
unassignedLocationList: [],
```

- [ ] 1.6 增加最小编排变更函数：

```ts
export function moveFactoryWarehouseArea(
  warehouseId: string,
  areaId: string,
  direction: -1 | 1,
): boolean

export function moveFactoryWarehouseShelf(
  warehouseId: string,
  areaId: string,
  shelfId: string,
  direction: -1 | 1,
): boolean

export function moveFactoryWarehouseLocation(
  warehouseId: string,
  areaId: string,
  shelfId: string,
  locationId: string,
  input: { direction?: -1 | 1; targetShelfId?: string },
): boolean

export function renameFactoryWarehouseLocation(
  warehouseId: string,
  areaId: string,
  shelfId: string,
  locationId: string,
  input: { locationNo: string; locationName: string },
): boolean
```

移动函数交换顺序后调用 `normalizeDisplayOrders`；重命名函数只能修改编号和名称，不得修改 `locationId`、所属货架或 `displayOrder`。

- [ ] 1.7 补充检查：重命名前后 ID 和顺序不变；占用库位不能移入未编排区；未编排库位归入目标货架后获得新的末位顺序。

- [ ] 1.8 运行主数据检查：

```bash
npm run check:factory-internal-warehouse-model
npm run check:cutting-warehouse-location-map
```

预期：两条命令均通过。

- [ ] 1.9 只提交本任务文件：

```bash
git add package.json \
  scripts/check-cutting-warehouse-location-map.ts \
  scripts/check-factory-internal-warehouse-model.ts \
  src/data/fcs/factory-internal-warehouse.ts
git commit -m "feat(裁床仓库): 增加库位稳定编排顺序"
```

### 任务 2：建立空闲/占用投影和相邻选择规则

**文件：**

- 新建：`src/pages/process-factory/cutting/warehouse-location-map-model.ts`
- 修改：`scripts/check-cutting-warehouse-location-map.ts`

- [ ] 2.1 在专项检查中先写四组失败场景：

```ts
const waitProcessMap = buildCuttingWarehouseLocationMap({
  warehouse: cuttingWaitProcess,
  occupancies: waitProcessOccupancies,
})
assert.equal(waitProcessMap.emptyLocationCount + waitProcessMap.occupiedLocationCount, waitProcessMap.totalLocationCount)
assert.equal(waitProcessMap.areas.flatMap((area) => area.shelves).flatMap((shelf) => shelf.locations)
  .every((location) => ['EMPTY', 'OCCUPIED'].includes(location.businessStatus)), true)

assert.deepEqual(
  validateWarehouseLocationSelection(waitProcessMap, ['LOC-A-01-01', 'LOC-A-01-02']),
  { ok: true, message: '', selectedLocationIds: ['LOC-A-01-01', 'LOC-A-01-02'] },
)
assert.equal(
  validateWarehouseLocationSelection(waitProcessMap, ['LOC-A-01-01', 'LOC-B-01-01']).message,
  '请选择同一货架内连续相邻的空闲库位。',
)
```

另外覆盖：

- 中间隔着占用库位时不能跨过去选择。
- 编号不连续但显示顺序连续时允许选择。
- 停用库位不进入图和统计。
- 一个库位有两条物料时仍只计一个占用库位。
- 待交出袋完成交出后不再进入占用。
- 找不到稳定库位 ID 且无法用历史编号匹配的事实进入 `unlocatedOccupancies`。

- [ ] 2.2 运行专项检查确认失败：

```bash
npm run check:cutting-warehouse-location-map
```

预期：报错找不到 `warehouse-location-map-model.ts`。

- [ ] 2.3 实现稳定路径解析：

```ts
export interface FactoryWarehouseLocationPath {
  warehouseId: string
  areaId: string
  areaName: string
  shelfId: string
  shelfNo: string
  locationId: string
  locationNo: string
  displayOrder: number
}

export function findWarehouseLocationPath(
  warehouse: FactoryInternalWarehouse,
  input: { locationId?: string; areaName?: string; shelfNo?: string; locationNo?: string },
): FactoryWarehouseLocationPath | null
```

匹配优先级固定为：

1. `locationId`。
2. 同仓库内 `areaName + shelfNo + locationNo`。
3. 同仓库内唯一的 `areaName + locationNo`。
4. 无法唯一匹配则返回 `null`，不得猜测库位。

- [ ] 2.4 实现投影函数：

```ts
export function buildCuttingWarehouseLocationMap(input: {
  warehouse: FactoryInternalWarehouse
  occupancies: WarehouseLocationMapOccupancy[]
}): CuttingWarehouseLocationMapProjection
```

实现顺序：

1. 过滤停用库区、货架和库位。
2. 按各层 `displayOrder` 排列。
3. 将占用事实按 `locationId` 分组。
4. 有有效占用的库位输出 `OCCUPIED`，否则输出 `EMPTY`。
5. 未匹配事实进入 `unlocatedOccupancies`。
6. 统计基于最终可见库位，不包含停用和未编排库位。

- [ ] 2.5 实现相邻校验：

```ts
export function validateWarehouseLocationSelection(
  projection: CuttingWarehouseLocationMapProjection,
  selectedLocationIds: string[],
): WarehouseLocationSelectionResult {
  const uniqueIds = Array.from(new Set(selectedLocationIds))
  if (!uniqueIds.length) {
    return { ok: false, message: '请选择空闲库位。', selectedLocationIds: [] }
  }
  const cells = findSelectedCells(projection, uniqueIds)
  const invalid = cells.length !== uniqueIds.length
    || cells.some((cell) => cell.businessStatus !== 'EMPTY')
    || !isSameShelf(cells)
    || !hasConsecutiveDisplayOrders(cells)
  return invalid
    ? { ok: false, message: '请选择同一货架内连续相邻的空闲库位。', selectedLocationIds: uniqueIds }
    : { ok: true, message: '', selectedLocationIds: uniqueIds }
}
```

- [ ] 2.6 实现两类占用来源转换：

```ts
export function buildWaitProcessLocationOccupancies(
  items: FactoryWaitProcessStockItem[],
): WarehouseLocationMapOccupancy[]

export function buildWaitHandoverLocationOccupancies(
  projection: WaitHandoverRuntimeProjection,
): WarehouseLocationMapOccupancy[]
```

待加工只保留 `availableQty ?? receivedQty - issuedQty > 0`；待交出只保留已入仓且尚未交出的中转袋。历史数据先用路径兼容字段匹配，新数据优先使用稳定 ID。

- [ ] 2.7 运行专项检查：

```bash
npm run check:cutting-warehouse-location-map
```

预期：所有投影与相邻规则断言通过。

- [ ] 2.8 提交投影：

```bash
git add scripts/check-cutting-warehouse-location-map.ts \
  src/pages/process-factory/cutting/warehouse-location-map-model.ts
git commit -m "feat(裁床仓库): 建立库位占用投影与相邻校验"
```

### 任务 3：实现共享库位图字符串组件

**文件：**

- 新建：`src/components/ui/warehouse-location-map.ts`
- 修改：`scripts/check-cutting-warehouse-location-map.ts`

- [ ] 3.1 先在专项检查中断言组件契约：

```ts
const html = renderWarehouseLocationMap({
  projection: waitProcessMap,
  mode: 'VIEW',
  selectedLocationIds: [],
})
assert(html.includes('待加工仓库位图'))
assert(html.includes('空闲'))
assert(html.includes('占用'))
assert(!html.includes('部分占用'))
assert(!html.includes('预留'))
assert(html.includes('data-warehouse-map-area'))
assert(html.includes('data-warehouse-map-shelf'))
assert(html.includes('data-warehouse-map-location'))
assert(html.includes('overflow-x-auto'))
```

- [ ] 3.2 运行专项检查确认组件尚不存在。

- [ ] 3.3 实现组件输入：

```ts
export interface RenderWarehouseLocationMapOptions {
  projection: CuttingWarehouseLocationMapProjection
  mode: WarehouseLocationMapMode
  selectedLocationIds: string[]
  selectionMessage?: string
}

export function renderWarehouseLocationMap(
  options: RenderWarehouseLocationMapOptions,
): string
```

- [ ] 3.4 实现日常图：

- 顶部标题按仓库类型显示“待加工仓库位图”或“待交出仓库位图”。
- 只显示空闲、占用图例。
- 摘要显示“共 N 个、空闲 N 个、占用 N 个”。
- 库区按响应式卡片排列。
- 每个货架一行，左侧固定货架名，右侧库位区使用 `overflow-x-auto`。
- 空闲格只显示库位编号和“空闲”。
- 占用格显示生产单号以及“面料”或“袋 BAG-xxx”摘要。
- 多条占用显示“POxxx 等”和“2 种物料”或“2 袋”。

- [ ] 3.5 实现三种模式的按钮契约：

```html
<!-- 查看模式 -->
<button data-warehouse-map-action="open-occupancy" data-location-id="...">

<!-- 选择模式 -->
<button data-warehouse-map-action="toggle-location" data-location-id="...">

<!-- 编排模式 -->
<button data-warehouse-map-action="move-location" data-direction="-1" data-location-id="...">
<button data-warehouse-map-action="move-location" data-direction="1" data-location-id="...">
```

占用库位在选择模式中必须带 `disabled`；停用库位不渲染；“本次已选”使用边框和勾选图标表达，但状态文字仍为“空闲”。

- [ ] 3.6 实现占用详情和异常提示：

- 待加工详情显示生产单、物料、颜色/规格、数量单位、入仓人和时间。
- 待交出详情显示生产单、中转袋、裁片数量、入仓人和时间。
- `unlocatedOccupancies` 非空时显示“存在 N 条未定位库存”，并提供“查看未定位库存”。
- `unassignedLocations` 只在编排模式显示。

- [ ] 3.7 运行专项检查：

```bash
npm run check:cutting-warehouse-location-map
```

- [ ] 3.8 提交共享组件：

```bash
git add scripts/check-cutting-warehouse-location-map.ts \
  src/components/ui/warehouse-location-map.ts
git commit -m "feat(裁床仓库): 增加两态库位图组件"
```

### 任务 4：接入 PFOS 两个仓库页面和编排交互

**文件：**

- 新建：`src/pages/process-factory/cutting/warehouse-location-map.ts`
- 修改：`src/pages/process-factory/cutting/warehouse-hub.ts`
- 修改：`src/main-handlers/fcs-handlers.ts`
- 修改：`scripts/check-cutting-warehouse-management-switch.ts`
- 修改：`scripts/check-cutting-warehouse-location-map.ts`

- [ ] 4.1 先更新页面检查：

```ts
appStore.syncFromBrowser('/fcs/craft/cutting/warehouse-management/wait-process?tab=locations')
const waitProcessLocationHtml = renderCraftCuttingWarehouseManagementWaitProcessPage()
assertIncludes(waitProcessLocationHtml, '待加工仓库位图', '待加工仓缺少库位图')
assertIncludes(waitProcessLocationHtml, 'data-warehouse-map-root', '待加工仓未接入共享库位图')
assertNotIncludes(waitProcessLocationHtml, '待裁面料', '不得继续渲染静态库位行')

appStore.syncFromBrowser('/fcs/craft/cutting/warehouse-management/wait-handover?tab=locations')
const waitHandoverLocationHtml = renderCraftCuttingWarehouseManagementWaitHandoverPage()
assertIncludes(waitHandoverLocationHtml, '待交出仓库位图', '待交出仓缺少库位图')
assertIncludes(waitHandoverLocationHtml, '中转袋', '待交出仓占用摘要缺少中转袋')
```

- [ ] 4.2 运行两个检查确认页面仍输出静态库位行：

```bash
npm run check:cutting-warehouse-management-switch
npm run check:cutting-warehouse-location-map
```

- [ ] 4.3 在页面组合模块中提供两个入口：

```ts
export function renderCuttingWarehouseLocationMapSection(
  warehouseKind: CuttingWarehouseMapKind,
): string

export function handleCuttingWarehouseLocationMapEvent(
  target: HTMLElement,
): boolean
```

组合模块负责：

- 找到当前裁床工厂的待加工仓或待交出仓。
- 读取共享占用事实。
- 构造库位图投影。
- 从 URL 的 `layout=1` 决定查看或编排模式。
- 生成“进入编排/退出编排”按钮。

- [ ] 4.4 替换 `warehouse-hub.ts` 中两个 `locationContent`：

```ts
const locationContent = renderCuttingWarehouseLocationMapSection('WAIT_PROCESS')
```

以及：

```ts
const locationContent = renderCuttingWarehouseLocationMapSection('WAIT_HANDOVER')
```

保留 `activeTab === 'locations'` 分支和现有页面外壳，不改其余库存页签。

- [ ] 4.5 实现编排动作：

- 库区：前移、后移。
- 货架：上移、下移。
- 库位：左移、右移。
- 未编排库位：选择目标货架后“归入货架”。
- 库位编号：短弹窗修改编号和名称。
- 已占用库位：允许调整显示顺序和编号，不提供删除或停用动作。

每次动作只更新 `[data-warehouse-map-root]`：

```ts
function refreshWarehouseLocationMapRoot(root: HTMLElement, warehouseKind: CuttingWarehouseMapKind): void {
  root.outerHTML = renderCuttingWarehouseLocationMapSection(warehouseKind)
}
```

按钮带 `data-skip-page-rerender="true"`，处理器返回 `true`，避免 `root.innerHTML` 级整页重绘。

- [ ] 4.6 在 `fcs-handlers.ts` 的裁床处理链中接入：

```ts
await handleCuttingWarehouseLocationMapEvent(target) ||
await handleCraftCuttingWaitProcessEvent(target) ||
await handleCraftCuttingWaitHandoverWebActionsEvent(target) ||
await handleCraftCuttingWaitHandoverEvent(target) ||
```

- [ ] 4.7 运行页面检查：

```bash
npm run check:cutting-warehouse-management-switch
npm run check:cutting-warehouse-location-map
```

- [ ] 4.8 提交 PFOS 页面：

```bash
git add scripts/check-cutting-warehouse-management-switch.ts \
  scripts/check-cutting-warehouse-location-map.ts \
  src/main-handlers/fcs-handlers.ts \
  src/pages/process-factory/cutting/warehouse-hub.ts \
  src/pages/process-factory/cutting/warehouse-location-map.ts
git commit -m "feat(裁床仓库): 接入待加工与待交出库位图"
```

### 任务 5：让 PDA 待加工仓支持连续相邻多选

**文件：**

- 修改：`src/data/fcs/cutting/production-material-prep.ts`
- 修改：`src/pages/pda-warehouse-shared.ts`
- 修改：`src/pages/pda-warehouse-wait-process.ts`
- 修改：`scripts/check-cutting-warehouse-location-map.ts`

- [ ] 5.1 先增加领料事实检查：

```ts
const session = appendPickupSessionFromNode({
  pickupNodeId: node.nodeId,
  pickupNodeVersion: node.version,
  receiverName: '裁床仓管',
  warehouseArea: 'A区',
  locationCode: 'A-01-01',
  toLocationIds: ['LOC-A-01-01', 'LOC-A-01-02'],
  waitProcessLedgerEventId: 'check-location-map',
})
assert.deepEqual(session.toLocationIds, ['LOC-A-01-01', 'LOC-A-01-02'])
assert(session.pickupNodeSnapshot, '领料会话仍需保留节点快照')
```

- [ ] 5.2 在 `PickupRecord`、`PickupSession` 和 `appendPickupSessionFromNode` 输入中增加：

```ts
toLocationIds: string[]
```

写入规则：

- 至少一个稳定库位 ID。
- 第一项解析为兼容字段 `warehouseArea` 和 `locationCode`。
- 同一次领料产生的全部物料记录共享同一组 `toLocationIds`。
- 运行时事件 payload 同时写入 `locationIds`，每个 ID 都能形成同一批物料的占用关联。

- [ ] 5.3 在 `pda-warehouse-shared.ts` 增加：

```ts
export function getWarehouseLocationPathById(
  warehouseId: string,
  locationId: string,
): FactoryWarehouseLocationPath | null
```

该 helper 只负责读取路径，不产生空闲/占用判断。

- [ ] 5.4 将 `renderCuttingPickupDraftPage()` 中“入库库区/入库库位”两个下拉替换为：

```ts
renderWarehouseLocationMap({
  projection: buildCurrentCuttingWaitProcessLocationMap(),
  mode: 'SELECT',
  selectedLocationIds: state.cuttingPickupLocationIds,
  selectionMessage: state.cuttingPickupLocationMessage,
})
```

首屏仍按现有顺序显示：

1. 当前领料节点。
2. 本次全部物料。
3. 选择存放库位。
4. “确认全部领料”唯一主按钮。

- [ ] 5.5 处理 `toggle-location`：

```ts
const nextIds = toggleWarehouseLocationId(
  state.cuttingPickupLocationIds,
  actionNode.dataset.locationId || '',
)
const result = validateWarehouseLocationSelection(projection, nextIds)
if (!result.ok) {
  state.cuttingPickupLocationMessage = result.message
  return updateCuttingPickupLocationMapLocally(container)
}
state.cuttingPickupLocationIds = result.selectedLocationIds
state.cuttingPickupLocationMessage = ''
return updateCuttingPickupLocationMapLocally(container)
```

选择第一个库位后，其他货架、其他库区、占用库位和不能形成连续区间的空闲库位进入不可选状态。

- [ ] 5.6 确认领料前再次调用相邻校验，不信任 DOM 状态：

```ts
const selection = validateWarehouseLocationSelection(
  buildCurrentCuttingWaitProcessLocationMap(),
  state.cuttingPickupLocationIds,
)
if (!selection.ok) {
  window.alert(selection.message)
  return true
}
```

- [ ] 5.7 运行检查：

```bash
npm run check:cutting-warehouse-location-map
npm run check:cutting-pickup-ui-closure
npm run check:material-prep-pickup-management
```

- [ ] 5.8 提交 PDA 待加工仓：

```bash
git add scripts/check-cutting-warehouse-location-map.ts \
  src/data/fcs/cutting/production-material-prep.ts \
  src/pages/pda-warehouse-shared.ts \
  src/pages/pda-warehouse-wait-process.ts
git commit -m "feat(裁床仓库): 支持相邻库位多选入仓"
```

### 任务 6：让 PDA 中转袋入仓接入待交出仓库位图

**文件：**

- 修改：`src/pages/pda-cutting-inbound.ts`
- 修改：`src/pages/process-factory/cutting/wait-handover-runtime.ts`
- 修改：`scripts/check-cutting-warehouse-location-map.ts`

- [ ] 6.1 先增加中转袋入仓事实检查：

```ts
const event = appendWaitHandoverInboundEvent({
  source: 'PDA',
  operator: { operatorName: '裁片仓入仓员' },
  bagCode: 'BAG-MAP-001',
  warehouseArea: 'B区',
  locationCode: 'B-01-02',
  locationId: 'LOC-B-01-02',
  tickets: [ticket],
})
assert.equal(event.payload.locationId, 'LOC-B-01-02')
assert.equal(event.inventoryEffect?.toLocationCode, 'B-01-02')
```

- [ ] 6.2 扩展入仓事件输入：

```ts
export function appendWaitHandoverInboundEvent(input: {
  source: CuttingRuntimeEventSource
  operator: WaitHandoverRuntimeOperator
  bagCode: string
  warehouseArea: string
  locationCode: string
  locationId: string
  tickets: WaitHandoverRuntimeTicketInput[]
  occurredAt?: string
})
```

`payload.locationId` 是稳定身份；`warehouseArea`、`locationCode` 和 `inventoryEffect` 保持兼容。

- [ ] 6.3 扩展 `InboundFormState`：

```ts
selectedLocationId: string
```

保留 `locationLabel` 扫码输入。扫码成功时解析到稳定库位 ID；点击库位图时反向填充 `locationLabel`。

- [ ] 6.4 在“扫库区库位”步骤下方增加可视化兜底：

```ts
renderWarehouseLocationMap({
  projection: buildCurrentCuttingWaitHandoverLocationMap(),
  mode: 'SELECT',
  selectedLocationIds: form.selectedLocationId ? [form.selectedLocationId] : [],
})
```

该场景只允许单选。占用库位不可选；点击占用库位只能查看占用详情，不能覆盖原袋。

- [ ] 6.5 `applyPdaCuttingInboundBusinessTransition()` 增加稳定 ID 校验：

- 扫码或点击得到的库位必须存在于当前裁床待交出仓。
- 库位必须启用、已编排且当前空闲。
- 失败提示分别为“库位不存在，请重新扫描”“该库位已停用，请更换库位”“该库位已被占用，请选择空闲库位”。

- [ ] 6.6 确认成功后从袋内菲票候选构造 `WaitHandoverRuntimeTicketInput[]`，调用 `appendWaitHandoverInboundEvent()`；再次打开待交出仓库位图时，所选格显示生产单和袋号。

- [ ] 6.7 保证局部响应：

- 扫码输入继续使用现有 debounce。
- 点击库位只刷新当前库位图容器和选中摘要。
- 确认入仓只刷新当前工作流卡片。
- 不调用整页 `root.innerHTML`。

- [ ] 6.8 运行检查：

```bash
npm run check:cutting-warehouse-location-map
npm run check:pda-cutting-wait-handover-route-integration
npm run check:cutting-wait-handover-transfer-bag-flow
```

- [ ] 6.9 提交 PDA 待交出仓：

```bash
git add scripts/check-cutting-warehouse-location-map.ts \
  src/pages/pda-cutting-inbound.ts \
  src/pages/process-factory/cutting/wait-handover-runtime.ts
git commit -m "feat(裁床仓库): 接入中转袋可视化选位"
```

### 任务 7：补齐浏览器验收与原型审查

**文件：**

- 新建：`tests/cutting-warehouse-location-map.spec.ts`
- 新建：`docs/prototype-review-records/2026-07-30-cutting-warehouse-location-map.md`
- 修改：`scripts/check-cutting-warehouse-location-map.ts`

- [ ] 7.1 编写浏览器验收：

```ts
import { expect, test } from '@playwright/test'

test('待加工仓库位图只展示空闲和占用并可查看物料', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/warehouse-management/wait-process?tab=locations')
  await expect(page.getByText('待加工仓库位图')).toBeVisible()
  await expect(page.getByText('空闲', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('占用', { exact: true }).first()).toBeVisible()
  await page.locator('[data-warehouse-map-action="open-occupancy"]').first().click()
  await expect(page.getByText('生产单号')).toBeVisible()
  await expect(page.getByText('入仓时间')).toBeVisible()
})

test('待加工仓领料只能多选同货架连续空闲库位', async ({ page }) => {
  await page.goto('/fcs/pda/warehouse/wait-process?scope=cutting&action=pickup')
  await page.locator('[data-pda-warehouse-action="cutting-wp-pickup"]').first().click()
  const first = page.locator('[data-warehouse-map-action="toggle-location"]:not([disabled])').first()
  await first.click()
  await expect(page.getByText(/已选 1 个库位/)).toBeVisible()
  await page.locator('[data-warehouse-map-location][data-selection-blocked="true"]').first().click({ force: true })
  await expect(page.getByText('请选择同一货架内连续相邻的空闲库位。')).toBeVisible()
})

test('待交出仓占用详情展示生产单和中转袋', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/warehouse-management/wait-handover?tab=locations')
  await page.locator('[data-warehouse-map-action="open-occupancy"]').first().click()
  await expect(page.getByText('中转袋号')).toBeVisible()
  await expect(page.getByText('裁片数量')).toBeVisible()
})
```

- [ ] 7.2 再增加编排验收：

- 进入编排模式。
- 将一个库位右移。
- 修改该库位编号。
- 退出并重新进入编排模式。
- 断言位置保持移动后的顺序。
- 断言库位 DOM 的 `data-location-id` 不变。
- 断言页面中没有“库位组”。

- [ ] 7.3 在 1366×768 和 1280×720 各执行一次：

- 页面主体无水平滚动。
- 库位较多时只有货架行产生内部水平滚动。
- 占用详情可关闭。
- 编排按钮可见。
- PDA 主按钮无需横向滚动即可点击。

- [ ] 7.4 填写原型审查记录，至少记录：

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 主管编排，一线只看图和选位 |
| 任务清晰度 | 通过 | 日常页只回答哪里空闲、哪里占用 |
| 数量与状态 | 通过 | 只有空闲、占用，数量带单位 |
| 扫码与识别 | 通过 | 中转袋入仓保留扫码，库位图作为可视化选择 |
| 防错 | 通过 | 占用不可选，跨货架和不连续多选被阻断 |
| 异常与追溯 | 通过 | 未编排和未定位单独展示，占用详情含人和时间 |
| 现场设备可用性 | 通过 | 1280×720 和 PDA 小屏可完成主动作 |

例外填写：

```text
无。本次保留既有扫码入口，并用库位图补充可视化选位；未引入新的现场手填字段。
```

- [ ] 7.5 运行专项浏览器验收：

```bash
npm run check:cutting-warehouse-location-map-e2e
```

- [ ] 7.6 提交验收与审查记录：

```bash
git add docs/prototype-review-records/2026-07-30-cutting-warehouse-location-map.md \
  scripts/check-cutting-warehouse-location-map.ts \
  tests/cutting-warehouse-location-map.spec.ts
git commit -m "test(裁床仓库): 补齐库位图浏览器验收"
```

### 任务 8：完成全量收口验证和任务收据

**文件：**

- 本任务只允许修正第 1 节列出的文件。

- [ ] 8.1 运行专项和相关回归：

```bash
npm run check:cutting-warehouse-location-map
npm run check:factory-internal-warehouse-model
npm run check:cutting-warehouse-management-switch
npm run check:cutting-pickup-ui-closure
npm run check:material-prep-pickup-management
npm run check:pda-cutting-wait-handover-route-integration
npm run check:cutting-wait-handover-transfer-bag-flow
npm run check:prototype-design-governance
```

预期：全部退出码为 0。

- [ ] 8.2 运行构建：

```bash
npm run build
```

预期：Vite 构建成功，无 TypeScript 或治理错误。

- [ ] 8.3 运行浏览器验收：

```bash
npm run check:cutting-warehouse-location-map-e2e
```

- [ ] 8.4 检查工作区范围：

```bash
git status --short
git diff --check
git diff --name-only HEAD
```

不得加入或覆盖用户现有的以下改动：

- `docs/product-design/裁片单补料管理产品需求文档.md`
- `docs/superpowers/specs/2026-07-30-wool-management-fact-workflow-design.md`
- `.codex/`
- `docs/product-design/补料业务产品需求说明文档.md`

- [ ] 8.5 同步 CodeGraph：

```bash
codegraph sync
codegraph status
```

预期：索引显示 `up to date`，无 `Pending sync`。

- [ ] 8.6 按实际执行方式追加结构化阶段轨迹：

- 触发原因：已确认的库位图规格进入实现。
- `superpowers-zh:writing-plans` 实际调用。
- `superpowers-zh:test-driven-development` 实际调用。
- `superpowers-zh:subagent-driven-development` 或 `superpowers-zh:executing-plans` 实际调用。
- 规格文档、实现计划、原型审查记录。
- 每个实现提交。
- 最终检查结果和 CodeGraph 状态。

如果选择子代理驱动，按要求加入规格审查和代码质量审查，并在最终验证中使用 `--require-two-stage-review`。

- [ ] 8.7 最后一次实质改动和提交后生成任务收据：

```bash
warehouse_map_receipt_dir=$(mktemp -d)
npm run workflow:verify -- \
  --output "$warehouse_map_receipt_dir/task-receipt.json" \
  --task-boundary "裁床待加工仓与待交出仓库位图、稳定编排、两态占用、PDA 相邻选位和中转袋单选入仓" \
  --stage-trace /tmp/higoods-cutting-warehouse-location-map-stage-trace.json \
  --required-skills superpowers-zh:writing-plans,superpowers-zh:test-driven-development
```

若选择子代理驱动，将 `superpowers-zh:subagent-driven-development` 加入 `--required-skills` 并增加 `--require-two-stage-review`；若选择当前会话执行，将 `superpowers-zh:executing-plans` 加入 `--required-skills`。

只有收据状态为 `verified` 才能表述为验证闭环。没有 GitHub API 回执时，不表述为远端已交付。

- [ ] 8.8 如果验证产生必要修正，只逐个暂存本计划文件并提交：

```bash
git commit -m "chore(裁床仓库): 收口库位图验证"
```

没有修正时不创建空提交；禁止使用 `git add .` 或 `git add -A`。

---

## 4. 实现自查清单

### 层级与编排

- [ ] 页面层级只有仓库、库区、货架、库位。
- [ ] 页面文案没有“库位组”。
- [ ] 现有库区、货架和库位自动生成初始图。
- [ ] 库区、货架和库位均按稳定顺序显示。
- [ ] 未编排库位单独展示并能归入货架。
- [ ] 修改库位编号后，稳定 ID、位置和相邻关系不变。

### 空闲与占用

- [ ] 日常图例和库位格只有空闲、占用。
- [ ] 停用库位不显示也不计入统计。
- [ ] 状态完全由有效库存事实投影，不存在手工切换按钮。
- [ ] 一个库位有多条有效事实时只统计一个占用库位。
- [ ] 最后一条有效事实离开后自动恢复空闲。

### 待加工仓

- [ ] 占用摘要显示生产单和物料。
- [ ] 占用详情显示数量单位、颜色/规格、入仓人和时间。
- [ ] 一个领料会话可以选择多个库位。
- [ ] 多选只能同库区、同货架且显示顺序连续。
- [ ] 编号是否连续不影响相邻判断。

### 待交出仓

- [ ] 占用摘要显示生产单和中转袋号。
- [ ] 占用详情显示袋内裁片数量、入仓人和时间。
- [ ] 中转袋只能选择一个空闲库位入仓。
- [ ] 完成交出后释放对应占用。
- [ ] 特殊工艺回仓后可以按新库位恢复占用。

### 现场端与性能

- [ ] PDA 首屏只有一个主确认动作。
- [ ] 扫码仍是中转袋和库位识别的优先入口。
- [ ] 选错库位时阻断并告诉用户如何改。
- [ ] 点击库位、打开详情、调整顺序不触发整页重绘。
- [ ] 单次按钮交互目标响应时间不超过 200ms。
- [ ] 1366×768 页面主体不水平溢出。
- [ ] 1280×720 可以完成查看、编排和选位。
- [ ] 货架库位过多时只在货架行内部横向滚动。

### 验证与治理

- [ ] 专项数据检查通过。
- [ ] 现有仓储和裁床回归检查通过。
- [ ] 浏览器验收通过。
- [ ] 原型审查记录覆盖全部受管文件。
- [ ] `npm run check:prototype-design-governance` 通过。
- [ ] `npm run build` 通过。
- [ ] CodeGraph 已同步。
- [ ] 最终任务收据状态为 `verified`。

---

## 5. 执行顺序与检查点

推荐严格按以下顺序实施：

1. 稳定编排主数据。
2. 空闲/占用投影与相邻规则。
3. 共享库位图组件。
4. PFOS 两个仓库页面。
5. PDA 待加工仓连续多选。
6. PDA 中转袋入仓单选。
7. 浏览器验收和原型审查。
8. 全量验证、CodeGraph 同步和任务收据。

检查点：

- 完成任务 2 后，先确认稳定 ID、占用投影和相邻规则正确，再开始页面。
- 完成任务 4 后，先审查 PFOS 两张库位图的业务表达，再接入 PDA。
- 完成任务 6 后，确认 Web 与 PDA 读取同一事实，再进入浏览器验收。
- 最后一次实质改动后重新执行完整验证，旧收据不得复用。
