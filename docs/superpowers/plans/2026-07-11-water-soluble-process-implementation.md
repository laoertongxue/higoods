# 水溶工序及加工单实现计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框语法跟踪进度。

**目标：** 在现有 HiGood 原型中完整接入准备阶段水溶工序，使仅水溶物料生成独立水溶加工单，同一物料的水溶加染色生成带水溶前置步骤的染色加工单，并打通 FCS、PFOS、PDA。

**架构：** 以正式技术包快照中的 BOM 物料为唯一工艺来源；生产单拆解按生产单、快照、BOM 物料形成稳定生成键。独立水溶由新的水溶加工单领域承载，含水溶染色继续复用染色领域，只增加工艺标识、水溶节点及开始染色前置校验，并由同一工厂连续完成。FCS、PFOS、PDA 共享领域状态和数量，不建立水溶需求单、连续工序任务或中间交接。

**技术栈：** Vite、TypeScript、Tailwind CSS、Vanilla TypeScript 字符串模板、Node 断言脚本、现有 FCS/PFOS/PDA 路由与通用交接能力。

---

## 一、文件结构与职责

### 新建文件

- src/data/fcs/water-soluble-task-domain.ts
  - 独立水溶加工单、执行节点、状态、数量差异、派厂、PDA 任务及交接映射的唯一领域来源。
- src/pages/process-water-soluble-orders.ts
  - FCS 任务编排与执行准备下的独立水溶加工单列表、筛选、分页、派厂和详情抽屉。
- src/pages/process-factory/dyeing/water-soluble-orders.ts
  - PFOS 染厂管理下的独立水溶加工单列表、当前动作、异常和交出入口。
- scripts/check-water-soluble-process.ts
  - 字典、BOM 联动、快照、生成组合、数量、幂等、派厂能力和染色前置规则的领域验收。
- scripts/check-water-soluble-pages.ts
  - 菜单、路由、分页、FCS/PFOS 展示边界和含水溶染色标签的页面验收。
- scripts/check-water-soluble-pda.ts
  - PDA 任务索引、当前动作、数量上限、角色、防重复、弱网表现和交接边界验收。
- docs/prototype-review-records/2026-07-11-water-soluble-process.md
  - 本次 FCS、PFOS、PDA 原型治理审查记录。

### 修改文件

- src/data/pcs-technical-data-version-types.ts
  - 增加 BOM 物料编码、单位、水溶要求和水溶触发字段类型。
- src/data/fcs/tech-packs.ts
  - 同步 FCS 技术包镜像类型的水溶字段。
- src/data/fcs/production-confirmation.ts
  - 保留生产确认快照中的水溶字段、物料编码和单位。
- src/data/pcs-technical-data-version-repository.ts
  - 克隆和持久化新增 BOM 字段。
- src/data/pcs-technical-data-fcs-adapter.ts
  - FCS 技术包适配时保留新增字段。
- src/data/pcs-tech-pack-review-diff.ts
  - 正式版本评审差异中识别水溶、物料编码和单位变化。
- src/data/fcs/process-craft-dict.ts
  - 新增准备阶段水溶工序及默认任务规则，排序在染色前。
- src/pages/tech-pack/bom-process-linkage.ts
  - 从具体 BOM 物料生成水溶工序，并绑定 linkedBomItemIds。
- src/pages/tech-pack/context.ts
  - 增加 BOM 水溶字段、单位、默认 Mock 和表单状态。
- src/pages/tech-pack/bom-domain.ts
  - BOM 列表和编辑弹窗增加水溶选择及固定顺序提示。
- src/pages/tech-pack/events.ts
  - 处理水溶字段编辑、保存、克隆和工序同步。
- src/data/tech-pack-process-route.ts
  - 保证同一物料的水溶步骤排在染色之前。
- src/data/fcs/production-tech-pack-snapshot-builder.ts
  - 快照克隆并冻结新增 BOM 字段和工序关联。
- src/data/fcs/production-order-tech-pack-runtime.ts
  - 运行时读取快照时保留新增字段。
- src/data/fcs/production-artifact-generation.ts
  - 按 BOM 物料拆分准备阶段产物，生成独立水溶任务或需先水溶的染色需求。
- src/data/fcs/page-adapters/process-prep-pages-adapter.ts
  - 把染色需求的水溶属性、BOM 来源和计划数量投影到 FCS 页面。
- src/pages/process-dye-requirements.ts
  - 展示需先水溶和固定工艺顺序。
- src/pages/process-dye-orders.ts
  - 限制多需求同质合单、按备货禁用水溶、校验染厂双能力。
- src/data/fcs/dyeing-task-domain.ts
  - 染色加工单增加水溶前置属性、WATER_SOLUBLE 节点和数量门槛。
- src/pages/process-factory/dyeing/work-orders.ts
  - PFOS 染色列表展示需先水溶和当前步骤。
- src/pages/process-factory/dyeing/work-order-detail.ts
  - 展示水溶节点、计划与完成数量、固定同厂和染色前置门槛。
- src/pages/process-factory/dyeing/events.ts
  - 接入含水溶染色的 Web 动作。
- src/data/fcs/factory-onboarding-store.ts
  - Mock 染厂增加水溶能力，水溶仍归类为染厂能力。
- src/data/fcs/factory-capacity-profile-mock.ts
  - 产能档案投影水溶能力，不新增专用设备类型。
- src/data/fcs/process-work-order-domain.ts
  - 统一加工单类型增加 WATER_SOLUBLE。
- src/data/fcs/process-mobile-task-binding.ts
  - 移动任务类型和列表来源增加 WATER_SOLUBLE。
- src/data/fcs/mobile-execution-task-index.ts
  - 增加水溶来源、搜索字段和来源定位。
- src/pages/pda-exec.ts
  - 执行列表展示水溶标签、物料、计划数量、当前步骤和主动作。
- src/pages/pda-exec-detail.ts
  - 独立水溶与含水溶染色使用当前动作优先的详情和事件回写。
- src/data/fcs/pda-handover-events.ts
  - 独立水溶复用通用交出；含水溶染色只允许最终交出。
- src/pages/pda-handover.ts
  - 交接列表识别独立水溶任务。
- src/pages/pda-handover-detail.ts
  - 独立水溶交出数量和物料单位展示。
- src/data/app-shell-config.ts
  - 增加 FCS 与 PFOS 两个水溶加工单菜单。
- src/router/route-renderers-fcs.ts
  - 增加两个页面的异步渲染器。
- src/router/routes-fcs.ts
  - 注册 FCS 与 PFOS 水溶加工单路由。
- src/main-handlers/fcs-handlers.ts
  - 分发两个水溶页面的局部交互事件。
- src/pages/process-factory/index.ts
  - 导出 PFOS 水溶页面。
- package.json
  - 注册三条水溶专项检查命令。

### 明确不修改

- src/data/fcs/production-preparation-timing.ts
- src/data/fcs/production-preparation-timing-runtime.ts
- src/pages/production/preparation-timing.ts
- 水溶专用仓库、结算、计价、批次相关文件
- 连续工序任务分配模块

