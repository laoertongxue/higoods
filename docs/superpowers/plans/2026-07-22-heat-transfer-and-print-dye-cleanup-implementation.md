# 烫画加工单与印染链路清理实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 `superpowers-zh:subagent-driven-development`（推荐）或 `superpowers-zh:executing-plans` 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 保留现有直喷加工单并新增独立烫画加工单，使两类加工单同时支持裁片部位和成衣；补齐成衣仓至辅助工艺待交出仓再到我方后道工厂的链路；保留三种印染加工单生成路径，并彻底清除已取消的印花、染色需求单代码。

**架构：** 继续使用现有 Vanilla TypeScript 字符串模板和辅助工艺公共域。烫画以独立工艺操作、独立加工单记录、独立动态路由和菜单存在，但复用 `special-craft` 的列表、详情、PDA、仓库与交接能力；印花、染色继续使用各自领域，通过一个小型来源解析与幂等创建服务承接生产单、备货和裁片补料。标准工艺顺序在技术包确认时校验，执行是否可开工继续由物料收货和可用库存决定，不建立染色与印花加工单之间的状态锁。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、现有标准列表页组件、Node/tsx 专项检查、Playwright、CodeGraph。

**设计依据：** `docs/superpowers/specs/2026-07-22-heat-transfer-and-print-dye-cleanup-design.md`

---

## 文件结构与职责

### 新建文件

- `src/data/fcs/process-work-order-generation-service.ts`：统一解析三种来源、计算幂等键，并调用现有印花或染色加工单注册能力。
- `scripts/check-heat-transfer-and-print-dye-contract.ts`：验证烫画独立加工单、双作用对象、固定先染后印、三种印染来源和成衣仓链路。
- `tests/heat-transfer-and-print-dye-flow.spec.ts`：浏览器验证技术包、烫画加工单、补料加工单和辅助工艺仓库关键页面。
- `docs/prototype-review-records/2026-07-22-heat-transfer-and-print-dye-cleanup.md`：按项目模板记录角色、页面模式、防错、分辨率和例外自查。

### 修改文件：技术包与字典

- `src/data/fcs/process-craft-dict.ts`：直喷、烫画的支持对象统一为裁片部位和成衣；印花、染色默认产物改为加工任务。
- `src/data/fcs/special-craft-operations.ts`：让菲票、回裁床和接收方按本张加工单的作用对象决定。
- `src/data/pcs-technical-data-version-types.ts`：BOM 类型增加成衣，技术包工艺产物口径不再给印花、染色保留需求单分支。
- `src/data/pcs-technical-data-version-bootstrap.ts`：修正演示技术包和默认工艺数据。
- `src/pages/tech-pack/context.ts`：BOM 成衣表单状态、成衣作用对象展示和工艺路线数据。
- `src/pages/tech-pack/bom-domain.ts`：成衣类型表单、字段显隐、单位和默认用量。
- `src/pages/tech-pack/bom-process-linkage.ts`：BOM 印染要求直接形成加工任务定义。
- `src/pages/tech-pack/process-domain.ts`：显示成衣关联并保持路线可读。
- `src/pages/tech-pack/events.ts`：成衣 BOM 保存校验及同物料先染后印校验。

### 修改文件：烫画、直喷与仓库

- `src/data/fcs/special-craft-task-generation.ts`：按裁片或成衣生成直喷、烫画需求明细，并保留成衣 BOM 来源。
- `src/data/fcs/special-craft-task-orders.ts`：生成独立烫画加工单和直喷加工单，成衣加工单使用件数且无菲票。
- `src/data/fcs/process-warehouse-domain.ts`：不再把所有辅助工艺对象硬编码成裁片。
- `src/data/fcs/process-warehouse-linkage-service.ts`：成衣加工完成后进入辅助工艺待交出仓并交我方后道工厂。
- `src/data/fcs/factory-internal-warehouse.ts`：保存成衣仓来源、后道工厂接收和数量差异事实。
- `src/data/fcs/process-mobile-task-binding.ts`：PDA 数量单位和对象类型随加工单作用对象变化。
- `src/pages/process-factory/special-craft/task-orders.ts`：按工艺形成独立直喷、烫画加工单列表。
- `src/pages/process-factory/special-craft/work-order-detail.ts`：裁片与成衣详情分支。
- `src/pages/process-factory/special-craft/warehouse.ts`：成衣仓来源和后道工厂去向展示。
- `src/pages/pda-exec-detail.ts`、`src/pages/pda-warehouse-wait-process.ts`、`src/pages/pda-warehouse-wait-handover.ts`：成衣执行、收货和交出动作。
- `src/data/app-shell-config.ts`、`src/router/routes-fcs.ts`、`src/router/route-renderers-fcs.ts`：验证并保留动态生成的独立烫画加工单菜单与路由，不复制页面框架。

### 修改文件：印染加工单来源

- `src/data/fcs/process-work-order-domain.ts`：来源类型增加裁片补料，并保存补料、裁片单、技术包版本与 BOM 行快照。
- `src/data/fcs/production-process-work-order-service.ts`：生产单来源改为调用统一创建服务。
- `src/data/fcs/printing-task-domain.ts`、`src/data/fcs/dyeing-task-domain.ts`：接受统一来源快照，保留现有生产单与备货入口。
- `src/data/fcs/dye-work-order-online-view.ts`、`src/data/fcs/task-print-cards.ts`、`src/data/fcs/page-adapters/process-prep-pages-adapter.ts`：来源显示支持三种口径。
- `src/pages/process-factory/cutting/supplement-management.ts`：确认补料时生成真实加工单，列表和详情只展示加工单。
- `src/pages/process-factory/printing/work-orders.ts`、`src/pages/process-factory/printing/work-order-detail.ts`、`src/pages/process-factory/printing/shared.ts`：三种来源筛选和追溯。
- `src/pages/process-factory/dyeing/work-orders.ts`、`src/pages/process-factory/dyeing/work-order-detail.ts`：三种来源筛选和追溯。

### 修改文件：旧链路物理清理

- `src/data/fcs/production-artifact-generation.ts`
- `src/data/fcs/production-task-generation-rules.ts`
- `src/data/fcs/production-preparation-timing.ts`
- `src/data/fcs/production-object-overview.ts`
- `src/data/fcs/production-tech-pack-change-domain.ts`
- `src/data/fcs/dispatch-acceptance-sla.ts`
- `scripts/check-printing-workflow.ts`
- `scripts/check-dyeing-workflow.ts`
- `scripts/check-process-work-order-unification.ts`
- `scripts/check-production-object-overview.ts`
- `scripts/check-production-preparation-timing.ts`
- `scripts/check-special-craft-task-generation.ts`
- `package.json`

这些文件只删除印花、染色需求单类型、编号、生成、展示、转换和检查，不删除生产需求单、水溶加工单、印花加工单或染色加工单。

---

### 任务 1：建立最终清理基线并删除旧需求产物

**文件：**
- 修改：`src/data/fcs/production-artifact-generation.ts`
- 修改：`src/data/fcs/production-task-generation-rules.ts`
- 修改：`src/data/fcs/production-preparation-timing.ts`
- 修改：`src/data/fcs/production-object-overview.ts`
- 修改：`src/data/fcs/production-tech-pack-change-domain.ts`
- 修改：`src/data/fcs/dispatch-acceptance-sla.ts`
- 修改：`scripts/check-production-object-overview.ts`
- 修改：`scripts/check-production-preparation-timing.ts`
- 修改：`scripts/check-special-craft-task-generation.ts`

