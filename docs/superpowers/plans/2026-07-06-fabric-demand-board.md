# 面料需求看板 实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 在 WLS 仓储管理下新增「面料需求看板」，按目标成品面料 SKU 展示搜索筛选、统计卡片、多仓库存、原料库存、印花/染色/采购数据和六类异常预警。

**架构：** 使用一个 WLS 本地原型数据模型提供行、筛选、统计和异常规则；使用一个 Vanilla TypeScript 字符串模板页面渲染搜索区、统计区和宽表；在现有菜单、路由和全局事件流中做最小接入。首版不创建真实调拨单、采购单、后端接口或状态机。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有 app shell 和全局事件派发。

---

## 文件结构

- 创建：`src/data/wls/fabric-demand-board.ts`
  - 职责：定义面料需求看板类型、mock 行数据、筛选函数、统计函数、六类异常规则函数。
- 创建：`src/pages/wls-fabric-demand-board.ts`
  - 职责：渲染页面，维护页面内筛选状态，处理搜索/筛选/重置事件。
- 修改：`src/data/app-shell-config.ts`
  - 职责：在 WLS / 仓储管理菜单新增「面料需求看板」入口。
- 修改：`src/router/routes.ts`
  - 职责：让 `/wls/fabric-demand-board` 进入实际页面渲染，而不是菜单占位页。
- 修改：`src/router/route-renderers.ts`
  - 职责：新增 `renderWlsFabricDemandBoardPage` 异步渲染器。
- 修改：`src/main.ts`
  - 职责：为 `/wls/fabric-demand-board` 接入页面事件处理器。
- 创建：`scripts/check-wls-fabric-demand-board.ts`
  - 职责：用最小脚本验证路由、菜单、统计、异常规则和页面关键文案。
- 创建：`docs/prototype-review-records/2026-07-06-fabric-demand-board.md`
  - 职责：记录本次 WLS 原型审查结论。

---

### 任务 1：写失败检查脚本

**文件：**
- 创建：`scripts/check-wls-fabric-demand-board.ts`

- [ ] **步骤 1：编写失败的检查脚本**

创建 `scripts/check-wls-fabric-demand-board.ts`：

```typescript
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  getFabricDemandBoardAlertRules,
  getFabricDemandBoardRows,
  summarizeFabricDemandBoardRows,
} from '../src/data/wls/fabric-demand-board.ts'
import { renderWlsFabricDemandBoardPage } from '../src/pages/wls-fabric-demand-board.ts'

function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

function assertIncludes(source: string, text: string, message: string): void {
  assert.ok(source.includes(text), message)
}

const menuSource = read('src/data/app-shell-config.ts')
const routesSource = read('src/router/routes.ts')
const renderersSource = read('src/router/route-renderers.ts')
const mainSource = read('src/main.ts')

assertIncludes(menuSource, '面料需求看板', 'WLS 菜单缺少面料需求看板')
assertIncludes(menuSource, '/wls/fabric-demand-board', 'WLS 菜单缺少面料需求看板路径')
assertIncludes(routesSource, '/wls/fabric-demand-board', '路由缺少 /wls/fabric-demand-board')
assertIncludes(renderersSource, 'renderWlsFabricDemandBoardPage', '缺少 WLS 面料需求看板渲染器')
assertIncludes(mainSource, 'handleWlsFabricDemandBoardEvent', '主事件流缺少 WLS 面料需求看板事件处理')

const rows = getFabricDemandBoardRows()
assert.ok(rows.length >= 4, '面料需求看板 mock 行数至少 4 条')
assert.ok(rows.some((row) => row.requiresPrint), '缺少需印花面料场景')
assert.ok(rows.some((row) => row.requiresDye), '缺少需染色面料场景')
assert.ok(rows.some((row) => !row.requiresPrint && !row.requiresDye), '缺少直裁面料场景')
assert.ok(rows.some((row) => row.warehouseStocks.length >= 2), '缺少多仓库存场景')
assert.ok(rows.some((row) => row.alerts.some((alert) => alert.type === '印花待调拨')), '缺少印花待调拨异常')
assert.ok(rows.some((row) => row.alerts.some((alert) => alert.type === '染色待调拨')), '缺少染色待调拨异常')
assert.ok(rows.some((row) => row.alerts.some((alert) => alert.type === '直裁待调拨')), '缺少直裁待调拨异常')
assert.ok(rows.some((row) => row.alerts.some((alert) => alert.type === '缺印花原料')), '缺少缺印花原料异常')
assert.ok(rows.some((row) => row.alerts.some((alert) => alert.type === '缺染色原料')), '缺少缺染色原料异常')
assert.ok(rows.some((row) => row.alerts.some((alert) => alert.type === '缺直裁面料')), '缺少缺直裁面料异常')

const summary = summarizeFabricDemandBoardRows(rows)
assert.equal(summary.totalSkuCount, rows.length, '总数统计应等于目标面料 SKU 行数')
assert.ok(summary.printOrDyeSkuCount > 0, '印染数量统计应大于 0')
assert.ok(summary.directCutSkuCount > 0, '直裁数量统计应大于 0')
assert.ok(summary.stockQty > 0, '库存米数统计应大于 0')

const rules = getFabricDemandBoardAlertRules()
for (const type of ['缺直裁面料', '缺印花原料', '缺染色原料', '直裁待调拨', '印花待调拨', '染色待调拨'] as const) {
  const rule = rules.find((item) => item.type === type)
  assert.ok(rule, `缺少异常规则：${type}`)
  assert.ok(rule.triggerText.includes('触发'), `异常规则缺少触发说明：${type}`)
  assert.ok(rule.resolveText.includes('解除'), `异常规则缺少解除说明：${type}`)
}

const html = renderWlsFabricDemandBoardPage()
for (const text of [
  '面料需求看板',
  '数据搜索区',
  '数据统计区',
  '数据展示区',
  '面料 SPU',
  '是否需印花',
  '是否需染色',
  '原料库存',
  '多仓库存',
  '异常预警',
  '中央仓面料仓',
  '印花厂待加工仓',
  '染色厂待加工仓',
  '中转仓',
]) {
  assertIncludes(html, text, `页面缺少文案：${text}`)
}

assert.ok(!html.includes('PENDING'), '页面不得展示英文状态码 PENDING')
assert.ok(!html.includes('IN_PROGRESS'), '页面不得展示英文状态码 IN_PROGRESS')
assert.ok(!html.includes('DONE'), '页面不得展示英文状态码 DONE')

console.log('WLS 面料需求看板检查通过')
```

