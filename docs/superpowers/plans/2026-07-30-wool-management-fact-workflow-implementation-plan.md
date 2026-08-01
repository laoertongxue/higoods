# 毛织管理事实型加工单重构实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers-zh:subagent-driven-development`（推荐）或 `superpowers-zh:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 将毛织管理从固定工序节点模型重构为“确认接收、加工填报、发起交出、人工完成”四类事实和独立横机当前关联，并同步闭环技术包、生产任务、Web、PDA、仓库及下游交接。

**架构：** 在毛织模块内干净重写，使用 `higood-fcs-wool-domain-store-v2` 保存冻结加工单、可重复事实记录、仓库流水、横机当前关联和操作日志；所有状态、Tab、操作门禁、库存和移动端投影均从事实查询派生。`src/data/fcs/wool-task-domain.ts` 保留为毛织领域公共门面，内部按类型、技术包解析、存储、查询、命令、设备和 Mock 数据拆分，避免继续扩张现有 3,400 余行单文件。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有 `src/components/ui/` 标准列表组件、localStorage Mock 存储、Node/tsx 专项检查、Playwright。

**正式规格：** `docs/superpowers/specs/2026-07-30-wool-management-fact-workflow-design.md`

---

## 实施边界

- 本仓库是产品原型，不增加真实后端、数据库、接口层、权限层或状态管理框架。
- 只重写毛织管理及其直接上下游消费者；其他工艺的熨烫、包装、菲票、价格、统计和仓库位置逻辑保持不变。
- 毛织侧不计算纱线最多可加工件数，也不做纱线预占或款色间分配。
- 已确认设计中的三类核心操作名称固定为“确认接收”“加工填报”“发起交出”；上游任务“接单”不得替代确认接收。
- 整件毛织加工后对象是成衣 SKU，单位为件；部位毛织加工后对象是毛织部位 SKU，但完工数量、交出数量和 150% 上限均按颜色+尺码件数，不按片数换算。
- 完成加工单只由业务人员二次确认，不增加数量充分性判断。
- 本计划执行时应在隔离 worktree 中进行；不得覆盖主工作区中与本任务无关的未提交修改。

## 文件结构

### 新建文件

- `src/data/fcs/wool-domain/types.ts`：事实型加工单、记录、仓库流水、完成快照、横机关联和查询结果类型。
- `src/data/fcs/wool-domain/tech-pack-source.ts`：从生产单技术包快照解析并冻结整件/部位加工后 SKU 与必需纱线。
- `src/data/fcs/wool-domain/store.ts`：`higood-fcs-wool-domain-store-v2` 的读取、克隆、一次性提交和仅毛织重置。
- `src/data/fcs/wool-domain/queries.ts`：齐料、150% 容量、Tab、状态、库存、记录分页和允许操作查询。
- `src/data/fcs/wool-domain/commands.ts`：确认接收、加工填报、交出、数量修改、下游确认和人工完成命令。
- `src/data/fcs/wool-domain/machine-associations.ts`：横机整组保存、转移、解除、维修/停用和日志。
- `src/data/fcs/wool-domain/mock-data.ts`：覆盖正式规格 26 类场景的事实型 Mock 数据。
- `src/pages/process-factory/wool/machine-associations.ts`：横机生产关联标准列表页。
- `scripts/check-wool-fact-workflow.ts`：核心领域规则、技术包来源、库存原子性、完成和设备关系专项检查。
- `tests/wool-management-fact-workflow.spec.ts`：Web、PDA、仓库和横机页面浏览器验收。
- `docs/prototype-review-records/2026-07-30-wool-management-fact-workflow.md`：本次页面、交互、Mock、路由和跨端协作审查记录。

### 重点重写文件

- `src/data/fcs/wool-task-domain.ts`：改为新领域公共门面，删除旧节点、价格、菲票、排产、位置 CRUD 和自动推进。
- `src/pages/process-factory/wool/work-orders.ts`：标准列表、筛选联动 Tab 和四类业务操作弹窗。
- `src/pages/process-factory/wool/work-order-detail.ts`：事实页签、分页记录、数量修改历史和完成快照。
- `src/pages/process-factory/wool/machines.ts`：四状态设备档案和维修/停用影响确认。
- `src/pages/process-factory/wool/warehouse.ts`：三个固定默认库位、领用/退回、库存/流水/调整/转移。
- `src/pages/process-factory/wool/handover-print.ts`：A4 毛织交出单打印页，展示生产单、毛织加工单、接收方、颜色尺码件数、款式图、物料图、条码和二维码。
- `src/pages/process-factory/wool/shared.ts`：仅保留毛织详情与弹窗需要的轻量格式化和局部挂载辅助。
- `scripts/check-wool-internal-style-code.ts`：改为检查内部货号、筛选联动 Tab 和无统计卡片。
- `scripts/check-wool-warehouse-unified-model.ts`：改为检查固定库位、同源流水和禁止旧仓库自动推进。

### 同步修改文件

- 技术包和快照：
  - `src/data/pcs-technical-data-version-types.ts`
  - `src/data/fcs/tech-packs.ts`
  - `src/data/fcs/production-tech-pack-snapshot-builder.ts`
  - `src/data/fcs/production-tech-pack-snapshot-types.ts`
  - `src/data/fcs/production-order-tech-pack-runtime.ts`
  - `src/data/pcs-technical-data-version-bootstrap.ts`
  - `src/pages/tech-pack/context.ts`
  - `src/pages/tech-pack/events.ts`
  - `src/pages/tech-pack/process-domain.ts`
  - `src/pages/fcs-production-tech-pack-snapshot.ts`
- 生产任务和适配：
  - `src/data/fcs/production-artifact-generation.ts`
  - `src/data/fcs/task-detail-rows.ts`
  - `src/data/fcs/process-tasks.ts`
  - `src/data/fcs/runtime-process-tasks.ts`
  - `src/data/fcs/page-adapters/task-execution-adapter.ts`
  - `src/data/fcs/milestone-configs.ts`
  - `src/data/fcs/process-craft-dict.ts`
- PDA 与移动投影：
  - `src/pages/pda-exec.ts`
  - `src/pages/pda-exec-detail.ts`
  - `src/pages/pda-task-receive.ts`
  - `src/pages/pda-warehouse.ts`
  - `src/pages/pda-warehouse-wait-process.ts`
  - `src/pages/pda-warehouse-wait-handover.ts`
  - `src/data/fcs/pda-cutting-execution-source.ts`
  - `src/data/fcs/process-mobile-task-binding.ts`
  - `src/data/fcs/mobile-execution-task-index.ts`
  - `src/data/fcs/pda-handover-events.ts`
  - `src/data/fcs/factory-mobile-todos.ts`
  - `src/data/fcs/factory-mobile-warehouse.ts`
  - `src/data/fcs/pda-task-scenario-matrix.ts`
- 路由、菜单和事件：
  - `src/main-handlers/fcs-handlers.ts`
  - `src/router/routes-fcs.ts`
  - `src/router/route-renderers-fcs.ts`
  - `src/data/app-shell-config.ts`
  - `src/data/fcs/fcs-route-links.ts`
- 打印、治理和命令：
  - `src/pages/print/templates/label-print-template.ts`
  - `scripts/standard-list-page-baseline.json`
  - `package.json`

### 删除文件

- `src/pages/process-factory/wool/fei-tickets.ts`
- `src/pages/process-factory/wool/statistics.ts`
- `src/pages/process-factory/wool/machine-schedule.ts`

---

### 任务 1：先建立事实工作流失败检查

**文件：**
- 创建：`scripts/check-wool-fact-workflow.ts`
- 修改：`package.json`

- [ ] **步骤 1：编写新领域入口和关键业务规则的失败检查**

检查脚本先引用尚未存在的新接口，固定齐料、150% 上限、无填报不可交出、人工完成和横机解除规则：

```ts
import assert from 'node:assert/strict'
import {
  addWoolProcessReport,
  addWoolYarnReceipt,
  completeWoolWorkOrder,
  getWoolOutputReadiness,
  getWoolWorkOrderById,
  listWoolMachineAssociations,
  listWoolWorkOrders,
  replaceWoolMachineAssociations,
  resetWoolFactWorkflowMock,
} from '../src/data/fcs/wool-task-domain.ts'

resetWoolFactWorkflowMock('CHECK_WOOL_FACT_WORKFLOW')
const order = listWoolWorkOrders().find((item) => item.woolOrderNo === 'WMO-CHECK-READY')!
const black = order.outputPlanLines.find((item) => item.colorCode === 'BLACK')!

assert.deepEqual(black.requiredYarnSkus, ['YARN-A', 'YARN-B'])
assert.deepEqual(getWoolOutputReadiness(order.woolOrderId, black.outputSkuCode).missingYarnSkus, ['YARN-A', 'YARN-B'])

addWoolYarnReceipt(order.woolOrderId, {
  commandId: 'CMD-WR-CHECK-001',
  receiptNo: 'WR-CHECK-001',
  deliveryNo: 'DN-CHECK-001',
  batchNo: 'BATCH-A',
  receivedAt: '2026-07-30 08:00:00',
  receivedBy: '毛织仓管',
  lines: [{ yarnSkuCode: 'YARN-A', receivedQty: 20, qtyUnit: 'kg' }],
})
assert.deepEqual(getWoolOutputReadiness(order.woolOrderId, black.outputSkuCode).missingYarnSkus, ['YARN-B'])

addWoolYarnReceipt(order.woolOrderId, {
  commandId: 'CMD-WR-CHECK-002',
  receiptNo: 'WR-CHECK-002',
  receivedAt: '2026-07-30 09:00:00',
  receivedBy: '毛织仓管',
  lines: [{ yarnSkuCode: 'YARN-B', receivedQty: 1, qtyUnit: 'kg' }],
})
assert.equal(getWoolOutputReadiness(order.woolOrderId, black.outputSkuCode).isReady, true)

addWoolProcessReport(order.woolOrderId, {
  commandId: 'CMD-REPORT-CHECK-LIMIT',
  outputSkuCode: black.outputSkuCode,
  reportedQty: Math.floor(black.plannedQty * 1.5),
  reportedAt: '2026-07-30 10:00:00',
  reportedBy: '毛织主管',
})
assert.throws(
  () => addWoolProcessReport(order.woolOrderId, {
    commandId: 'CMD-REPORT-CHECK-OVER-LIMIT',
    outputSkuCode: black.outputSkuCode,
    reportedQty: 1,
    reportedAt: '2026-07-30 10:01:00',
    reportedBy: '毛织主管',
  }),
  /累计加工填报不能超过计划数量的 150%/,
)

replaceWoolMachineAssociations(order.woolOrderId, ['WM-001', 'WM-002'], {
  operatedAt: '2026-07-30 11:00:00',
  operatedBy: '毛织主管',
})
assert.equal(listWoolMachineAssociations(order.woolOrderId).length, 2)
assert.throws(
  () => completeWoolWorkOrder(order.woolOrderId, {
    completedAt: '2026-07-30 12:00:00',
    completedBy: '毛织主管',
    remark: '没有交出记录不能完成',
  }),
  /至少有一次发起交出后才能完成加工单/,
)
assert.equal(getWoolWorkOrderById(order.woolOrderId)?.processingStatus, 'UNPROCESSED')
```