- [ ] **步骤 1：记录旧对象的精确残留清单**

运行：

```bash
rg -n "印花需求单|染色需求单|PRINT_DEMAND|DYE_DEMAND|printDemandNos|dyeDemandNos" src scripts package.json
```

预期：命中当前已知的产物生成、准备时效、生产对象概览、补料页面和检查脚本；保存命中结果用于本任务末尾对照，不修改两个未跟踪的产品设计文档。

- [ ] **步骤 2：先把产物检查改成只接受加工单**

在 `scripts/check-production-preparation-timing.ts` 中将准备项产物断言收口为：

```typescript
for (const outputType of ['印花加工单', '染色加工单', '辅料采购单'] as const) {
  assert.ok(outputTypesWithAllItems.has(outputType), `runtime 准备项产出缺少「${outputType}」`)
}
```

在 `scripts/check-production-object-overview.ts` 中只检查实际执行单据：

```typescript
for (const docType of ['技术包版本', '中转袋', '印花工单', '印花回货批次', '染色工单', '染色回货批次']) {
  assert.ok(overview.relatedDocuments.some((doc) => doc.docType === docType), `P1 关联单据缺少 ${docType}`)
}
```

- [ ] **步骤 3：运行检查并确认旧实现失败**

运行：

```bash
npm run check:production-object-overview
npm run check:production-preparation-timing
```

预期：至少一项因仍生成旧需求产物或数量不一致而失败；失败位置应指向旧产物数组或旧关联单据。

- [ ] **步骤 4：删除旧产物生成和投影**

在 `src/data/fcs/production-preparation-timing.ts` 中，印花和染色准备项分别只推入加工单：

```typescript
if (selectedItems.some((item) => item.itemType === '数码印/DTF/DTG花型')) {
  outputs.push({
    outputType: '印花加工单',
    outputNo: `PRO-${input.recordNo.slice(-3)}`,
    outputHref: '/fcs/process/print-orders',
    outputStatus: status,
    outputGeneratedAt: input.outputPublishedAt,
  })
}
if (selectedItems.some((item) => item.itemType === '染色调色（纱线）' || item.itemType === '染色调色（面料）')) {
  outputs.push({
    outputType: '染色加工单',
    outputNo: `DYO-${input.recordNo.slice(-3)}`,
    outputHref: '/fcs/process/dye-orders',
    outputStatus: status,
    outputGeneratedAt: input.outputPublishedAt,
  })
}
```

同时：

- 从 `PreparationOutputType` 删除两类旧值。
- 从 `production-object-overview.ts` 删除两组旧 Mock 单据和关键词。
- 从 `production-artifact-generation.ts` 删除 PRINT、DYE 的需求产物标签、生成分支和导出类型；保留特殊工艺任务和真实加工单入口。
- 从 `production-task-generation-rules.ts` 删除 `PRINT_REQUIREMENT`、`DYE_REQUIREMENT` 对象映射，改为读取 `ProcessWorkOrder`。
- 将技术包变更文案改为“印花加工单同步更新”。
- 将派单 SLA 文案改为“印花加工单派出后”。

- [ ] **步骤 5：清理专项检查中的旧正向与负向词条**

删除 `scripts/check-printing-workflow.ts`、`scripts/check-dyeing-workflow.ts`、`scripts/check-process-work-order-unification.ts` 中仅用于搜索旧页面文案、旧路由和旧单号的数组；保留对印花、染色加工单页面、路由和唯一加工单号的断言。

- [ ] **步骤 6：验证产物检查恢复通过**

运行：

```bash
npm run check:production-object-overview
npm run check:production-preparation-timing
npm run check:printing-workflow
npm run check:dyeing-workflow
```

预期：全部 PASS，输出对象只剩真实加工单。

- [ ] **步骤 7：提交旧链路清理**

```bash
git add src/data/fcs/production-artifact-generation.ts src/data/fcs/production-task-generation-rules.ts src/data/fcs/production-preparation-timing.ts src/data/fcs/production-object-overview.ts src/data/fcs/production-tech-pack-change-domain.ts src/data/fcs/dispatch-acceptance-sla.ts scripts/check-production-object-overview.ts scripts/check-production-preparation-timing.ts scripts/check-special-craft-task-generation.ts scripts/check-printing-workflow.ts scripts/check-dyeing-workflow.ts scripts/check-process-work-order-unification.ts
git commit -m "refactor(印染): 删除已取消的需求产物链路"
```

---

### 任务 2：收口工艺字典与固定先染后印规则

**文件：**
- 修改：`src/data/fcs/process-craft-dict.ts`
- 修改：`src/data/pcs-technical-data-version-types.ts`
- 修改：`src/data/pcs-technical-data-version-bootstrap.ts`
- 修改：`src/pages/tech-pack/bom-process-linkage.ts`
- 修改：`src/pages/tech-pack/context.ts`
- 修改：`src/pages/tech-pack/events.ts`
- 修改：`scripts/check-tech-pack-process-route.ts`
- 修改：`scripts/check-tech-pack-special-craft-target-object-and-versioning.ts`

- [ ] **步骤 1：添加先染后印失败用例**

在 `scripts/check-tech-pack-process-route.ts` 构造同一 BOM 行的反向路线：

```typescript
const reversedDyePrint = applyProcessRouteDraftAction(
  dyePrintDraft,
  { type: 'move-up', techniqueId: 'process-print' },
  '测试人员',
  '2026-07-22 10:00:00',
)
assert.deepEqual(
  reversedDyePrint.techniques.map((item) => item.id),
  dyePrintDraft.techniques.map((item) => item.id),
  '同一 BOM 物料不能保存先印花后染色的路线',
)
```

在 `scripts/check-tech-pack-special-craft-target-object-and-versioning.ts` 将直喷和烫画的期望对象设置为：

```typescript
const expectedTargets = ['已裁部位', '成衣']
assert.deepEqual(heatTransfer.supportedTargetObjectLabels, expectedTargets)
assert.deepEqual(directPrint.supportedTargetObjectLabels, expectedTargets)
```

- [ ] **步骤 2：运行用例确认失败**

运行：

```bash
npm run check:tech-pack-process-route
npm run check:tech-pack-special-craft-target-object-and-versioning
```

预期：路线校验尚未覆盖染色与印花，作用对象仍含旧口径，因此失败。

- [ ] **步骤 3：修改工艺字典目标对象与默认产物**

在 `src/data/fcs/process-craft-dict.ts` 保留内部稳定枚举，但把用户标签统一为：

```typescript
export const SPECIAL_CRAFT_TARGET_OBJECT_LABEL = {
  CUT_PIECE: '已裁部位',
  FULL_FABRIC: '完整面料',
  SEMI_FINISHED_GARMENT: '成衣',
} as const

const SPECIAL_CRAFT_SUPPORTED_TARGET_OBJECTS_BY_LEGACY_VALUE = {
  8192: ['CUT_PIECE', 'SEMI_FINISHED_GARMENT'],
  16384: ['CUT_PIECE', 'SEMI_FINISHED_GARMENT'],
} as const
```

同步把 `SpecialCraftTargetObjectLabel`、`ProcessTargetObjectName`、`SpecialCraftTargetObject`、`getDefaultSpecialCraftTargetObject()`、`isSpecialCraftTargetObjectSupported()` 和旧值规范化函数的用户口径从“成衣半成品”改为“成衣”；内部稳定值 `SEMI_FINISHED_GARMENT`、`GARMENT_SEMI` 保持不变。旧快照中的“成衣半成品”只在读取时迁移为“成衣”，保存时不得继续写回旧标签。