- [ ] **步骤 2：运行检查脚本验证失败**

运行：

```bash
npm run test -- scripts/check-wls-fabric-demand-board.ts
```

预期：FAIL，报错包含 `Cannot find module '../src/data/wls/fabric-demand-board.ts'` 或 `Cannot find module '../src/pages/wls-fabric-demand-board.ts'`。

- [ ] **步骤 3：Commit**

```bash
git add scripts/check-wls-fabric-demand-board.ts
git commit -m "test: add fabric demand board check"
```

---

### 任务 2：实现看板数据模型

**文件：**
- 创建：`src/data/wls/fabric-demand-board.ts`
- 测试：`scripts/check-wls-fabric-demand-board.ts`

- [ ] **步骤 1：创建 WLS 数据目录和模型文件**

创建 `src/data/wls/fabric-demand-board.ts`：

```typescript
export type FabricDemandBoardMaterialType = '直裁面料' | '印花面料' | '染色面料'
export type FabricDemandBoardWarehouseName = '中央仓面料仓' | '中转仓' | '印花厂待加工仓' | '染色厂待加工仓'
export type FabricDemandBoardAlertType =
  | '缺直裁面料'
  | '缺印花原料'
  | '缺染色原料'
  | '直裁待调拨'
  | '印花待调拨'
  | '染色待调拨'

export interface FabricDemandBoardWarehouseStock {
  warehouseName: FabricDemandBoardWarehouseName
  areaName: string
  locationCode: string
  qty: number
  unit: '米'
}

export interface FabricDemandBoardProcessQty {
  waitPickupQty: number
  processingQty: number
  waitInboundQty: number
}

export interface FabricDemandBoardPurchaseQty {
  purchasingQty: number
  transitQty: number
  waitInboundQty: number
}

export interface FabricDemandBoardAlert {
  type: FabricDemandBoardAlertType
  reasonText: string
  resolveText: string
  gapQty: number
  ownerText: string
}

export interface FabricDemandBoardAlertRule {
  type: FabricDemandBoardAlertType
  triggerText: string
  resolveText: string
}

export interface FabricDemandBoardRow {
  id: string
  materialImageUrl: string
  materialName: string
  materialSpu: string
  materialSku: string
  materialType: FabricDemandBoardMaterialType
  requiresPrint: boolean
  requiresDye: boolean
  demandQty: number
  rawMaterialName: string
  rawMaterialSku: string
  rawMaterialDemandQty: number
  warehouseStocks: FabricDemandBoardWarehouseStock[]
  printQty: FabricDemandBoardProcessQty
  dyeQty: FabricDemandBoardProcessQty
  purchaseQty: FabricDemandBoardPurchaseQty
  alerts: FabricDemandBoardAlert[]
}

export interface FabricDemandBoardFilters {
  keyword: string
  materialType: '全部' | FabricDemandBoardMaterialType
  printRequirement: '全部' | '需印花' | '不需印花'
  dyeRequirement: '全部' | '需染色' | '不需染色'
  alertType: '全部' | FabricDemandBoardAlertType
  warehouseName: '全部' | FabricDemandBoardWarehouseName
}

export interface FabricDemandBoardSummary {
  totalSkuCount: number
  printOrDyeSkuCount: number
  directCutSkuCount: number
  printingQty: number
  dyeingQty: number
  cuttingQty: number
  purchasingQty: number
  stockQty: number
}

export const defaultFabricDemandBoardFilters: FabricDemandBoardFilters = {
  keyword: '',
  materialType: '全部',
  printRequirement: '全部',
  dyeRequirement: '全部',
  alertType: '全部',
  warehouseName: '全部',
}

function stock(warehouseName: FabricDemandBoardWarehouseName, qty: number, locationCode: string): FabricDemandBoardWarehouseStock {
  const areaName = warehouseName === '中央仓面料仓' ? 'A区' : warehouseName === '中转仓' ? 'B区' : '待加工区'
  return { warehouseName, areaName, locationCode, qty, unit: '米' }
}

function alert(
  type: FabricDemandBoardAlertType,
  gapQty: number,
  reasonText: string,
  resolveText: string,
  ownerText: string,
): FabricDemandBoardAlert {
  return { type, gapQty, reasonText, resolveText, ownerText }
}

const fabricDemandBoardRows: FabricDemandBoardRow[] = [
  {
    id: 'fabric-demand-001',
    materialImageUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?auto=format&fit=crop&w=120&q=80',
    materialName: '黑色斜纹直裁主面料',
    materialSpu: 'FAB-SPU-1008',
    materialSku: 'FAB-2026-001-BLK',
    materialType: '直裁面料',
    requiresPrint: false,
    requiresDye: false,
    demandQty: 620,
    rawMaterialName: '黑色斜纹直裁主面料',
    rawMaterialSku: 'FAB-2026-001-BLK',
    rawMaterialDemandQty: 620,
    warehouseStocks: [
      stock('中央仓面料仓', 420, 'A-03-02'),
      stock('中转仓', 80, 'B-01-08'),
    ],
    printQty: { waitPickupQty: 0, processingQty: 0, waitInboundQty: 0 },
    dyeQty: { waitPickupQty: 0, processingQty: 0, waitInboundQty: 0 },
    purchaseQty: { purchasingQty: 180, transitQty: 0, waitInboundQty: 0 },
    alerts: [
      alert('直裁待调拨', 540, '触发：中转仓仅 80 米，未覆盖直裁需求 620 米；中央仓面料仓有 420 米可调拨。', '解除：中转仓库存达到 620 米。', '仓储主管'),
    ],
  },
  {
    id: 'fabric-demand-002',
    materialImageUrl: 'https://images.unsplash.com/photo-1584273143981-41c073dfe8f8?auto=format&fit=crop&w=120&q=80',
    materialName: '花型印花针织布',
    materialSpu: 'FAB-SPU-2031',
    materialSku: 'FAB-2026-031-PRT',
    materialType: '印花面料',
    requiresPrint: true,
    requiresDye: false,
    demandQty: 540,
    rawMaterialName: '白坯针织布',
    rawMaterialSku: 'RAW-FAB-2026-031-WHT',
    rawMaterialDemandQty: 540,
    warehouseStocks: [
      stock('中央仓面料仓', 360, 'A-08-06'),
      stock('印花厂待加工仓', 120, 'P-02-04'),
    ],
    printQty: { waitPickupQty: 420, processingQty: 260, waitInboundQty: 60 },
    dyeQty: { waitPickupQty: 0, processingQty: 0, waitInboundQty: 0 },
    purchaseQty: { purchasingQty: 0, transitQty: 0, waitInboundQty: 0 },
    alerts: [
      alert('印花待调拨', 420, '触发：印花厂待加工仓仅 120 米，未覆盖印花需求 540 米；中央仓面料仓有 360 米可调拨。', '解除：印花厂待加工仓原料库存达到 540 米。', '印花仓管'),
    ],
  },
  {
    id: 'fabric-demand-003',
    materialImageUrl: 'https://images.unsplash.com/photo-1534639077088-d702bcf685e1?auto=format&fit=crop&w=120&q=80',
    materialName: '雾蓝染色梭织布',
    materialSpu: 'FAB-SPU-3086',
    materialSku: 'FAB-2026-086-DYE',
    materialType: '染色面料',
    requiresPrint: false,
    requiresDye: true,
    demandQty: 720,
    rawMaterialName: '本白梭织坯布',
    rawMaterialSku: 'RAW-FAB-2026-086-WHT',
    rawMaterialDemandQty: 720,
    warehouseStocks: [
      stock('中央仓面料仓', 500, 'A-11-01'),
      stock('染色厂待加工仓', 160, 'D-03-02'),
    ],
    printQty: { waitPickupQty: 0, processingQty: 0, waitInboundQty: 0 },
    dyeQty: { waitPickupQty: 560, processingQty: 210, waitInboundQty: 70 },
    purchaseQty: { purchasingQty: 0, transitQty: 0, waitInboundQty: 0 },
    alerts: [
      alert('染色待调拨', 560, '触发：染色厂待加工仓仅 160 米，未覆盖染色需求 720 米；中央仓面料仓有 500 米可调拨。', '解除：染色厂待加工仓原料库存达到 720 米。', '染色仓管'),
    ],
  },
  {
    id: 'fabric-demand-004',
    materialImageUrl: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=120&q=80',
    materialName: '米白直裁里布',
    materialSpu: 'FAB-SPU-4012',
    materialSku: 'FAB-2026-112-LIN',
    materialType: '直裁面料',
    requiresPrint: false,
    requiresDye: false,
    demandQty: 460,
    rawMaterialName: '米白直裁里布',
    rawMaterialSku: 'FAB-2026-112-LIN',
    rawMaterialDemandQty: 460,
    warehouseStocks: [
      stock('中央仓面料仓', 120, 'A-02-09'),
      stock('中转仓', 80, 'B-04-02'),
    ],
    printQty: { waitPickupQty: 0, processingQty: 0, waitInboundQty: 0 },
    dyeQty: { waitPickupQty: 0, processingQty: 0, waitInboundQty: 0 },
    purchaseQty: { purchasingQty: 260, transitQty: 80, waitInboundQty: 0 },
    alerts: [
      alert('缺直裁面料', 260, '触发：中央仓面料仓 120 米 + 中转仓 80 米，合计小于直裁需求 460 米。', '解除：中央仓面料仓 + 中转仓库存达到 460 米。', '采购跟单'),
    ],
  },
  {
    id: 'fabric-demand-005',
    materialImageUrl: 'https://images.unsplash.com/photo-1603912699214-92627f304eb6?auto=format&fit=crop&w=120&q=80',
    materialName: '渐变印花雪纺',
    materialSpu: 'FAB-SPU-5099',
    materialSku: 'FAB-2026-099-PRT',
    materialType: '印花面料',
    requiresPrint: true,
    requiresDye: false,
    demandQty: 680,
    rawMaterialName: '本白雪纺坯布',
    rawMaterialSku: 'RAW-FAB-2026-099-WHT',
    rawMaterialDemandQty: 680,
    warehouseStocks: [
      stock('中央仓面料仓', 180, 'A-07-03'),
      stock('印花厂待加工仓', 90, 'P-01-07'),
    ],
    printQty: { waitPickupQty: 590, processingQty: 120, waitInboundQty: 0 },
    dyeQty: { waitPickupQty: 0, processingQty: 0, waitInboundQty: 0 },
    purchaseQty: { purchasingQty: 410, transitQty: 0, waitInboundQty: 60 },
    alerts: [
      alert('缺印花原料', 410, '触发：中央仓面料仓 180 米 + 印花厂待加工仓 90 米，合计小于印花需求 680 米。', '解除：中央仓面料仓 + 印花厂待加工仓原料库存达到 680 米。', '采购跟单'),
    ],
  },
  {
    id: 'fabric-demand-006',
    materialImageUrl: 'https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=120&q=80',
    materialName: '炭灰染色弹力布',
    materialSpu: 'FAB-SPU-6105',
    materialSku: 'FAB-2026-105-DYE',
    materialType: '染色面料',
    requiresPrint: false,
    requiresDye: true,
    demandQty: 580,
    rawMaterialName: '本白弹力坯布',
    rawMaterialSku: 'RAW-FAB-2026-105-WHT',
    rawMaterialDemandQty: 580,
    warehouseStocks: [
      stock('中央仓面料仓', 150, 'A-10-05'),
      stock('染色厂待加工仓', 120, 'D-02-01'),
    ],
    printQty: { waitPickupQty: 0, processingQty: 0, waitInboundQty: 0 },
    dyeQty: { waitPickupQty: 460, processingQty: 160, waitInboundQty: 0 },
    purchaseQty: { purchasingQty: 310, transitQty: 0, waitInboundQty: 0 },
    alerts: [
      alert('缺染色原料', 310, '触发：中央仓面料仓 150 米 + 染色厂待加工仓 120 米，合计小于染色需求 580 米。', '解除：中央仓面料仓 + 染色厂待加工仓原料库存达到 580 米。', '采购跟单'),
    ],
  },
]

export function getFabricDemandBoardRows(): FabricDemandBoardRow[] {
  return fabricDemandBoardRows.map((row) => ({
    ...row,
    warehouseStocks: row.warehouseStocks.map((item) => ({ ...item })),
    printQty: { ...row.printQty },
    dyeQty: { ...row.dyeQty },
    purchaseQty: { ...row.purchaseQty },
    alerts: row.alerts.map((item) => ({ ...item })),
  }))
}

export function getFabricDemandBoardAlertRules(): FabricDemandBoardAlertRule[] {
  return [
    { type: '缺直裁面料', triggerText: '触发：中央仓面料仓库存 + 中转仓库存 < 直裁需求米数。', resolveText: '解除：中央仓面料仓库存 + 中转仓库存 >= 直裁需求米数。' },
    { type: '缺印花原料', triggerText: '触发：中央仓面料仓原料库存 + 印花厂待加工仓原料库存 < 印花需求米数。', resolveText: '解除：中央仓面料仓原料库存 + 印花厂待加工仓原料库存 >= 印花需求米数。' },
    { type: '缺染色原料', triggerText: '触发：中央仓面料仓原料库存 + 染色厂待加工仓原料库存 < 染色需求米数。', resolveText: '解除：中央仓面料仓原料库存 + 染色厂待加工仓原料库存 >= 染色需求米数。' },
    { type: '直裁待调拨', triggerText: '触发：中转仓库存不足，中央仓面料仓有库存，且两仓合计可覆盖直裁需求。', resolveText: '解除：中转仓库存 >= 直裁需求米数。' },
    { type: '印花待调拨', triggerText: '触发：印花厂待加工仓原料库存不足，中央仓面料仓有原料，且两仓合计可覆盖印花需求。', resolveText: '解除：印花厂待加工仓原料库存 >= 印花需求米数。' },
    { type: '染色待调拨', triggerText: '触发：染色厂待加工仓原料库存不足，中央仓面料仓有原料，且两仓合计可覆盖染色需求。', resolveText: '解除：染色厂待加工仓原料库存 >= 染色需求米数。' },
  ]
}

export function formatFabricDemandQty(value: number): string {
  return `${Math.max(value, 0).toLocaleString('zh-CN')} 米`
}

export function summarizeFabricDemandBoardRows(rows: FabricDemandBoardRow[]): FabricDemandBoardSummary {
  return {
    totalSkuCount: rows.length,
    printOrDyeSkuCount: rows.filter((row) => row.requiresPrint || row.requiresDye).length,
    directCutSkuCount: rows.filter((row) => !row.requiresPrint && !row.requiresDye).length,
    printingQty: rows.reduce((sum, row) => sum + row.printQty.processingQty, 0),
    dyeingQty: rows.reduce((sum, row) => sum + row.dyeQty.processingQty, 0),
    cuttingQty: rows
      .filter((row) => !row.requiresPrint && !row.requiresDye)
      .reduce((sum, row) => sum + Math.min(row.demandQty, getWarehouseQty(row, '中转仓')), 0),
    purchasingQty: rows.reduce((sum, row) => sum + row.purchaseQty.purchasingQty, 0),
    stockQty: rows.reduce((sum, row) => sum + row.warehouseStocks.reduce((rowSum, stock) => rowSum + stock.qty, 0), 0),
  }
}

export function getWarehouseQty(row: FabricDemandBoardRow, warehouseName: FabricDemandBoardWarehouseName): number {
  return row.warehouseStocks
    .filter((stockItem) => stockItem.warehouseName === warehouseName)
    .reduce((sum, stockItem) => sum + stockItem.qty, 0)
}

export function filterFabricDemandBoardRows(
  rows: FabricDemandBoardRow[],
  filters: FabricDemandBoardFilters,
): FabricDemandBoardRow[] {
  const keyword = filters.keyword.trim().toLowerCase()
  return rows.filter((row) => {
    if (filters.materialType !== '全部' && row.materialType !== filters.materialType) return false
    if (filters.printRequirement === '需印花' && !row.requiresPrint) return false
    if (filters.printRequirement === '不需印花' && row.requiresPrint) return false
    if (filters.dyeRequirement === '需染色' && !row.requiresDye) return false
    if (filters.dyeRequirement === '不需染色' && row.requiresDye) return false
    if (filters.alertType !== '全部' && !row.alerts.some((item) => item.type === filters.alertType)) return false
    if (filters.warehouseName !== '全部' && !row.warehouseStocks.some((item) => item.warehouseName === filters.warehouseName && item.qty > 0)) return false
    if (!keyword) return true
    return [row.materialName, row.materialSku, row.materialSpu, row.rawMaterialName, row.rawMaterialSku]
      .join(' ')
      .toLowerCase()
      .includes(keyword)
  })
}
```