- [ ] **步骤 2：运行检查并确认失败**

运行：

```bash
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-wool-fact-workflow.ts
```

预期：FAIL，首先报错新领域导出不存在或 `resetWoolFactWorkflowMock` 未定义。

- [ ] **步骤 3：在 `package.json` 注册专项检查**

在 `scripts` 中增加：

```json
"check:wool-fact-workflow": "tsx scripts/check-wool-fact-workflow.ts",
"test:wool-fact-workflow:e2e": "playwright test tests/wool-management-fact-workflow.spec.ts"
```

- [ ] **步骤 4：确认现有毛织检查仍能暴露旧模型**

运行：

```bash
npm run check:wool-internal-style-code
npm run check:wool-warehouse-unified-model
```

预期：两个旧检查在本任务开始时仍通过；将输出保存为改造前基线，不把“旧检查通过”当成新规格通过。

- [ ] **步骤 5：提交检查骨架**

```bash
git add scripts/check-wool-fact-workflow.ts package.json
git commit -m "test: define wool fact workflow contract"
```

---

### 任务 2：标记技术包款色用料关系来源并删除毛织旧执行要求

**文件：**
- 修改：`src/data/pcs-technical-data-version-types.ts`
- 修改：`src/data/fcs/tech-packs.ts`
- 修改：`src/data/fcs/production-tech-pack-snapshot-types.ts`
- 修改：`src/data/fcs/production-tech-pack-snapshot-builder.ts`
- 修改：`src/data/fcs/production-order-tech-pack-runtime.ts`
- 修改：`src/data/pcs-technical-data-version-bootstrap.ts`
- 修改：`src/pages/tech-pack/context.ts`
- 修改：`src/pages/tech-pack/events.ts`
- 修改：`src/pages/tech-pack/process-domain.ts`
- 修改：`src/pages/fcs-production-tech-pack-snapshot.ts`
- 修改：`scripts/check-wool-fact-workflow.ts`

- [ ] **步骤 1：增加失败检查，证明兜底关系不能成为毛织纱线证据**

```ts
import { alignWoolColorMaterialMappingsForDemand } from '../src/data/fcs/production-tech-pack-snapshot-builder.ts'

const alignedMappings = alignWoolColorMaterialMappingsForDemand({
  mappings: [{
    mappingId: 'MAP-BLACK',
    mappingOrigin: 'TECH_PACK',
    colorCode: 'BLACK',
    colorName: '黑色',
    applicableSkuCodes: ['GARMENT-BLACK-M'],
    materialLines: [],
  }],
  demandSkuLines: [
    { skuCode: 'GARMENT-BLACK-M', colorCode: 'BLACK', colorName: '黑色' },
    { skuCode: 'GARMENT-WHITE-M', colorCode: 'WHITE', colorName: '白色' },
  ],
})
const mappingOrigins = alignedMappings.map((item) => item.mappingOrigin)

assert(mappingOrigins.includes('TECH_PACK'))
assert(mappingOrigins.includes('DEMAND_FALLBACK'))
assert.equal(
  mappingOrigins.filter((origin) => origin === 'DEMAND_FALLBACK').every((origin) => origin !== 'TECH_PACK'),
  true,
)
```

同时对文件源码增加负向断言：

```ts
const techPackProcessSource = readFileSync(
  new URL('../src/pages/tech-pack/process-domain.ts', import.meta.url),
  'utf8',
)
assert(!techPackProcessSource.includes('打印毛织菲票'))
assert(!techPackProcessSource.includes('毛织厂包装'))
```

- [ ] **步骤 2：运行检查并确认来源字段缺失**

运行：`npm run check:wool-fact-workflow`

预期：FAIL，TypeScript 报 `mappingOrigin` 不存在，或运行时断言未得到 `TECH_PACK` 与 `DEMAND_FALLBACK`。

- [ ] **步骤 3：扩展快照款色关系类型并在构建时赋值**

使用唯一联合类型：

```ts
export type TechnicalColorMaterialMappingOrigin = 'TECH_PACK' | 'DEMAND_FALLBACK'

export interface ProductionTechPackColorMaterialMapping {
  mappingId: string
  mappingOrigin: TechnicalColorMaterialMappingOrigin
  colorCode: string
  colorName: string
  applicableSkuCodes: string[]
  materialLines: ProductionTechPackColorMaterialLine[]
}
```

`cloneColorMappings()` 克隆技术包原始行时统一写 `mappingOrigin: 'TECH_PACK'`。把 `alignSnapshotWithDemandSkuLines()` 内的款色关系对齐提取为 `alignWoolColorMaterialMappingsForDemand()`：复制缺色关系时统一写 `mappingOrigin: 'DEMAND_FALLBACK'`，原构建函数调用该纯函数。运行时克隆和读取必须保留该字段，不允许用颜色或行内容反推来源。

- [ ] **步骤 4：删除毛织专属菲票、包装配置和展示**

从毛织工艺配置类型、技术包编辑上下文、事件读写、规则卡、快照执行要求和 bootstrap 示例中删除 `requiresFeiTicket`、`packagingRequired` 及毛织旧节点文案。只删除毛织分支，不改其他工艺的包装、菲票能力。

核心类型保留：

```ts
export interface TechnicalWoolProcessRule {
  woolTaskKind: 'WHOLE_GARMENT' | 'PART_PANEL'
  downstreamTarget: 'DOWNSTREAM_FACTORY' | 'CUTTING_WAIT_HANDOVER_WAREHOUSE'
}
```

- [ ] **步骤 5：运行技术包与毛织检查**

运行：

```bash
npm run check:fcs-production-tech-pack-snapshot
npm run check:fcs-tech-pack-snapshot-consumption
npm run check:tech-pack-process-route
npm run check:wool-fact-workflow
```

预期：前三项 PASS；毛织检查继续在尚未实现的新领域入口失败，但不再因 `mappingOrigin` 或旧毛织执行要求失败。

- [ ] **步骤 6：提交技术包来源改造**

```bash
git add src/data/pcs-technical-data-version-types.ts src/data/fcs/tech-packs.ts src/data/fcs/production-tech-pack-snapshot-types.ts src/data/fcs/production-tech-pack-snapshot-builder.ts src/data/fcs/production-order-tech-pack-runtime.ts src/data/pcs-technical-data-version-bootstrap.ts src/pages/tech-pack/context.ts src/pages/tech-pack/events.ts src/pages/tech-pack/process-domain.ts src/pages/fcs-production-tech-pack-snapshot.ts scripts/check-wool-fact-workflow.ts
git commit -m "refactor: mark wool tech pack material origins"
```

---

### 任务 3：建立加工后对象与必需纱线冻结模型

**文件：**
- 创建：`src/data/fcs/wool-domain/types.ts`
- 创建：`src/data/fcs/wool-domain/tech-pack-source.ts`
- 修改：`src/data/fcs/task-detail-rows.ts`
- 修改：`scripts/check-wool-fact-workflow.ts`

- [ ] **步骤 1：增加整件、部位、缺关系和非毛织 BOM 的失败检查**

```ts
import {
  buildWoolOrderSourceSnapshot,
  type WoolOrderSourceBuildInput,
} from '../src/data/fcs/wool-domain/tech-pack-source.ts'

const sourceBase: Omit<WoolOrderSourceBuildInput, 'kind' | 'patternParts'> = {
  taskId: 'TASK-WOOL-SOURCE-CHECK',
  productionOrderId: 'PO-WOOL-SOURCE-CHECK',
  productionOrderNo: 'PO-WOOL-SOURCE-CHECK',
  sourceTechPackVersionId: 'TP-WOOL-CHECK-V1',
  sourceTechPackVersionCode: 'V1',
  garmentSkuLines: [
    { skuCode: 'GARMENT-BLACK-M', colorCode: 'BLACK', colorName: '黑色', sizeCode: 'M', plannedQty: 100 },
  ],
  bomItems: [
    { bomItemId: 'BOM-YARN-A', materialCode: 'YARN-A', materialName: '黑色纱线 A', usageProcessCodes: ['WOOL'] },
    { bomItemId: 'BOM-BAG', materialCode: 'BAG-01', materialName: '包装袋', usageProcessCodes: ['PACKAGING'] },
  ],
  colorMaterialMappings: [{
    mappingId: 'MAP-BLACK',
    mappingOrigin: 'TECH_PACK',
    colorCode: 'BLACK',
    colorName: '黑色',
    applicableSkuCodes: ['GARMENT-BLACK-M'],
    materialLines: [
      { bomItemId: 'BOM-YARN-A', materialCode: 'YARN-A' },
      { bomItemId: 'BOM-BAG', materialCode: 'BAG-01' },
    ],
  }],
}

const whole = buildWoolOrderSourceSnapshot({
  ...sourceBase,
  kind: 'WHOLE_GARMENT',
  patternParts: [],
})
assert(whole.outputPlanLines.every((line) => line.outputObjectType === 'GARMENT'))
assert(whole.outputPlanLines.every((line) => line.qtyUnit === '件'))
assert(whole.outputPlanLines.every((line) => line.sourceColorMappingIds.length > 0))
assert.deepEqual(whole.outputPlanLines[0].requiredYarnSkus, ['YARN-A'])

const panel = buildWoolOrderSourceSnapshot({
  ...sourceBase,
  kind: 'PART_PANEL',
  patternParts: [{ patternId: 'SLEEVE', partName: '袖片', piecesPerGarment: 2 }],
})
const sleeveM = panel.outputPlanLines.find((line) => line.woolPartName === '袖片' && line.sizeCode === 'M')!
assert.equal(sleeveM.outputObjectType, 'WOOL_PANEL')
assert.equal(sleeveM.outputSkuCode, `WP-${sleeveM.woolPartCode}-${sleeveM.garmentSkuCode}`)
assert.equal(sleeveM.plannedQty, 200)
assert.equal(sleeveM.qtyUnit, '片')

const missing = buildWoolOrderSourceSnapshot({
  ...sourceBase,
  kind: 'WHOLE_GARMENT',
  patternParts: [],
  colorMaterialMappings: sourceBase.colorMaterialMappings.map((item) => ({
    ...item,
    mappingOrigin: 'DEMAND_FALLBACK',
  })),
})
assert.equal(missing.outputPlanLines.some((line) => line.requiredYarnSkus.length === 0), true)
assert.equal(missing.outputPlanLines.every((line) => line.sourceColorMappingIds.length === 0), true)
```