印花、染色的 `defaultDocument` 改为“任务单”，`defaultDocType` 改为 `TASK`；技术包 bootstrap 和 BOM 自动联动同步改为 `TASK`，不再为 PRINT、DYE 生成需求单语义。

- [ ] **步骤 4：增加共享 BOM 的顺序守卫**

在 `src/pages/tech-pack/events.ts` 增加并复用：

```typescript
function hasInvalidDyePrintOrder(techniques: TechniqueItem[]): boolean {
  const dyeEntries = techniques.filter((item) => item.processCode === 'DYE')
  const printEntries = techniques.filter((item) => item.processCode === 'PRINT')
  return dyeEntries.some((dye) => {
    const dyeBomIds = new Set(dye.linkedBomItemIds ?? [])
    return printEntries.some((print) =>
      (print.linkedBomItemIds ?? []).some((id) => dyeBomIds.has(id))
      && print.routeStepNo <= dye.routeStepNo,
    )
  })
}
```

拖动、保存和确认路线时发现该结果即保持原草稿并显示：`同一物料必须先染色、后印花，请调整工艺顺序`。不要创建前置加工单 ID、锁定字段或自动解锁逻辑。

- [ ] **步骤 5：运行技术包专项检查**

运行：

```bash
npm run check:tech-pack-process-route
npm run check:tech-pack-special-craft-target-object-and-versioning
npm run check:fcs-tech-pack-special-craft-source-and-dialog-stability
```

预期：全部 PASS；直喷、烫画只展示“已裁部位、成衣”，同物料反向路线无法落盘。

- [ ] **步骤 6：提交字典与路线规则**

```bash
git add src/data/fcs/process-craft-dict.ts src/data/pcs-technical-data-version-types.ts src/data/pcs-technical-data-version-bootstrap.ts src/pages/tech-pack/bom-process-linkage.ts src/pages/tech-pack/context.ts src/pages/tech-pack/events.ts scripts/check-tech-pack-process-route.ts scripts/check-tech-pack-special-craft-target-object-and-versioning.ts
git commit -m "feat(技术包): 统一烫画直喷对象并固定先染后印"
```

---

### 任务 3：BOM 新增成衣类型并隔离面料字段

**文件：**
- 修改：`src/data/pcs-technical-data-version-types.ts`
- 修改：`src/pages/tech-pack/context.ts`
- 修改：`src/pages/tech-pack/bom-domain.ts`
- 修改：`src/pages/tech-pack/events.ts`
- 修改：`src/pages/tech-pack/process-domain.ts`
- 新建：`scripts/check-tech-pack-garment-bom.ts`
- 修改：`package.json`

- [ ] **步骤 1：编写成衣 BOM 失败检查**

创建 `scripts/check-tech-pack-garment-bom.ts`，核心断言为：

```typescript
import assert from 'node:assert/strict'
import {
  normalizeGarmentBomItem,
  validateGarmentBomItem,
  type BomItemRow,
} from '../src/pages/tech-pack/context.ts'

const normalized = normalizeGarmentBomItem({
  id: 'bom-garment-1',
  type: '成衣',
  colorLabel: '黑色',
  materialCode: 'GARMENT-001',
  materialName: '成衣',
  spec: 'M',
  unit: '米',
  patternPieces: ['前片'],
  linkedPatternIds: ['pattern-1'],
  usage: 3,
  lossRate: 0.1,
  applicableSkuCodes: ['SKU-BLACK-M'],
  usageProcessCodes: ['AUX_HEAT_TRANSFER'],
  printRequirement: '有',
  waterSolubleRequirement: '是',
  dyeRequirement: '有',
  shrinkRequirement: '是',
  washRequirement: '是',
  printSideMode: 'SINGLE',
  frontPatternDesignId: 'design-1',
  frontPatternDesignIds: ['design-1'],
  insidePatternDesignId: '',
  insidePatternDesignIds: [],
} satisfies BomItemRow)
assert.equal(normalized.unit, '件')
assert.equal(normalized.usage, 1)
assert.equal(normalized.lossRate, 0)
assert.equal(normalized.printRequirement, '无')
assert.equal(normalized.dyeRequirement, '无')
assert.equal(validateGarmentBomItem(normalized), '')
assert.match(validateGarmentBomItem({ ...normalized, applicableSkuCodes: [] }), /SKU/)
```

- [ ] **步骤 2：运行检查确认导出不存在**

运行：

```bash
npx tsx scripts/check-tech-pack-garment-bom.ts
```

预期：FAIL，提示 `normalizeGarmentBomItem` 或 `validateGarmentBomItem` 尚未导出。

- [ ] **步骤 3：实现成衣 BOM 规范化**

在 `src/data/pcs-technical-data-version-types.ts` 为 BOM 类型增加“成衣”；在 `src/pages/tech-pack/context.ts` 实现：

```typescript
export function normalizeGarmentBomItem(item: BomItemRow): BomItemRow {
  if (item.type !== '成衣') return item
  return {
    ...item,
    materialName: '成衣',
    materialCode: '',
    spec: '',
    unit: '件',
    usage: 1,
    lossRate: 0,
    printRequirement: '无',
    dyeRequirement: '无',
    waterSolubleRequirement: '否',
    shrinkRequirement: '否',
    washRequirement: '否',
    linkedPatternIds: [],
  }
}

export function validateGarmentBomItem(item: BomItemRow): string {
  if (item.type !== '成衣') return ''
  return item.applicableSkuCodes.length > 0 ? '' : '成衣 BOM 必须选择至少一个适用 SKU'
}
```

- [ ] **步骤 4：调整 BOM 表单**

`src/pages/tech-pack/bom-domain.ts` 的物料类型选项增加“成衣”。选择成衣时：

- 显示适用 SKU、备注、固定单位“件”和单件用量 1。
- 隐藏物料编码、规格、损耗率、印花、染色、水溶、缩水、洗水和纸样关联字段。
- 保存按钮只在存在适用 SKU 时可用。

`src/pages/tech-pack/events.ts` 的 `new-bom-type` 事件在切换到成衣时立即局部更新表单状态，不整页重绘；保存时再次调用 `validateGarmentBomItem`。

- [ ] **步骤 5：隔离下游面料计算**

所有采购、纸样映射、裁片齐套和印染数量计算入口统一先过滤：

```typescript
const materialBomItems = bomItems.filter((item) => item.type !== '成衣')
const garmentBomItems = bomItems.filter((item) => item.type === '成衣')
```

`process-domain.ts` 的成衣辅助工艺关联只读取 `garmentBomItems`，不允许把成衣 BOM 作为裁片纸样物料。

- [ ] **步骤 6：注册并运行成衣 BOM 检查**

在 `package.json` 增加：

```json
"check:tech-pack-garment-bom": "tsx scripts/check-tech-pack-garment-bom.ts"
```

运行：

```bash
npm run check:tech-pack-garment-bom
npm run check:tech-pack-bom-unit-guard
npm run check:fcs-tech-pack-pattern-piece-detail
```

预期：全部 PASS，既有面料与纸样行为不回归。

- [ ] **步骤 7：提交成衣 BOM**

