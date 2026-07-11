import assert from 'node:assert/strict'

import {
  getProcessCraftByLegacyValue,
  getProcessDefinitionByCode,
  getProcessCraftDictRowByCode,
} from '../src/data/fcs/process-craft-dict.ts'
import {
  getFactorySupplyFormulaGuide,
  getFactorySupplyFormulaTemplate,
} from '../src/data/fcs/process-craft-output-value-explainer.ts'
import { buildProductionOrderTechPackSnapshot } from '../src/data/fcs/production-tech-pack-snapshot-builder.ts'
import {
  getTechnicalDataVersionContent,
  resetTechnicalDataVersionRepository,
  updateTechnicalDataVersionContent,
} from '../src/data/pcs-technical-data-version-repository.ts'
import { normalizeProcessRouteEntries } from '../src/data/tech-pack-process-route.ts'
import { syncPreparationProcessesFromBom } from '../src/pages/tech-pack/bom-process-linkage.ts'
import { applyProcessRouteDraftAction } from '../src/pages/tech-pack/events.ts'

const printProcess = getProcessDefinitionByCode('PRINT')
const waterProcess = getProcessDefinitionByCode('WATER_SOLUBLE')
const dyeProcess = getProcessDefinitionByCode('DYE')
const waterCraft = getProcessCraftByLegacyValue(2000009)

assert(printProcess, '工序字典缺少 PRINT 印花定义')
assert(waterProcess, '工序字典缺少 WATER_SOLUBLE 水溶定义')
assert(dyeProcess, '工序字典缺少 DYE 染色定义')
assert.equal(waterProcess.stageCode, 'PREP', '水溶必须属于准备阶段')
assert.equal(waterProcess.sort, 15, '水溶排序必须固定为 15')
assert(printProcess.sort < waterProcess.sort, '水溶排序必须晚于印花')
assert(waterProcess.sort < dyeProcess.sort, '水溶排序必须早于染色')
assert.equal(waterProcess.processRole, 'EXTERNAL_TASK', '水溶必须是对外任务')
assert.equal(waterProcess.generatesExternalTask, true, '水溶必须生成对外任务')
assert.equal(waterProcess.requiresTaskQr, true, '水溶必须生成任务二维码')
assert.equal(waterProcess.requiresHandoverOrder, true, '水溶必须生成交接单')
assert.equal(waterProcess.capacityEnabled, true, '水溶必须启用产能配置')
assert.equal(waterProcess.capacityRollupMode, 'SELF', '水溶产能必须按自身汇总')
assert.equal(waterProcess.defaultDocType, 'TASK', '水溶必须默认生成任务单')
assert.equal(waterProcess.factoryMobileExecutionMode, 'FULL_TASK', '水溶必须支持工厂移动端完整任务执行')
assert.equal(waterProcess.isActive, true, '水溶工序必须启用')
assert.equal(waterProcess.description, '由 BOM 物料上的水溶要求触发', '水溶工序说明错误')
assert.equal(waterProcess.triggerSource, 'BOM 物料存在水溶要求', '水溶触发来源错误')
assert.equal(waterProcess.systemProcessCode, 'PROC_WATER_SOLUBLE', '水溶系统工序编码错误')
assert.equal(waterProcess.assignmentGranularity, 'ORDER', '水溶必须按生产单分配')
assert.equal(waterProcess.detailSplitMode, 'COMPOSITE', '水溶必须使用组合维度拆分')
assert.deepEqual(waterProcess.detailSplitDimensions, ['MATERIAL_SKU'], '水溶必须按物料 SKU 拆分明细')