- [ ] **步骤 2：运行检查并确认新文件不存在**

运行：`npm run check:wool-fact-workflow`

预期：FAIL，报错无法找到 `wool-domain/tech-pack-source.ts`。

- [ ] **步骤 3：定义稳定领域类型**

在 `types.ts` 定义正式规格第 13 节全部类型，并固定以下关键类型：

```ts
export type WoolProcessingStatus = 'UNPROCESSED' | 'PROCESSING' | 'COMPLETED'
export type WoolOutputObjectType = 'GARMENT' | 'WOOL_PANEL'
export type WoolQtyUnit = '件' | '片' | 'kg'

export interface WoolOutputPlanLine {
  outputSkuCode: string
  outputObjectType: WoolOutputObjectType
  garmentSkuCode: string
  woolPartCode?: string
  woolPartName?: string
  colorCode: string
  colorName: string
  sizeCode: string
  plannedQty: number
  qtyUnit: '件' | '片'
  requiredYarnSkus: string[]
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  sourceColorMappingIds: string[]
  sourceBomItemIds: string[]
}
```

同一文件完整定义 `WoolWorkOrder`、三类事实记录、数量修改日志、仓库流水、完成快照、横机关联和关联日志；不得保留 `nodes`、`priceInfo`、`machineScheduleId`、`handoverOrderNo` 单值或毛织菲票字段。

- [ ] **步骤 4：实现只认技术包原始关系的来源解析**

`buildWoolOrderSourceSnapshot(input: WoolOrderSourceBuildInput)` 使用上面可直接构造的窄输入类型；`buildWoolOrderSourceSnapshotFromRuntimeTask(taskId)` 负责把现有生产单、运行时任务和技术包快照适配成该输入。两者必须：

1. 从运行时任务定位生产单和冻结技术包快照。
2. 整件按生产单成衣 SKU 生成计划行。
3. 部位按纸样部位 × 成衣 SKU 生成稳定部位 SKU，计划数量为该颜色+尺码成衣 SKU 的计划件数，单位为件；单件片数只作为技术资料，不参与完工、交出和 150% 上限。
4. 只读取 `mappingOrigin === 'TECH_PACK'`。
5. 只接受能由 `bomItemId` 或唯一 `materialCode` 关联到 BOM，且 `usageProcessCodes` 含 `WOOL` 或 `PROC_WOOL` 的行。
6. 按 `applicableSkuCodes` 投影并按纱线 SKU 去重。
7. 保留快照版本、关系行和 BOM 行 ID。
8. 关系、SKU 或部位缺失时保留不可填报计划行或明确生成错误，不用名称、类型或第一条 BOM 猜测。

- [ ] **步骤 5：收敛通用任务明细的毛织输出对象**

`task-detail-rows.ts` 继续服务通用任务展示，但毛织分支改为调用同一稳定输出 SKU 生成函数；`item.id` 不得再作为毛织纱线 `materialCode` 的事实来源。

- [ ] **步骤 6：运行检查并提交**

运行：

```bash
npm run check:wool-fact-workflow
npm run check:fcs-tech-pack-snapshot-consumption
npm run check:production-process-work-order-generation
```

预期：来源解析断言 PASS；毛织检查继续在存储或命令入口处失败。

```bash
git add src/data/fcs/wool-domain/types.ts src/data/fcs/wool-domain/tech-pack-source.ts src/data/fcs/task-detail-rows.ts scripts/check-wool-fact-workflow.ts
git commit -m "feat: freeze wool output and yarn requirements"
```

---

### 任务 4：建立 v2 存储、查询和 26 类 Mock 场景

**文件：**
- 创建：`src/data/fcs/wool-domain/store.ts`
- 创建：`src/data/fcs/wool-domain/queries.ts`
- 创建：`src/data/fcs/wool-domain/mock-data.ts`
- 修改：`src/data/fcs/wool-task-domain.ts`
- 修改：`scripts/check-wool-fact-workflow.ts`

- [ ] **步骤 1：增加状态、Tab、齐料和 Mock 覆盖失败检查**

```ts
const allOrders = listWoolWorkOrders()
assert(allOrders.some((item) => item.mockScenarioCode === 'NO_YARN_RECEIPT'))
assert(allOrders.some((item) => item.mockScenarioCode === 'ONE_COLOR_READY'))
assert(allOrders.some((item) => item.mockScenarioCode === 'ALL_READY_SKUS_AT_LIMIT'))
assert(allOrders.some((item) => item.mockScenarioCode === 'COMPLETED_WITH_STOCK'))
assert(allOrders.some((item) => item.mockScenarioCode === 'TECH_PACK_FALLBACK_REJECTED'))
assert(allOrders.some((item) => item.kind === 'PART_PANEL'))

const readyOrder = allOrders.find((item) => item.mockScenarioCode === 'ONE_COLOR_READY')!
assert.equal(getWoolWorkOrderTab(readyOrder.woolOrderId), 'READY')
assert.equal(getWoolProcessingStatus(readyOrder.woolOrderId), 'UNPROCESSED')

const cappedOrder = allOrders.find((item) => item.mockScenarioCode === 'ALL_READY_SKUS_AT_LIMIT')!
assert.equal(getWoolWorkOrderTab(cappedOrder.woolOrderId), 'NOT_READY')
assert.match(getWoolWorkOrderBlockReason(cappedOrder.woolOrderId), /全部加工后 SKU 已达到填报上限/)
```

- [ ] **步骤 2：运行检查并确认失败**

运行：`npm run check:wool-fact-workflow`

预期：FAIL，报存储、查询或 Mock 导出不存在。

- [ ] **步骤 3：实现 v2 存储和一次性提交**

```ts
export const WOOL_DOMAIN_STORE_KEY = 'higood-fcs-wool-domain-store-v2'

export interface WoolDomainStore {
  workOrders: Record<string, WoolWorkOrder>
  yarnReceipts: WoolYarnReceiptRecord[]
  yarnIssues: WoolYarnIssueRecord[]
  yarnReturns: WoolYarnReturnRecord[]
  processReports: WoolProcessReportRecord[]
  handovers: WoolHandoverRecord[]
  qtyChangeLogs: WoolQtyChangeLog[]
  warehouseFlows: WoolWarehouseFlow[]
  completions: WoolCompletionRecord[]
  machines: WoolMachine[]
  machineAssociations: WoolMachineAssociation[]
  machineAssociationLogs: WoolMachineAssociationLog[]
  operationLogs: WoolOperationLog[]
}
```

`commitWoolStore(mutator)` 必须先克隆当前 store，在克隆上完成全部校验和写入，成功后只调用一次 `localStorage.setItem`；异常时不写回。`resetWoolFactWorkflowMock()` 只重置 v2 key，不删除其他模块或旧 key。

- [ ] **步骤 4：实现派生查询**

`queries.ts` 提供并测试：

```ts
getWoolOutputReadiness(woolOrderId, outputSkuCode)
getWoolProcessingStatus(woolOrderId)
getWoolWorkOrderTab(woolOrderId)
getWoolWorkOrderBlockReason(woolOrderId)
getWoolAllowedActions(woolOrderId)
getWoolOutputReportedQty(woolOrderId, outputSkuCode)
getWoolOutputHandedOverQty(woolOrderId, outputSkuCode)
getWoolWarehouseStock(stockKey)
listWoolWorkOrders(filters)
listWoolFactRecords(query)
```

`isReady` 必须要求必需纱线集合非空且每一种纱线都在“实收数量大于 0 的已保存接收明细”中出现；纱线重量不参与可填报容量。Tab 计算必须先应用搜索筛选，再分别统计 `READY`、`NOT_READY`、`COMPLETED`。

- [ ] **步骤 5：建立正式规格要求的 Mock 数据**

`mock-data.ts` 至少生成正式规格第 15 节的 26 类场景；每个场景使用稳定 `mockScenarioCode`，并包含可核对的生产单、技术包版本、加工后 SKU、纱线、批次、记录、库存和设备关系。

- [ ] **步骤 6：将 `wool-task-domain.ts` 改为新领域门面**

清空旧状态机实现，改为显式 re-export：

```ts
export * from './wool-domain/types.ts'
export * from './wool-domain/tech-pack-source.ts'
export * from './wool-domain/store.ts'
export * from './wool-domain/queries.ts'
export * from './wool-domain/commands.ts'
export * from './wool-domain/machine-associations.ts'
export * from './wool-domain/mock-data.ts'
```

此时允许下游消费者暂时出现编译错误；不得在门面中保留旧函数兼容层来模拟新事实。

- [ ] **步骤 7：运行专项检查并提交**

运行：`npm run check:wool-fact-workflow`

预期：查询和 Mock 断言 PASS；命令相关断言仍因 `commands.ts` 不存在而失败。

```bash
git add src/data/fcs/wool-domain/store.ts src/data/fcs/wool-domain/queries.ts src/data/fcs/wool-domain/mock-data.ts src/data/fcs/wool-task-domain.ts scripts/check-wool-fact-workflow.ts
git commit -m "refactor: replace wool domain store with fact model"
```

---

### 任务 5：实现三类可重复事实、数量修改、固定库位和人工完成

**文件：**
- 创建：`src/data/fcs/wool-domain/commands.ts`
- 修改：`src/data/fcs/wool-domain/queries.ts`
- 修改：`scripts/check-wool-fact-workflow.ts`

- [ ] **步骤 1：补齐事实命令和仓库原子性的失败检查**