```bash
git add src/data/pcs-technical-data-version-types.ts src/pages/tech-pack/context.ts src/pages/tech-pack/bom-domain.ts src/pages/tech-pack/events.ts src/pages/tech-pack/process-domain.ts scripts/check-tech-pack-garment-bom.ts package.json
git commit -m "feat(BOM): 新增成衣类型并隔离面料链路"
```

---

### 任务 4：按作用对象生成裁片或成衣的辅助工艺明细

**文件：**
- 修改：`src/data/fcs/special-craft-operations.ts`
- 修改：`src/data/fcs/special-craft-task-generation.ts`
- 修改：`src/data/fcs/special-craft-task-orders.ts`
- 修改：`scripts/check-special-craft-task-generation.ts`

- [ ] **步骤 1：增加双对象生成用例**

在 `scripts/check-special-craft-task-generation.ts` 对直喷和烫画分别断言：

```typescript
for (const craftName of ['直喷', '烫画'] as const) {
  const orders = allStoreTasks.filter((order) => order.craftName === craftName)
  const cutPiece = orders.find((order) => order.targetObject === '已裁部位')
  const garment = orders.find((order) => order.targetObject === '成衣')
  assert(cutPiece, `${craftName} 必须生成裁片部位加工单`)
  assert(garment, `${craftName} 必须生成成衣加工单`)
  assert.equal(cutPiece.unit, '片')
  assert(cutPiece.feiTicketNos.length > 0)
  assert.equal(garment.unit, '件')
  assert.deepEqual(garment.feiTicketNos, [])
}
```

- [ ] **步骤 2：运行生成检查确认失败**

运行：

```bash
npm run check:special-craft-task-generation
```

预期：FAIL，直喷没有成衣任务或烫画没有裁片任务。

- [ ] **步骤 3：把菲票和回裁床规则改为对象规则**

在 `src/data/fcs/special-craft-operations.ts` 增加：

```typescript
export function getSpecialCraftFlowRule(targetObject: SpecialCraftTargetObjectLabel) {
  if (targetObject === '成衣') {
    return { unit: '件', requiresFeiTicketScan: false, mustReturnToCuttingFactory: false }
  }
  return { unit: '片', requiresFeiTicketScan: true, mustReturnToCuttingFactory: true }
}
```

生成、列表、仓库和详情不得再直接使用烫画或直喷 seed 上的固定 `requiresFeiTicketScan`、`mustReturnToCuttingFactory` 判断。

- [ ] **步骤 4：成衣明细绑定成衣 BOM**

`special-craft-task-generation.ts` 的成衣分支必须：

```typescript
const garmentBom = snapshot.bomItems.find((item) =>
  item.type === '成衣'
  && (entry.linkedBomItemIds ?? []).includes(item.id),
)
if (!garmentBom) {
  errors.push(buildBlockingError({
    productionOrderId: productionOrder.productionOrderId,
    productionOrderNo,
    patternFileId: '',
    pieceRowId: '',
    partName: '成衣',
    operationName: operation.operationName,
    errorType: '成衣BOM缺失',
    errorMessage: `${operation.operationName}成衣加工缺少成衣 BOM`,
    blocking: true,
  }))
  return
}
```

同时在 `SpecialCraftTaskGenerationError['errorType']` 增加中文值 `成衣BOM缺失`，继续沿用 `errorMessage` 与 `blocking` 字段，不另建第二套错误模型。

只遍历 `garmentBom.applicableSkuCodes` 对应生产数量，保存 `sourceBomItemId`，单位固定为件，不构造纸样或菲票占位值。

- [ ] **步骤 5：裁片分支保持真实裁片口径**

裁片明细继续按：

```typescript
const planPieceQty = orderQty * pieceCountPerGarment
```

并要求真实 `patternFileId`、`pieceRowId`、部位、颜色、尺码和菲票关联；不能从成衣 BOM 补虚拟裁片信息。

- [ ] **步骤 6：运行生成和菲票回归检查**

运行：

```bash
npm run check:special-craft-task-generation
npm run check:special-craft-task-and-fei-flow-deepening
npm run check:cutting-special-craft-dispatch-return
```

预期：全部 PASS；成衣无菲票，裁片菲票链路保持可用。

- [ ] **步骤 7：提交双对象生成**

```bash
git add src/data/fcs/special-craft-operations.ts src/data/fcs/special-craft-task-generation.ts src/data/fcs/special-craft-task-orders.ts scripts/check-special-craft-task-generation.ts
git commit -m "feat(辅助工艺): 按裁片和成衣生成加工明细"
```

---

### 任务 5：固化独立烫画加工单并保留直喷加工单

**文件：**
- 修改：`src/data/fcs/special-craft-task-orders.ts`
- 修改：`src/data/app-shell-config.ts`
- 修改：`src/router/routes-fcs.ts`
- 修改：`src/router/route-renderers-fcs.ts`
- 修改：`src/pages/process-factory/special-craft/task-orders.ts`
- 修改：`src/pages/process-factory/special-craft/work-order-detail.ts`
- 修改：`scripts/check-special-craft-operation-menus.ts`
- 修改：`scripts/check-process-factory-special-craft-split.ts`
- 新建：`scripts/check-heat-transfer-and-print-dye-contract.ts`
- 修改：`package.json`

- [ ] **步骤 1：先写独立加工单契约**

`scripts/check-heat-transfer-and-print-dye-contract.ts` 首段：

```typescript
import assert from 'node:assert/strict'
import { buildSpecialCraftMenuGroups } from '../src/data/app-shell-config.ts'
import {
  listSpecialCraftTaskWorkOrders,
  getEnabledSpecialCraftOperations,
} from '../src/data/fcs/special-craft-task-orders.ts'

const operations = getEnabledSpecialCraftOperations()
const heat = operations.find((item) => item.operationId === 'AUX-OP-HEAT-TRANSFER')
const direct = operations.find((item) => item.operationId === 'AUX-OP-DIRECT-PRINT')
assert(heat, '缺少烫画工艺操作')
assert(direct, '缺少直喷工艺操作')

const workOrders = listSpecialCraftTaskWorkOrders()
const heatOrders = workOrders.filter((item) => item.operationId === heat.operationId)
const directOrders = workOrders.filter((item) => item.operationId === direct.operationId)
assert(heatOrders.length > 0, '必须存在独立烫画加工单')
assert(directOrders.length > 0, '必须保留直喷加工单')
assert(heatOrders.every((item) => item.craftName === '烫画'))
assert(directOrders.every((item) => item.craftName === '直喷'))
assert.equal(new Set([...heatOrders, ...directOrders].map((item) => item.workOrderNo)).size, heatOrders.length + directOrders.length)
const menuTitles = buildSpecialCraftMenuGroups().flatMap((group) => group.items.map((item) => item.title))
assert(menuTitles.includes('烫画加工单'))
assert(menuTitles.includes('直喷加工单'))
```

- [ ] **步骤 2：运行契约确认当前数据不足**

运行：

```bash
npx tsx scripts/check-heat-transfer-and-print-dye-contract.ts
```

预期：因烫画没有完整双对象加工单或独立字段而失败。

- [ ] **步骤 3：给加工单增加稳定业务类型**

在 `SpecialCraftTaskWorkOrder` 增加：

```typescript
businessType: 'HEAT_TRANSFER' | 'DIRECT_PRINT' | 'OTHER_SPECIAL_CRAFT'
```

映射函数：