- [ ] **步骤 2：运行检查脚本验证仍失败**

运行：

```bash
npm run test -- scripts/check-wls-fabric-demand-board.ts
```

预期：FAIL，报错包含 `Cannot find module '../src/pages/wls-fabric-demand-board.ts'`。

- [ ] **步骤 3：Commit**

```bash
git add src/data/wls/fabric-demand-board.ts
git commit -m "feat: add fabric demand board data"
```

---

### 任务 3：实现看板页面渲染和筛选事件

**文件：**
- 创建：`src/pages/wls-fabric-demand-board.ts`
- 测试：`scripts/check-wls-fabric-demand-board.ts`

- [ ] **步骤 1：创建页面文件**

创建 `src/pages/wls-fabric-demand-board.ts`：

```typescript
import {
  defaultFabricDemandBoardFilters,
  filterFabricDemandBoardRows,
  formatFabricDemandQty,
  getFabricDemandBoardAlertRules,
  getFabricDemandBoardRows,
  getWarehouseQty,
  summarizeFabricDemandBoardRows,
  type FabricDemandBoardAlertType,
  type FabricDemandBoardFilters,
  type FabricDemandBoardMaterialType,
  type FabricDemandBoardRow,
  type FabricDemandBoardWarehouseName,
} from '../data/wls/fabric-demand-board.ts'
import { escapeHtml } from '../utils.ts'

let filters: FabricDemandBoardFilters = { ...defaultFabricDemandBoardFilters }

function option(value: string, label: string, selected: boolean): string {
  return `<option value="${escapeHtml(value)}" ${selected ? 'selected' : ''}>${escapeHtml(label)}</option>`
}

function renderSelect<T extends string>(label: string, field: keyof FabricDemandBoardFilters, value: T, values: T[]): string {
  return `
    <label class="block min-w-[150px] space-y-1">
      <span class="text-xs text-muted-foreground">${escapeHtml(label)}</span>
      <select class="h-9 w-full rounded-md border bg-background px-3 text-sm" data-wls-fabric-demand-field="${String(field)}">
        ${values.map((item) => option(item, item, value === item)).join('')}
      </select>
    </label>
  `
}

function renderSearchSection(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 class="text-base font-semibold">数据搜索区</h2>
          <p class="text-xs text-muted-foreground">按面料名称、面料 SKU、面料 SPU、异常和目的仓筛选。</p>
        </div>
        <button type="button" class="inline-flex h-9 items-center rounded-md border px-3 text-sm hover:bg-muted" data-wls-fabric-demand-action="reset">重置</button>
      </div>
      <div class="flex flex-wrap items-end gap-3">
        <label class="block min-w-[280px] flex-1 space-y-1">
          <span class="text-xs text-muted-foreground">关键词</span>
          <input class="h-9 w-full rounded-md border bg-background px-3 text-sm" value="${escapeHtml(filters.keyword)}" placeholder="搜索面料名称 / 面料 SKU / 面料 SPU" data-wls-fabric-demand-field="keyword" />
        </label>
        ${renderSelect<FabricDemandBoardMaterialType | '全部'>('面料类型', 'materialType', filters.materialType, ['全部', '直裁面料', '印花面料', '染色面料'])}
        ${renderSelect<'全部' | '需印花' | '不需印花'>('是否需印花', 'printRequirement', filters.printRequirement, ['全部', '需印花', '不需印花'])}
        ${renderSelect<'全部' | '需染色' | '不需染色'>('是否需染色', 'dyeRequirement', filters.dyeRequirement, ['全部', '需染色', '不需染色'])}
        ${renderSelect<FabricDemandBoardAlertType | '全部'>('异常预警', 'alertType', filters.alertType, ['全部', '缺直裁面料', '缺印花原料', '缺染色原料', '直裁待调拨', '印花待调拨', '染色待调拨'])}
        ${renderSelect<FabricDemandBoardWarehouseName | '全部'>('仓库/目的仓', 'warehouseName', filters.warehouseName, ['全部', '中央仓面料仓', '中转仓', '印花厂待加工仓', '染色厂待加工仓'])}
      </div>
    </section>
  `
}