---

## 二、实施任务

### 任务 1：先用失败检查锁定字典与 BOM 数据契约

**文件：**

- 创建：scripts/check-water-soluble-process.ts
- 修改：package.json
- 修改：src/data/pcs-technical-data-version-types.ts
- 修改：src/data/fcs/process-craft-dict.ts

- [ ] **步骤 1：编写字典和类型的失败检查**

在 scripts/check-water-soluble-process.ts 先加入以下断言：

~~~typescript
import assert from 'node:assert/strict'

import {
  getProcessDefinitionByCode,
  listActiveProcessCraftDefinitions,
} from '../src/data/fcs/process-craft-dict.ts'

const waterProcess = getProcessDefinitionByCode('WATER_SOLUBLE')
const dyeProcess = getProcessDefinitionByCode('DYE')

assert(waterProcess, '缺少水溶工序定义')
assert.equal(waterProcess.stageCode, 'PREP', '水溶必须属于准备阶段')
assert.equal(waterProcess.defaultDocType, 'TASK', '水溶默认直接生成任务单')
assert.equal(waterProcess.factoryMobileExecutionMode, 'FULL_TASK', '水溶必须支持 PDA 完整执行')
assert(dyeProcess && waterProcess.sort < dyeProcess.sort, '水溶必须排在染色之前')
assert(
  listActiveProcessCraftDefinitions().some(
    (item) => item.processCode === 'WATER_SOLUBLE' && item.craftName === '水溶',
  ),
  '工序工艺字典必须存在水溶工艺',
)
~~~

在 package.json 增加：

~~~json
"check:water-soluble-process": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-water-soluble-process.ts"
~~~

- [ ] **步骤 2：运行检查并确认失败**

运行：

~~~bash
npm run check:water-soluble-process
~~~

预期：FAIL，错误包含缺少水溶工序定义。

- [ ] **步骤 3：扩展 BOM 和工序触发字段类型**

在 TechnicalBomItem 增加：

~~~typescript
materialCode?: string
unit?: string
waterSolubleRequirement?: '是' | '否'
~~~

同步扩展技术包工序和字典的目标对象联合类型：

~~~typescript
export type ProcessTargetObject =
  | 'CUT_PIECE_PART'
  | 'FABRIC'
  | 'ACCESSORY'
  | 'GARMENT_SEMI'
  | 'BOM_MATERIAL'

export type ProcessTargetObjectName =
  | '裁片部位'
  | '面料'
  | '辅料'
  | '成衣半成品'
  | 'BOM物料'
~~~

TechnicalProcessEntry.targetObject 和 targetObjectName 使用同一新增值，避免页面联动与字典类型不一致。

把 TechnicalProcessEntry.triggerField 扩为：

~~~typescript
triggerField?:
  | 'printRequirement'
  | 'dyeRequirement'
  | 'waterSolubleRequirement'
  | 'shrinkRequirement'
  | 'washRequirement'
~~~

水溶目标使用现有通用 BOM 关联，不引入只适用于面料的限制。

- [ ] **步骤 4：增加水溶工序与工艺定义**

在 processDefinitionSeeds 中增加：

~~~typescript
{
  processCode: 'WATER_SOLUBLE',
  processName: '水溶',
  stageCode: 'PREP',
  sort: 15,
  processRole: 'EXTERNAL_TASK',
  generatesExternalTask: true,
  requiresTaskQr: true,
  requiresHandoverOrder: true,
  capacityEnabled: true,
  capacityRollupMode: 'SELF',
  factoryMobileExecutionMode: 'FULL_TASK',
  isActive: true,
  defaultDocument: '任务单',
  description: '由 BOM 物料上的水溶要求触发',
  triggerSource: 'BOM 物料存在水溶要求',
}
~~~

在 supplementalProcessCraftMappings 增加稳定字典值：

~~~typescript
{
  legacyValue: 2000009,
  legacyCraftName: '水溶',
  craftName: '水溶',
  processCode: 'WATER_SOLUBLE',
  isSpecialCraft: false,
  isActive: true,
  defaultDocument: '任务单',
}
~~~

同步补齐 PROC_WATER_SOLUBLE、染色厂优先、按 MATERIAL_SKU 拆分、参考产值与字典结果投影所需的同表常量。

- [ ] **步骤 5：运行字典检查与现有回归**

运行：

~~~bash
npm run check:water-soluble-process
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-process-craft-dictionary-rebuild.ts
~~~

预期：两条命令均 PASS。

- [ ] **步骤 6：提交**

~~~bash
git add package.json scripts/check-water-soluble-process.ts src/data/pcs-technical-data-version-types.ts src/data/fcs/process-craft-dict.ts
git commit -m "feat: add water-soluble process dictionary"
~~~

### 任务 2：打通技术包 BOM、工序页和正式快照

**文件：**

- 修改：scripts/check-water-soluble-process.ts
- 修改：src/pages/tech-pack/bom-process-linkage.ts
- 修改：src/pages/tech-pack/context.ts
- 修改：src/pages/tech-pack/bom-domain.ts
- 修改：src/pages/tech-pack/events.ts
- 修改：src/data/tech-pack-process-route.ts
- 修改：src/data/pcs-technical-data-version-repository.ts
- 修改：src/data/pcs-technical-data-fcs-adapter.ts
- 修改：src/data/pcs-tech-pack-review-diff.ts
- 修改：src/data/fcs/tech-packs.ts
- 修改：src/data/fcs/production-confirmation.ts
- 修改：src/data/fcs/production-tech-pack-snapshot-builder.ts
- 修改：src/data/fcs/production-order-tech-pack-runtime.ts

- [ ] **步骤 1：增加 BOM 联动和快照失败检查**

在专项脚本构造三条 BOM：

~~~typescript
const bomRows = [
  { id: 'BOM-WATER', waterSolubleRequirement: '是', dyeRequirement: '无' },
  { id: 'BOM-BOTH', waterSolubleRequirement: '是', dyeRequirement: '匹染' },
  { id: 'BOM-DYE', waterSolubleRequirement: '否', dyeRequirement: '匹染' },
]

const result = syncPreparationProcessesFromBom([], bomRows)
const techniques = result.techniques
const water = techniques.find((item) => item.processCode === 'WATER_SOLUBLE')
const dye = techniques.find((item) => item.processCode === 'DYE')

assert.deepEqual(water?.linkedBomItemIds, ['BOM-WATER', 'BOM-BOTH'])
assert.deepEqual(dye?.linkedBomItemIds, ['BOM-BOTH', 'BOM-DYE'])
assert(
  Number(water?.routeStepNo) < Number(dye?.routeStepNo),
  '同一技术包的水溶必须排在染色之前',
)
~~~

再构造正式快照并断言 BOM-BOTH 的 materialCode、unit、waterSolubleRequirement 和工序 linkedBomItemIds 均保留。

- [ ] **步骤 2：运行检查并确认失败**

~~~bash
npm run check:water-soluble-process
~~~