```typescript
function getSpecialCraftWorkOrderBusinessType(craftName: string): SpecialCraftTaskWorkOrder['businessType'] {
  if (craftName === '烫画') return 'HEAT_TRANSFER'
  if (craftName === '直喷') return 'DIRECT_PRINT'
  return 'OTHER_SPECIAL_CRAFT'
}
```

加工单号继续基于各自 `taskOrderNo` 生成，且任务号内包含不同 `craftCode`，因此直喷旧编号身份不变，烫画获得独立且不重复的加工单号。禁止把烫画保存为直喷的字段变体。

- [ ] **步骤 4：校验动态独立入口**

保留现有公共页面函数，但确保菜单和路由分别生成：

```typescript
buildSpecialCraftTaskOrdersPath('AUX-OP-HEAT-TRANSFER')
buildSpecialCraftTaskOrdersPath('AUX-OP-DIRECT-PRINT')
```

列表 H1、面包屑、筛选持久化键和详情返回地址都必须包含当前 operation slug；烫画页面标题为“烫画加工单”，直喷页面标题仍为“直喷加工单”。

- [ ] **步骤 5：注册并运行专项检查**

在 `package.json` 增加：

```json
"check:heat-transfer-and-print-dye-contract": "tsx scripts/check-heat-transfer-and-print-dye-contract.ts"
```

运行：

```bash
npm run check:heat-transfer-and-print-dye-contract
npm run check:special-craft-operation-menus
npm run check:process-factory-special-craft-split
```

预期：全部 PASS；两个菜单、两个列表语义、两类加工单记录和两类加工单号同时存在。

- [ ] **步骤 6：提交独立烫画加工单**

```bash
git add src/data/fcs/special-craft-task-orders.ts src/data/app-shell-config.ts src/router/routes-fcs.ts src/router/route-renderers-fcs.ts src/pages/process-factory/special-craft/task-orders.ts src/pages/process-factory/special-craft/work-order-detail.ts scripts/check-special-craft-operation-menus.ts scripts/check-process-factory-special-craft-split.ts scripts/check-heat-transfer-and-print-dye-contract.ts package.json
git commit -m "feat(辅助工艺): 新增独立烫画加工单"
```

---

### 任务 6：打通成衣仓到辅助工艺再到后道工厂

**文件：**
- 修改：`src/data/fcs/special-craft-task-orders.ts`
- 修改：`src/data/fcs/process-warehouse-domain.ts`
- 修改：`src/data/fcs/process-warehouse-linkage-service.ts`
- 修改：`src/data/fcs/factory-internal-warehouse.ts`
- 修改：`src/data/fcs/process-mobile-task-binding.ts`
- 修改：`src/pages/process-factory/special-craft/warehouse.ts`
- 修改：`src/pages/process-factory/special-craft/work-order-detail.ts`
- 修改：`src/pages/pda-exec-detail.ts`
- 修改：`src/pages/pda-warehouse-wait-process.ts`
- 修改：`src/pages/pda-warehouse-wait-handover.ts`
- 修改：`scripts/check-heat-transfer-and-print-dye-contract.ts`

- [ ] **步骤 1：增加成衣仓链路失败断言**

在专项检查中加入：

```typescript
const garmentHeat = heatOrders.find((item) => item.targetObject === '成衣')
assert(garmentHeat, '缺少成衣烫画加工单')
assert.equal(garmentHeat.planQty > 0, true)
assert.deepEqual(garmentHeat.feiTicketNos, [])

const garmentWarehouse = getWarehouseRecordsByWorkOrderId(garmentHeat.workOrderId)
assert(garmentWarehouse.some((item) => item.recordType === 'WAIT_PROCESS' && item.objectType === '成衣'))
assert(garmentWarehouse.some((item) => item.recordType === 'WAIT_HANDOVER' && item.targetFactoryName === '我方后道工厂'))
```

- [ ] **步骤 2：运行检查确认对象仍被写成裁片或中转仓**

运行：

```bash
npm run check:heat-transfer-and-print-dye-contract
```

预期：FAIL，当前 `process-warehouse-domain.ts` 仍硬编码 `objectType: '裁片'`，或接收方仍为中转仓。

- [ ] **步骤 3：建立对象驱动的仓库上下文**

统一使用：

```typescript
function resolveAuxiliaryWarehouseFlow(targetObject: string) {
  if (targetObject === '成衣') {
    return {
      objectType: '成衣',
      itemKind: '成衣半成品',
      qtyUnit: '件',
      sourceObjectName: '成衣仓',
      receiverKind: '后道工厂' as const,
      receiverName: '我方后道工厂',
    }
  }
  return {
    objectType: '裁片',
    itemKind: '裁片',
    qtyUnit: '片',
    sourceObjectName: '裁床待交出仓',
    receiverKind: '裁床厂' as const,
    receiverName: '裁床待交出仓',
  }
}
```

`process-warehouse-domain.ts`、`special-craft-task-orders.ts` 和 linkage service 共用同一判断，避免三个文件各写一套分支。

- [ ] **步骤 4：形成两个明确仓库节点**

成衣加工单：

1. 成衣仓出库形成辅助工艺收货记录。
2. 确认收货后进入辅助工艺待加工仓。
3. 加工完成的合格件进入辅助工艺待交出仓。
4. 待交出仓发起交出，接收方为我方后道工厂。
5. 后道收货保存实收、差异、收货人和时间，并接入现有后道状态。

任何一步不得创建裁片部位、菲票或“回裁床”动作。

- [ ] **步骤 5：修正 PDA 数量单位和动作**

`process-mobile-task-binding.ts` 对计数类任务继续使用内部 `PIECE`，但显示单位读取加工单事实：

```typescript
qtyUnit: 'PIECE',
qtyDisplayUnit: taskOrder.unit,
```

PDA 首屏成衣任务只显示生产单、SKU、应收/实收件数、当前仓和下一动作；裁片任务继续显示部位和菲票。

- [ ] **步骤 6：运行仓库与 PDA 检查**

运行：

```bash
npm run check:heat-transfer-and-print-dye-contract
npm run check:process-factory-special-craft-split
npm run check:special-craft-task-and-fei-flow-deepening
```

预期：全部 PASS；成衣从成衣仓进入，经过待交出仓后交我方后道工厂。

- [ ] **步骤 7：提交成衣仓链路**

```bash
git add src/data/fcs/special-craft-task-orders.ts src/data/fcs/process-warehouse-domain.ts src/data/fcs/process-warehouse-linkage-service.ts src/data/fcs/factory-internal-warehouse.ts src/data/fcs/process-mobile-task-binding.ts src/pages/process-factory/special-craft/warehouse.ts src/pages/process-factory/special-craft/work-order-detail.ts src/pages/pda-exec-detail.ts src/pages/pda-warehouse-wait-process.ts src/pages/pda-warehouse-wait-handover.ts scripts/check-heat-transfer-and-print-dye-contract.ts
git commit -m "feat(辅助工艺): 接通成衣仓至后道工厂链路"
```

---

### 任务 7：建立三种印染加工单来源模型

**文件：**
- 新建：`src/data/fcs/process-work-order-generation-service.ts`
- 修改：`src/data/fcs/process-work-order-domain.ts`
- 修改：`src/data/fcs/production-process-work-order-service.ts`
- 修改：`src/data/fcs/printing-task-domain.ts`
- 修改：`src/data/fcs/dyeing-task-domain.ts`
- 修改：`scripts/check-production-process-work-order-generation.ts`
- 修改：`scripts/check-stock-process-work-order-creation.ts`
- 修改：`scripts/check-heat-transfer-and-print-dye-contract.ts`