function renderStatCard(label: string, value: string, helper: string): string {
  return `
    <article class="rounded-lg border bg-card p-4">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-2 text-2xl font-semibold">${escapeHtml(value)}</div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(helper)}</div>
    </article>
  `
}

function renderStatsSection(rows: FabricDemandBoardRow[]): string {
  const summary = summarizeFabricDemandBoardRows(rows)
  return `
    <section class="space-y-3">
      <div>
        <h2 class="text-base font-semibold">数据统计区</h2>
        <p class="text-xs text-muted-foreground">统计随当前筛选结果变化，长度统一展示为米。</p>
      </div>
      <div class="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        ${renderStatCard('面料总数', `${summary.totalSkuCount}`, '目标面料 SKU')}
        ${renderStatCard('印染数量', `${summary.printOrDyeSkuCount}`, '需印花或需染色')}
        ${renderStatCard('直裁数量', `${summary.directCutSkuCount}`, '不需印花/染色')}
        ${renderStatCard('印花中米数', formatFabricDemandQty(summary.printingQty), '原料已进入印花')}
        ${renderStatCard('染色中米数', formatFabricDemandQty(summary.dyeingQty), '原料已进入染色')}
        ${renderStatCard('裁剪中米数', formatFabricDemandQty(summary.cuttingQty), '中转仓已覆盖')}
        ${renderStatCard('采购中米数', formatFabricDemandQty(summary.purchasingQty), '采购仍未完成')}
        ${renderStatCard('库存米数', formatFabricDemandQty(summary.stockQty), '多仓库存合计')}
      </div>
    </section>
  `
}

