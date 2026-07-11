import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  getProcessCraftByLegacyValue,
  getProcessDefinitionByCode,
  getProcessCraftDictRowByCode,
} from '../src/data/fcs/process-craft-dict.ts'
import {
  getFactorySupplyFormulaGuide,
  getFactorySupplyFormulaTemplate,
} from '../src/data/fcs/process-craft-output-value-explainer.ts'
import {
  buildProductionOrderTechPackSnapshot,
  cloneProductionOrderTechPackSnapshot,
} from '../src/data/fcs/production-tech-pack-snapshot-builder.ts'
import {
  getTechnicalDataVersionContent,
  resetTechnicalDataVersionRepository,
  updateTechnicalDataVersionContent,
} from '../src/data/pcs-technical-data-version-repository.ts'
import {
  areRouteEntriesContinuous,
  normalizeProcessRouteEntries,
} from '../src/data/tech-pack-process-route.ts'
import { syncPreparationProcessesFromBom } from '../src/pages/tech-pack/bom-process-linkage.ts'
import { applyProcessRouteDraftAction } from '../src/pages/tech-pack/events.ts'

const printProcess = getProcessDefinitionByCode('PRINT')
const waterProcess = getProcessDefinitionByCode('WATER_SOLUBLE')
const dyeProcess = getProcessDefinitionByCode('DYE')
const waterCraft = getProcessCraftByLegacyValue(2000009)
const techPackContextSource = readFileSync('src/pages/tech-pack/context.ts', 'utf8')

assert(
  techPackContextSource.includes("targetObject?: TechnicalProcessEntry['targetObject']")
    && techPackContextSource.includes("targetObjectName?: TechnicalProcessEntry['targetObjectName']")
    && techPackContextSource.includes("triggerField?: TechnicalProcessEntry['triggerField']"),
  '页面 TechniqueItem 必须直接复用正式技术包工序类型契约',
)

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

const resyncedWater = syncPreparationProcessesFromBom([
  { ...waterTechnique, linkedBomItemIds: ['BOM-OLD'] },
], [{ id: 'BOM-BOTH', waterSolubleRequirement: '是' }])
assert.deepEqual(
  resyncedWater.techniques.find((item) => item.processCode === 'WATER_SOLUBLE')?.linkedBomItemIds,
  ['BOM-BOTH'],
  '重新同步已有水溶工序时必须覆盖为最新 BOM 绑定',
)

const removedWater = syncPreparationProcessesFromBom([waterTechnique], [
  { id: 'BOM-WATER', waterSolubleRequirement: '否' },
])
assert(!removedWater.techniques.some((item) => item.processCode === 'WATER_SOLUBLE'), '取消水溶后无人工内容的自动工序必须移除')
assert(removedWater.removedProcessCodes.includes('WATER_SOLUBLE'), '取消水溶必须记录 WATER_SOLUBLE 已移除')

const pendingWater = syncPreparationProcessesFromBom([
  { ...waterTechnique, manualNotes: '保留人工备注', hasManualOverride: true },
], [{ id: 'BOM-WATER', waterSolubleRequirement: '否' }])
const pendingWaterTechnique = pendingWater.techniques.find((item) => item.processCode === 'WATER_SOLUBLE')
assert(pendingWaterTechnique, '取消水溶但存在人工内容时不得静默删除')
assert.equal(pendingWaterTechnique.linkageStatus, '待确认', '人工维护的水溶工序必须进入待确认')
assert.equal(pendingWaterTechnique.requiresRemovalConfirmation, true, '人工维护的水溶工序必须要求删除确认')

const normalizedRoute = normalizeProcessRouteEntries(syncResult.techniques)
const normalizedWater = normalizedRoute.find((item) => item.processCode === 'WATER_SOLUBLE')
const normalizedDye = normalizedRoute.find((item) => item.processCode === 'DYE')
assert(normalizedWater && normalizedDye, '归一化路线必须保留水溶与染色工序')
assert(
  Number(normalizedWater.routeStepNo) < Number(normalizedDye.routeStepNo),
  '同一物料同时水溶和染色时，路线必须固定先水溶、后染色',
)