- [ ] **步骤 1：增加三来源与幂等失败用例**

在 `scripts/check-production-process-work-order-generation.ts` 增加：

```typescript
const supplementSource: ProcessWorkOrderGenerationInput = {
  source: {
    sourceType: 'CUT_PIECE_SUPPLEMENT',
    productionOrderId: 'PO-SUP-001',
    productionOrderNo: 'PO-SUP-001',
    techPackVersionId: 'TPV-SUP-001',
    techPackVersionLabel: '正式版 V1',
    bomItemId: 'BOM-SUP-001',
    supplementRecordId: 'SUP-RECORD-001',
    supplementRecordNo: 'BL-20260722-001',
    originalCutOrderId: 'CUT-ORDER-001',
    originalCutOrderNo: 'CP-20260722-001',
  },
  processCodes: ['DYE', 'PRINT'],
  orderedAt: '2026-07-22 10:00:00',
  materialId: 'MAT-SUP-001',
  materialName: '补料针织布',
  materialItems: [{
    sourceBomItemId: 'BOM-SUP-001',
    materialId: 'MAT-SUP-001',
    materialName: '补料针织布',
  }],
  targetColor: '黑色',
  plannedQty: 12,
  qtyUnit: '米',
  dyeProcessName: '匹染',
  printProcessName: '数码印花',
  spuCode: 'SPU-SUP-001',
  spuName: '补料测试款',
  requiredDeliveryDate: '2026-07-30',
}
const firstSupplementResult = ensureProcessWorkOrders(supplementSource)
const secondSupplementResult = ensureProcessWorkOrders(supplementSource)
assert(firstSupplementResult.dyeWorkOrderId)
assert(firstSupplementResult.printWorkOrderId)
assert.equal(secondSupplementResult.dyeWorkOrderId, firstSupplementResult.dyeWorkOrderId)
assert.equal(secondSupplementResult.printWorkOrderId, firstSupplementResult.printWorkOrderId)
assert.equal(getProcessWorkOrderById(firstSupplementResult.dyeWorkOrderId)?.sourceType, 'CUT_PIECE_SUPPLEMENT')
assert.equal(getProcessWorkOrderById(firstSupplementResult.printWorkOrderId)?.sourceType, 'CUT_PIECE_SUPPLEMENT')
```

并断言同一物料同时需要两种工艺时，一次调用同时返回 `dyeWorkOrderId` 与 `printWorkOrderId`，两张加工单都不包含前置单或锁定字段。

- [ ] **步骤 2：运行生成检查确认来源类型不支持补料**

运行：

```bash
npm run check:production-process-work-order-generation
npm run check:stock-process-work-order-creation
```

预期：FAIL，`ProcessWorkOrderSourceType` 只有生产单和备货。

- [ ] **步骤 3：增加来源快照类型**

在 `process-work-order-domain.ts` 定义：

```typescript
export type ProcessWorkOrderSourceType = 'PRODUCTION_ORDER' | 'STOCK' | 'CUT_PIECE_SUPPLEMENT'

export interface ProcessWorkOrderSourceSnapshot {
  sourceType: ProcessWorkOrderSourceType
  productionOrderId?: string
  productionOrderNo?: string
  techPackVersionId?: string
  techPackVersionLabel?: string
  bomItemId?: string
  supplementRecordId?: string
  supplementRecordNo?: string
  originalCutOrderId?: string
  originalCutOrderNo?: string
  stockMaterialId?: string
  stockMaterialName?: string
}
```

`ProcessWorkOrder` 增加必填 `sourceSnapshot`，页面不得用“不是 STOCK 就是生产单”的二分判断。`mapPrintWorkOrder`、`mapDyeWorkOrder` 和 `mapWaterSolubleWorkOrder` 均必须填充来源快照，保证统一类型映射无空值。

`PrintWorkOrder`、`DyeWorkOrder`、PDA 任务和打印卡片中的 `sourceType` 同步引用 `ProcessWorkOrderSourceType`，不得在各文件重新声明两值联合类型。

- [ ] **步骤 4：实现小型统一创建服务**

`process-work-order-generation-service.ts` 的公共入口：

```typescript
export interface ProcessWorkOrderGenerationInput {
  source: ProcessWorkOrderSourceSnapshot
  processCodes: Array<'DYE' | 'PRINT'>
  orderedAt: string
  materialId: string
  materialName: string
  materialItems: FormalProductionOrderMaterialItem[]
  targetColor: string
  plannedQty: number
  qtyUnit: string
  dyeProcessName?: string
  printProcessName?: string
  requiresWaterSoluble?: boolean
  factoryId?: string
  factoryName?: string
  spuCode: string
  spuName: string
  requiredDeliveryDate: string
}

export interface EnsuredProcessWorkOrders {
  dyeWorkOrderId?: string
  printWorkOrderId?: string
}

export function ensureProcessWorkOrders(input: ProcessWorkOrderGenerationInput): EnsuredProcessWorkOrders
```

幂等键分别为：

```typescript
function buildSourceKey(input: ProcessWorkOrderGenerationInput, processCode: 'DYE' | 'PRINT'): string {
  if (input.source.sourceType === 'CUT_PIECE_SUPPLEMENT') {
    return [input.source.supplementRecordId, input.source.originalCutOrderId, input.source.techPackVersionId, input.source.bomItemId, processCode].join('|')
  }
  if (input.source.sourceType === 'STOCK') {
    return [input.source.stockMaterialId, input.orderedAt, processCode].join('|')
  }
  return [input.source.productionOrderId, input.source.techPackVersionId, input.source.bomItemId, processCode].join('|')
}
```

- [ ] **步骤 5：复用现有印花和染色注册能力**

统一服务分别调用 `registerFormalProductionOrderPrintWorkOrder` 和 `registerFormalProductionOrderDyeWorkOrder`，扩展其输入以接收 `sourceSnapshot` 与 `sourceKey`；备货原入口继续执行库存和工厂能力校验后调用统一服务。不要合并两套执行状态机。

- [ ] **步骤 6：验证同时生成但不互锁**

运行：

```bash
npm run check:production-process-work-order-generation
npm run check:stock-process-work-order-creation
npm run check:process-work-order-unification
```

预期：全部 PASS；生产单、备货、补料来源可区分；染色与印花同时生成且无互锁字段。

- [ ] **步骤 7：提交三来源领域模型**

```bash
git add src/data/fcs/process-work-order-generation-service.ts src/data/fcs/process-work-order-domain.ts src/data/fcs/production-process-work-order-service.ts src/data/fcs/printing-task-domain.ts src/data/fcs/dyeing-task-domain.ts scripts/check-production-process-work-order-generation.ts scripts/check-stock-process-work-order-creation.ts scripts/check-heat-transfer-and-print-dye-contract.ts
git commit -m "feat(印染): 统一三种加工单来源"
```

---

### 任务 8：裁片补料确认生成真实印染加工单

**文件：**
- 修改：`src/pages/process-factory/cutting/supplement-management.ts`
- 修改：`src/data/fcs/process-work-order-generation-service.ts`
- 新建：`scripts/check-cutting-supplement-process-work-orders.ts`
- 修改：`package.json`

- [ ] **步骤 1：编写补料追溯失败检查**