预期：FAIL，错误指向水溶联动或快照字段缺失。

- [ ] **步骤 3：让 BOM 联动按具体物料生成水溶工序**

扩展 BomDrivenPrepProcessCode 和 BomTriggerField：

~~~typescript
export type BomDrivenPrepProcessCode =
  | 'PRINT'
  | 'WATER_SOLUBLE'
  | 'DYE'
  | 'PREP_SHRINKING'
  | 'PREP_WASHING'
~~~

水溶工序元数据：

~~~typescript
{
  processCode: 'WATER_SOLUBLE',
  processName: '水溶',
  processStage: 'PREP',
  processStageName: '准备阶段',
  targetObject: 'BOM_MATERIAL',
  targetObjectName: 'BOM物料',
  triggerField: 'waterSolubleRequirement',
  defaultDocument: 'TASK',
  taskTypeMode: 'PROCESS',
  assignmentGranularity: 'ORDER',
  detailSplitDimensions: ['MATERIAL_SKU'],
  defaultOutputValue: 0,
  outputValueUnit: '产值/批',
  description: '由 BOM 物料上的水溶要求触发。',
}
~~~

buildAutoGeneratedPrepProcess 必须以当前字段筛选 BOM 行并写入 linkedBomItemIds，不能使用全表 any 结果代替关联物料。

- [ ] **步骤 4：增加 BOM 页面字段和固定顺序提示**

BomItemRow 与 newBomItem 增加：

~~~typescript
unit: string
waterSolubleRequirement: BomRequirementFlag
~~~

BOM 表格在染色前增加水溶列：

~~~html
<select
  class="h-8 w-20 rounded-md border px-2 text-sm"
  data-tech-field="bom-water-soluble"
  data-bom-id="${item.id}"
  data-testid="bom-water-soluble-requirement-select"
>
  ${bomRequirementOptions
    .map((option) => `<option value="${option}" ${item.waterSolubleRequirement === option ? 'selected' : ''}>${option}</option>`)
    .join('')}
</select>
~~~

同一行同时为水溶是、染色非无时显示：

~~~html
<span class="text-xs text-blue-700">固定顺序：先水溶、后染色</span>
~~~

所有物料类型显示该字段，不增加物料类型禁用条件。

- [ ] **步骤 5：保存、克隆、评审差异和快照全部保留字段**

所有 BOM 映射统一写入：

~~~typescript
materialCode: item.materialCode,
unit: item.unit || '米',
waterSolubleRequirement: item.waterSolubleRequirement || '否',
~~~

评审差异归一化中加入 waterSolubleRequirement、materialCode、unit，使正式版本变化可被审查。

- [ ] **步骤 6：运行技术包专项回归**

~~~bash
npm run check:water-soluble-process
npm run check:tech-pack-process-route
npm run check:fcs-production-tech-pack-snapshot
~~~

预期：三条命令均 PASS；快照只受正式版本影响。

- [ ] **步骤 7：提交**

~~~bash
git add src/pages/tech-pack src/data/tech-pack-process-route.ts src/data/pcs-technical-data-version-repository.ts src/data/pcs-technical-data-fcs-adapter.ts src/data/pcs-tech-pack-review-diff.ts src/data/fcs/tech-packs.ts src/data/fcs/production-confirmation.ts src/data/fcs/production-tech-pack-snapshot-builder.ts src/data/fcs/production-order-tech-pack-runtime.ts scripts/check-water-soluble-process.ts
git commit -m "feat: capture water-soluble requirements in tech packs"
~~~

### 任务 3：按 BOM 物料生成正确单据并锁定数量和幂等

**文件：**

- 修改：scripts/check-water-soluble-process.ts
- 修改：src/data/fcs/production-artifact-generation.ts

- [ ] **步骤 1：增加四种组合和数量失败检查**

检查脚本构造同一正式快照中的四条物料：

~~~typescript
const scenarios = [
  { id: 'ONLY-WATER', water: true, dye: false, expected: 'WATER_TASK' },
  { id: 'ONLY-DYE', water: false, dye: true, expected: 'DYE_DEMAND' },
  { id: 'BOTH', water: true, dye: true, expected: 'DYE_DEMAND_BEFORE_WATER' },
  { id: 'NONE', water: false, dye: false, expected: 'NONE' },
]
~~~

断言：

~~~typescript
assert.equal(onlyWaterArtifacts.filter((item) => item.processCode === 'WATER_SOLUBLE').length, 1)
assert.equal(bothArtifacts.filter((item) => item.processCode === 'WATER_SOLUBLE').length, 0)
assert.equal(bothDyeDemand.requiresWaterSoluble, true)
assert.equal(bothDyeDemand.bomItemId, 'BOTH')
assert.equal(bothDyeDemand.plannedQty, 1050)
assert.equal(bothDyeDemand.plannedUnit, '米')
assert.deepEqual(
  generateProductionArtifactsForOrder(orderId).map((item) => item.artifactId),
  generateProductionArtifactsForOrder(orderId).map((item) => item.artifactId),
  '重复拆解必须保持相同产物标识',
)
~~~

1050 的输入固定为适用 SKU 数量 1000、单耗 1、损耗率 5。

- [ ] **步骤 2：运行检查并确认失败**

~~~bash
npm run check:water-soluble-process
~~~

预期：FAIL，错误指向 BOM 物料级产物或 requiresWaterSoluble 缺失。

- [ ] **步骤 3：扩展准备阶段产物字段**

GeneratedProductionArtifactBase 增加：

~~~typescript
bomItemId?: string
materialCode?: string
materialName?: string
plannedQty?: number
plannedUnit?: string
~~~

GeneratedDemandArtifact 增加：

~~~typescript
requiresWaterSoluble?: boolean
processRoute?: string[]
~~~

- [ ] **步骤 4：实现 BOM 数量计算**

在 production-artifact-generation.ts 内增加纯函数：

~~~typescript
export function calculateBomProcessPlannedQty(
  order: ProductionOrder,
  bomItem: TechPackBomItemSnapshot,
): number {
  const applicable = new Set(bomItem.applicableSkuCodes || [])
  const garmentQty = order.demandSnapshot.skuLines
    .filter((line) => applicable.size === 0 || applicable.has(line.skuCode))
    .reduce((sum, line) => sum + line.qty, 0)
  return Number(
    (garmentQty * bomItem.unitConsumption * (1 + bomItem.lossRate / 100)).toFixed(3),
  )
}
~~~

- [ ] **步骤 5：按同一 BOM 行判断生成组合**

对 WATER_SOLUBLE 工序关联物料逐条处理：

~~~typescript
const requiresWater = bomItem.waterSolubleRequirement === '是'
const requiresDye = String(bomItem.dyeRequirement || '无') !== '无'

if (requiresWater && !requiresDye) {
  artifacts.push(toBomTaskArtifact(context, bomItem, plannedQty))
}
~~~

对 DYE 工序关联物料逐条处理：