const reversedSharedRoute = normalizeProcessRouteEntries([
  { ...dyeTechnique, routeStepNo: 1, routeLaneNo: 1 },
  { ...waterTechnique, routeStepNo: 2, routeLaneNo: 1 },
])
const reversedSharedWater = reversedSharedRoute.find((item) => item.processCode === 'WATER_SOLUBLE')
const reversedSharedDye = reversedSharedRoute.find((item) => item.processCode === 'DYE')
assert(reversedSharedWater && reversedSharedDye, '倒序路线归一化必须保留水溶与染色')
assert(reversedSharedWater.routeStepNo < reversedSharedDye.routeStepNo, '共享 BOM 时通用归一化必须修正倒序路线')

const parallelPartner = {
  ...dyeTechnique,
  id: 'TECH-PARALLEL-PARTNER',
  processCode: 'PRINT',
  process: '印花',
  technique: '印花',
  linkedBomItemIds: ['BOM-PRINT'],
}
const sharedParallelRoute = normalizeProcessRouteEntries([
  { ...waterTechnique, routeStepNo: 1, routeLaneNo: 1, routeParallelGroupId: 'GROUP-1', routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED' },
  { ...dyeTechnique, routeStepNo: 1, routeLaneNo: 2, routeParallelGroupId: 'GROUP-1' },
  { ...parallelPartner, routeStepNo: 1, routeLaneNo: 3, routeParallelGroupId: 'GROUP-1' },
])
const parallelWater = sharedParallelRoute.find((item) => item.processCode === 'WATER_SOLUBLE')
const parallelDye = sharedParallelRoute.find((item) => item.processCode === 'DYE')
const normalizedPartner = sharedParallelRoute.find((item) => item.id === parallelPartner.id)
assert(parallelWater && parallelDye && normalizedPartner, '并行路线归一化必须保留原工序')
assert.equal(parallelWater.routeStepNo, 1, '共享 BOM 的并行水溶必须拆为前一独立步骤')
assert.equal(parallelWater.routeLaneNo, 1, '拆出的水溶必须为独立路线 lane 1')
assert.equal(parallelWater.routeParallelGroupId, undefined, '拆出的水溶不得保留并行组')
assert.equal(parallelWater.routeParallelAcceptanceMode, 'INDEPENDENT_ONLY', '拆出的水溶必须恢复独立承接模式')
assert.equal(parallelDye.routeStepNo, 2, '共享 BOM 的染色必须保留在后一组')
assert.equal(normalizedPartner.routeStepNo, 2, '染色原并行伙伴必须保留在后一组')
assert.deepEqual(
  [parallelDye.routeLaneNo, normalizedPartner.routeLaneNo].sort((left, right) => left - right),
  [1, 2],
  '染色及原并行伙伴 lane 必须连续',
)

const unrelatedReversedRoute = normalizeProcessRouteEntries([
  { ...dyeTechnique, linkedBomItemIds: ['BOM-DYE'], routeStepNo: 1, routeLaneNo: 1 },
  { ...waterTechnique, linkedBomItemIds: ['BOM-WATER'], routeStepNo: 2, routeLaneNo: 1 },
])
assert.equal(unrelatedReversedRoute[0]?.processCode, 'DYE', '无共享 BOM 时必须保留原 DYE / WATER_SOLUBLE 相对顺序')
assert.equal(unrelatedReversedRoute[1]?.processCode, 'WATER_SOLUBLE', '无共享 BOM 时不得强制重排不同物料工序')
const unrelatedMovedDraft = applyProcessRouteDraftAction({
  techniques: [
    { ...waterTechnique, linkedBomItemIds: ['BOM-WATER'], routeStepNo: 1, routeLaneNo: 1 },
    { ...dyeTechnique, linkedBomItemIds: ['BOM-DYE'], routeStepNo: 2, routeLaneNo: 1 },
  ],
  processRouteStatus: 'UNCONFIRMED',
  processRouteConfirmedBy: '',
  processRouteConfirmedAt: '',
  processRouteUpdatedBy: '',
  processRouteUpdatedAt: '',
}, { type: 'move-down', techniqueId: waterTechnique.id }, '水溶专项检查', '2026-07-11 11:05:00')
assert.equal(unrelatedMovedDraft.techniques[0]?.processCode, 'DYE', '无共享 BOM 时页面路线动作不得被固定顺序保护误拦截')

const multiSharedRoute = normalizeProcessRouteEntries([
  { ...waterTechnique, id: 'WATER-A', linkedBomItemIds: ['BOM-A'], routeStepNo: 1, routeLaneNo: 1 },
  { ...dyeTechnique, id: 'DYE-A', linkedBomItemIds: ['BOM-A'], routeStepNo: 2, routeLaneNo: 1 },
  { ...dyeTechnique, id: 'DYE-B', linkedBomItemIds: ['BOM-B'], routeStepNo: 3, routeLaneNo: 1 },
  { ...waterTechnique, id: 'WATER-B', linkedBomItemIds: ['BOM-B'], routeStepNo: 4, routeLaneNo: 1 },
])
const multiRouteStep = (id: string) => multiSharedRoute.find((item) => item.id === id)?.routeStepNo ?? 0
assert(multiRouteStep('WATER-A') < multiRouteStep('DYE-A'), '多组共享关系中第一组必须保持先水溶、后染色')
assert(multiRouteStep('WATER-B') < multiRouteStep('DYE-B'), '多组共享关系中后续倒序组也必须被修正')

const crossedParallelRoute = normalizeProcessRouteEntries([
  {
    ...dyeTechnique,
    id: 'CROSS-DYE-A',
    linkedBomItemIds: ['BOM-A'],
    routeStepNo: 1,
    routeLaneNo: 1,
    routeParallelGroupId: 'CROSS-G1',
    routeParallelGroupName: '交叉组 1',
  },
  {
    ...waterTechnique,
    id: 'CROSS-WATER-B',
    linkedBomItemIds: ['BOM-B'],
    routeStepNo: 1,
    routeLaneNo: 2,
    routeParallelGroupId: 'CROSS-G1',
    routeParallelGroupName: '交叉组 1',
  },
  {
    ...dyeTechnique,
    id: 'CROSS-DYE-B',
    linkedBomItemIds: ['BOM-B'],
    routeStepNo: 2,
    routeLaneNo: 1,
    routeParallelGroupId: 'CROSS-G2',
    routeParallelGroupName: '交叉组 2',
  },
  {
    ...waterTechnique,
    id: 'CROSS-WATER-A',
    linkedBomItemIds: ['BOM-A'],
    routeStepNo: 2,
    routeLaneNo: 2,
    routeParallelGroupId: 'CROSS-G2',
    routeParallelGroupName: '交叉组 2',
  },
])
const crossedStep = (id: string) => crossedParallelRoute.find((item) => item.id === id)?.routeStepNo ?? 0
assert(crossedStep('CROSS-WATER-A') < crossedStep('CROSS-DYE-A'), '交叉依赖 A 必须保证先水溶、后染色')
assert(crossedStep('CROSS-WATER-B') < crossedStep('CROSS-DYE-B'), '交叉依赖 B 必须保证先水溶、后染色')
const crossedSteps = [...new Set(crossedParallelRoute.map((item) => item.routeStepNo))].sort((left, right) => left - right)
assert.deepEqual(crossedSteps, crossedSteps.map((_, index) => index + 1), '交叉依赖归一化后的步骤号必须连续')
for (const stepNo of crossedSteps) {
  const lanes = crossedParallelRoute
    .filter((item) => item.routeStepNo === stepNo)
    .map((item) => item.routeLaneNo)
    .sort((left, right) => left - right)
  assert.deepEqual(lanes, lanes.map((_, index) => index + 1), `交叉依赖第 ${stepNo} 步 lane 必须连续`)
}
for (const bomId of ['BOM-A', 'BOM-B']) {
  const waterStep = crossedParallelRoute.find(
    (item) => item.processCode === 'WATER_SOLUBLE' && item.linkedBomItemIds?.includes(bomId),
  )?.routeStepNo ?? 0
  const dyeStep = crossedParallelRoute.find(
    (item) => item.processCode === 'DYE' && item.linkedBomItemIds?.includes(bomId),
  )?.routeStepNo ?? 0
  assert(waterStep > 0 && dyeStep > 0 && waterStep < dyeStep, `交叉依赖归一化不得静默保留 ${bomId} 非法路线`)
}

const laterSharedRoute = normalizeProcessRouteEntries([
  { ...dyeTechnique, id: 'DYE-NO-SHARE', linkedBomItemIds: ['BOM-NO-SHARE'], routeStepNo: 1, routeLaneNo: 1 },
  { ...dyeTechnique, id: 'DYE-LATER', linkedBomItemIds: ['BOM-LATER'], routeStepNo: 2, routeLaneNo: 1 },
  { ...waterTechnique, id: 'WATER-LATER', linkedBomItemIds: ['BOM-LATER'], routeStepNo: 3, routeLaneNo: 1 },
])
const laterWaterStep = laterSharedRoute.find((item) => item.id === 'WATER-LATER')?.routeStepNo ?? 0
const laterDyeStep = laterSharedRoute.find((item) => item.id === 'DYE-LATER')?.routeStepNo ?? 0
assert(laterWaterStep < laterDyeStep, '首个染色不共享水溶时仍必须继续修正后续共享倒序组')

const pairOnlyParallelRoute = normalizeProcessRouteEntries([
  {
    ...waterTechnique,
    id: 'WATER-PAIR-ONLY',
    linkedBomItemIds: ['BOM-PAIR'],
    routeStepNo: 1,
    routeLaneNo: 1,
    routeParallelGroupId: 'PAIR-GROUP',
    routeParallelGroupName: '水溶染色并行组',
    routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED',
  },
  {
    ...dyeTechnique,
    id: 'DYE-PAIR-ONLY',
    linkedBomItemIds: ['BOM-PAIR'],
    routeStepNo: 1,
    routeLaneNo: 2,
    routeParallelGroupId: 'PAIR-GROUP',
    routeParallelGroupName: '水溶染色并行组',
    routeParallelAcceptanceMode: 'WHOLE_GROUP_ALLOWED',
  },
])
const pairOnlyWater = pairOnlyParallelRoute.find((item) => item.id === 'WATER-PAIR-ONLY')
const pairOnlyDye = pairOnlyParallelRoute.find((item) => item.id === 'DYE-PAIR-ONLY')
assert(pairOnlyWater && pairOnlyDye, '仅水溶与染色并行拆分必须保留两条工序')
assert.equal(pairOnlyWater.routeStepNo, 1, '仅两项并行拆分后水溶必须为第一步')
assert.equal(pairOnlyDye.routeStepNo, 2, '仅两项并行拆分后染色必须为第二步')
for (const item of [pairOnlyWater, pairOnlyDye]) {
  assert.equal(item.routeParallelGroupId, undefined, '拆分后的单项步骤不得残留并行组 ID')
  assert.equal(item.routeParallelGroupName, undefined, '拆分后的单项步骤不得残留并行组名称')
  assert.equal(item.routeParallelAcceptanceMode, 'INDEPENDENT_ONLY', '拆分后的单项步骤必须恢复独立承接')
}
assert.equal(
  areRouteEntriesContinuous(pairOnlyParallelRoute).allowed,
  true,
  '仅水溶与染色拆分后的连续路线必须允许连续承接',
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

const confirmedReversedDraft = applyProcessRouteDraftAction({
  techniques: [
    { ...dyeTechnique, routeStepNo: 1, routeLaneNo: 1 },
    { ...waterTechnique, routeStepNo: 2, routeLaneNo: 1 },
  ],
  processRouteStatus: 'UNCONFIRMED',
  processRouteConfirmedBy: '',
  processRouteConfirmedAt: '',
  processRouteUpdatedBy: '',
  processRouteUpdatedAt: '',
}, { type: 'confirm' }, '水溶专项检查', '2026-07-11 11:10:00')
const confirmedReversedWater = confirmedReversedDraft.techniques.find((item) => item.processCode === 'WATER_SOLUBLE')
const confirmedReversedDye = confirmedReversedDraft.techniques.find((item) => item.processCode === 'DYE')
assert(confirmedReversedWater && confirmedReversedDye, '确认倒序草稿必须保留水溶与染色')
assert(confirmedReversedWater.routeStepNo < confirmedReversedDye.routeStepNo, '确认动作必须修正共享 BOM 的倒序路线')

const confirmedParallelDraft = applyProcessRouteDraftAction({
  techniques: [
    { ...waterTechnique, routeStepNo: 1, routeLaneNo: 1, routeParallelGroupId: 'GROUP-1' },
    { ...dyeTechnique, routeStepNo: 1, routeLaneNo: 2, routeParallelGroupId: 'GROUP-1' },
    { ...parallelPartner, routeStepNo: 1, routeLaneNo: 3, routeParallelGroupId: 'GROUP-1' },
  ],
  processRouteStatus: 'UNCONFIRMED',
  processRouteConfirmedBy: '',
  processRouteConfirmedAt: '',
  processRouteUpdatedBy: '',
  processRouteUpdatedAt: '',
}, { type: 'confirm' }, '水溶专项检查', '2026-07-11 11:20:00')
const confirmedParallelWater = confirmedParallelDraft.techniques.find((item) => item.processCode === 'WATER_SOLUBLE')
const confirmedParallelDye = confirmedParallelDraft.techniques.find((item) => item.processCode === 'DYE')
assert(confirmedParallelWater && confirmedParallelDye, '确认并行草稿必须保留水溶与染色')
assert(confirmedParallelWater.routeStepNo < confirmedParallelDye.routeStepNo, '确认动作必须拆开共享 BOM 的水溶染色并行')
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

updateTechnicalDataVersionContent(technicalVersionId, {
  bomItems: baseContent.bomItems.map((item) => ({
    ...item,
    materialCode: 'MAT-SOURCE-CHANGED',
    unit: '千克',
    waterSolubleRequirement: '否',
    applicableSkuCodes: ['SKU-SOURCE-CHANGED'],
  })),
  processEntries: processEntries.map((item) => ({
    ...item,
    linkedBomItemIds: ['BOM-SOURCE-CHANGED'],
  })),
})
assert.equal(snapshotBomBoth.materialCode, 'MAT-BOTH-001', '修改源 content 后既有正式快照物料编码不得变化')
assert.equal(snapshotBomBoth.unit, '米', '修改源 content 后既有正式快照单位不得变化')
assert.equal(snapshotBomBoth.waterSolubleRequirement, '是', '修改源 content 后既有正式快照水溶要求不得变化')
assert.deepEqual(snapshotWaterProcess?.linkedBomItemIds, ['BOM-WATER', 'BOM-BOTH'], '修改源 content 后快照工序绑定不得变化')

const runtimeCopyOne = cloneProductionOrderTechPackSnapshot(formalSnapshot)
const runtimeCopyTwo = cloneProductionOrderTechPackSnapshot(formalSnapshot)
assert(runtimeCopyOne && runtimeCopyTwo, '正式快照运行时副本必须可读取')
const runtimeCopyBom = runtimeCopyOne.bomItems.find((item) => item.id === 'BOM-BOTH')
const runtimeCopyProcess = runtimeCopyOne.processEntries.find((item) => item.processCode === 'WATER_SOLUBLE')
assert(runtimeCopyBom && runtimeCopyProcess, '运行时副本必须保留水溶 BOM 与工序')
runtimeCopyBom.materialCode = 'MAT-RUNTIME-MUTATED'
runtimeCopyBom.unit = '件'
runtimeCopyBom.waterSolubleRequirement = '否'
runtimeCopyBom.applicableSkuCodes?.push('SKU-RUNTIME-MUTATED')
runtimeCopyProcess.linkedBomItemIds?.push('BOM-RUNTIME-MUTATED')
const runtimeCopyTwoBom = runtimeCopyTwo.bomItems.find((item) => item.id === 'BOM-BOTH')
const runtimeCopyTwoProcess = runtimeCopyTwo.processEntries.find((item) => item.processCode === 'WATER_SOLUBLE')
assert.equal(runtimeCopyTwoBom?.materialCode, 'MAT-BOTH-001', '修改一次运行时副本不得污染下一次读取的物料编码')
assert.equal(runtimeCopyTwoBom?.unit, '米', '修改一次运行时副本不得污染下一次读取的单位')
assert.equal(runtimeCopyTwoBom?.waterSolubleRequirement, '是', '修改一次运行时副本不得污染下一次读取的水溶要求')
assert.deepEqual(runtimeCopyTwoBom?.applicableSkuCodes, ['SKU-WATER-S'], '运行时 BOM 数组字段必须隔离')
assert.deepEqual(runtimeCopyTwoProcess?.linkedBomItemIds, ['BOM-WATER', 'BOM-BOTH'], '运行时工序 BOM 绑定数组必须隔离')

console.log('water-soluble process checks passed')