```ts
import {
  addWoolProcessReport,
  addWoolHandover,
  changeWoolFactQty,
  completeWoolWorkOrder,
  confirmWoolDownstreamReceipt,
  getWoolCompletion,
  getWoolOutputReadiness,
  getWoolOutputStockQty,
  issueWoolYarn,
  listWoolMachineAssociations,
  listWoolWorkOrders,
  listWoolWarehouseFlows,
  resetWoolFactWorkflowMock,
  returnWoolYarn,
} from '../src/data/fcs/wool-task-domain.ts'

resetWoolFactWorkflowMock('CHECK_WOOL_FACT_COMMANDS')
const reportOrder = listWoolWorkOrders().find((item) => item.mockScenarioCode === 'ONE_COLOR_READY')!
const reportLine = reportOrder.outputPlanLines.find(
  (item) => getWoolOutputReadiness(reportOrder.woolOrderId, item.outputSkuCode).isReady,
)!

const report = addWoolProcessReport(reportOrder.woolOrderId, {
  commandId: 'CMD-REPORT-CHECK-001',
  outputSkuCode: reportLine.outputSkuCode,
  reportedQty: 10,
  reportedAt: '2026-07-30 10:00:00',
  reportedBy: '毛织主管',
})
const reportRetry = addWoolProcessReport(reportOrder.woolOrderId, {
  commandId: 'CMD-REPORT-CHECK-001',
  outputSkuCode: reportLine.outputSkuCode,
  reportedQty: 10,
  reportedAt: '2026-07-30 10:00:00',
  reportedBy: '毛织主管',
})
assert.equal(reportRetry.reportId, report.reportId)
assert.equal(listWoolWarehouseFlows({ sourceRecordId: report.reportId }).length, 1)
assert.equal(
  listWoolWarehouseFlows({ sourceRecordId: report.reportId })[0].defaultLocationId,
  reportLine.outputObjectType === 'GARMENT' ? 'WOOL-WH-GARMENT-DEFAULT' : 'WOOL-WH-CUT-DEFAULT',
)

const handover = addWoolHandover(reportOrder.woolOrderId, {
  commandId: 'CMD-HANDOVER-CHECK-001',
  outputSkuCode: reportLine.outputSkuCode,
  handoverQty: 6,
  handedOverAt: '2026-07-30 11:00:00',
  handedOverBy: '毛织主管',
})
assert.equal(getWoolOutputStockQty(reportOrder.woolOrderId, reportLine.outputSkuCode), 4)

changeWoolFactQty({
  recordType: 'PROCESS_REPORT',
  recordId: report.reportId,
  afterQty: 12,
  reason: '复核生产记录',
  changedAt: '2026-07-30 11:10:00',
  changedBy: '毛织主管',
})
assert.equal(getWoolOutputStockQty(reportOrder.woolOrderId, reportLine.outputSkuCode), 6)

confirmWoolDownstreamReceipt(handover.handoverId, {
  actualReceivedQty: 5,
  receivedAt: '2026-07-30 12:00:00',
  receivedBy: '下游仓管',
})
assert.throws(
  () => changeWoolFactQty({
    recordType: 'HANDOVER',
    recordId: handover.handoverId,
    afterQty: 7,
    reason: '下游已确认后尝试修改',
    changedAt: '2026-07-30 12:10:00',
    changedBy: '毛织主管',
  }),
  /下游已确认，交出数量不可修改/,
)

const yarnLine = reportOrder.outputPlanLines.flatMap((item) => item.requiredYarnSkus)[0]
issueWoolYarn(reportOrder.woolOrderId, {
  commandId: 'CMD-YARN-ISSUE-CHECK-001',
  yarnSkuCode: yarnLine,
  issuedQty: 2,
  issuedAt: '2026-07-30 12:20:00',
  issuedBy: '毛织仓管',
})
returnWoolYarn(reportOrder.woolOrderId, {
  commandId: 'CMD-YARN-RETURN-CHECK-001',
  yarnSkuCode: yarnLine,
  returnedQty: 1,
  returnedAt: '2026-07-30 12:30:00',
  returnedBy: '毛织仓管',
})
assert.throws(
  () => returnWoolYarn(reportOrder.woolOrderId, {
    commandId: 'CMD-YARN-RETURN-CHECK-OVER',
    yarnSkuCode: yarnLine,
    returnedQty: 2,
    returnedAt: '2026-07-30 12:40:00',
    returnedBy: '毛织仓管',
  }),
  /累计退回不能超过累计领用/,
)

const completionOrder = listWoolWorkOrders().find((item) => item.mockScenarioCode === 'READY_TO_COMPLETE')!
const completionStockBefore = completionOrder.outputPlanLines.reduce(
  (sum, item) => sum + getWoolOutputStockQty(completionOrder.woolOrderId, item.outputSkuCode),
  0,
)
completeWoolWorkOrder(completionOrder.woolOrderId, {
  completedAt: '2026-07-30 13:00:00',
  completedBy: '毛织主管',
  remark: '业务核对后确认完成',
})
assert(getWoolCompletion(completionOrder.woolOrderId))
assert.equal(listWoolMachineAssociations(completionOrder.woolOrderId).length, 0)
assert.equal(
  completionOrder.outputPlanLines.reduce(
    (sum, item) => sum + getWoolOutputStockQty(completionOrder.woolOrderId, item.outputSkuCode),
    0,
  ),
  completionStockBefore,
)
```

- [ ] **步骤 2：运行检查并确认命令缺失**

运行：`npm run check:wool-fact-workflow`

预期：FAIL，报命令导出不存在。

- [ ] **步骤 3：实现确认接收和纱线默认库位入库**

`addWoolYarnReceipt` 校验至少一条明细、每条数量大于 0、SKU 属于本加工单冻结必需纱线，并在同一次 `commitWoolStore` 中新增接收记录和每条明细对应的 `YARN_RECEIPT` 入库流水，固定写 `WOOL-WP-YARN-DEFAULT`。三类新增事实命令都必须接收稳定 `commandId`；同一 `commandId` 重试时返回第一次结果，不重复新增记录或仓库流水。

- [ ] **步骤 4：实现加工填报和 150% 上限**

`addWoolProcessReport` 一次只接受一个加工后 SKU；校验加工单未完成、必需纱线已齐、数量为正整数、累计数量不超过 `Math.floor(plannedQty * 1.5)`，并原子新增记录与裁片/成衣默认库位入库流水。

- [ ] **步骤 5：实现结构化去向交出和下游确认**

`addWoolHandover` 从加工单读取结构化 `receiverType/receiverId/receiverName`，不接受页面自由文本；按输入 `outputSkuCode` 计算“可交出余额 = min(该 SKU 默认库位有效库存, 该 SKU 累计有效加工填报 - 该 SKU 累计有效交出)”，本次数量不得超过该余额。无该 SKU 有效填报、余额为 0 或超量时零写失败；不同款色 SKU 的填报与库存不得拼接。整件毛织和部位毛织的交出数量均按颜色+尺码件数保存，部位毛织不得写片数。校验通过后才原子新增交出记录、出库流水和下游待接收投影。`confirmWoolDownstreamReceipt` 只追加实际接收、差异、接收人和时间，不恢复毛织库存、不修改来源交出数量。

- [ ] **步骤 5.1：实现毛织交出单打印**

新增 `renderCraftWoolHandoverPrintPage` 和动态路由 `/fcs/craft/wool/work-orders/:woolOrderId/handover-print`；毛织加工单列表在至少存在一条交出记录后显示“打印交出单”。打印页按交出记录逐张输出 A4 `SURAT JALAN / 毛织交出单`，必须展示生产单、毛织加工单、下游接收工厂、颜色、尺码、本次交出件数、款式图、物料图、条码和二维码。整件毛织接收方为后道工厂；部位毛织接收方为裁床工厂（裁床待交出仓）。毛织打印链路不得出现菲票语义。

- [ ] **步骤 6：实现纱线领用退回与独立库存调整/转移**

先实现独立仓库命令：

- `issueWoolYarn`：只允许未完成加工单和该单冻结必需纱线，从纱线默认库位扣减，不能超过当前库存。
- `returnWoolYarn`：回到同加工单、同纱线和对应批次，累计退回不能超过累计领用。
- `adjustWoolWarehouseStock`：必须填写原因，保存调整前后数量、操作人和时间。
- `transferWoolWarehouseStock`：只转到公共仓库位置主数据中的启用位置；不改变核心操作仍只读写默认库位。

- [ ] **步骤 7：实现直接修改数量和差额流水**

统一命令 `changeWoolFactQty`：

- 接收：完成前可改，差额调整纱线默认库位，不得让库存小于零。
- 填报：完成前可改，不得超过 150%、低于累计交出或让默认库位库存小于零。
- 交出：完成前且下游未确认可改；增加量不得超过修改前同一 `outputSkuCode` 的可交出余额，该余额继续取默认库位有效库存与“累计有效加工填报减累计有效交出”的较小值；减少量返还原默认库位。独立调高库存不得让累计有效交出超过累计有效加工填报。
- 三类数量均必须大于 0，必须填写原因，并写 `WoolQtyChangeLog`。

- [ ] **步骤 8：实现人工完成的单次原子提交**

`completeWoolWorkOrder` 只校验未完成且至少有一条交出记录。命令在一次提交中保存四块确认快照、完成记录、解除全部当前横机、写关联日志和操作日志；不判断计划差异、缺料、下游待确认或剩余库存，不清理库存。任务 5 先在 store 草稿上使用私有 `releaseMachineAssociationsForCompletion()` 完成批量解除；任务 6 将其移动到设备关系模块并由完成命令复用，行为保持不变。

- [ ] **步骤 9：运行检查并提交**

运行：`npm run check:wool-fact-workflow`

预期：核心事实、原子库存、数量修改、下游锁定和人工完成断言全部 PASS。

```bash
git add src/data/fcs/wool-domain/commands.ts src/data/fcs/wool-domain/queries.ts scripts/check-wool-fact-workflow.ts
git commit -m "feat: add repeatable wool fact commands"
```

---

### 任务 6：实现横机当前关联和四状态联动

**文件：**
- 创建：`src/data/fcs/wool-domain/machine-associations.ts`
- 修改：`src/data/fcs/wool-domain/commands.ts`
- 修改：`scripts/check-wool-fact-workflow.ts`

- [ ] **步骤 1：增加整组保存、转移、维修、停用和完成解除检查**