~~~typescript
if (requiresDye) {
  artifacts.push(
    toBomDemandArtifact(context, bomItem, plannedQty, {
      requiresWaterSoluble: requiresWater,
      processRoute: requiresWater ? ['WATER_SOLUBLE', 'DYE'] : ['DYE'],
    }),
  )
}
~~~

artifactId 固定包含 orderId、sourceEntryId、bomItem.id，形成生产单、正式快照工序、BOM 物料的稳定键。

- [ ] **步骤 6：运行生成回归**

~~~bash
npm run check:water-soluble-process
npm run check:fcs-production-tech-pack-snapshot
~~~

预期：水溶专项 PASS，现有印花、染色、后道产物数量不回退。

- [ ] **步骤 7：提交**

~~~bash
git add src/data/fcs/production-artifact-generation.ts scripts/check-water-soluble-process.ts
git commit -m "feat: generate water-soluble artifacts by BOM material"
~~~

### 任务 4：建立独立水溶加工单领域和染厂能力约束

**文件：**

- 创建：src/data/fcs/water-soluble-task-domain.ts
- 修改：scripts/check-water-soluble-process.ts
- 修改：src/data/fcs/factory-onboarding-store.ts
- 修改：src/data/fcs/factory-capacity-profile-mock.ts

- [ ] **步骤 1：先写状态、能力和幂等失败检查**

~~~typescript
const orders = listWaterSolubleWorkOrders()
assert(orders.length > 0, '必须生成独立水溶加工单')
assert(orders.every((item) => item.sourceDemandIds.length === 0), '水溶不得生成需求单')
assert.equal(new Set(orders.map((item) => item.generationKey)).size, orders.length)

const unassigned = orders.find((item) => item.status === 'WAIT_FACTORY_ASSIGNMENT')
assert(unassigned, '需要待分配染厂场景')

assert.equal(canAssignWaterSolubleFactory(unassigned.waterOrderId, 'FACTORY-WITHOUT-WATER').ok, false)
assert.equal(canAssignWaterSolubleFactory(unassigned.waterOrderId, 'FACTORY-WITH-WATER').ok, true)
~~~

再断言合法状态链：

~~~typescript
const expectedStatuses = [
  'WAIT_FACTORY_ASSIGNMENT',
  'WAIT_MATERIAL',
  'WAIT_WATER_SOLUBLE',
  'WATER_SOLUBLE_IN_PROGRESS',
  'WAIT_HANDOVER',
  'HANDOVER_WAIT_RECEIVE',
  'DONE',
]
expectedStatuses.forEach((status) => {
  assert(Object.hasOwn(WATER_SOLUBLE_STATUS_LABEL, status))
})
~~~

- [ ] **步骤 2：运行检查并确认失败**

~~~bash
npm run check:water-soluble-process
~~~

预期：FAIL，模块或导出不存在。

- [ ] **步骤 3：定义独立水溶领域对象**

~~~typescript
export type WaterSolubleWorkOrderStatus =
  | 'WAIT_FACTORY_ASSIGNMENT'
  | 'WAIT_MATERIAL'
  | 'WAIT_WATER_SOLUBLE'
  | 'WATER_SOLUBLE_IN_PROGRESS'
  | 'PRODUCTION_PAUSED'
  | 'WAIT_HANDOVER'
  | 'HANDOVER_WAIT_RECEIVE'
  | 'RECEIPT_DIFFERENCE'
  | 'DONE'

export interface WaterSolubleWorkOrder {
  waterOrderId: string
  waterOrderNo: string
  generationKey: string
  sourceArtifactId: string
  sourceDemandIds: []
  productionOrderId: string
  productionOrderNo: string
  techPackVersionId: string
  bomItemId: string
  materialCode: string
  materialName: string
  materialSpec: string
  plannedQty: number
  completedQty: number
  qtyUnit: string
  factoryId?: string
  factoryName?: string
  status: WaterSolubleWorkOrderStatus
  taskId: string
  taskNo: string
  taskQrValue: string
  handoverOrderId?: string
  exceptionReason?: string
  supervisorDecision?: 'CONTINUE_PROCESSING' | 'CONTINUE_WITH_ACTUAL_QTY' | 'RETURN_FOR_REWORK'
  createdAt: string
  updatedAt: string
}
~~~

- [ ] **步骤 4：从独立水溶任务产物投影加工单**

只读取 processCode 为 WATER_SOLUBLE 的任务产物。编号和任务标识由 generationKey 稳定派生；重复 list 不得产生新对象或重复交出单。

- [ ] **步骤 5：实现状态动作和数量差异**

导出精确动作：

~~~typescript
listWaterSolubleWorkOrders()
getWaterSolubleWorkOrderById(orderId)
getWaterSolubleWorkOrderByTaskId(taskId)
listWaterSolubleMobileTasks()
assignWaterSolubleFactory(orderId, factoryId)
markWaterSolubleMaterialReady(orderId)
startWaterSoluble(orderId, operator)
completeWaterSoluble(orderId, completedQty, reason)
resolveWaterSolublePause(orderId, decision, supervisor)
submitWaterSolubleHandover(orderId, qty)
writeBackWaterSolubleReceipt(orderId, receivedQty)
~~~

completeWaterSoluble 的规则：

~~~typescript
if (completedQty < order.plannedQty && !reason.trim()) {
  return { ok: false, message: '完成数量少于计划数量，请填写原因。' }
}
order.status = completedQty < order.plannedQty ? 'PRODUCTION_PAUSED' : 'WAIT_HANDOVER'
~~~

- [ ] **步骤 6：增加水溶能力并归类为染厂**

factory-onboarding-store.ts 的工厂类型推断加入：

~~~typescript
if (capability.processCode === 'WATER_SOLUBLE') return 'DYEING_FACTORY'
~~~

染厂 Mock 至少覆盖：

- 同时具备 WATER_SOLUBLE 与 DYE 的染厂。
- 仅具备 DYE 的染厂，用于拦截场景。
- 未分配工厂的水溶加工单。

- [ ] **步骤 7：运行领域检查**

~~~bash
npm run check:water-soluble-process
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-factory-onboarding-final-flow.ts
~~~

预期：均 PASS。

- [ ] **步骤 8：提交**

~~~bash
git add src/data/fcs/water-soluble-task-domain.ts src/data/fcs/factory-onboarding-store.ts src/data/fcs/factory-capacity-profile-mock.ts scripts/check-water-soluble-process.ts
git commit -m "feat: add standalone water-soluble work orders"
~~~

### 任务 5：给染色需求和染色加工单增加水溶前置

**文件：**

- 修改：scripts/check-water-soluble-process.ts
- 修改：src/data/fcs/page-adapters/process-prep-pages-adapter.ts
- 修改：src/pages/process-dye-requirements.ts
- 修改：src/pages/process-dye-orders.ts
- 修改：src/data/fcs/dyeing-task-domain.ts
- 修改：src/pages/process-factory/dyeing/work-orders.ts
- 修改：src/pages/process-factory/dyeing/work-order-detail.ts
- 修改：src/pages/process-factory/dyeing/events.ts