function renderBooleanBadge(active: boolean, activeText: string, inactiveText: string): string {
  const className = active ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-slate-200 bg-slate-50 text-slate-600'
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${className}">${escapeHtml(active ? activeText : inactiveText)}</span>`
}

function renderAlertBadge(type: FabricDemandBoardAlertType): string {
  const danger = type.startsWith('缺')
  const className = danger ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-amber-200 bg-amber-50 text-amber-700'
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${className}">${escapeHtml(type)}</span>`
}

function renderWarehouseStocks(row: FabricDemandBoardRow): string {
  const total = row.warehouseStocks.reduce((sum, item) => sum + item.qty, 0)
  return `
    <div class="space-y-1 text-xs">
      <div class="font-semibold text-foreground">总库存 ${escapeHtml(formatFabricDemandQty(total))}</div>
      ${row.warehouseStocks
        .filter((item) => item.qty > 0)
        .map((item) => `<div>${escapeHtml(item.warehouseName)} ${escapeHtml(item.areaName)} ${escapeHtml(item.locationCode)}：${escapeHtml(formatFabricDemandQty(item.qty))}</div>`)
        .join('')}
    </div>
  `
}

function renderRawMaterial(row: FabricDemandBoardRow): string {
  if (!row.requiresPrint && !row.requiresDye) {
    return `<div class="text-xs text-muted-foreground">直裁面料，无加工前原料转换。</div>`
  }
  const destination = row.requiresPrint ? '印花厂待加工仓' : '染色厂待加工仓'
  const destinationQty = getWarehouseQty(row, destination)
  return `
    <div class="space-y-1 text-xs">
      <div class="font-semibold text-foreground">${escapeHtml(row.rawMaterialName)}</div>
      <div class="font-mono">${escapeHtml(row.rawMaterialSku)}</div>
      <div>中央仓面料仓：${escapeHtml(formatFabricDemandQty(getWarehouseQty(row, '中央仓面料仓')))}</div>
      <div>${escapeHtml(destination)}：${escapeHtml(formatFabricDemandQty(destinationQty))}</div>
    </div>
  `
}