新建检查并构造：补料记录 → 原始裁片单 → 生产单 → 冻结技术包 → BOM 行。核心断言：

```typescript
const [seedRecord] = listSupplementRecords()
assert(seedRecord, '缺少补料检查数据')
const fixtureDraft = structuredClone(seedRecord.draft)
const result = confirmSupplementAndGenerateProcessWorkOrders(fixtureDraft, '测试人员')
assert.equal(result.ok, true)
if (result.ok) {
  assert.equal(result.record.processWorkOrderRefs.length, 2)
  assert.deepEqual(result.record.processWorkOrderRefs.map((item) => item.processType).sort(), ['DYE', 'PRINT'])
  assert(result.record.processWorkOrderRefs.every((item) => item.workOrderId && item.workOrderNo))
  assert(result.record.processWorkOrderRefs.every((item) => item.sourceType === 'CUT_PIECE_SUPPLEMENT'))
}
```

再加入无唯一 BOM、缺冻结技术包和重复确认三个用例。

- [ ] **步骤 2：运行检查确认确认函数尚未返回真实加工单**

运行：

```bash
npx tsx scripts/check-cutting-supplement-process-work-orders.ts
```

预期：FAIL，当前记录仍保存虚构需求号和拼接加工单号。

- [ ] **步骤 3：替换补料记录字段**

将 `SupplementRecord` 改为：

```typescript
export interface SupplementProcessWorkOrderRef {
  processType: 'PRINT' | 'DYE'
  sourceType: 'CUT_PIECE_SUPPLEMENT'
  workOrderId: string
  workOrderNo: string
  materialSku: string
  materialName: string
  plannedQty: number
  unit: string
}

export interface SupplementRecord {
  id: string
  recordNo: string
  status: '已确认'
  createdAt: string
  createdBy: string
  draft: SupplementDraft
  processWorkOrderRefs: SupplementProcessWorkOrderRef[]
}
```

删除 `printDemandNos`、`dyeDemandNos`、`demandNo`、`demandStatus` 和所有伪编号生成。

同时导出只读测试入口，返回深拷贝，避免检查脚本直接改页面状态：

```typescript
export function listSupplementRecords(): SupplementRecord[] {
  ensureMockSupplementOrders()
  return structuredClone(state.records)
}
```

- [ ] **步骤 4：确认时读取冻结技术包并真实建单**

实现并导出：

```typescript
export function confirmSupplementAndGenerateProcessWorkOrders(
  draft: SupplementDraft,
  createdBy: string,
): { ok: true; record: SupplementRecord } | { ok: false; message: string }
```

每条补料物料必须唯一匹配冻结技术包 BOM 行。计划数量使用：

```typescript
const plannedQty = Math.round(
  supplementQty * bomItem.unitConsumption * (1 + bomItem.lossRate) * 1_000_000,
) / 1_000_000
```

同一 BOM 同时需要染色和印花时，一次调用统一服务并把两张真实加工单写入 `processWorkOrderRefs`。

- [ ] **步骤 5：改造列表和详情**

- 列名从“印染需求”改为“印染加工单”。
- 详情标题改为“印花 / 染色加工单”。
- 只显示真实加工单号、工艺、工厂、来源和执行状态。
- 加工单号跳转到既有印花或染色详情。
- 无印染要求时显示“无需生成印染加工单”。

- [ ] **步骤 6：注册并运行补料检查**

`package.json` 增加：

```json
"check:cutting-supplement-process-work-orders": "tsx scripts/check-cutting-supplement-process-work-orders.ts"
```

运行：

```bash
npm run check:cutting-supplement-process-work-orders
npm run check:production-process-work-order-generation
npm run check:list-page-governance
```

预期：全部 PASS；重复确认不重复建单，页面继续满足标准列表页门禁。

- [ ] **步骤 7：提交补料真实建单**

```bash
git add src/pages/process-factory/cutting/supplement-management.ts src/data/fcs/process-work-order-generation-service.ts scripts/check-cutting-supplement-process-work-orders.ts package.json
git commit -m "feat(补料): 确认后生成真实印染加工单"
```

---

### 任务 9：印花、染色页面显示三种来源

**文件：**
- 修改：`src/data/fcs/dye-work-order-online-view.ts`
- 修改：`src/data/fcs/task-print-cards.ts`
- 修改：`src/data/fcs/page-adapters/process-prep-pages-adapter.ts`
- 修改：`src/pages/process-factory/printing/work-orders.ts`
- 修改：`src/pages/process-factory/printing/work-order-detail.ts`
- 修改：`src/pages/process-factory/printing/shared.ts`
- 修改：`src/pages/process-factory/dyeing/work-orders.ts`
- 修改：`src/pages/process-factory/dyeing/work-order-detail.ts`
- 修改：`scripts/check-printing-workflow.ts`
- 修改：`scripts/check-dyeing-workflow.ts`

- [ ] **步骤 1：扩展页面检查**

印花和染色工作流检查都应断言来源标签：

```typescript
for (const sourceLabel of ['生产单自动生成', '备货手动创建', '裁片补料生成']) {
  assertIncludes(platformOrdersHtml, sourceLabel, '加工单来源筛选')
}
```

补料来源详情必须含补料单号、原始裁片单号、生产单号和技术包版本；备货来源不得渲染空生产单。

- [ ] **步骤 2：运行页面检查确认第三来源尚未显示**

运行：

```bash
npm run check:printing-workflow
npm run check:dyeing-workflow
```

预期：FAIL，来源筛选或详情缺少裁片补料。

- [ ] **步骤 3：增加统一来源标签函数**

在 `process-work-order-domain.ts` 导出：

```typescript
export const PROCESS_WORK_ORDER_SOURCE_LABEL: Record<ProcessWorkOrderSourceType, string> = {
  PRODUCTION_ORDER: '生产单自动生成',
  STOCK: '备货手动创建',
  CUT_PIECE_SUPPLEMENT: '裁片补料生成',
}
```

所有 adapter、卡片、打印和页面均调用该映射，不自行做二分条件判断。

- [ ] **步骤 4：调整列表和详情**

标准列表页来源筛选包含三项。补料详情展示：

```typescript
const sourceRows = [
  ['来源', PROCESS_WORK_ORDER_SOURCE_LABEL[order.sourceType]],
  ['补料单', order.sourceSnapshot.supplementRecordNo],
  ['原始裁片单', order.sourceSnapshot.originalCutOrderNo],
  ['所属生产单', order.sourceSnapshot.productionOrderNo],
  ['技术包版本', order.sourceSnapshot.techPackVersionLabel],
  ['BOM 物料', `${order.materialSku} / ${order.materialName}`],
]
```

不增加加工单前置状态或染色完成锁定提示。

- [ ] **步骤 5：运行列表、工作流和统一单据检查**

运行：

```bash
npm run check:printing-workflow
npm run check:dyeing-workflow
npm run check:process-work-order-unification
npm run check:list-page-governance
```

预期：全部 PASS。

- [ ] **步骤 6：提交来源展示**

```bash
git add src/data/fcs/dye-work-order-online-view.ts src/data/fcs/task-print-cards.ts src/data/fcs/page-adapters/process-prep-pages-adapter.ts src/pages/process-factory/printing/work-orders.ts src/pages/process-factory/printing/work-order-detail.ts src/pages/process-factory/printing/shared.ts src/pages/process-factory/dyeing/work-orders.ts src/pages/process-factory/dyeing/work-order-detail.ts scripts/check-printing-workflow.ts scripts/check-dyeing-workflow.ts
git commit -m "feat(印染): 展示三种加工单来源"
```