- [ ] **步骤 1：增加合单、能力和前置门槛失败检查**

~~~typescript
const demands = listPrepRequirementDemands('DYE')
const normalDemand = demands.find((item) => !item.requiresWaterSoluble)
const waterDemand = demands.find((item) => item.requiresWaterSoluble)
assert(normalDemand && waterDemand, '需要普通染色和需先水溶两类需求')

assert.equal(validateDyeDemandSelection([normalDemand, waterDemand]).ok, false)
assert.match(
  validateDyeDemandSelection([normalDemand, waterDemand]).message,
  /水溶要求不一致/,
)

assert.equal(
  validateDyeFactoryCapabilities([waterDemand], 'DYE-ONLY-FACTORY').ok,
  false,
)

const combinedOrder = getDyeWorkOrderById('DYE-WITH-WATER')
assert(combinedOrder?.requiresWaterSoluble)
assert.equal(validateDyeStartPrerequisite(combinedOrder.dyeOrderId, 100).ok, false)
~~~

- [ ] **步骤 2：运行检查并确认失败**

~~~bash
npm run check:water-soluble-process
~~~

预期：FAIL，缺少染色需求水溶属性或染色前置校验。

- [ ] **步骤 3：投影染色需求水溶属性**

PrepRequirementDemandFact 和页面 DemandOption 增加：

~~~typescript
bomItemId: string
requiresWaterSoluble: boolean
processRoute: Array<'WATER_SOLUBLE' | 'DYE'>
~~~

染色需求列表和详情显示需先水溶标签及水溶 → 染色，不提供手工修改入口。

在 dyeing-task-domain.ts 导出 validateDyeDemandSelection 和 validateDyeFactoryCapabilities，FCS 创建抽屉与检查脚本调用同一规则，避免页面自建一套校验。

- [ ] **步骤 4：实现多需求同质合单**

选择第一条需求后：

~~~typescript
const selectedWaterMode = selectedDemands[0]?.requiresWaterSoluble
const compatibleOptions = demandOptions.filter(
  (item) => item.requiresWaterSoluble === selectedWaterMode,
)
~~~

提交前再次执行：

~~~typescript
const waterModes = new Set(linkedDemands.map((item) => item.requiresWaterSoluble))
if (waterModes.size > 1) {
  state.notice = '所选染色需求的水溶要求不一致，请分别创建加工单。'
  return
}
~~~

按备货模式固定 requiresWaterSoluble 为 false，页面不出现水溶选项。

提交创建时调用 dyeing-task-domain.ts 新增的 createDyeWorkOrderFromDemands；process-dye-orders.ts 不再只向页面内 ORDERS 数组追加。创建成功后重新读取 listPrepProcessOrders('DYE')，确保 FCS、PFOS、PDA 看到同一张加工单。

- [ ] **步骤 5：分配染厂时校验双能力**

含水溶需求只能选择 capability 同时覆盖 WATER_SOLUBLE 和 DYE 的染厂。普通染色需求保持现有染厂规则。

- [ ] **步骤 6：扩展染色领域**

DyeWorkOrder 增加：

~~~typescript
requiresWaterSoluble: boolean
waterSolublePlannedQty?: number
waterSolubleCompletedQty?: number
waterSolubleQtyUnit?: string
~~~

DyeExecutionNodeCode 增加 WATER_SOLUBLE，DyeWorkOrderStatus 增加 WAIT_WATER_SOLUBLE、WATER_SOLUBLE_IN_PROGRESS、PRODUCTION_PAUSED。

同时导出以下节点动作供 Web 与 PDA 共用：

~~~typescript
startDyeWaterSolubleNode(dyeOrderId, operator)
completeDyeWaterSolubleNode(dyeOrderId, outputQty, reason)
resolveDyeWaterSolublePause(dyeOrderId, decision, supervisor)
~~~

节点顺序使用：

~~~typescript
const route = order.requiresWaterSoluble
  ? ['SAMPLE', 'MATERIAL_READY', 'VAT_PLAN', 'WATER_SOLUBLE', 'DYE', 'DEHYDRATE', 'DRY', 'SET', 'ROLL', 'PACK']
  : ['SAMPLE', 'MATERIAL_READY', 'VAT_PLAN', 'DYE', 'DEHYDRATE', 'DRY', 'SET', 'ROLL', 'PACK']
~~~

水溶不是对所有染前准备的替代；只在真正开始 DYE 前形成硬门槛。

- [ ] **步骤 7：实现染色投入上限**

~~~typescript
export function validateDyeStartPrerequisite(
  dyeOrderId: string,
  inputQty: number,
): { ok: boolean; message: string } {
  const order = getDyeWorkOrderById(dyeOrderId)
  if (!order) return { ok: false, message: '未找到染色加工单。' }
  if (!order.requiresWaterSoluble) return { ok: true, message: '' }
  const waterNode = getDyeExecutionNodeRecord(dyeOrderId, 'WATER_SOLUBLE')
  if (!waterNode?.finishedAt) return { ok: false, message: '请先完成水溶，再开始染色。' }
  if (inputQty > Number(waterNode.outputQty || 0)) {
    return { ok: false, message: '染色投入数量不能超过水溶完成数量。' }
  }
  return { ok: true, message: '' }
}
~~~

- [ ] **步骤 8：更新 Web 页面**

FCS 和 PFOS 染色列表只增加需先水溶徽标、当前步骤和数量摘要；含水溶染色单不得出现在独立水溶页面。

详情页展示水溶计划、完成、差异和同厂连续加工；水溶完成后不出现中间交出按钮。

- [ ] **步骤 9：运行染色回归**

~~~bash
npm run check:water-soluble-process
npm run check:dyeing-workflow
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-print-dye-web-action-dialog-and-dispatch.ts
~~~

预期：全部 PASS。

- [ ] **步骤 10：提交**

~~~bash
git add src/data/fcs/page-adapters/process-prep-pages-adapter.ts src/pages/process-dye-requirements.ts src/pages/process-dye-orders.ts src/data/fcs/dyeing-task-domain.ts src/pages/process-factory/dyeing/work-orders.ts src/pages/process-factory/dyeing/work-order-detail.ts src/pages/process-factory/dyeing/events.ts scripts/check-water-soluble-process.ts
git commit -m "feat: add water-soluble prerequisite to dyeing"
~~~

### 任务 6：实现 FCS 和 PFOS 独立水溶加工单页面

**文件：**

- 创建：src/pages/process-water-soluble-orders.ts
- 创建：src/pages/process-factory/dyeing/water-soluble-orders.ts
- 创建：scripts/check-water-soluble-pages.ts
- 修改：src/data/app-shell-config.ts
- 修改：src/router/route-renderers-fcs.ts
- 修改：src/router/routes-fcs.ts
- 修改：src/main-handlers/fcs-handlers.ts
- 修改：src/pages/process-factory/index.ts
- 修改：package.json

- [ ] **步骤 1：编写菜单、路由和页面边界失败检查**

~~~typescript
import assert from 'node:assert/strict'
import fs from 'node:fs'