function renderProcessQty(label: string, qty: { waitPickupQty: number; processingQty: number; waitInboundQty: number }): string {
  return `
    <div class="space-y-1 text-xs">
      <div class="font-medium text-foreground">${escapeHtml(label)}</div>
      <div>待领料：${escapeHtml(formatFabricDemandQty(qty.waitPickupQty))}</div>
      <div>${escapeHtml(label)}中：${escapeHtml(formatFabricDemandQty(qty.processingQty))}</div>
      <div>待入库：${escapeHtml(formatFabricDemandQty(qty.waitInboundQty))}</div>
    </div>
  `
}

function renderAlertCell(row: FabricDemandBoardRow): string {
  if (!row.alerts.length) return '<span class="text-xs text-muted-foreground">暂无异常</span>'
  return row.alerts
    .map((alert) => `
      <div class="mb-2 rounded-md border bg-background p-2 text-xs last:mb-0">
        <div class="mb-1">${renderAlertBadge(alert.type)}</div>
        <div class="text-muted-foreground">${escapeHtml(alert.reasonText)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(alert.resolveText)}</div>
        <div class="mt-1 font-medium">差额：${escapeHtml(formatFabricDemandQty(alert.gapQty))} / 处理：${escapeHtml(alert.ownerText)}</div>
      </div>
    `)
    .join('')
}

function renderRows(rows: FabricDemandBoardRow[]): string {
  if (!rows.length) {
    return '<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-muted-foreground">暂无匹配面料需求</td></tr>'
  }
  return rows.map((row) => `
    <tr class="border-b align-top last:border-b-0">
      <td class="min-w-[260px] px-4 py-3">
        <div class="flex gap-3">
          <img src="${escapeHtml(row.materialImageUrl)}" alt="${escapeHtml(row.materialName)}" class="h-14 w-14 rounded-md object-cover" />
          <div class="space-y-1 text-xs">
            <div class="text-sm font-semibold text-foreground">${escapeHtml(row.materialName)}</div>
            <div>面料 SPU：${escapeHtml(row.materialSpu)}</div>
            <div>面料 SKU：<span class="font-mono">${escapeHtml(row.materialSku)}</span></div>
            <div>类型：${escapeHtml(row.materialType)}</div>
            <div class="flex flex-wrap gap-1">${renderBooleanBadge(row.requiresPrint, '需印花', '不需印花')} ${renderBooleanBadge(row.requiresDye, '需染色', '不需染色')}</div>
          </div>
        </div>
      </td>
      <td class="min-w-[190px] px-4 py-3">${renderRawMaterial(row)}</td>
      <td class="min-w-[210px] px-4 py-3">${renderWarehouseStocks(row)}</td>
      <td class="min-w-[140px] px-4 py-3">${renderProcessQty('印花', row.printQty)}</td>
      <td class="min-w-[140px] px-4 py-3">${renderProcessQty('染色', row.dyeQty)}</td>
      <td class="min-w-[140px] px-4 py-3">
        <div class="space-y-1 text-xs">
          <div>采购中：${escapeHtml(formatFabricDemandQty(row.purchaseQty.purchasingQty))}</div>
          <div>转运中：${escapeHtml(formatFabricDemandQty(row.purchaseQty.transitQty))}</div>
          <div>待入库：${escapeHtml(formatFabricDemandQty(row.purchaseQty.waitInboundQty))}</div>
        </div>
      </td>
      <td class="min-w-[260px] px-4 py-3">${renderAlertCell(row)}</td>
    </tr>
  `).join('')
}

function renderTableSection(rows: FabricDemandBoardRow[]): string {
  return `
    <section class="space-y-3">
      <div>
        <h2 class="text-base font-semibold">数据展示区</h2>
        <p class="text-xs text-muted-foreground">一行一个目标成品面料 SKU，库存支持多仓展示。</p>
      </div>
      <div class="overflow-hidden rounded-lg border bg-card">
        <div class="overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th class="px-4 py-3 font-medium">面料信息</th>
                <th class="px-4 py-3 font-medium">原料库存</th>
                <th class="px-4 py-3 font-medium">多仓库存</th>
                <th class="px-4 py-3 font-medium">印花数据</th>
                <th class="px-4 py-3 font-medium">染色数据</th>
                <th class="px-4 py-3 font-medium">采购数据</th>
                <th class="px-4 py-3 font-medium">异常预警</th>
              </tr>
            </thead>
            <tbody>${renderRows(rows)}</tbody>
          </table>
        </div>
      </div>
    </section>
  `
}