assert(waterCraft, '工序工艺字典缺少 legacyValue 2000009 水溶定义')
assert.equal(waterCraft.processCode, 'WATER_SOLUBLE', '水溶工艺必须归属 WATER_SOLUBLE')
assert.equal(waterCraft.craftName, '水溶', '水溶工艺名称错误')
assert.equal(waterCraft.defaultDocType, 'TASK', '水溶工艺必须默认生成任务单')
assert.equal(waterCraft.isActive, true, '水溶工艺必须启用')
assert.equal(waterCraft.isSpecialCraft, false, '水溶不得归入特殊工艺')
assert.equal(waterCraft.systemProcessCode, 'PROC_WATER_SOLUBLE', '水溶工艺系统编码错误')
assert.equal(waterCraft.carrySuggestion, '染色厂优先', '水溶必须由染色厂优先承接')
assert.equal(waterCraft.targetObject, 'BOM_MATERIAL', '水溶目标对象必须为 BOM 物料')
assert.equal(waterCraft.targetObjectName, 'BOM物料', '水溶目标对象名称错误')
assert.equal(waterCraft.referenceOutputValueValue, 70, '水溶理论参考产值必须为 70')
assert.equal(waterCraft.referenceOutputValueUnit, 'VALUE_PER_BATCH', '水溶理论参考产值必须按批')

const waterCraftRow = getProcessCraftDictRowByCode(waterCraft.craftCode)
assert.equal(waterCraftRow?.referenceOutputValueUnitLabel, '产值/批', '水溶理论参考产值单位中文标签错误')

assert.equal(getFactorySupplyFormulaTemplate('水溶'), 'D', '水溶必须复用批次型模板 D')
const waterGuide = getFactorySupplyFormulaGuide('水溶')
assert.equal(waterGuide.template, 'D', '水溶公共产值指南必须返回模板 D')
assert(waterGuide.currentFieldKeys.includes('batchLoadCapacity'), '水溶批次型模板必须包含单次有效装载量')
assert(waterGuide.currentFieldKeys.includes('cycleMinutes'), '水溶批次型模板必须包含单次循环分钟')

const bomRows = [
  {
    id: 'BOM-WATER',
    materialCode: 'MAT-WATER-001',
    unit: '米',
    waterSolubleRequirement: '是',
    dyeRequirement: '无',
  },
  {
    id: 'BOM-BOTH',
    materialCode: 'MAT-BOTH-001',
    unit: '米',
    waterSolubleRequirement: '是',
    dyeRequirement: '匹染',
  },
  {
    id: 'BOM-DYE',
    materialCode: 'MAT-DYE-001',
    unit: '米',
    waterSolubleRequirement: '否',
    dyeRequirement: '匹染',
  },
]

const syncResult = syncPreparationProcessesFromBom([], bomRows)
const waterTechnique = syncResult.techniques.find((item) => item.processCode === 'WATER_SOLUBLE')
const dyeTechnique = syncResult.techniques.find((item) => item.processCode === 'DYE')

assert(waterTechnique, 'BOM 水溶要求必须自动生成 WATER_SOLUBLE 准备工序')
assert(dyeTechnique, 'BOM 染色要求必须自动生成 DYE 准备工序')
assert.deepEqual(
  waterTechnique.linkedBomItemIds,
  ['BOM-WATER', 'BOM-BOTH'],
  '水溶工序必须只绑定实际选择水溶的 BOM 行',
)
assert.deepEqual(
  dyeTechnique.linkedBomItemIds,
  ['BOM-BOTH', 'BOM-DYE'],
  '染色工序必须只绑定实际选择染色的 BOM 行',
)
assert(!waterTechnique.linkedBomItemIds?.includes('BOM-DYE'), '仅选择染色的物料不得误绑水溶工序')
assert(!dyeTechnique.linkedBomItemIds?.includes('BOM-WATER'), '仅选择水溶的物料不得误绑染色工序')