```ts
import {
  changeWoolMachineAvailability,
  getWoolMachineById,
  listWoolMachineAssociations,
  listWoolWorkOrders,
  replaceWoolMachineAssociations,
  resetWoolFactWorkflowMock,
} from '../src/data/fcs/wool-task-domain.ts'

resetWoolFactWorkflowMock('CHECK_WOOL_MACHINE_ASSOCIATIONS')
const orderA = listWoolWorkOrders().find((item) => item.mockScenarioCode === 'MACHINE_ASSOCIATION_A')!
const orderB = listWoolWorkOrders().find((item) => item.mockScenarioCode === 'MACHINE_ASSOCIATION_B')!
const actor = { operatedAt: '2026-07-30 12:00:00', operatedBy: '设备主管' }

replaceWoolMachineAssociations(orderA.woolOrderId, ['WM-001', 'WM-002'], actor)
assert.equal(getWoolMachineById('WM-001')?.status, 'PRODUCING')

replaceWoolMachineAssociations(orderA.woolOrderId, ['WM-002'], actor)
assert.equal(getWoolMachineById('WM-001')?.status, 'IDLE')

replaceWoolMachineAssociations(orderB.woolOrderId, ['WM-002'], actor)
assert.equal(listWoolMachineAssociations(orderA.woolOrderId).length, 0)
assert.equal(listWoolMachineAssociations(orderB.woolOrderId)[0].machineId, 'WM-002')

assert.throws(
  () => replaceWoolMachineAssociations(orderB.woolOrderId, ['WM-REPAIR'], actor),
  /维修或停用设备不可关联/,
)

changeWoolMachineAvailability('WM-002', {
  nextStatus: 'REPAIR',
  reason: '机针故障',
  operatedAt: '2026-07-30 13:00:00',
  operatedBy: '设备主管',
  confirmedImpact: true,
})
assert.equal(listWoolMachineAssociations(orderB.woolOrderId).length, 0)
assert.equal(getWoolMachineById('WM-002')?.status, 'REPAIR')
```

- [ ] **步骤 2：运行检查并确认失败**

运行：`npm run check:wool-fact-workflow`

预期：FAIL，报横机关联命令不存在。

- [ ] **步骤 3：实现当前关联与派生状态**

设备档案只保存 `IDLE | REPAIR | DISABLED` 可编辑状态；查询时只要存在当前关联即派生为 `PRODUCING`。整组保存把本次选中集合视为最终真相，统一计算新增、保持、移除和跨单转移；维修和停用不可选。

- [ ] **步骤 4：实现设备异常影响确认命令**

生产中设备改维修或停用时要求 `confirmedImpact: true`，一次性解除当前关联、修改档案状态、写设备关联日志和设备操作日志。维修/停用恢复时只允许改为空闲，不自动恢复旧关联。

- [ ] **步骤 5：确认不存在“已排产”领域值**

```ts
const woolSources = [
  readFileSync(new URL('../src/data/fcs/wool-task-domain.ts', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/data/fcs/wool-domain/types.ts', import.meta.url), 'utf8'),
  readFileSync(new URL('../src/data/fcs/wool-domain/machine-associations.ts', import.meta.url), 'utf8'),
].join('\n')
assert(!woolSources.includes('SCHEDULED'))
assert(!woolSources.includes('已排产'))
```

- [ ] **步骤 6：运行检查并提交**

运行：`npm run check:wool-fact-workflow`

预期：全部领域检查 PASS。

```bash
git add src/data/fcs/wool-domain/machine-associations.ts src/data/fcs/wool-domain/commands.ts scripts/check-wool-fact-workflow.ts
git commit -m "feat: model current wool machine associations"
```

---

### 任务 7：改造上游生产任务生成和运行时投影

**文件：**
- 修改：`src/data/fcs/production-artifact-generation.ts`
- 修改：`src/data/fcs/process-tasks.ts`
- 修改：`src/data/fcs/runtime-process-tasks.ts`
- 修改：`src/data/fcs/page-adapters/task-execution-adapter.ts`
- 修改：`src/data/fcs/milestone-configs.ts`
- 修改：`src/data/fcs/process-craft-dict.ts`
- 修改：`scripts/check-wool-fact-workflow.ts`
- 修改：`scripts/check-production-process-work-order-generation.ts`

- [ ] **步骤 1：增加新毛织加工单初始事实检查**

```ts
const woolRuntimeTask = listRuntimeExecutionTasks().find(
  (item) => item.processBusinessCode === 'WOOL',
)!
const generated = buildWoolOrderFromRuntimeTask(woolRuntimeTask.taskId)
assert.equal(generated.processingStatus, 'UNPROCESSED')
assert.equal(generated.outputPlanLines.length > 0, true)
assert.equal(listWoolYarnReceipts(generated.woolOrderId).length, 0)
assert.equal(listWoolProcessReports(generated.woolOrderId).length, 0)
assert.equal(listWoolHandovers(generated.woolOrderId).length, 0)
assert.equal(getWoolCompletion(generated.woolOrderId), undefined)
assert.equal(getWoolWorkOrderTab(generated.woolOrderId), 'NOT_READY')
assert.equal('priceInfo' in generated, false)
assert.equal('nodes' in generated, false)
```

- [ ] **步骤 2：运行生产任务检查并确认旧默认开工行为失败**

运行：

```bash
npm run check:production-process-work-order-generation
npm run check:wool-fact-workflow
```

预期：至少一项 FAIL，显示新毛织任务仍带已接单、开工、横机里程碑、第一条物料、价格、包装或菲票。

- [ ] **步骤 3：让毛织任务生成调用冻结来源构建器**

`process-tasks.ts` 的毛织分支只生成任务协作字段；毛织加工单由 `buildWoolOrderSourceSnapshot()` 生成计划行和必需纱线。不得把 `acceptanceStatus`、`startedAt`、通用价格或旧里程碑复制为毛织加工事实。

- [ ] **步骤 4：删除毛织旧产物与里程碑**

从生产工艺产物、毛织里程碑配置和毛织工艺说明中删除横机首批、缝盘、熨烫、包装、毛织菲票与价格要求；保留全局其他工艺定义。

- [ ] **步骤 5：调整运行时任务和标准适配器**

运行时任务继续保存工厂分配和上游接单协作，但毛织状态与操作必须从 `wool-task-domain.ts` 查询。`task-execution-adapter.ts` 的毛织分支不输出标准价、派工价、差价原因、价格单位或结算价格。

- [ ] **步骤 6：运行检查并提交**

运行：

```bash
npm run check:production-process-work-order-generation
npm run check:wool-fact-workflow
npm run check:production-order-changes
```

预期：PASS，且染色、印花等非毛织任务生成场景保持通过。

```bash
git add src/data/fcs/production-artifact-generation.ts src/data/fcs/process-tasks.ts src/data/fcs/runtime-process-tasks.ts src/data/fcs/page-adapters/task-execution-adapter.ts src/data/fcs/milestone-configs.ts src/data/fcs/process-craft-dict.ts scripts/check-wool-fact-workflow.ts scripts/check-production-process-work-order-generation.ts
git commit -m "refactor: generate wool orders from frozen facts"
```

---

### 任务 8：重写毛织加工单标准列表和操作弹窗

**文件：**
- 重写：`src/pages/process-factory/wool/work-orders.ts`
- 重写：`src/pages/process-factory/wool/shared.ts`
- 修改：`scripts/check-wool-internal-style-code.ts`
- 修改：`scripts/standard-list-page-baseline.json`
- 修改：`scripts/check-wool-fact-workflow.ts`

- [ ] **步骤 1：将页面治理和三个 Tab 写成失败检查**

```ts
const workOrderSource = readFileSync(
  new URL('../src/pages/process-factory/wool/work-orders.ts', import.meta.url),
  'utf8',
)
assert(workOrderSource.startsWith('// @page-pattern: list'))
assert(workOrderSource.includes('renderStandardListPage'))
assert(workOrderSource.includes('renderStandardListTable'))
assert(workOrderSource.includes('renderTablePagination'))
assert(workOrderSource.includes('可以开工'))
assert(workOrderSource.includes('不可以开工'))
assert(workOrderSource.includes('已完成'))
assert(!workOrderSource.includes('统计卡片'))
assert(!workOrderSource.includes('advanceWoolOrderToWarehouseInbound'))
assert(workOrderSource.includes('getWoolOutputHandoverAvailableQty'))
assert(workOrderSource.includes('可交出余额'))
```

- [ ] **步骤 2：运行检查并确认旧列表失败**

运行：

```bash
npm run check:wool-internal-style-code
npm run check:list-page-governance
```

预期：FAIL，旧毛织列表仍在治理基线或未使用标准列表组件，并仍包含旧弹窗/自动推进。

- [ ] **步骤 3：重写标准列表结构**

页面顺序固定为标题与必要主操作、搜索条件、三个含数量 Tab、标准表格、分页。搜索条件先过滤全量，再计算三个 Tab 数量。列定义必须将加工单号、款式/内部货号、纱线接收摘要、可填报 SKU 摘要标为 `required: true`，操作列固定右侧。

- [ ] **步骤 4：实现局部刷新和防抖**

列表状态包含筛选、Tab、排序、页码和覆盖层；搜索输入只更新 DOM 值并使用 debounce 刷新结果区，Tab、分页、列偏好只替换列表工作区，弹窗开关只挂载/卸载覆盖层。不得调用页面级 `root.innerHTML`。

- [ ] **步骤 5：实现四类操作弹窗**

- 确认接收：多纱线明细，只选本单必需纱线，保存后追加记录。
- 加工填报：可选区只显示已齐料且未达 150% 的加工后 SKU；不可选区显示缺纱线或上限原因。
- 发起交出：逐 `outputSkuCode` 计算“可交出余额 = min(该 SKU 默认库位有效库存, 该 SKU 累计有效加工填报 - 该 SKU 累计有效交出)”，只显示余额大于 0 的 SKU；接收对象只读，缺稳定接收方阻断保存。不同款色 SKU 的填报、交出和库存不得拼接，独立库存调整不能绕过同一 SKU 的填报余额，保存命令必须按同一口径再次校验并在失败时保持交出记录和库存零写。
- 完成加工单：至少一次交出才显示；四块事实摘要和明确“系统不判断是否应该完成”提示，二次确认后调用单一完成命令。

所有弹窗输入只维护草稿；保存成功后局部刷新列表和覆盖层。

任务 8 的对抗检查至少覆盖：黑色 SKU 已填报、白色 SKU 填报为 0 时，单独调入白色库存后白色仍不进入交出候选且命令拒绝；有填报 SKU 多次交出后，可交出余额随累计有效交出减少；默认库位库存小于未交出填报余额时取库存值，反之取未交出填报余额；加工填报 150、已交出 40 后即使独立把库存调到 500，也不能把既有交出记录改到 200，且失败后填报、交出、库存、store 和持久化均不变；余额内合法增加可以成功。所有失败分支均不新增交出记录、不写库存流水。

- [ ] **步骤 6：实现数量修改入口和错误提示**