function renderRulesSection(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h2 class="text-base font-semibold">异常规则说明</h2>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${getFabricDemandBoardAlertRules().map((rule) => `
          <article class="rounded-md border bg-background p-3 text-xs">
            <div class="mb-2">${renderAlertBadge(rule.type)}</div>
            <p class="text-muted-foreground">${escapeHtml(rule.triggerText)}</p>
            <p class="mt-1 text-muted-foreground">${escapeHtml(rule.resolveText)}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `
}

export function renderWlsFabricDemandBoardPage(): string {
  const rows = filterFabricDemandBoardRows(getFabricDemandBoardRows(), filters)
  return `
    <div class="space-y-6">
      <section>
        <div class="text-sm text-muted-foreground">仓储管理 / 面料需求看板</div>
        <h1 class="mt-1 text-2xl font-semibold tracking-normal">面料需求看板</h1>
        <p class="mt-2 text-sm text-muted-foreground">按目标成品面料 SKU 查看多仓库存、原料调拨、加工在途、采购在途和异常预警。</p>
      </section>
      ${renderSearchSection()}
      ${renderStatsSection(rows)}
      ${renderTableSection(rows)}
      ${renderRulesSection()}
    </div>
  `
}

export function handleWlsFabricDemandBoardEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-wls-fabric-demand-action]')
  if (actionNode?.dataset.wlsFabricDemandAction === 'reset') {
    filters = { ...defaultFabricDemandBoardFilters }
    return true
  }

  const fieldNode = target.closest<HTMLInputElement | HTMLSelectElement>('[data-wls-fabric-demand-field]')
  const field = fieldNode?.dataset.wlsFabricDemandField as keyof FabricDemandBoardFilters | undefined
  if (!field || !fieldNode) return false
  filters = { ...filters, [field]: fieldNode.value }
  return true
}
```

- [ ] **步骤 2：运行检查脚本验证仍失败**

运行：

```bash
npm run test -- scripts/check-wls-fabric-demand-board.ts
```

预期：FAIL，报错包含 `WLS 菜单缺少面料需求看板`。

- [ ] **步骤 3：Commit**

```bash
git add src/pages/wls-fabric-demand-board.ts
git commit -m "feat: add fabric demand board page"
```

---

### 任务 4：接入菜单、路由和事件

**文件：**
- 修改：`src/data/app-shell-config.ts`
- 修改：`src/router/route-renderers.ts`
- 修改：`src/router/routes.ts`
- 修改：`src/main.ts`
- 测试：`scripts/check-wls-fabric-demand-board.ts`

- [ ] **步骤 1：新增菜单入口**

在 `src/data/app-shell-config.ts` 的 `wls` / `仓储管理` items 中，在 `库存管理` 前插入：

```typescript
{ key: 'fabric-demand-board', title: '面料需求看板', icon: 'PanelsTopLeft', href: '/wls/fabric-demand-board' },
```

- [ ] **步骤 2：新增异步渲染器**

在 `src/router/route-renderers.ts` 中新增导出：

```typescript
export const renderWlsFabricDemandBoardPage = createAsyncRenderer(
  () => import('../pages/wls-fabric-demand-board'),
  'renderWlsFabricDemandBoardPage',
)
```

- [ ] **步骤 3：接入 WLS 路由**

在 `src/router/routes.ts` 的 imports 中补充：

```typescript
import { renderWlsFabricDemandBoardPage } from './route-renderers'
```

在 `exactBaseRoutes` 中补充：

```typescript
'/wls': () => renderRouteRedirect('/wls/fabric-demand-board', '正在跳转到面料需求看板'),
'/wls/fabric-demand-board': () => renderWlsFabricDemandBoardPage(),
```

保留现有菜单兜底逻辑，让 `/wls/inventory`、`/wls/inbound`、`/wls/outbound` 继续走占位页。

- [ ] **步骤 4：接入页面事件**

在 `src/main.ts` 顶部类型区新增：

```typescript
type WlsFabricDemandBoardPageModule = typeof import('./pages/wls-fabric-demand-board')
```

在模块 promise 区新增：

```typescript
let wlsFabricDemandBoardPageModulePromise: Promise<WlsFabricDemandBoardPageModule> | null = null
```

在模块加载函数区新增：

```typescript
function getWlsFabricDemandBoardPageModule(): Promise<WlsFabricDemandBoardPageModule> {
  if (!wlsFabricDemandBoardPageModulePromise) {
    wlsFabricDemandBoardPageModulePromise = import('./pages/wls-fabric-demand-board').catch((error) => {
      wlsFabricDemandBoardPageModulePromise = null
      throw error
    })
  }
  return wlsFabricDemandBoardPageModulePromise
}
```

在 `dispatchPageEvent()` 中、`handlerSystem` fallback 前加入：

```typescript
if (pathname.startsWith('/wls/fabric-demand-board')) {
  const wlsFabricDemandBoardPage = await getWlsFabricDemandBoardPageModule()
  return wlsFabricDemandBoardPage.handleWlsFabricDemandBoardEvent(eventTarget)
}
```

- [ ] **步骤 5：运行检查脚本验证通过**

运行：

```bash
npm run test -- scripts/check-wls-fabric-demand-board.ts
```

预期：PASS，输出 `WLS 面料需求看板检查通过`。

- [ ] **步骤 6：Commit**

```bash
git add src/data/app-shell-config.ts src/router/route-renderers.ts src/router/routes.ts src/main.ts
git commit -m "feat: wire fabric demand board route"
```

---

### 任务 5：补原型审查记录

**文件：**
- 创建：`docs/prototype-review-records/2026-07-06-fabric-demand-board.md`

- [ ] **步骤 1：创建审查记录**

创建 `docs/prototype-review-records/2026-07-06-fabric-demand-board.md`：

```markdown
# 面料需求看板原型审查记录