const shell = fs.readFileSync('src/data/app-shell-config.ts', 'utf8')
const routes = fs.readFileSync('src/router/routes-fcs.ts', 'utf8')
const fcsPage = fs.readFileSync('src/pages/process-water-soluble-orders.ts', 'utf8')
const pfosPage = fs.readFileSync('src/pages/process-factory/dyeing/water-soluble-orders.ts', 'utf8')

assert(shell.includes("title: '水溶加工单'"))
assert(routes.includes("'/fcs/process/water-soluble-orders'"))
assert(routes.includes("'/fcs/craft/dyeing/water-soluble-orders'"))
assert(fcsPage.includes('data-testid="water-soluble-pagination"'))
assert(pfosPage.includes('data-testid="factory-water-soluble-pagination"'))
assert(!fcsPage.includes('requiresWaterSoluble'), '独立水溶页不得混入含水溶染色单')
~~~

package.json 增加：

~~~json
"check:water-soluble-pages": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-water-soluble-pages.ts"
~~~

- [ ] **步骤 2：运行检查并确认失败**

~~~bash
npm run check:water-soluble-pages
~~~

预期：FAIL，新页面不存在。

- [ ] **步骤 3：实现 FCS 页面**

路由固定为 /fcs/process/water-soluble-orders。页面只调用 listWaterSolubleWorkOrders，包含：

- 加工单号、生产单号、物料、计划与完成数量。
- 染厂、状态、计划交期、异常、技术包版本。
- 关键词、状态、染厂、交期、异常筛选。
- 10、20、50 每页和页码。
- 分配染厂、查看任务、查看执行、查看异常、查看交接。
- 详情用现有 drawer 组件或页面内清晰 renderWaterSolubleDetailDrawer 函数实现。

分配染厂提交调用 assignWaterSolubleFactory，并展示领域返回的中文拦截原因。

- [ ] **步骤 4：实现 PFOS 页面**

路由固定为 /fcs/craft/dyeing/water-soluble-orders。按当前染厂过滤，仅显示独立水溶单，包含：

- 当前状态和当前要做什么。
- 计划数量、完成数量和差异。
- PDA 操作人和最近操作。
- 生产暂停的主管处理入口。
- 待交出的交接入口。
- 10、20、50 每页和页码。

- [ ] **步骤 5：接入菜单、渲染器、路由和事件**

FCS 菜单放在染色加工单之前或之后但仍位于任务编排与执行准备：

~~~typescript
{
  key: 'process-water-soluble-orders',
  title: '水溶加工单',
  icon: 'Waves',
  href: '/fcs/process/water-soluble-orders',
}
~~~

PFOS 菜单放在染色加工单相邻位置：

~~~typescript
{
  key: 'pfos-water-soluble-orders',
  title: '水溶加工单',
  icon: 'Waves',
  href: '/fcs/craft/dyeing/water-soluble-orders',
}
~~~

两个页面导出 render 与 handle 函数，由 fcs-handlers 统一转发。

- [ ] **步骤 6：运行页面检查**

~~~bash
npm run check:water-soluble-pages
npm run check:prototype-design-governance
npm run build
~~~

预期：全部 PASS，两个路由构建可达。

- [ ] **步骤 7：提交**

~~~bash
git add src/pages/process-water-soluble-orders.ts src/pages/process-factory/dyeing/water-soluble-orders.ts scripts/check-water-soluble-pages.ts src/data/app-shell-config.ts src/router/route-renderers-fcs.ts src/router/routes-fcs.ts src/main-handlers/fcs-handlers.ts src/pages/process-factory/index.ts package.json
git commit -m "feat: add water-soluble order pages"
~~~

### 任务 7：把独立水溶接入统一加工单和 PDA 任务索引

**文件：**

- 创建：scripts/check-water-soluble-pda.ts
- 修改：package.json
- 修改：src/data/fcs/process-work-order-domain.ts
- 修改：src/data/fcs/process-mobile-task-binding.ts
- 修改：src/data/fcs/mobile-execution-task-index.ts
- 修改：src/pages/pda-exec.ts

- [ ] **步骤 1：编写 PDA 索引失败检查**

~~~typescript
import assert from 'node:assert/strict'

import {
  getMobileExecutionTaskSourceInfo,
  listMobileExecutionTasks,
} from '../src/data/fcs/mobile-execution-task-index.ts'

const waterTasks = listMobileExecutionTasks({ processType: 'WATER_SOLUBLE' })
assert(waterTasks.length > 0, 'PDA 执行列表缺少独立水溶任务')

const source = getMobileExecutionTaskSourceInfo(waterTasks[0])
assert.equal(source.sourceType, 'WATER_SOLUBLE_WORK_ORDER')
assert(source.materialSku, '水溶任务搜索索引必须包含物料编码')

const located = listMobileExecutionTasks({ keyword: source.materialSku })
assert(located.some((item) => item.taskId === waterTasks[0].taskId))
~~~

package.json 增加：

~~~json
"check:water-soluble-pda": "node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-water-soluble-pda.ts"
~~~

- [ ] **步骤 2：运行检查并确认失败**

~~~bash
npm run check:water-soluble-pda
~~~

预期：FAIL，WATER_SOLUBLE 不是合法移动任务类型。

- [ ] **步骤 3：扩展统一加工单**

~~~typescript
export type ProcessWorkOrderType = 'PRINT' | 'DYE' | 'WATER_SOLUBLE'
~~~

ProcessWorkOrder 增加 waterSolublePayload，并在 listProcessWorkOrders 与 getProcessWorkOrderById 中映射独立水溶单。

- [ ] **步骤 4：扩展移动任务来源**

MobileTaskProcessType 增加 WATER_SOLUBLE。getMobileTaskProcessType 必须先匹配水溶，再匹配染色：

~~~typescript
if (/PROC_WATER_SOLUBLE|WATER_SOLUBLE|水溶/.test(explicitFields)) return 'WATER_SOLUBLE'
if (/PROC_DYE|DYE\b|染色/.test(explicitFields)) return 'DYE'
~~~

listPdaMobileExecutionTasks 合并 listWaterSolubleMobileTasks，并按 taskId 去重。

- [ ] **步骤 5：扩展搜索与来源定位**

MobileExecutionTaskSourceInfo 增加 waterSolubleOrderNo。来源映射：

~~~typescript
{
  sourceType: 'WATER_SOLUBLE_WORK_ORDER',
  sourceId: order.waterOrderId,
  sourceWorkOrderId: order.waterOrderId,
  sourceWorkOrderNo: order.waterOrderNo,
  workOrderNo: order.waterOrderNo,
  waterSolubleOrderNo: order.waterOrderNo,
  productionOrderNo: order.productionOrderNo,
  materialSku: order.materialCode,
  operationName: '水溶',
}
~~~

matchSourceType 接受 WATER_SOLUBLE_WORK_ORDER、WATER_SOLUBLE_ORDER。

- [ ] **步骤 6：更新 PDA 执行列表卡片**