记录详情中的修改弹窗只允许数量和原因。修改交出数量时，增加量不得超过修改前同一加工后 SKU 的可交出余额；领域命令在 store 草稿内复用逐 SKU 余额查询，失败时数量修改记录、库存流水和持久化均保持零写。领域错误原样转成可操作中文，例如“最多还可填报 20 件，请将本次数量改为 20 件以内”或“交出增加量不能超过修改前该 SKU 可交出余额 20 件”，不显示“参数异常”。

- [ ] **步骤 7：移除治理基线条目并运行检查**

从 `scripts/standard-list-page-baseline.json` 删除且只删除 `src/pages/process-factory/wool/work-orders.ts` 条目，不更新哈希。

运行：

```bash
npm run check:wool-internal-style-code
npm run check:list-page-governance
npm run check:wool-fact-workflow
```

预期：PASS。

- [ ] **步骤 8：提交列表**

```bash
git add src/pages/process-factory/wool/work-orders.ts src/pages/process-factory/wool/shared.ts scripts/check-wool-internal-style-code.ts scripts/standard-list-page-baseline.json scripts/check-wool-fact-workflow.ts
git commit -m "feat: rebuild wool work order list"
```

---

### 任务 9：重写毛织加工单详情和分页事实记录

**文件：**
- 重写：`src/pages/process-factory/wool/work-order-detail.ts`
- 修改：`src/pages/process-factory/wool/shared.ts`
- 修改：`scripts/check-wool-fact-workflow.ts`

- [ ] **步骤 1：增加七个事实页签和旧节点缺失检查**

```ts
const detailSource = readFileSync(
  new URL('../src/pages/process-factory/wool/work-order-detail.ts', import.meta.url),
  'utf8',
)
for (const label of [
  '业务概览',
  '款色用料与开工判断',
  '确认接收记录',
  '加工填报记录',
  '发起交出记录',
  '横机关联',
  '操作记录',
]) assert(detailSource.includes(label))
for (const oldLabel of ['横机成片', '缝盘熨烫包装', '毛织菲票']) {
  assert(!detailSource.includes(oldLabel))
}
assert(detailSource.includes('renderTablePagination'))
```

- [ ] **步骤 2：运行检查并确认旧详情失败**

运行：`npm run check:wool-fact-workflow`

预期：FAIL，旧详情仍包含旧节点页签或缺少事实记录分页。

- [ ] **步骤 3：实现业务概览和款色用料判断**

业务概览只展示计划、累计接收/加工/交出、状态、结构化去向和当前横机。款色用料页按加工后 SKU 展示计划、必需纱线、已确认纱线、缺少纱线、可填报容量、累计加工、累计交出和默认库位余额。

- [ ] **步骤 4：实现三类记录分页和修改历史**

接收、加工、交出三个页签分别维护独立页码，每页只渲染当前页。记录详情展示凭证、操作人、时间、关联仓库流水和完整数量修改历史；完成后隐藏修改入口，下游已确认的交出记录也隐藏修改入口。

- [ ] **步骤 5：实现完成快照和只读状态**

已完成加工单的概览展示完成人、时间、备注和确认当时四块快照；后续下游确认数据与完成快照分栏展示，避免把后续回写误当成完成时事实。

- [ ] **步骤 6：运行检查并提交**

运行：

```bash
npm run check:wool-fact-workflow
npm run check:prototype-design-governance -- --all
```

预期：PASS。

```bash
git add src/pages/process-factory/wool/work-order-detail.ts src/pages/process-factory/wool/shared.ts scripts/check-wool-fact-workflow.ts
git commit -m "feat: rebuild wool fact detail"
```

---

### 任务 10：建立横机生产关联页并重写设备档案

**文件：**
- 创建：`src/pages/process-factory/wool/machine-associations.ts`
- 重写：`src/pages/process-factory/wool/machines.ts`
- 修改：`scripts/check-wool-fact-workflow.ts`

- [ ] **步骤 1：增加两个标准列表和级联选择失败检查**

```ts
for (const file of ['machine-associations.ts', 'machines.ts']) {
  const source = readFileSync(new URL(`../src/pages/process-factory/wool/${file}`, import.meta.url), 'utf8')
  assert(source.startsWith('// @page-pattern: list'))
  assert(source.includes('renderStandardListPage'))
  assert(source.includes('renderStandardListTable'))
  assert(source.includes('renderTablePagination'))
}
const associationSource = readFileSync(
  new URL('../src/pages/process-factory/wool/machine-associations.ts', import.meta.url),
  'utf8',
)
assert(associationSource.includes('关联生产单'))
assert(associationSource.includes('woolOrderId'))
assert(associationSource.includes('replaceWoolMachineAssociations'))
```

- [ ] **步骤 2：运行检查并确认新页面不存在**

运行：`npm run check:wool-fact-workflow`

预期：FAIL，报 `machine-associations.ts` 不存在。

- [ ] **步骤 3：实现横机生产关联工作台**

默认每台横机一行，展示设备、四状态、当前具体毛织加工单、生产单、款号、内部货号、关联人和时间。筛选支持生产单/加工单/款号关键字、设备状态和是否已关联。

右上角“关联生产单”弹窗按以下级联：

1. 先选至少含一张可维护未完成毛织加工单的生产单。
2. 只有一张加工单时自动选中；多张时强制选择具体 `woolOrderId`。
3. 展示加工单类型、齐料摘要和当前横机。
4. 多选空闲或生产中设备；维修、停用禁用显示。
5. 保存前对跨单转移列出影响，确认后调用整组保存命令。

- [ ] **步骤 4：实现加工单列表入口复用**

从加工单列表打开时直接锁定 `woolOrderId`，当前关联设备默认选中。已达到 150% 但仍有关联设备的加工单保留入口用于解除；已完成加工单不显示入口。

- [ ] **步骤 5：重写设备档案状态编辑**

设备页只允许手工选空闲、维修、停用；生产中只读派生。生产中改维修/停用时弹出影响确认，展示当前加工单、生产单、款号和关联时间；确认后调用单一原子命令。

- [ ] **步骤 6：运行治理检查并提交**

运行：

```bash
npm run check:wool-fact-workflow
npm run check:list-page-governance
```

预期：PASS，两个页面均有分页、列配置、必需列和右侧固定操作列。

```bash
git add src/pages/process-factory/wool/machine-associations.ts src/pages/process-factory/wool/machines.ts scripts/check-wool-fact-workflow.ts
git commit -m "feat: add wool machine association workbench"
```

---

### 任务 11：重写毛织 Web 仓库和固定默认库位流水

**文件：**
- 重写：`src/pages/process-factory/wool/warehouse.ts`
- 重写：`scripts/check-wool-warehouse-unified-model.ts`
- 修改：`scripts/check-wool-fact-workflow.ts`

- [ ] **步骤 1：把固定库位、领用退回和旧入口禁令写成失败检查**

```ts
const warehouseSource = readFileSync(
  new URL('../src/pages/process-factory/wool/warehouse.ts', import.meta.url),
  'utf8',
)
for (const locationId of [
  'WOOL-WP-YARN-DEFAULT',
  'WOOL-WH-CUT-DEFAULT',
  'WOOL-WH-GARMENT-DEFAULT',
]) assert(warehouseSource.includes(locationId))
for (const removedText of ['库区管理', '库位管理', '完工入仓', '损耗回收']) {
  assert(!warehouseSource.includes(removedText))
}
assert(warehouseSource.includes('纱线领用'))
assert(warehouseSource.includes('纱线退回'))
assert(warehouseSource.includes('库存调整'))
assert(warehouseSource.includes('库存转移'))
```

- [ ] **步骤 2：运行仓库检查并确认旧模型失败**

运行：`npm run check:wool-warehouse-unified-model`

预期：FAIL，旧检查或页面仍要求加工领料自动排机、完工入仓、交出确认或位置 CRUD。

- [ ] **步骤 3：实现待加工仓**

库存唯一键为“加工单 + 纱线 SKU + 批次 + `WOOL-WP-YARN-DEFAULT`”。库存列表可按加工单、生产单、纱线和批次筛选，详情保留接收明细。纱线领用只关联未完成加工单和该单技术包纱线，不能超过库存；退回必须对应原加工单和同一纱线，累计退回不能超过累计领用。两者不改变齐料和加工状态。

- [ ] **步骤 4：实现待交出仓**

库存唯一键为“加工单 + 加工后 SKU + 对象类型 + 固定默认库位”。库存、入库、出库、调整和转移分别使用标准列表组件并分页。已完成加工单剩余库存明确标记；独立调整/转移必须填写原因和操作人。核心自动入出库不显示库位选择器，转出默认库位后的库存不参与发起交出。

- [ ] **步骤 5：删除毛织位置 CRUD 和旧回收模型的所有页面引用**

页面不再读取或写入 `areas`、`locations`、`WoolWarehouseArea`、`WoolWarehouseLocation`、`WoolYarnRecoveryRecord` 和 `recordWoolYarnRecovery`。

- [ ] **步骤 6：运行检查并提交**

运行：

```bash
npm run check:wool-warehouse-unified-model
npm run check:factory-internal-warehouse-model
npm run check:process-warehouse-unification
npm run check:list-page-governance
```

预期：PASS，其他工艺仓库检查不回归。

```bash
git add src/pages/process-factory/wool/warehouse.ts scripts/check-wool-warehouse-unified-model.ts scripts/check-wool-fact-workflow.ts
git commit -m "feat: rebuild wool warehouse facts"
```

---

### 任务 12：改造 PDA 毛织执行并解除上游接单门禁

**文件：**
- 修改：`src/pages/pda-exec.ts`
- 修改：`src/pages/pda-exec-detail.ts`
- 修改：`src/pages/pda-task-receive.ts`
- 修改：`src/data/fcs/pda-cutting-execution-source.ts`
- 修改：`src/data/fcs/process-mobile-task-binding.ts`
- 修改：`src/data/fcs/mobile-execution-task-index.ts`
- 修改：`src/data/fcs/factory-mobile-todos.ts`
- 修改：`src/data/fcs/pda-task-scenario-matrix.ts`
- 修改：`scripts/check-pda-exec-task-detail.ts`
- 修改：`scripts/check-pda-task-receive-scope.ts`
- 修改：`scripts/check-wool-fact-workflow.ts`

- [ ] **步骤 1：增加 PDA 只显示事实操作的失败检查**