## 1. 基本信息

| 项目 | 内容 |
| --- | --- |
| 审查日期 | 2026-07-06 |
| 相关需求 / 任务 | 仓储管理 - 面料需求看板 |
| 涉及系统 | WLS |
| 涉及页面路径 | `/wls/fabric-demand-board` |
| 端类型 | 管理端 / 主管端 |
| 主要角色 | 仓储主管、计划协同人员 |
| 主要任务 | 按目标面料 SKU 查看库存、原料调拨、加工在途、采购在途和异常预警 |

## 2. 参考规范

- `docs/higood-indonesia-factory-product-design-guidelines.md`
- `docs/higood-indonesia-factory-prototype-review-checklist.md`

## 3. 自查结论

| 检查项 | 结论 | 说明 |
| --- | --- | --- |
| 角色匹配 | 通过 | 页面面向仓储主管和计划协同人员，不作为 PDA 员工执行页。 |
| 任务清晰度 | 通过 | 页面按搜索、统计、宽表和异常规则组织，进入后先定位面料 SKU。 |
| 信息架构与导航 | 通过 | 入口放在 WLS / 仓储管理，符合物料收发存和调拨视角。 |
| 页面模式 | 通过 | 管理端宽表承载多仓库存和异常说明。 |
| 信息负荷 | 有条件通过 | 宽表列较多，已通过横向滚动和分组列降低混乱。 |
| 文案 | 通过 | 异常文案说明触发、解除、差额和处理方向。 |
| 数量与状态 | 通过 | 长度统一展示为米，避免英文状态码。 |
| 扫码与识别 | 通过 | 本页不是现场扫码执行页，不要求扫码。 |
| 防错 | 通过 | 首版无写操作，风险集中在规则说明是否清晰。 |
| UI 样式 | 通过 | 使用企业后台风格、统计卡片和宽表。 |
| 组件交互 | 通过 | 搜索和筛选只更新本页内容，不创建业务对象。 |
| 协作关系 | 通过 | 明确中央仓面料仓到印花厂、染色厂、中转仓的调拨方向。 |
| 异常与追溯 | 通过 | 六类异常均说明触发和解除条件。 |
| 现场设备可用性 | 有条件通过 | 主管 Web 页适合桌面查看，低分辨率下依赖横向滚动。 |

## 4. 问题标签

- `字段过载`

## 5. 主要问题与处理

| 问题 | 标签 | 影响角色 | 处理方式 | 是否仍有风险 |
| --- | --- | --- | --- | --- |
| 宽表字段较多 | 字段过载 | 仓储主管 | 按面料信息、原料库存、多仓库存、加工/采购、异常分组展示 | 是，低分辨率下仍需横向滚动 |

## 6. 最终结论

结论：有条件通过

说明：

- 页面作为 WLS 管理/主管看板成立。
- 首版不做真实调拨单和采购单创建，避免把原型扩成业务系统。
- 后续如进入执行闭环，应单独设计调拨单创建和扫码确认流程。
```

- [ ] **步骤 2：运行治理检查**

运行：

```bash
npm run check:prototype-design-governance
```

预期：PASS。

- [ ] **步骤 3：Commit**

```bash
git add docs/prototype-review-records/2026-07-06-fabric-demand-board.md
git commit -m "docs: add fabric demand board review"
```

---

### 任务 6：完整验证和收尾

**文件：**
- 验证：全项目构建、设计治理、CodeGraph 同步。

- [ ] **步骤 1：运行页面专项检查**

运行：

```bash
npm run test -- scripts/check-wls-fabric-demand-board.ts
```

预期：PASS，输出 `WLS 面料需求看板检查通过`。

- [ ] **步骤 2：运行构建**

运行：

```bash
npm run build
```

预期：PASS，Vite build 成功。

- [ ] **步骤 3：运行设计治理检查**

运行：

```bash
npm run check:prototype-design-governance
```

预期：PASS。

- [ ] **步骤 4：启动本地开发服务器**

运行：

```bash
npm run dev -- --host 0.0.0.0 --port 5173
```

如果 5173 被占用，换一个可用端口。

- [ ] **步骤 5：浏览器验证页面**

打开：

```text
http://localhost:5173/wls/fabric-demand-board
```

人工检查：

- 页面不是占位页。
- 顶部顺序是搜索筛选、统计卡片、数据列表。
- 输入关键词能筛选列表。
- 选择异常预警能筛选列表。
- 多仓库存能展示多个仓。
- 需印花/需染色行能展示原料库存。
- 异常预警说明包含触发、解除、差额和处理人。

- [ ] **步骤 6：同步 CodeGraph**

运行：

```bash
codegraph sync
codegraph status
```

预期：索引同步完成，无 pending sync。

- [ ] **步骤 7：最终 Commit**

如任务 1-5 已分别提交且没有收尾改动，本步骤只运行：

```bash
git status --short
```

预期：无未提交改动。

如存在验证修正，提交：

```bash
git add <修正文件>
git commit -m "fix: verify fabric demand board"
```

---

## 自检

- 规格覆盖：页面入口、搜索区、统计区、宽表、原料库存、多仓库存、六类异常、异常触发/解除、原型边界、治理检查均有任务覆盖。
- 范围控制：未引入后端、真实调拨单、采购单、复杂状态机、React 迁移或新依赖。
- 类型一致性：计划中所有页面、数据和检查脚本均使用 `FabricDemandBoard*` 前缀；异常类型固定为六类中文标签。
- 测试策略：先用专项脚本锁定菜单、路由、文案、统计和规则，再跑 build 与治理检查，最后做浏览器验证。