不修改底部导航。水溶卡片显示：

- 水溶加工单。
- 物料名称和编码。
- 计划数量和单位。
- 当前步骤。
- 当前唯一主动作。
- 生产暂停提示。

搜索框提示文案更新为任务号 / 加工单号 / 生产单号 / 物料，但输入事件继续局部更新，不触发整页重绘。

- [ ] **步骤 7：运行索引和列表回归**

~~~bash
npm run check:water-soluble-pda
npm run check:pda-exec-task-detail
npm run build
~~~

预期：均 PASS。

- [ ] **步骤 8：提交**

~~~bash
git add scripts/check-water-soluble-pda.ts package.json src/data/fcs/process-work-order-domain.ts src/data/fcs/process-mobile-task-binding.ts src/data/fcs/mobile-execution-task-index.ts src/pages/pda-exec.ts
git commit -m "feat: index water-soluble tasks for PDA"
~~~

### 任务 8：实现 PDA 当前动作、染色门槛和现场防错

**文件：**

- 修改：scripts/check-water-soluble-pda.ts
- 修改：src/pages/pda-exec-detail.ts
- 修改：src/data/fcs/water-soluble-task-domain.ts
- 修改：src/data/fcs/dyeing-task-domain.ts

- [ ] **步骤 1：增加当前动作和防重复失败检查**

~~~typescript
const order = getWaterSolubleWorkOrderByTaskId(waterTask.taskId)
assert(order)
assert.equal(getWaterSolubleCurrentAction(order).code, 'START_WATER_SOLUBLE')

const first = startWaterSoluble(order.waterOrderId, operator)
const second = startWaterSoluble(order.waterOrderId, operator)
assert.equal(first.ok, true)
assert.equal(second.ok, false)
assert.match(second.message, /已经开始/)

const shortage = completeWaterSoluble(order.waterOrderId, order.plannedQty - 10, '')
assert.equal(shortage.ok, false)
assert.match(shortage.message, /填写原因/)
~~~

含水溶染色检查：

~~~typescript
const combinedOrder = listDyeWorkOrders().find((item) => item.requiresWaterSoluble)
assert(combinedOrder, '需要一张含水溶的染色加工单')
const startDyeBeforeWater = validateDyeStartPrerequisite(combinedOrder.dyeOrderId, 100)
startDyeWaterSolubleNode(combinedOrder.dyeOrderId, operator)
completeDyeWaterSolubleNode(combinedOrder.dyeOrderId, 80, '物料实际可水溶数量不足')
resolveDyeWaterSolublePause(
  combinedOrder.dyeOrderId,
  'CONTINUE_WITH_ACTUAL_QTY',
  supervisor,
)
const startDyeAboveWaterOutput = validateDyeStartPrerequisite(combinedOrder.dyeOrderId, 100)

assert.equal(startDyeBeforeWater.ok, false)
assert.match(startDyeBeforeWater.message, /先完成水溶/)
assert.equal(startDyeAboveWaterOutput.ok, false)
assert.match(startDyeAboveWaterOutput.message, /不能超过水溶完成数量/)
~~~

- [ ] **步骤 2：运行检查并确认失败**

~~~bash
npm run check:water-soluble-pda
~~~

预期：FAIL，当前动作或重复提交规则缺失。

- [ ] **步骤 3：实现独立水溶当前动作区**

在 water-soluble-task-domain.ts 导出 getWaterSolubleCurrentAction，使 Web、PDA 和检查脚本共享同一动作判断。

renderWaterSolubleTaskCard 顶部只返回一个主动作：

~~~typescript
const actionByStatus = {
  WAIT_WATER_SOLUBLE: { code: 'water-start', label: '开始水溶' },
  WATER_SOLUBLE_IN_PROGRESS: { code: 'water-complete', label: '完成水溶' },
  PRODUCTION_PAUSED: { code: 'water-view-supervisor', label: '查看主管处理' },
  WAIT_HANDOVER: { code: 'water-go-handover', label: '去交出' },
} as const
~~~

完整执行记录放在默认折叠区域，不能把多个节点按钮平铺到首屏。

- [ ] **步骤 4：实现含水溶染色当前动作区**

含水溶染色在 WATER_SOLUBLE 节点显示开始水溶、完成水溶；完成后显示开始染色。普通染色不显示水溶。

dye-start-dye 事件在任何页面入口都调用 validateDyeStartPrerequisite，不只依赖按钮禁用。

- [ ] **步骤 5：实现数量弹窗**

完成水溶弹窗默认计划数量，提交字段为 completedQty 和 reason：

~~~typescript
const completedQty = Number(input.value)
if (!Number.isFinite(completedQty) || completedQty < 0) {
  showPdaExecDetailToast('请输入有效的水溶完成数量。')
  return true
}
~~~

超过计划数量显示二次确认；少于计划数量要求原因并进入生产暂停。

- [ ] **步骤 6：实现角色门槛**

- ROLE_OPERATOR：开始、完成水溶。
- ROLE_PRODUCTION：处理生产暂停，决定补做、按实际继续、退回重做。
- ROLE_HANDOVER：进入独立水溶交出。
- ROLE_ADMIN：查看并执行异常兜底。

按钮隐藏之外，领域动作仍校验角色。

- [ ] **步骤 7：实现弱网和防重复表现**

提交按钮点击后立刻 disabled 并显示处理中；失败时保留 completedQty、reason。领域动作使用 orderId、actionCode、当前状态形成动作唯一键，同一状态下重复提交返回已处理的中文结果。

- [ ] **步骤 8：运行 PDA 检查**

~~~bash
npm run check:water-soluble-pda
npm run check:pda-exec-task-detail
npm run check:dyeing-workflow
~~~

预期：均 PASS。

- [ ] **步骤 9：提交**

~~~bash
git add scripts/check-water-soluble-pda.ts src/pages/pda-exec-detail.ts src/data/fcs/water-soluble-task-domain.ts src/data/fcs/dyeing-task-domain.ts
git commit -m "feat: execute water-soluble steps on PDA"
~~~

### 任务 9：复用通用交接并封死中间交接

**文件：**

- 修改：scripts/check-water-soluble-pda.ts
- 修改：src/data/fcs/pda-handover-events.ts
- 修改：src/pages/pda-handover.ts
- 修改：src/pages/pda-handover-detail.ts
- 修改：src/pages/pda-exec-detail.ts
- 修改：src/data/fcs/water-soluble-task-domain.ts

- [ ] **步骤 1：增加交接边界失败检查**

~~~typescript
const standalone = getWaterSolubleWorkOrderById('WSO-STANDALONE')
const standaloneHandover = ensureHandoverOrderForStartedTask(standalone.taskId)
assert(standaloneHandover.handoverOrderId)

const combined = getDyeWorkOrderById('DYE-WITH-WATER')
completeDyeWaterSolubleNode(combined.dyeOrderId, 100)
assert.equal(
  listHandoverOrdersByTaskId(combined.taskId).length,
  0,
  '含水溶染色在水溶完成后不得生成中间交出',
)
~~~