```ts
const pdaDetail = readFileSync(new URL('../src/pages/pda-exec-detail.ts', import.meta.url), 'utf8')
for (const action of ['确认接收', '加工填报', '发起交出', '完成加工单']) {
  assert(pdaDetail.includes(action))
}
for (const removedText of ['横机首批', '缝盘', '熨烫', '包装', '毛织菲票']) {
  assert(!pdaDetail.includes(removedText))
}
const pdaReceive = readFileSync(new URL('../src/pages/pda-task-receive.ts', import.meta.url), 'utf8')
assert(!pdaReceive.includes('acceptWoolWorkOrder'))
```

- [ ] **步骤 2：运行 PDA 检查并确认旧流程失败**

运行：

```bash
npm run check:pda-exec-task-detail
npm run check:pda-task-receive-scope
npm run check:wool-fact-workflow
```

预期：FAIL，旧 PDA 仍按接单、开工、横机里程碑和节点推进。

- [ ] **步骤 3：重写 PDA 毛织首屏与详情**

首屏只展示加工单、款式图片/颜色/尺码、可填报 SKU、缺少纱线和当前唯一主操作；完整记录放详情。四类操作调用与 Web 相同的领域命令和幂等记录号，重复点击同一记录号不得重复入库或扣库存。

- [ ] **步骤 4：解除毛织专属接单推进**

通用任务接收页可继续保存上游工厂协作结果，但毛织分支不得调用领域“接单”命令、不得改毛织状态、不得生成纱线接收。移动绑定保留具体毛织加工单 ID 和任务 ID 的来源关系。

- [ ] **步骤 5：调整移动任务投影**

状态只投影未加工/加工中/已完成；物料摘要展示多种必需纱线及缺料；操作从领域门禁产生；删除毛织菲票号、价格、差价和旧里程碑。

- [ ] **步骤 6：运行检查并提交**

运行：

```bash
npm run check:pda-exec-task-detail
npm run check:pda-task-receive-scope
npm run check:wool-fact-workflow
```

预期：PASS。

```bash
git add src/pages/pda-exec.ts src/pages/pda-exec-detail.ts src/pages/pda-task-receive.ts src/data/fcs/pda-cutting-execution-source.ts src/data/fcs/process-mobile-task-binding.ts src/data/fcs/mobile-execution-task-index.ts src/data/fcs/factory-mobile-todos.ts src/data/fcs/pda-task-scenario-matrix.ts scripts/check-pda-exec-task-detail.ts scripts/check-pda-task-receive-scope.ts scripts/check-wool-fact-workflow.ts
git commit -m "feat: align wool pda with fact workflow"
```

---

### 任务 13：改造 PDA 仓库、移动仓库概览和下游交接

**文件：**
- 修改：`src/pages/pda-warehouse.ts`
- 修改：`src/pages/pda-warehouse-wait-process.ts`
- 修改：`src/pages/pda-warehouse-wait-handover.ts`
- 修改：`src/data/fcs/factory-mobile-warehouse.ts`
- 修改：`src/data/fcs/pda-handover-events.ts`
- 修改：`scripts/check-wool-warehouse-unified-model.ts`
- 修改：`scripts/check-pda-handover-pages.ts`
- 修改：`scripts/check-pda-handover-detail-source.ts`

- [ ] **步骤 1：增加禁止旧 PDA 自动推进的失败检查**

```ts
const waitProcessSource = readFileSync(
  new URL('../src/pages/pda-warehouse-wait-process.ts', import.meta.url),
  'utf8',
)
const waitHandoverSource = readFileSync(
  new URL('../src/pages/pda-warehouse-wait-handover.ts', import.meta.url),
  'utf8',
)
assert(!waitProcessSource.includes('scheduleWoolMachines'))
assert(!waitHandoverSource.includes('finish-inbound'))
assert(!waitHandoverSource.includes('printWoolFeiTicket'))
assert(waitProcessSource.includes('纱线领用'))
assert(waitProcessSource.includes('纱线退回'))
```

- [ ] **步骤 2：运行仓库和交接检查并确认失败**

运行：

```bash
npm run check:wool-warehouse-unified-model
npm run check:pda-handover-pages
```

预期：FAIL，旧 PDA 仍含完工入仓、交出确认自动打印或旧节点推进。

- [ ] **步骤 3：改造 PDA 仓库入口**

仓库首页的毛织入口改为“纱线收货/领用/退回”和“查看待交出库存/交出记录”，不出现“给横机使用”“完工入仓”“交出确认”等节点式文案。

- [ ] **步骤 4：改造待加工仓和待交出仓动作**

待加工仓只调用接收、领用、退回和独立库存调整命令；待交出仓只展示加工填报自动入库结果、交出扣减结果和独立调整/转移，不循环调用旧加工动作，不自动打印菲票。

- [ ] **步骤 5：让移动仓库和交接读取多次事实**

`factory-mobile-warehouse.ts` 按接收明细、加工填报和交出流水汇总，不以加工单数冒充物料行数。`pda-handover-events.ts` 每条毛织交出生成独立下游待接收记录，保留加工后 SKU、对象类型、颜色、尺码、部位、结构化接收方和来源出库流水。

- [ ] **步骤 6：验证下游确认不反向修改来源**

专项检查确认下游可在加工单完成后确认接收；确认只写实际数量、差异、接收人和时间，来源 `handoverQty` 不变，毛织库存不恢复。

- [ ] **步骤 7：运行检查并提交**

运行：

```bash
npm run check:wool-warehouse-unified-model
npm run check:pda-handover-pages
npm run check:pda-handover-detail-source
npm run check:factory-internal-warehouse-model
```

预期：PASS。

```bash
git add src/pages/pda-warehouse.ts src/pages/pda-warehouse-wait-process.ts src/pages/pda-warehouse-wait-handover.ts src/data/fcs/factory-mobile-warehouse.ts src/data/fcs/pda-handover-events.ts scripts/check-wool-warehouse-unified-model.ts scripts/check-pda-handover-pages.ts scripts/check-pda-handover-detail-source.ts
git commit -m "feat: align wool warehouse and handover projections"
```

---

### 任务 14：删除毛织旧页面、路由、菜单、事件、打印和价格投影

**文件：**
- 删除：`src/pages/process-factory/wool/fei-tickets.ts`
- 删除：`src/pages/process-factory/wool/statistics.ts`
- 删除：`src/pages/process-factory/wool/machine-schedule.ts`
- 修改：`src/main-handlers/fcs-handlers.ts`
- 修改：`src/router/routes-fcs.ts`
- 修改：`src/router/route-renderers-fcs.ts`
- 修改：`src/data/app-shell-config.ts`
- 修改：`src/data/fcs/fcs-route-links.ts`
- 修改：`src/pages/print/templates/label-print-template.ts`
- 修改：`scripts/check-wool-fact-workflow.ts`

- [ ] **步骤 1：增加全链路负向检查**

```ts
const scopedSources = [
  'src/data/fcs/wool-task-domain.ts',
  'src/pages/process-factory/wool/work-orders.ts',
  'src/pages/process-factory/wool/work-order-detail.ts',
  'src/pages/process-factory/wool/machines.ts',
  'src/pages/process-factory/wool/warehouse.ts',
  'src/pages/pda-exec-detail.ts',
  'src/pages/pda-warehouse-wait-process.ts',
  'src/pages/pda-warehouse-wait-handover.ts',
  'src/data/fcs/mobile-execution-task-index.ts',
].map((path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')).join('\n')

for (const removedText of [
  '横机成片',
  '缝盘',
  '毛织菲票',
  '已排产',
  'advanceWoolOrderToWarehouseInbound',
  'WoolPriceInfo',
  'recordWoolYarnRecovery',
]) assert(!scopedSources.includes(removedText))
```

另外断言路由、菜单和链接中不存在毛织菲票、统计和旧横机排产路径，存在新的横机生产关联路径。

- [ ] **步骤 2：运行检查并确认旧引用仍存在**

运行：`npm run check:wool-fact-workflow`

预期：FAIL，并列出仍存在的旧专属引用。

- [ ] **步骤 3：切换横机生产关联路由和事件**

注册 `/fcs/process-factory/wool/machine-associations`，对应新页面渲染器和事件处理；菜单名称固定为“横机生产关联”。加工单与设备页链接均指向新路径。

- [ ] **步骤 4：删除毛织菲票、毛织统计和旧排产**

删除三个页面及其路由、菜单、链接、异步渲染器、事件分发和 Mock 引用，不做旧地址重定向。

- [ ] **步骤 5：删除通用打印和移动投影中的毛织专属数据**

`label-print-template.ts` 不再读取毛织菲票记录；通用移动任务和交接不再输出毛织菲票、标准价、派工价、差价原因或结算价格。其他业务打印和价格保持不变。

- [ ] **步骤 6：用文字检索确认删除边界**

运行：

```bash
rg -n "横机成片|缝盘|毛织菲票|已排产|advanceWoolOrderToWarehouseInbound|WoolPriceInfo|recordWoolYarnRecovery" src/data/fcs/wool-task-domain.ts src/data/fcs/wool-domain src/pages/process-factory/wool src/pages/pda-exec-detail.ts src/pages/pda-warehouse-wait-process.ts src/pages/pda-warehouse-wait-handover.ts src/data/fcs/mobile-execution-task-index.ts
```

预期：无输出。随后全仓检索同样文字，人工确认剩余命中只属于非毛织模块、历史文档或正式规格，不误删全局能力。

- [ ] **步骤 7：运行检查并提交**

运行：

```bash
npm run check:wool-fact-workflow
npm run check:wool-internal-style-code
npm run check:wool-warehouse-unified-model
npm run check:process-factory-warehouse-menu-consolidation
```

预期：PASS。

```bash
git add -A src/pages/process-factory/wool src/main-handlers/fcs-handlers.ts src/router/routes-fcs.ts src/router/route-renderers-fcs.ts src/data/app-shell-config.ts src/data/fcs/fcs-route-links.ts src/pages/print/templates/label-print-template.ts scripts/check-wool-fact-workflow.ts
git commit -m "refactor: remove legacy wool nodes and pages"
```

---

### 任务 15：补齐原型治理记录和浏览器端到端验收

**文件：**
- 创建：`docs/prototype-review-records/2026-07-30-wool-management-fact-workflow.md`
- 创建：`tests/wool-management-fact-workflow.spec.ts`
- 修改：`scripts/check-wool-fact-workflow.ts`

- [ ] **步骤 1：编写浏览器验收用例**

用例固定使用稳定 `mockScenarioCode` 对应的加工单，覆盖：