---

### 任务 10：完成页面审查记录和浏览器验收

**文件：**
- 新建：`docs/prototype-review-records/2026-07-22-heat-transfer-and-print-dye-cleanup.md`
- 新建：`tests/heat-transfer-and-print-dye-flow.spec.ts`

- [ ] **步骤 1：按项目规范完成人工审查记录**

先完整阅读：

```text
docs/higood-indonesia-factory-product-design-guidelines.md
docs/higood-indonesia-factory-prototype-review-checklist.md
docs/prototype-review-record-template.md
```

审查记录必须覆盖：技术包维护人员、成衣仓人员、辅助工艺工厂操作员、我方后道工厂收货员；Web/PDA 页面模式；成衣与裁片防错；差异处理；1366×768 与 1280×720；列表分页和局部更新。没有例外时明确写“无例外”。

- [ ] **步骤 2：编写浏览器验收用例**

`tests/heat-transfer-and-print-dye-flow.spec.ts` 至少包含：

```typescript
test('直喷和烫画拥有独立加工单入口', async ({ page }) => {
  await page.goto('/fcs/process-factory/special-craft/aux-op-heat-transfer/tasks')
  await expect(page.getByRole('heading', { name: '烫画加工单' })).toBeVisible()
  await page.goto('/fcs/process-factory/special-craft/aux-op-direct-print/tasks')
  await expect(page.getByRole('heading', { name: '直喷加工单' })).toBeVisible()
})

test('成衣烫画无菲票并交往后道工厂', async ({ page }) => {
  await page.goto('/fcs/process-factory/special-craft/aux-op-heat-transfer/tasks')
  await page.getByText('成衣').first().click()
  await expect(page.getByText('单位：件')).toBeVisible()
  await expect(page.getByText('菲票')).toHaveCount(0)
  await expect(page.getByText('我方后道工厂')).toBeVisible()
})

test('补料详情只显示真实印染加工单', async ({ page }) => {
  await page.goto('/fcs/craft/cutting/supplement-management')
  await page.getByRole('button', { name: '查看详情' }).first().click()
  await expect(page.getByRole('heading', { name: '印花 / 染色加工单' })).toBeVisible()
  await expect(page.getByText('裁片补料生成')).toBeVisible()
})
```

- [ ] **步骤 3：运行浏览器验收**

运行：

```bash
npx playwright test tests/heat-transfer-and-print-dye-flow.spec.ts --project=chromium
```

预期：全部 PASS；弹窗、筛选和列表操作无整页闪烁或滚动位置丢失。

- [ ] **步骤 4：运行设计治理**

运行：

```bash
npm run check:prototype-design-governance -- --all
npm run check:list-page-governance
```

预期：全部 PASS，审查记录覆盖所有被修改页面。

- [ ] **步骤 5：提交验收资产**

```bash
git add docs/prototype-review-records/2026-07-22-heat-transfer-and-print-dye-cleanup.md tests/heat-transfer-and-print-dye-flow.spec.ts
git commit -m "test(工艺): 补充烫画与印染链路验收"
```

---

### 任务 11：零残留、全量验证和 CodeGraph 收口

**文件：**
- 检查：本计划列出的全部文件
- 修改：仅修复本轮验证发现的直接相关问题

- [ ] **步骤 1：检查旧对象零残留**

运行：

```bash
if rg -n "印花需求单|染色需求单|PRINT_DEMAND|DYE_DEMAND|printDemandNos|dyeDemandNos" src scripts package.json; then
  echo "发现已取消对象残留"
  exit 1
fi
```

预期：无匹配、退出码 0。生产需求单相关代码仍然存在且不在搜索词范围内。

- [ ] **步骤 2：检查不存在加工单互锁代码**

运行：

```bash
if rg -n "前置染色未完成|dyePredecessor|predecessorDye|unlockPrintAfterDye" src scripts; then
  echo "发现不允许的印染互锁代码"
  exit 1
fi
```

预期：无匹配、退出码 0。

- [ ] **步骤 3：运行全部相关专项检查**

运行：

```bash
npm run check:tech-pack-garment-bom
npm run check:tech-pack-process-route
npm run check:tech-pack-special-craft-target-object-and-versioning
npm run check:special-craft-task-generation
npm run check:special-craft-task-and-fei-flow-deepening
npm run check:special-craft-operation-menus
npm run check:process-factory-special-craft-split
npm run check:heat-transfer-and-print-dye-contract
npm run check:production-process-work-order-generation
npm run check:stock-process-work-order-creation
npm run check:cutting-supplement-process-work-orders
npm run check:process-work-order-unification
npm run check:printing-workflow
npm run check:dyeing-workflow
npm run check:production-object-overview
npm run check:production-preparation-timing
```

预期：全部 PASS。

- [ ] **步骤 4：运行工程与浏览器总验收**

运行：

```bash
npm run check:prototype-design-governance -- --all
npm run check:list-page-governance
npm run build
npx playwright test tests/heat-transfer-and-print-dye-flow.spec.ts --project=chromium
```

预期：全部 PASS；Vite 构建无 TypeScript 或模块错误。

- [ ] **步骤 5：同步 CodeGraph 并检查索引**

运行：

```bash
codegraph sync
codegraph status
```

预期：`Index is up to date`，无 pending files。

- [ ] **步骤 6：检查提交范围**

运行：

```bash
git status --short
git diff --check
git log --oneline -8
```

预期：只有本计划相关文件；不得暂存或提交：

```text
docs/product-design/裁片放行管理产品需求文档.md
docs/product-design/铺布单优化产品需求文档.md
```

---

## 规格覆盖自检

| 设计要求 | 实现任务 |
| --- | --- |
| 保留直喷加工单，新增独立烫画加工单 | 任务 5 |
| 烫画、直喷支持裁片部位和成衣 | 任务 2、4 |
| BOM 新增成衣且不进入面料链路 | 任务 3 |
| 成衣单位件、无裁片部位、无菲票 | 任务 4、6 |
| 成衣仓出库到辅助工艺工厂 | 任务 6 |
| 必须经过辅助工艺待交出仓 | 任务 6 |
| 交往我方后道工厂 | 任务 6 |
| 生产单自动生成印染加工单 | 任务 7 |
| 备货手动创建印染加工单 | 任务 7 |
| 裁片补料生成印染加工单 | 任务 7、8 |
| 固定先染后印且技术包禁止反向 | 任务 2 |
| 两张加工单同时生成但不互锁 | 任务 7、11 |
| 彻底删除已取消需求单相关代码 | 任务 1、8、11 |
| 页面、PDA、仓库、交接和后道可追溯 | 任务 5、6、9、10 |
| 原型治理、列表治理、构建和浏览器验收 | 任务 10、11 |

## 计划自检结论

- 每项已确认设计均对应至少一个实现任务和一条可执行验证。
- 新类型 `CUT_PIECE_SUPPLEMENT`、`ProcessWorkOrderSourceSnapshot`、`businessType` 和“成衣”口径在后续任务中保持一致。
- 烫画与直喷使用独立业务记录和动态入口，但不复制公共页面或状态机。
- 印花与染色只共享来源解析和幂等创建，不合并执行领域。
- 全计划没有为印花加工单增加染色状态依赖。
- 旧对象零残留由最终命令直接扫描，不在仓库中新增保留旧名称的检查代码。