const normalizedRoute = normalizeProcessRouteEntries(syncResult.techniques)
const normalizedWater = normalizedRoute.find((item) => item.processCode === 'WATER_SOLUBLE')
const normalizedDye = normalizedRoute.find((item) => item.processCode === 'DYE')
assert(normalizedWater && normalizedDye, '归一化路线必须保留水溶与染色工序')
assert(
  Number(normalizedWater.routeStepNo) < Number(normalizedDye.routeStepNo),
  '同一物料同时水溶和染色时，路线必须固定先水溶、后染色',
)
const guardedRouteDraft = applyProcessRouteDraftAction({
  techniques: normalizedRoute,
  processRouteStatus: 'UNCONFIRMED',
  processRouteConfirmedBy: '',
  processRouteConfirmedAt: '',
  processRouteUpdatedBy: '',
  processRouteUpdatedAt: '',
}, { type: 'move-down', techniqueId: normalizedWater.id }, '水溶专项检查', '2026-07-11 11:00:00')
const guardedWater = guardedRouteDraft.techniques.find((item) => item.processCode === 'WATER_SOLUBLE')
const guardedDye = guardedRouteDraft.techniques.find((item) => item.processCode === 'DYE')
assert(guardedWater && guardedDye, '路线移动保护必须保留水溶与染色工序')
assert(
  Number(guardedWater.routeStepNo) < Number(guardedDye.routeStepNo),
  '不得手工交换固定的先水溶、后染色顺序',
)
assert.equal(waterTechnique.triggerField, 'waterSolubleRequirement', '水溶必须由 waterSolubleRequirement 触发')
assert.equal(waterTechnique.targetObject, 'BOM_MATERIAL', '水溶目标对象必须为 BOM 物料')
assert.equal(waterTechnique.targetObjectName, 'BOM物料', '水溶目标对象名称错误')
assert.equal(waterTechnique.defaultDocType, 'TASK', '水溶必须默认生成任务单')
assert.equal(waterTechnique.sourceType, 'BOM', '水溶必须标记为 BOM 来源')

resetTechnicalDataVersionRepository()
const technicalVersionId = 'tdv_demand_SPU_2024_001'
const baseContent = getTechnicalDataVersionContent(technicalVersionId)
assert(baseContent, '正式技术包测试基线不存在')
const processEntries = normalizedRoute.map((item) => ({
  ...item,
  stageName: item.stage,
  processName: item.process,
  craftName: item.technique,
  outputValuePerUnit: item.outputValue,
}))
updateTechnicalDataVersionContent(technicalVersionId, {
  processRouteStatus: 'CONFIRMED',
  bomItems: bomRows.map((item) => ({
    ...item,
    type: '辅料',
    name: item.materialCode,
    spec: '测试规格',
    unitConsumption: 1,
    lossRate: 0,
    supplier: '测试供应商',
    applicableSkuCodes: ['SKU-WATER-S'],
    linkedPatternIds: ['PATTERN-WATER'],
    usageProcessCodes: ['WATER_SOLUBLE', 'DYE'],
  })),
  processEntries,
})

const formalSnapshot = buildProductionOrderTechPackSnapshot({
  productionOrderId: 'PO-WATER-SNAPSHOT',
  productionOrderNo: 'PO-WATER-SNAPSHOT',
  demand: { spuCode: 'SPU-2024-001' },
  technicalVersionId,
  snapshotAt: '2026-07-11 12:00:00',
  snapshotBy: '水溶专项检查',
})
const snapshotBomBoth = formalSnapshot.bomItems.find((item) => item.id === 'BOM-BOTH')
const snapshotWaterProcess = formalSnapshot.processEntries.find((item) => item.processCode === 'WATER_SOLUBLE')
assert(snapshotBomBoth, '正式技术包快照必须保留 BOM-BOTH')
assert.equal(snapshotBomBoth.materialCode, 'MAT-BOTH-001', '正式快照必须保留 BOM 物料编码')
assert.equal(snapshotBomBoth.unit, '米', '正式快照必须保留 BOM 单位')
assert.equal(snapshotBomBoth.waterSolubleRequirement, '是', '正式快照必须保留水溶要求')
assert.deepEqual(snapshotBomBoth.applicableSkuCodes, ['SKU-WATER-S'], '正式快照必须保留适用 SKU')
assert.deepEqual(snapshotBomBoth.linkedPatternIds, ['PATTERN-WATER'], '正式快照必须保留关联纸样')
assert.deepEqual(snapshotBomBoth.usageProcessCodes, ['WATER_SOLUBLE', 'DYE'], '正式快照必须保留使用工序')
assert.deepEqual(
  snapshotWaterProcess?.linkedBomItemIds,
  ['BOM-WATER', 'BOM-BOTH'],
  '正式快照必须保留工序关联的 BOM 行',
)

console.log('water-soluble process checks passed')