完成 PACK 后再断言只生成一个最终交出单。

- [ ] **步骤 2：运行检查并确认失败**

~~~bash
npm run check:water-soluble-pda
~~~

预期：FAIL，独立水溶来源或含水溶染色交接门槛不完整。

- [ ] **步骤 3：接入独立水溶交出**

独立水溶任务进入 WAIT_HANDOVER 后允许 ensureHandoverOrderForStartedTask，交出对象使用 BOM 物料、completedQty、qtyUnit；接收回写后更新 HANDOVER_WAIT_RECEIVE、RECEIPT_DIFFERENCE 或 DONE。

- [ ] **步骤 4：限制含水溶染色交出**

水溶节点完成只更新染色加工单内部节点。只有 PACK 完成后的 WAIT_HANDOVER 可以创建通用交出单。

- [ ] **步骤 5：更新交接页面**

交接列表和详情把 WATER_SOLUBLE_WORK_ORDER 显示为水溶加工单，展示物料名称、编码、完成数量和单位。不要新增水溶专用交接页面。

- [ ] **步骤 6：运行交接回归**

~~~bash
npm run check:water-soluble-pda
npm run check:pda-handover-pages
npm run check:pda-exec-task-detail
~~~

预期：均 PASS。

- [ ] **步骤 7：提交**

~~~bash
git add scripts/check-water-soluble-pda.ts src/data/fcs/pda-handover-events.ts src/pages/pda-handover.ts src/pages/pda-handover-detail.ts src/pages/pda-exec-detail.ts src/data/fcs/water-soluble-task-domain.ts
git commit -m "feat: hand over standalone water-soluble orders"
~~~

### 任务 10：补齐治理记录、全量验收和浏览器验证

**文件：**

- 创建：docs/prototype-review-records/2026-07-11-water-soluble-process.md
- 修改：scripts/check-water-soluble-process.ts
- 修改：scripts/check-water-soluble-pages.ts
- 修改：scripts/check-water-soluble-pda.ts

- [ ] **步骤 1：完成规格覆盖矩阵**

在三个脚本中确认以下场景都有直接断言：

- 仅水溶、仅染色、水溶加染色、均未选择。
- 同一物料组合与不同物料不得误组合。
- 所有 BOM 物料类型可选择水溶。
- 草稿不生成、正式快照拆解才生成。
- 重复拆解不重复。
- 混合水溶属性的染色需求不能合单。
- 按备货不能附加水溶。
- 独立水溶单能力校验。
- 含水溶染色双能力校验。
- 独立水溶正常和数量不足。
- 未完成水溶不能染色。
- 染色投入不超过水溶产出。
- 水溶完成无中间交接。
- PDA 错误任务、重复提交和弱网重试。
- 新技术包版本不改变已生成加工单。
- 生产准备时效文件不出现 WATER_SOLUBLE。

- [ ] **步骤 2：编写原型审查记录**

按 docs/prototype-review-record-template.md 填写：

- 角色：平台业务、染厂主管、现场操作员、交接人员、管理员。
- PDA 首屏：当前物料、计划数量、当前步骤、唯一主动作。
- 防错：错工厂、错物料、错步骤、数量不足、重复提交。
- 异常：生产暂停与主管继续或退回。
- 跨端：FCS、PFOS、PDA 状态和数量一致。
- 例外：不新增 PDA 底部导航，不新增水溶仓库和结算。
- 性能：筛选输入不整页重绘，轻交互目标小于 200ms。

- [ ] **步骤 3：运行完整自动检查**

~~~bash
npm run check:water-soluble-process
npm run check:water-soluble-pages
npm run check:water-soluble-pda
node --experimental-strip-types --experimental-specifier-resolution=node scripts/check-process-craft-dictionary-rebuild.ts
npm run check:tech-pack-process-route
npm run check:fcs-production-tech-pack-snapshot
npm run check:dyeing-workflow
npm run check:pda-exec-task-detail
npm run check:pda-handover-pages
npm run check:prototype-design-governance
npm run build
~~~

预期：所有命令退出码为 0。

- [ ] **步骤 4：启动局域网可访问的本地原型**

~~~bash
npm run dev -- --host 0.0.0.0 --port 4173
~~~

获取局域网 IP，并验证以下地址：

~~~text
http://局域网IP:4173/fcs/production/craft-dict
从 PCS 款式档案进入任一正式技术包版本页面
http://局域网IP:4173/fcs/process/dye-requirements
http://局域网IP:4173/fcs/process/dye-orders
http://局域网IP:4173/fcs/process/water-soluble-orders
http://局域网IP:4173/fcs/craft/dyeing/water-soluble-orders
http://局域网IP:4173/fcs/craft/dyeing/work-orders
http://局域网IP:4173/fcs/pda/exec
http://局域网IP:4173/fcs/pda/handover
~~~

- [ ] **步骤 5：浏览器逐项验收**

使用真实浏览器检查：

1. 技术包 BOM 水溶字段对所有物料可用。
2. 同行同时选择时显示先水溶、后染色。
3. 技术包工序页展示具体关联物料。
4. FCS 独立水溶列表可筛选、分页、派厂、查看详情。
5. PFOS 独立水溶列表只显示当前染厂任务。
6. 染色需求和染色加工单显示需先水溶。
7. 混合需求选择和能力不足派厂被中文提示拦截。
8. PDA 无新底部导航，当前步骤只有一个主动作。
9. 水溶数量不足进入生产暂停，主管处理后才能继续。
10. 含水溶染色水溶完成后没有中间交接，最终仅一次交出。
11. 输入、页签、抽屉和按钮无明显整页闪烁，响应小于 200ms。

- [ ] **步骤 6：同步 CodeGraph 并运行状态检查**

~~~bash
codegraph sync
codegraph status
~~~

预期：索引显示 up to date。

- [ ] **步骤 7：提交最终验收记录**

~~~bash
git add docs/prototype-review-records/2026-07-11-water-soluble-process.md scripts/check-water-soluble-process.ts scripts/check-water-soluble-pages.ts scripts/check-water-soluble-pda.ts
git commit -m "test: verify water-soluble process workflow"
~~~

---

## 三、完成定义

只有同时满足以下条件才可宣布实现完成：

- 正式技术包快照可以保留具体 BOM 物料的水溶要求。
- 单据生成组合与产品规格完全一致。
- 独立水溶无需求单，含水溶染色无独立水溶单。
- 同一物料水溶与染色固定同厂、固定顺序。
- 独立水溶在 FCS、PFOS、PDA 和通用交接形成闭环。
- 含水溶染色在染色加工单内完成水溶前置，只有最终一次交出。
- 数量口径使用适用 SKU 数量、单耗和损耗率。
- 派厂能力、角色、扫码、数量、重复提交和路由绕过均有防错。
- 水溶没有进入生产准备时效、连续工序任务、专用仓库或结算。
- 三条水溶专项检查、相关回归、治理检查和构建全部通过。
- 已完成本地浏览器验证和原型审查记录。