```ts
import { expect, test } from '@playwright/test'

test('搜索条件联动三个 Tab，且无统计卡片', async ({ page }) => {
  await page.goto('/fcs/process-factory/wool/work-orders')
  await page.getByPlaceholder(/加工单号|任务号/).fill('WMO-CHECK')
  await expect(page.getByRole('tab', { name: /可以开工 \\d+/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /不可以开工 \\d+/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /已完成 \\d+/ })).toBeVisible()
  await expect(page.locator('[data-summary-card]')).toHaveCount(0)
})

test('接收齐一种颜色全部纱线后才允许加工填报', async ({ page }) => {
  await page.goto('/fcs/process-factory/wool/work-orders?scenario=NO_YARN_RECEIPT')
  await page.getByRole('button', { name: '确认接收' }).click()
  await page.getByRole('button', { name: '添加纱线' }).click()
  await page.getByLabel('物料 SKU').selectOption('YARN-A')
  await page.getByLabel('实收数量').fill('20')
  await page.getByRole('button', { name: '保存确认接收' }).click()
  await expect(page.getByText('缺 YARN-B')).toBeVisible()
})

test('完成加工单展示四块事实并自动解除横机', async ({ page }) => {
  await page.goto('/fcs/process-factory/wool/work-orders?scenario=READY_TO_COMPLETE')
  await page.getByRole('button', { name: '完成加工单' }).click()
  for (const title of ['确认接收情况', '加工填报情况', '发起交出情况', '待交出仓情况']) {
    await expect(page.getByText(title, { exact: true })).toBeVisible()
  }
  await page.getByRole('button', { name: '确认完成加工单' }).click()
  await expect(page.getByText('已完成')).toBeVisible()
  await expect(page.getByText('当前关联横机 0 台')).toBeVisible()
})
```

继续增加横机一单多加工单级联、维修/停用禁选、部位/整件默认库位、下游确认锁定和 PDA 单一主操作场景。

- [ ] **步骤 2：编写原型审查记录**

按 `docs/prototype-review-record-template.md` 完整记录：

- PFOS 毛织加工单列表、详情、横机生产关联、设备、仓库。
- PDA 毛织执行、待加工仓、待交出仓和下游接收。
- 角色、当前任务、上游来源、下游去向、数量、防错、异常、低分辨率和跨端一致性。
- 三个 Tab 已替代统计卡片；所有列表分页；PDA 首屏一个主动作。
- 例外为“毛织开工只判断必需纱线是否有有效确认接收，不按重量计算数量”，这是已确认业务规则，不是缺少系统计算。

- [ ] **步骤 3：启动局域网可访问开发服务**

运行：

```bash
npm run dev -- --host 0.0.0.0 --port 49480
```

预期：Vite 输出本机与 Network 地址；若 49480 被占用，选择可用端口并将 Playwright `baseURL` 与最终交付地址同步更新。

- [ ] **步骤 4：运行浏览器验收**

运行：

```bash
npm run test:wool-fact-workflow:e2e
```

预期：全部 PASS。分别将浏览器 viewport 设置为 1366×768、1280×720，并检查：

- 页面主体无横向溢出，宽表只在表格容器内滚动。
- 右侧操作列始终可见。
- 弹窗提交按钮在最低分辨率可见。
- Tab、弹窗、分页和输入不发生整页闪烁或滚动丢失。
- 交互从点击到可见结果不超过 200ms。

- [ ] **步骤 5：运行原型治理检查并提交**

运行：

```bash
npm run check:prototype-design-governance
npm run check:list-page-governance
```

预期：PASS。

```bash
git add docs/prototype-review-records/2026-07-30-wool-management-fact-workflow.md tests/wool-management-fact-workflow.spec.ts scripts/check-wool-fact-workflow.ts
git commit -m "test: add wool workflow browser acceptance"
```

---

### 任务 16：执行最终回归、CodeGraph 同步和任务收据

**文件：**
- 修改：仅限前述检查暴露出的毛织直接相关文件
- 生成：临时目录中的 `task-receipt.json`

- [ ] **步骤 1：检查工作区边界**

运行：

```bash
git status --short
git diff --check
git diff --name-only
```

预期：没有空白错误；变更只覆盖本计划文件清单和本次原型审查记录，不包含用户原有无关改动。

- [ ] **步骤 2：运行毛织和直接上下游专项检查**

```bash
npm run check:wool-fact-workflow
npm run check:wool-internal-style-code
npm run check:wool-warehouse-unified-model
npm run check:fcs-production-tech-pack-snapshot
npm run check:fcs-tech-pack-snapshot-consumption
npm run check:production-process-work-order-generation
npm run check:pda-exec-task-detail
npm run check:pda-task-receive-scope
npm run check:pda-handover-pages
npm run check:pda-handover-detail-source
npm run check:factory-internal-warehouse-model
npm run check:process-warehouse-unification
```

预期：全部退出码为 0。

- [ ] **步骤 3：运行治理和构建**

```bash
npm run check:list-page-governance
npm run check:prototype-design-governance
npm run build
```

预期：全部 PASS，Vite 构建成功。

- [ ] **步骤 4：运行浏览器终验**

```bash
npm run test:wool-fact-workflow:e2e
```

预期：全部 PASS，并保存测试输出作为最终验证证据。

- [ ] **步骤 5：同步 CodeGraph**

```bash
codegraph sync
codegraph status
```

预期：索引为最新，`Pending sync` 为 0，`worktreeMismatch` 为空。

- [ ] **步骤 6：生成机器可读任务收据**

```bash
receipt_dir="$(mktemp -d)"
npm run workflow:verify -- \
  --output "$receipt_dir/task-receipt.json" \
  --task-boundary "毛织管理事实型加工单重构：技术包、加工单、横机、仓库、PDA、交接及旧节点清理"
```

预期：收据状态为 `verified`，绑定最后一次实质改动后的 Git HEAD、工作区差异、受影响检查和 CodeGraph 状态。若收据后又发生任何实质改动，必须重新执行步骤 1 至步骤 6。

- [ ] **步骤 7：提交最终验证修正**

只有最终检查确实产生毛织范围内修正时才执行：

```bash
git add \
  src/data/fcs/wool-task-domain.ts \
  src/data/fcs/wool-domain \
  src/pages/process-factory/wool \
  src/pages/pda-exec.ts \
  src/pages/pda-exec-detail.ts \
  src/pages/pda-task-receive.ts \
  src/pages/pda-warehouse.ts \
  src/pages/pda-warehouse-wait-process.ts \
  src/pages/pda-warehouse-wait-handover.ts \
  scripts/check-wool-fact-workflow.ts \
  scripts/check-wool-internal-style-code.ts \
  scripts/check-wool-warehouse-unified-model.ts \
  tests/wool-management-fact-workflow.spec.ts \
  docs/prototype-review-records/2026-07-30-wool-management-fact-workflow.md
git commit -m "fix: close wool workflow verification gaps"
```

提交后重新执行步骤 1 至步骤 6；不得使用旧收据宣称完成。

---

## 规格覆盖自检矩阵

| 正式规格主题 | 实现任务 | 核心证据 |
|---|---:|---|
| 多次确认接收且一次可多纱线 | 1、4、5、8、12 | `WoolYarnReceiptRecord.lines`、专项检查、Web/PDA 弹窗 |
| 任一加工后 SKU 必需纱线全部接收才可填报 | 2、3、4、5 | `mappingOrigin`、`getWoolOutputReadiness` |
| 不按纱线数量换算加工件数 | 4、5 | 齐料只比较 SKU 集合；150% 独立检查 |
| 整件/部位加工后对象与计划量 | 3、7 | 成衣 SKU/毛织部位 SKU、件/片和片数乘法 |
| 三个含数量 Tab 与搜索联动，无统计卡片 | 4、8、15 | 列表查询、标准列表、Playwright |
| 三类核心操作均可多次 | 5、8、12 | 追加式事实记录和共享领域命令 |
| 150% 上限及达到上限后的 Tab 原因 | 1、4、5、8 | `Math.floor(plannedQty * 1.5)` 和阻断原因 |
| 加工填报自动入固定默认库位 | 5、11、13 | `PROCESS_REPORT` 入库流水 |
| 发起交出从固定默认库位扣减 | 5、11、13 | `HANDOVER` 出库流水 |
| 三类数量可改、差额调库存、无撤销 | 5、8、9 | `WoolQtyChangeLog` 和差额流水 |
| 下游确认后交出锁定并保留差异 | 5、13 | `WoolDownstreamReceipt` |
| 至少一次交出才显示完成 | 1、5、8、12 | 允许操作查询和完成命令 |
| 人工完成不判断数量充分性 | 5、8、9 | 四块确认快照与单一确认命令 |
| 完成自动解除横机且保留库存 | 5、6、9、11 | 原子完成命令和完成快照 |
| 横机是当前关系而非状态节点 | 6、10 | 整组保存、转移、解除和关联日志 |
| 横机仅空闲/生产中/维修/停用 | 6、10、14 | 派生生产中和负向文本检查 |
| 生产中维修/停用二次确认并解除 | 6、10、15 | 影响确认命令和浏览器验收 |
| 关联生产单后落到具体加工单 | 6、10、15 | 生产单—加工单级联和 `woolOrderId` |
| 纱线领用/退回只影响仓库 | 5、11、13 | 独立记录、默认库位流水 |
| 技术包原始关系和冻结版本 | 2、3、7 | `TECH_PACK`、来源行 ID、版本 ID |
| 通用接单/价格/里程碑不构成毛织门禁 | 7、12、14 | 新任务初始检查和移动投影 |
| PDA 与 Web 共用事实和命令 | 8、12、13 | 同一领域门面和幂等记录号 |
| 删除旧节点、菲票、统计、价格、已排产、完工入仓 | 2、7、11、12、13、14 | 文件删除、路由删除、全链路负向检查 |
| 标准列表、分页、固定操作列和局部刷新 | 8、9、10、11、15 | 列表治理、原型治理和浏览器验收 |
| 原型审查与最终收据 | 15、16 | 审查记录、构建、CodeGraph、`task-receipt.json` |

## 执行检查点

建议按以下四批执行，每批结束后审查当前差异和检查输出：

1. 任务 1—6：事实领域、技术包来源、固定库位原子命令、设备关系。
2. 任务 7—10：上游生成、加工单列表/详情、横机页面。
3. 任务 11—14：Web/PDA 仓库、PDA 执行、下游交接、旧代码删除。
4. 任务 15—16：原型审查、浏览器验收、全量回归和机器收据。

每一批都必须在上一批专项检查通过后开始；不得先删除旧页面再补事实消费者，也不得用兼容函数继续推进旧节点。
