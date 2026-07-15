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
import { productionOrders, type ProductionOrder } from '../src/data/fcs/production-orders.ts'
import {
  getFactoryMasterRecordById,
  removeFactoryMasterRecord,
  upsertFactoryMasterRecord,
} from '../src/data/fcs/factory-master-store.ts'
import { getProcessTaskQtyDisplayUnit } from '../src/data/fcs/process-tasks.ts'
import { buildTaskQrValue } from '../src/data/fcs/task-qr.ts'
import type { ProductionOrderTechPackSnapshot } from '../src/data/fcs/production-tech-pack-snapshot-types.ts'
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
import {
  WATER_SOLUBLE_STATUS_LABEL,
  assignWaterSolubleFactory,
  canAssignWaterSolubleFactory,
  completeWaterSoluble,
  getWaterSolubleCurrentAction,
  getWaterSolubleWorkOrderById,
  getWaterSolubleWorkOrderByTaskId,
  listWaterSolubleMobileTasks,
  listWaterSolubleWorkOrders,
  mapWaterSolubleQtyUnit,
  markWaterSolubleMaterialReady,
  resetWaterSolubleDomainForChecks,
  resolveWaterSolublePause,
  resolveWaterSolubleReceiptDifference,
  startWaterSoluble,
  submitWaterSolubleHandover,
  syncWaterSolubleOrderStoreWithArtifacts,
  writeBackWaterSolubleReceipt,
} from '../src/data/fcs/water-soluble-task-domain.ts'
import { listPrepProcessOrders, listPrepRequirementDemands } from '../src/data/fcs/page-adapters/process-prep-pages-adapter.ts'
import { getProcessWorkOrderById } from '../src/data/fcs/process-work-order-domain.ts'
import { buildPreparationOutputs } from '../src/data/fcs/production-preparation-timing.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import { listHandoverOrdersByTaskId } from '../src/data/fcs/pda-handover-events.ts'
import { getMobileExecutionTaskById } from '../src/data/fcs/mobile-execution-task-index.ts'
import {
  createDyeWorkOrderFromStock,
  completeDyeing,
  completeDyeMaterialReady,
  completeDyeNode,
  completeDyeWaterSolubleNode,
  getDyeExecutionNodeRecord,
  getDyeExecutionRoute,
  getDyeWorkOrderById,
  getDyeWorkOrderByTaskId,
  listDyeWorkOrders,
  planDyeVat,
  registerFormalProductionOrderDyeWorkOrder,
  resolveDyeWaterSolublePause,
  startDyeing,
  startDyeNode,
  startDyeWaterSolubleNode,
  submitDyeHandover,
  validateDyeStartPrerequisite,
} from '../src/data/fcs/dyeing-task-domain.ts'
import { listFactoryOnboardingApplications } from '../src/data/fcs/factory-onboarding-store.ts'
import { listProcessWorkOrderStockMaterials } from '../src/data/fcs/process-work-order-stock.ts'
import {
  getFactoryCapacityProfileByFactoryId,
  listFactoryCapacityEquipments,
} from '../src/data/fcs/factory-capacity-profile-mock.ts'

const printProcess = getProcessDefinitionByCode('PRINT')
const waterProcess = getProcessDefinitionByCode('WATER_SOLUBLE')
const dyeProcess = getProcessDefinitionByCode('DYE')
const waterCraft = getProcessCraftByLegacyValue(2000009)
const techPackContextSource = readFileSync('src/pages/tech-pack/context.ts', 'utf8')
const productionArtifactGeneration = await import('../src/data/fcs/production-artifact-generation.ts')

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

const allBomMaterialTypes = ['面料', '辅料', '包装材料', '其他'] as const
const allTypeBomRows = allBomMaterialTypes.map((type, index) => ({
  id: `BOM-TYPE-${index + 1}`,
  type,
  materialCode: `MAT-TYPE-${index + 1}`,
  waterSolubleRequirement: '是',
  dyeRequirement: '无',
}))
const allTypeWaterTechnique = syncPreparationProcessesFromBom([], allTypeBomRows)
  .techniques.find((item) => item.processCode === 'WATER_SOLUBLE')
assert(allTypeWaterTechnique, '所有 BOM 物料类型选择水溶后都必须生成水溶工序')
assert.deepEqual(
  allTypeWaterTechnique.linkedBomItemIds,
  allTypeBomRows.map((item) => item.id),
  '面料、辅料、包装材料和其他物料必须全部可选择水溶，不得按物料类型过滤',
)

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

const { generateProductionArtifactsForOrder } = productionArtifactGeneration
const sourceOrder = productionOrders[0]
assert(sourceOrder, 'BOM 物料级产物检查必须存在真实生产单基线')

const draftOnlyOrder: ProductionOrder = {
  ...sourceOrder,
  productionOrderId: 'PO-WATER-DRAFT-ONLY',
  productionOrderNo: 'PO-WATER-DRAFT-ONLY',
  selectedTechPackVersionId: '',
  techPackSnapshot: undefined,
}
productionOrders.push(draftOnlyOrder)
try {
  assert.deepEqual(
    generateProductionArtifactsForOrder(draftOnlyOrder.productionOrderId),
    [],
    '仅维护草稿 BOM、未冻结正式技术包快照时，真实生产拆解入口不得生成水溶或染色产物',
  )
} finally {
  const draftOrderIndex = productionOrders.indexOf(draftOnlyOrder)
  if (draftOrderIndex >= 0) productionOrders.splice(draftOrderIndex, 1)
}

const artifactOrder: ProductionOrder = {
  ...sourceOrder,
  productionOrderId: 'PO-WATER-ARTIFACT',
  productionOrderNo: 'PO-WATER-ARTIFACT',
  selectedTechPackVersionId: formalSnapshot.sourceTechPackVersionId,
  demandSnapshot: {
    ...sourceOrder.demandSnapshot,
    skuLines: [
      { skuCode: 'SKU-WATER-S', size: 'S', color: '黑色', qty: 400 },
      { skuCode: 'SKU-WATER-M', size: 'M', color: '黑色', qty: 600 },
    ],
  },
}
const artifactBomRows: ProductionOrderTechPackSnapshot['bomItems'] = [
  {
    id: 'ONLY-WATER',
    type: '辅料',
    name: '仅水溶花边',
    spec: '10 毫米',
    materialCode: 'MAT-ONLY-WATER',
    unit: '米',
    unitConsumption: 1,
    lossRate: 5,
    supplier: '测试供应商',
    waterSolubleRequirement: '是',
    dyeRequirement: '无',
    applicableSkuCodes: [],
  },
  {
    id: 'ONLY-DYE',
    type: '辅料',
    name: '仅染色花边',
    spec: '12 毫米',
    materialCode: 'MAT-ONLY-DYE',
    unit: '米',
    unitConsumption: 1,
    lossRate: 5,
    supplier: '测试供应商',
    waterSolubleRequirement: '否',
    dyeRequirement: '匹染',
    applicableSkuCodes: ['SKU-WATER-S'],
  },
  {
    id: 'BOTH',
    type: '辅料',
    name: '水溶染色花边',
    spec: '15 毫米',
    materialCode: 'MAT-BOTH',
    unit: '米',
    unitConsumption: 1,
    lossRate: 5,
    supplier: '测试供应商',
    waterSolubleRequirement: '是',
    dyeRequirement: '匹染',
    applicableSkuCodes: ['SKU-WATER-M'],
  },
  {
    id: 'NONE',
    type: '辅料',
    name: '无需准备加工花边',
    spec: '8 毫米',
    materialCode: 'MAT-NONE',
    unit: '米',
    unitConsumption: 1,
    lossRate: 5,
    supplier: '测试供应商',
    waterSolubleRequirement: '否',
    dyeRequirement: '无',
    applicableSkuCodes: [],
  },
]
const waterArtifactEntry = {
  ...waterTechnique,
  id: 'ENTRY-WATER-ARTIFACT',
  stageName: waterTechnique.stage,
  processName: waterTechnique.process,
  craftName: waterTechnique.technique,
  linkedBomItemIds: artifactBomRows.map((item) => item.id),
}
const dyeArtifactEntry = {
  ...dyeTechnique,
  id: 'ENTRY-DYE-ARTIFACT',
  stageName: dyeTechnique.stage,
  processName: dyeTechnique.process,
  craftName: dyeTechnique.technique,
  linkedBomItemIds: artifactBomRows.map((item) => item.id),
}
const artifactSnapshot: ProductionOrderTechPackSnapshot = {
  ...formalSnapshot,
  snapshotId: 'SNAP-WATER-ARTIFACT',
  sourceTechPackVersionId: 'VERSION-A',
  productionOrderId: artifactOrder.productionOrderId,
  productionOrderNo: artifactOrder.productionOrderNo,
  bomItems: artifactBomRows,
  processEntries: [waterArtifactEntry, dyeArtifactEntry],
}

function generateArtifactFixture(
  snapshot = artifactSnapshot,
  demandSnapshot = artifactOrder.demandSnapshot,
) {
  const temporaryOrder: ProductionOrder = {
    ...artifactOrder,
    selectedTechPackVersionId: snapshot.sourceTechPackVersionId,
    techPackSnapshot: snapshot,
    demandSnapshot,
  }
  productionOrders.push(temporaryOrder)
  try {
    return generateProductionArtifactsForOrder(temporaryOrder.productionOrderId)
  } finally {
    const temporaryOrderIndex = productionOrders.indexOf(temporaryOrder)
    if (temporaryOrderIndex >= 0) productionOrders.splice(temporaryOrderIndex, 1)
  }
}

const bomArtifacts = generateArtifactFixture()
const waterArtifacts = bomArtifacts.filter((item) => item.processCode === 'WATER_SOLUBLE')
const dyeArtifacts = bomArtifacts.filter((item) => item.processCode === 'DYE')
assert.equal(waterArtifacts.filter((item) => item.artifactType === 'DEMAND').length, 0, '水溶不得生成需求单')
assert.equal(waterArtifacts.length, 1, '仅水溶 BOM 行必须恰好生成一个独立 WATER_SOLUBLE TASK')
assert.equal(waterArtifacts[0]?.artifactType, 'TASK', '仅水溶产物必须是 TASK')
assert.equal(waterArtifacts[0]?.bomItemId, 'ONLY-WATER', '水溶任务必须绑定仅水溶 BOM 行')
assert.equal(waterArtifacts[0]?.taskTypeCode, 'WATER_SOLUBLE', '水溶任务类型编码错误')
assert.equal(waterArtifacts[0]?.taskTypeLabel, '水溶', '水溶任务类型名称错误')
assert.equal(waterArtifacts[0]?.taskScope, 'EXTERNAL_TASK', '水溶任务必须为外部任务')
assert.equal(dyeArtifacts.length, 2, '仅染色与水溶染色 BOM 行必须各生成一个 DYE DEMAND')

const onlyDyeArtifact = dyeArtifacts.find((item) => item.bomItemId === 'ONLY-DYE')
assert(onlyDyeArtifact && onlyDyeArtifact.artifactType === 'DEMAND', '仅染色 BOM 行必须生成普通 DYE DEMAND')
assert.equal(onlyDyeArtifact.requiresWaterSoluble, false, '仅染色需求不得标记需要水溶')
assert.deepEqual(onlyDyeArtifact.processRoute, ['DYE'], '仅染色需求路线必须只有染色')
const bothArtifact = dyeArtifacts.find((item) => item.bomItemId === 'BOTH')
assert(bothArtifact && bothArtifact.artifactType === 'DEMAND', '水溶染色 BOM 行必须生成一个 DYE DEMAND')
assert.equal(bothArtifact.requiresWaterSoluble, true, '水溶染色需求必须标记需要水溶')
assert.deepEqual(bothArtifact.processRoute, ['WATER_SOLUBLE', 'DYE'], '水溶染色需求路线必须固定先水溶后染色')
assert.equal(waterArtifacts.filter((item) => item.bomItemId === 'BOTH').length, 0, '水溶染色同一 BOM 行不得另生成水溶任务')
assert.equal(bomArtifacts.filter((item) => item.bomItemId === 'NONE').length, 0, '均未选择的 BOM 行不得生成准备产物')

const expectedByBomId = new Map(artifactBomRows.map((item) => [item.id, item]))
for (const artifact of bomArtifacts) {
  const bomItem = expectedByBomId.get(artifact.bomItemId ?? '')
  assert(bomItem, `产物 ${artifact.artifactId} 必须精确对应当前 BOM 行`)
  assert.equal(artifact.materialCode, bomItem.materialCode, '产物物料编码必须来自当前 BOM 行')
  assert.equal(artifact.materialName, bomItem.name, '产物物料名称必须来自当前 BOM 行')
  assert.equal(artifact.plannedUnit, bomItem.unit, '产物计划单位必须保留当前 BOM 单位')
  assert.deepEqual(artifact.linkedBomItemIds, [bomItem.id], '产物只能绑定当前 BOM 行，不得跨物料组合')
}
assert.equal(waterArtifacts[0]?.plannedQty, 1050, '全部 SKU 1000 件、单耗 1、损耗率 5% 时计划数量必须为 1050 米')
assert.equal(onlyDyeArtifact.plannedQty, 420, '只适用 SKU-WATER-S 时必须按 400 件计算，不得使用整单 1000 件')
assert.equal(bothArtifact.plannedQty, 630, '不同 BOM 行必须按自身适用 SKU 计算，不得与其他行误组合')

const repeatedBomArtifacts = generateArtifactFixture()
assert.deepEqual(
  repeatedBomArtifacts.map((item) => item.artifactId),
  bomArtifacts.map((item) => item.artifactId),
  '同一正式快照重复生成必须保持 artifactId 顺序与数量稳定，且不得状态累加',
)
const nextSnapshotArtifacts = generateArtifactFixture({
  ...artifactSnapshot,
  snapshotId: artifactSnapshot.snapshotId,
  sourceTechPackVersionId: 'VERSION-B',
})
assert.notDeepEqual(
  nextSnapshotArtifacts.map((item) => item.artifactId),
  bomArtifacts.map((item) => item.artifactId),
  '同一生产单 snapshotId 固定时，正式技术包版本变化后 BOM 物料级 artifactId 必须变化',
)

function generateWithProcessEntries(processEntries: ProductionOrderTechPackSnapshot['processEntries']) {
  return generateArtifactFixture({ ...artifactSnapshot, processEntries })
}

const craftDyeArtifacts = generateWithProcessEntries([{
  ...dyeArtifactEntry,
  id: 'ENTRY-DYE-CRAFT',
  entryType: 'CRAFT',
  linkedBomItemIds: ['ONLY-DYE'],
}])
assert.equal(craftDyeArtifacts.filter((item) => item.processCode === 'DYE').length, 0, 'CRAFT DYE 不得生成 BOM 染色需求')

const nonPrepDyeArtifacts = generateWithProcessEntries([{
  ...dyeArtifactEntry,
  id: 'ENTRY-DYE-NON-PREP',
  stageCode: 'PROD',
  stageName: '生产阶段',
  linkedBomItemIds: ['ONLY-DYE'],
}])
assert.equal(nonPrepDyeArtifacts.filter((item) => item.processCode === 'DYE').length, 0, '非 PREP DYE 不得生成 BOM 染色需求')

const taskDyeArtifacts = generateWithProcessEntries([{
  ...dyeArtifactEntry,
  id: 'ENTRY-DYE-TASK',
  defaultDocType: 'TASK',
  linkedBomItemIds: ['ONLY-DYE'],
}])
assert.equal(taskDyeArtifacts.filter((item) => item.processCode === 'DYE').length, 0, 'defaultDocType TASK 的 DYE 不得生成 BOM 染色需求')

const validDyeArtifacts = generateWithProcessEntries([{
  ...dyeArtifactEntry,
  id: 'ENTRY-DYE-VALID',
  linkedBomItemIds: ['ONLY-DYE'],
}])
assert.equal(validDyeArtifacts.filter((item) => item.processCode === 'DYE').length, 1, '合法 PREP/DEMAND DYE 必须生成 BOM 染色需求')

const duplicateArtifacts = generateWithProcessEntries([
  { ...waterArtifactEntry, id: 'ENTRY-WATER-FIRST', linkedBomItemIds: ['ONLY-WATER'] },
  { ...waterArtifactEntry, id: 'ENTRY-WATER-SECOND', linkedBomItemIds: ['ONLY-WATER'] },
  { ...dyeArtifactEntry, id: 'ENTRY-DYE-FIRST', linkedBomItemIds: ['ONLY-DYE'] },
  { ...dyeArtifactEntry, id: 'ENTRY-DYE-SECOND', linkedBomItemIds: ['ONLY-DYE'] },
])
const dedupedWaterArtifacts = duplicateArtifacts.filter((item) => item.processCode === 'WATER_SOLUBLE')
const dedupedDyeArtifacts = duplicateArtifacts.filter((item) => item.processCode === 'DYE')
assert.equal(dedupedWaterArtifacts.length, 1, '同一 BOM 的多条合法 WATER entry 最终只能生成一张任务')
assert.equal(dedupedWaterArtifacts[0]?.sourceEntryId, 'ENTRY-WATER-FIRST', '重复 WATER 必须稳定保留第一条路线 entry')
assert.equal(dedupedDyeArtifacts.length, 1, '同一 BOM 的多条合法 DYE entry 最终只能生成一张需求')
assert.equal(dedupedDyeArtifacts[0]?.sourceEntryId, 'ENTRY-DYE-FIRST', '重复 DYE 必须稳定保留第一条路线 entry')

const printEntry = {
  ...dyeArtifactEntry,
  id: 'ENTRY-PRINT-LEGACY',
  processCode: 'PRINT',
  processName: '印花',
  linkedBomItemIds: undefined,
}
const legacyDyeEntry = {
  ...dyeArtifactEntry,
  id: 'ENTRY-DYE-LEGACY',
  linkedBomItemIds: undefined,
}
const postEntry = {
  ...waterArtifactEntry,
  id: 'ENTRY-POST-LEGACY',
  stageCode: 'POST',
  stageName: '后道阶段',
  processCode: 'POST_FINISHING',
  processName: '后道',
  defaultDocType: 'TASK',
  linkedBomItemIds: undefined,
}
const legacyArtifacts = generateWithProcessEntries([printEntry, legacyDyeEntry, postEntry])
const legacyPrintArtifact = legacyArtifacts.find((item) => item.artifactType === 'DEMAND' && item.processCode === 'PRINT')
const legacyDyeArtifact = legacyArtifacts.find((item) => item.artifactType === 'DEMAND' && item.processCode === 'DYE' && !item.bomItemId)
assert(legacyPrintArtifact, 'PRINT legacy 入口必须继续生成原需求产物')
assert(legacyDyeArtifact, '无 BOM DYE legacy 入口必须继续生成原需求产物')
assert.equal(legacyPrintArtifact.artifactId, 'DEMART-PO-WATER-ARTIFACT-ENTRY-PRINT-LEGACY', 'PRINT legacy artifactId 不得变化')
assert.equal(legacyDyeArtifact.artifactId, 'DEMART-PO-WATER-ARTIFACT-ENTRY-DYE-LEGACY', '无 BOM DYE legacy artifactId 不得变化')
assert(legacyArtifacts.some((item) => item.artifactType === 'TASK' && item.processCode === 'POST_FINISHING'), '其他工序入口必须继续生成原任务产物')

const collisionBomB = { ...artifactBomRows[1], id: 'B', materialCode: 'MAT-B' }
const collisionBomAB = { ...artifactBomRows[1], id: 'A-B', materialCode: 'MAT-A-B' }
const collisionSnapshot = {
  ...artifactSnapshot,
  bomItems: [collisionBomB, collisionBomAB],
  processEntries: [
    { ...dyeArtifactEntry, id: 'DYE-A', linkedBomItemIds: ['B'] },
    { ...dyeArtifactEntry, id: 'DYE', linkedBomItemIds: ['A-B'] },
  ],
}
const collisionArtifacts = generateArtifactFixture(collisionSnapshot)
assert.equal(collisionArtifacts.length, 2, '碰撞反例必须保留两张不同 BOM 需求')
assert.notEqual(collisionArtifacts[0]?.artifactId, collisionArtifacts[1]?.artifactId, 'entry DYE-A/B 与 DYE/A-B 的 artifactId 必须无歧义')

const slashBom = { ...artifactBomRows[1], id: 'BOM/A', materialCode: 'MAT-SLASH' }
const colonBom = { ...artifactBomRows[1], id: 'BOM:A', materialCode: 'MAT-COLON' }
const punctuationArtifacts = generateArtifactFixture({
  ...artifactSnapshot,
  bomItems: [slashBom, colonBom],
  processEntries: [{ ...dyeArtifactEntry, id: 'ENTRY-DYE-PUNCTUATION', linkedBomItemIds: ['BOM/A', 'BOM:A'] }],
})
assert.equal(punctuationArtifacts.length, 2, '不同标点 BOM ID 必须保留两张需求')
assert.notEqual(punctuationArtifacts[0]?.artifactId, punctuationArtifacts[1]?.artifactId, 'BOM/A 与 BOM:A 的 artifactId 必须不同')

const invalidNoneBom = {
  ...artifactBomRows[3],
  applicableSkuCodes: ['SKU-NOT-FOUND'],
  unitConsumption: Number.NaN,
  lossRate: -1,
}
let ignoredNoneArtifacts = bomArtifacts
assert.doesNotThrow(() => {
  ignoredNoneArtifacts = generateArtifactFixture({
    ...artifactSnapshot,
    bomItems: [artifactBomRows[0], artifactBomRows[1], invalidNoneBom],
    processEntries: [
      { ...waterArtifactEntry, id: 'ENTRY-WATER-WITH-NONE', linkedBomItemIds: ['ONLY-WATER', 'NONE'] },
      { ...dyeArtifactEntry, id: 'ENTRY-DYE-WITH-NONE', linkedBomItemIds: ['ONLY-DYE', 'NONE'] },
    ],
  })
}, '残留关联的 NONE BOM 即使数量字段无效也不得阻断正式拆解')
assert.equal(ignoredNoneArtifacts.filter((item) => item.bomItemId === 'NONE').length, 0, 'NONE BOM 必须保持 0 产物')
assert.equal(ignoredNoneArtifacts.filter((item) => item.bomItemId === 'ONLY-WATER').length, 1, 'NONE BOM 不得影响其他合法水溶任务')
assert.equal(ignoredNoneArtifacts.filter((item) => item.bomItemId === 'ONLY-DYE').length, 1, 'NONE BOM 不得影响其他合法染色需求')

function assertInvalidQuantity(
  bomOverrides: Partial<ProductionOrderTechPackSnapshot['bomItems'][number]>,
  expectedReason: RegExp,
  skuLines = artifactOrder.demandSnapshot.skuLines,
) {
  const invalidBom = { ...artifactBomRows[1], id: 'INVALID-QTY', name: '异常数量物料', ...bomOverrides }
  const invalidSnapshot = {
    ...artifactSnapshot,
    bomItems: [invalidBom],
    processEntries: [{ ...dyeArtifactEntry, id: 'ENTRY-DYE-INVALID-QTY', linkedBomItemIds: [invalidBom.id] }],
  }
  assert.throws(
    () => generateArtifactFixture(invalidSnapshot, { ...artifactOrder.demandSnapshot, skuLines }),
    expectedReason,
  )
}

assertInvalidQuantity({ applicableSkuCodes: ['SKU-NOT-FOUND'] }, /BOM INVALID-QTY.*适用 SKU.*生产数量/)
assertInvalidQuantity({}, /BOM INVALID-QTY.*SKU SKU-WATER-S.*有限数/, [
  { ...artifactOrder.demandSnapshot.skuLines[0], qty: Number.NaN },
  artifactOrder.demandSnapshot.skuLines[1],
])
assertInvalidQuantity({}, /BOM INVALID-QTY.*SKU SKU-WATER-S.*大于等于 0/, [
  { ...artifactOrder.demandSnapshot.skuLines[0], qty: -1 },
  artifactOrder.demandSnapshot.skuLines[1],
])
assertInvalidQuantity({ unitConsumption: 0 }, /BOM INVALID-QTY.*单位用量.*大于 0/)
assertInvalidQuantity({ unitConsumption: -1 }, /BOM INVALID-QTY.*单位用量.*大于 0/)
assertInvalidQuantity({ unitConsumption: Number.NaN }, /BOM INVALID-QTY.*单位用量.*有限数/)
assertInvalidQuantity({ unit: '   ' }, /BOM INVALID-QTY.*数量单位.*不能为空/)
assertInvalidQuantity({ lossRate: -1 }, /BOM INVALID-QTY.*损耗率.*大于等于 0/)
assertInvalidQuantity({ lossRate: Number.NaN }, /BOM INVALID-QTY.*损耗率.*有限数/)
assertInvalidQuantity({ unitConsumption: Number.MAX_VALUE / 2, lossRate: 0 }, /BOM INVALID-QTY.*计划数量.*有限数/, [
  { ...artifactOrder.demandSnapshot.skuLines[0], qty: 1 },
])
assertInvalidQuantity({ unitConsumption: 0.0004, lossRate: 0 }, /BOM INVALID-QTY.*计划数量.*大于 0/, [
  { ...artifactOrder.demandSnapshot.skuLines[0], qty: 1 },
])
const zeroLossArtifacts = generateArtifactFixture({
  ...artifactSnapshot,
  bomItems: [{ ...artifactBomRows[1], id: 'ZERO-LOSS', lossRate: 0 }],
  processEntries: [{ ...dyeArtifactEntry, id: 'ENTRY-DYE-ZERO-LOSS', linkedBomItemIds: ['ZERO-LOSS'] }],
})
assert.equal(zeroLossArtifacts[0]?.plannedQty, 400, '0% 损耗必须允许并正确生成计划数量')

const expectedWaterStatuses = {
  WAIT_FACTORY_ASSIGNMENT: '待分配染厂',
  WAIT_MATERIAL: '待原料',
  WAIT_WATER_SOLUBLE: '待水溶',
  WATER_SOLUBLE_IN_PROGRESS: '水溶中',
  PRODUCTION_PAUSED: '生产暂停',
  WAIT_HANDOVER: '待交出',
  HANDOVER_WAIT_RECEIVE: '交出待收货',
  RECEIPT_DIFFERENCE: '收货差异',
  DONE: '已完成',
} as const
assert.deepEqual(WATER_SOLUBLE_STATUS_LABEL, expectedWaterStatuses, '水溶加工单状态中文标签必须完整且稳定')

const allGeneratedWaterTaskArtifacts = productionArtifactGeneration.listGeneratedProductionTaskArtifacts().filter(
  (item) => item.artifactType === 'TASK' && item.processCode === 'WATER_SOLUBLE',
)
const isDictionaryCoverageArtifact = (artifact: { artifactId: string; sourceEntryId: string }) =>
  artifact.artifactId.startsWith('DICT-') || artifact.sourceEntryId.startsWith('DICT-MOCK-')
const generatedWaterTaskArtifacts = allGeneratedWaterTaskArtifacts.filter(
  (artifact) => !isDictionaryCoverageArtifact(artifact),
)
assert(generatedWaterTaskArtifacts.length > 0, '必须存在来自正式技术包 BOM 的非 DICT WATER_SOLUBLE TASK 演示产物')
generatedWaterTaskArtifacts.forEach((artifact) => {
  assert(artifact.bomItemId, `水溶产物 ${artifact.artifactId} 缺少 BOM 行`)
  assert(artifact.materialCode?.trim(), `水溶产物 ${artifact.artifactId} 缺少物料编码`)
  assert(artifact.materialName?.trim(), `水溶产物 ${artifact.artifactId} 缺少物料名称`)
  assert(Number.isFinite(artifact.plannedQty) && (artifact.plannedQty ?? 0) > 0, `水溶产物 ${artifact.artifactId} 缺少有效计划数量`)
  assert(artifact.plannedUnit?.trim(), `水溶产物 ${artifact.artifactId} 缺少计划单位`)
  assert.deepEqual(artifact.linkedBomItemIds, [artifact.bomItemId], `水溶产物 ${artifact.artifactId} 必须精确关联当前 BOM 行`)
})
productionArtifactGeneration.listGeneratedProductionTaskArtifacts()
  .filter((artifact) => artifact.artifactId.startsWith('DICT-') && artifact.processCode !== 'WATER_SOLUBLE')
  .forEach((artifact) => {
    const mockIndexMatch = artifact.sourceEntryId.match(/-(\d{2})-/)
    assert(mockIndexMatch, `字典覆盖产物 ${artifact.artifactId} 缺少稳定 mockIndex`)
    const source = productionArtifactGeneration.getDictionaryCraftMockSource(
      artifact.craftCode || '',
      Number(mockIndexMatch[1]) - 1,
    )
    const firstBomItemId = source?.snapshot.bomItems[0]?.id
    assert.deepEqual(
      artifact.linkedBomItemIds,
      firstBomItemId ? [firstBomItemId] : undefined,
      `非水溶字典覆盖产物 ${artifact.artifactId} 必须保持首个 BOM 行行为`,
    )
  })

resetWaterSolubleDomainForChecks()
const firstWaterOrders = listWaterSolubleWorkOrders()
assert.equal(firstWaterOrders.length, generatedWaterTaskArtifacts.length, '每条有效 WATER_SOLUBLE TASK 产物必须投影且不得追加伪造加工单')
assert(
  firstWaterOrders.every((item) => !isDictionaryCoverageArtifact({
    artifactId: item.sourceArtifactId,
    sourceEntryId: allGeneratedWaterTaskArtifacts.find((artifact) => artifact.artifactId === item.sourceArtifactId)?.sourceEntryId ?? '',
  })),
  '水溶加工单的 sourceArtifactId 必须全部来自非 DICT 正式产物',
)
assert(firstWaterOrders.every((item) => item.sourceDemandIds.length === 0), '水溶加工单不得生成或关联需求单')
assert(firstWaterOrders.every((item) => item.processCode === 'WATER_SOLUBLE'), '水溶加工单必须只消费 WATER_SOLUBLE TASK 产物')
firstWaterOrders.forEach((order) => {
  const artifact = generatedWaterTaskArtifacts.find((item) => item.artifactId === order.sourceArtifactId)
  assert(artifact, `加工单 ${order.waterOrderId} 缺少来源 WATER_SOLUBLE TASK 产物`)
  assert.equal(order.bomItemId, artifact.bomItemId, '加工单 BOM 行必须原样复制来源产物')
  assert.equal(order.materialCode, artifact.materialCode, '加工单物料编码必须原样复制来源产物')
  assert.equal(order.materialName, artifact.materialName, '加工单物料名称必须原样复制来源产物')
  assert.equal(order.plannedQty, artifact.plannedQty, '加工单计划数量必须原样复制来源产物')
  assert.equal(order.qtyUnit, artifact.plannedUnit, '加工单计划单位必须原样复制来源产物')
  const productionOrder = productionOrders.find((item) => item.productionOrderId === order.productionOrderId)
  const formalSnapshot = productionOrder?.techPackSnapshot
  assert(formalSnapshot, `加工单 ${order.waterOrderId} 缺少正式技术包快照`)
  assert.equal(order.techPackVersionId, formalSnapshot.sourceTechPackVersionId, '加工单版本必须固定为产物对应正式快照版本')
  const sourceBomItem = formalSnapshot.bomItems.find((item) => item.id === order.bomItemId)
  assert(sourceBomItem, `加工单 ${order.waterOrderId} 无法反查正式快照 BOM ${order.bomItemId}`)
  assert.equal(sourceBomItem.waterSolubleRequirement, '是', '独立水溶加工单来源 BOM 必须选择水溶')
  assert.equal(sourceBomItem.dyeRequirement, '无', '独立水溶加工单来源 BOM 必须不需染色')
  assert(Number.isFinite(order.plannedQty) && order.plannedQty > 0, '独立水溶加工单必须保留完整计划数量')
  assert(order.qtyUnit.trim(), '独立水溶加工单必须保留 BOM 单位')
})
assert(firstWaterOrders.some((item) => item.status === 'WAIT_FACTORY_ASSIGNMENT'), '必须包含待分配染厂场景')
assert.equal(new Set(firstWaterOrders.map((item) => item.generationKey)).size, firstWaterOrders.length, 'generationKey 必须唯一')
const firstOrderIds = firstWaterOrders.map((item) => item.waterOrderId)
const firstOrderQty = firstWaterOrders.map((item) => item.plannedQty)
const repeatedWaterOrders = listWaterSolubleWorkOrders()
assert.deepEqual(repeatedWaterOrders.map((item) => item.waterOrderId), firstOrderIds, '重复 list 的加工单 ID 必须稳定')
assert.deepEqual(repeatedWaterOrders.map((item) => item.plannedQty), firstOrderQty, '重复 list 不得累加计划数量')

const cloneProbe = firstWaterOrders[0]
assert(cloneProbe, '缺少 clone 隔离测试加工单')
cloneProbe.sourceDemandIds.push('SHOULD-NOT-PERSIST')
cloneProbe.actionLogs.push({ action: '篡改', detail: '篡改', at: 'now' })
const cloneProbeAgain = getWaterSolubleWorkOrderById(cloneProbe.waterOrderId)
assert(cloneProbeAgain, '加工单 ID 查询失败')
assert.deepEqual(cloneProbeAgain.sourceDemandIds, [], 'sourceDemandIds 必须深拷贝')
assert(!cloneProbeAgain.actionLogs.some((item) => item.action === '篡改'), 'actionLogs 必须深拷贝')
assert.equal(getWaterSolubleWorkOrderByTaskId(cloneProbe.taskId)?.waterOrderId, cloneProbe.waterOrderId, '任务 ID 必须可反查加工单')
assert.equal(getWaterSolubleCurrentAction(cloneProbe.waterOrderId)?.actionCode, 'ASSIGN_FACTORY', '当前动作必须由加工单状态稳定派生')

const mobileTasks = listWaterSolubleMobileTasks()
assert.equal(mobileTasks.length, firstWaterOrders.length, '每张水溶加工单必须生成一条稳定移动任务')
assert(mobileTasks.every((item) => item.processCode === 'PROC_WATER_SOLUBLE'), '移动任务系统工序编码必须为 PROC_WATER_SOLUBLE')
assert(mobileTasks.every((item) => item.processNameZh === '水溶'), '移动任务中文工序名必须为水溶')
assert(mobileTasks.every((item) => ['PIECE', 'BUNDLE', 'METER'].includes(item.qtyUnit)), '移动任务必须映射到现有 QtyUnit')
assert(mobileTasks.every((item) => item.sourceQtyUnit), '移动任务必须保留原计划单位')
assert.deepEqual(listWaterSolubleMobileTasks().map((item) => item.taskId), mobileTasks.map((item) => item.taskId), '移动任务 ID 必须稳定')
assert.equal(mapWaterSolubleQtyUnit('米'), 'METER', '米必须映射为 METER')
assert.equal(mapWaterSolubleQtyUnit('Yard'), 'METER', 'Yard 必须映射为 METER')
assert.equal(mapWaterSolubleQtyUnit('卷'), 'BUNDLE', '卷必须映射为 BUNDLE')
assert.equal(mapWaterSolubleQtyUnit('公斤'), 'BUNDLE', '公斤必须映射为 BUNDLE')
assert.equal(mapWaterSolubleQtyUnit('件'), 'PIECE', '件必须映射为 PIECE')
assert.equal(mapWaterSolubleQtyUnit('未知单位'), 'BUNDLE', '未知单位不得默认显示成件')
assert.equal(getProcessTaskQtyDisplayUnit({ qtyUnit: 'BUNDLE', qtyDisplayUnit: '公斤' }), '公斤', '移动任务必须优先显示精确 BOM 单位')
assert(mobileTasks.every((item) => item.qtyDisplayUnit === item.sourceQtyUnit), '水溶移动任务必须把原 BOM 单位写入精确显示单位')

assert.equal(canAssignWaterSolubleFactory('ID-F002').ok, false, '只有染色能力、没有水溶能力的启用工厂必须拦截')
assert.match(canAssignWaterSolubleFactory('ID-F002').message, /水溶能力/, '无水溶能力原因必须使用中文说明')
assert.equal(canAssignWaterSolubleFactory('F090').ok, true, '具备水溶能力的染厂必须允许分配')
const factoryCapabilityBase = getFactoryMasterRecordById('F090')
assert(factoryCapabilityBase, '缺少工厂能力资格测试基线')
const legacyWaterCapability = {
  processCode: 'WATER_SOLUBLE',
  processName: '水溶',
  craftCode: 'CRAFT_2000009',
  craftName: '水溶',
  abilityScope: 'CRAFT' as const,
  canReceiveTask: true,
  capacityManaged: true,
  remark: '历史兼容能力',
}
const capabilityFactoryIds = [
  'CHECK-WATER-INACTIVE',
  'CHECK-WATER-NO-DISPATCH',
  'CHECK-WATER-ABILITY-DISABLED',
  'CHECK-WATER-ABILITY-NO-RECEIVE',
  'CHECK-WATER-LEGACY-FALLBACK',
]
try {
  upsertFactoryMasterRecord({ ...factoryCapabilityBase, id: capabilityFactoryIds[0], code: capabilityFactoryIds[0], status: 'inactive' })
  upsertFactoryMasterRecord({
    ...factoryCapabilityBase,
    id: capabilityFactoryIds[1],
    code: capabilityFactoryIds[1],
    eligibility: { ...factoryCapabilityBase.eligibility, allowDispatch: false },
  })
  upsertFactoryMasterRecord({
    ...factoryCapabilityBase,
    id: capabilityFactoryIds[2],
    code: capabilityFactoryIds[2],
    processAbilities: factoryCapabilityBase.processAbilities.map((ability) =>
      ability.processCode === 'WATER_SOLUBLE' ? { ...ability, status: 'DISABLED' as const } : ability,
    ),
    selectedCapabilities: [legacyWaterCapability],
  })
  upsertFactoryMasterRecord({
    ...factoryCapabilityBase,
    id: capabilityFactoryIds[3],
    code: capabilityFactoryIds[3],
    processAbilities: factoryCapabilityBase.processAbilities.map((ability) =>
      ability.processCode === 'WATER_SOLUBLE' ? { ...ability, canReceiveTask: false } : ability,
    ),
    selectedCapabilities: [legacyWaterCapability],
  })
  upsertFactoryMasterRecord({
    ...factoryCapabilityBase,
    id: capabilityFactoryIds[4],
    code: capabilityFactoryIds[4],
    processAbilities: [],
    selectedCapabilities: [legacyWaterCapability],
  })
  assert.equal(canAssignWaterSolubleFactory(capabilityFactoryIds[0]).ok, false, '停用工厂不得分配水溶加工单')
  assert.equal(canAssignWaterSolubleFactory(capabilityFactoryIds[1]).ok, false, '禁止派单工厂不得分配水溶加工单')
  assert.equal(canAssignWaterSolubleFactory(capabilityFactoryIds[2]).ok, false, '正式水溶能力停用时不得被旧能力覆盖')
  assert.equal(canAssignWaterSolubleFactory(capabilityFactoryIds[3]).ok, false, '正式水溶能力不可接单时不得被旧能力覆盖')
  assert.equal(canAssignWaterSolubleFactory(capabilityFactoryIds[4]).ok, true, '缺少正式能力数据时允许使用历史 selectedCapabilities')
} finally {
  capabilityFactoryIds.forEach(removeFactoryMasterRecord)
}
const waterFactoryProfile = getFactoryCapacityProfileByFactoryId('F090')
assert(waterFactoryProfile.capabilityItems.some((item) => item.processCode === 'WATER_SOLUBLE'), '水溶能力必须投影到工厂产能档案 capabilityItems')
const waterEquipment = listFactoryCapacityEquipments('F090').find((item) =>
  item.abilityList.some((ability) => ability.processCode === 'WATER_SOLUBLE'),
)
assert(waterEquipment, '水溶能力必须生成产能设备能力档案')
assert.equal(waterEquipment.equipmentType, 'GENERAL', '水溶不得新增专用设备类型')
assert(waterEquipment.abilityList.some((item) => item.processCode === 'WATER_SOLUBLE' && item.efficiencyUnit === '批/分钟'), '水溶产能参考单位必须为批/分钟')
const waterOnboarding = listFactoryOnboardingApplications().find((item) =>
  item.selectedCapabilities.some((capability) => capability.processCode === 'WATER_SOLUBLE'),
)
assert(waterOnboarding, '入驻 Mock 必须覆盖水溶能力')
assert.equal(waterOnboarding.primaryFactoryType, 'DYEING_FACTORY', '水溶能力必须归类为染厂能力')

resetWaterSolubleDomainForChecks()
const workflowOrder = listWaterSolubleWorkOrders().find((item) => item.status === 'WAIT_FACTORY_ASSIGNMENT')
assert(workflowOrder, '缺少待分配染厂加工单')
assert.equal(startWaterSoluble(workflowOrder.waterOrderId).ok, false, '未分厂不得直接开工')
assert.match(startWaterSoluble(workflowOrder.waterOrderId).message, /当前状态/, '非法状态动作必须返回中文原因')
assert.equal(assignWaterSolubleFactory(workflowOrder.waterOrderId, 'ID-F002').ok, false, '不得分配无水溶能力染厂')
const assigned = assignWaterSolubleFactory(workflowOrder.waterOrderId, 'F090')
assert.equal(assigned.ok, true, '具备水溶能力染厂应分配成功')
assert.equal(assigned.order?.status, 'WAIT_MATERIAL', '分配染厂后必须待原料')
assert.equal(assignWaterSolubleFactory(workflowOrder.waterOrderId, 'F090').ok, false, '重复分配必须明确失败')
assert.equal(markWaterSolubleMaterialReady(workflowOrder.waterOrderId).order?.status, 'WAIT_WATER_SOLUBLE', '原料就绪后必须待水溶')
assert.equal(markWaterSolubleMaterialReady(workflowOrder.waterOrderId).ok, false, '重复确认原料必须明确失败')
assert.equal(startWaterSoluble(workflowOrder.waterOrderId).order?.status, 'WATER_SOLUBLE_IN_PROGRESS', '开工后必须水溶中')
assert.equal(startWaterSoluble(workflowOrder.waterOrderId).ok, false, '重复开工必须明确失败')
const plannedQty = getWaterSolubleWorkOrderById(workflowOrder.waterOrderId)?.plannedQty ?? 0
assert.equal(completeWaterSoluble(workflowOrder.waterOrderId, Number.NaN).ok, false, '完成数量非有限数必须阻断')
assert.equal(completeWaterSoluble(workflowOrder.waterOrderId, 0).ok, false, '零产出未填原因必须阻断')
assert.equal(completeWaterSoluble(workflowOrder.waterOrderId, plannedQty + 1).ok, false, '超计划且无原因必须阻断')
assert.equal(completeWaterSoluble(workflowOrder.waterOrderId, plannedQty).order?.status, 'WAIT_HANDOVER', '按计划完成后必须待交出')
assert.equal(completeWaterSoluble(workflowOrder.waterOrderId, plannedQty).ok, false, '重复完工必须明确失败')
assert.equal(submitWaterSolubleHandover(workflowOrder.waterOrderId, 1).ok, false, '本期不支持绕过批准数量做部分交出')
assert.equal(submitWaterSolubleHandover(workflowOrder.waterOrderId, plannedQty + 1).ok, false, '交出数量不得超过完成数量')
assert.equal(submitWaterSolubleHandover(workflowOrder.waterOrderId, plannedQty).order?.status, 'HANDOVER_WAIT_RECEIVE', '交出后必须等待收货')
assert.equal(submitWaterSolubleHandover(workflowOrder.waterOrderId, plannedQty).ok, false, '重复交出必须明确失败')
assert.equal(writeBackWaterSolubleReceipt(workflowOrder.waterOrderId, plannedQty).order?.status, 'DONE', '收货数量一致必须完成')
assert.equal(writeBackWaterSolubleReceipt(workflowOrder.waterOrderId, plannedQty).ok, false, '重复收货回写必须明确失败')

resetWaterSolubleDomainForChecks()
const zeroOutputOrder = listWaterSolubleWorkOrders().find((item) => item.status === 'WAIT_FACTORY_ASSIGNMENT')!
assignWaterSolubleFactory(zeroOutputOrder.waterOrderId, 'F090')
markWaterSolubleMaterialReady(zeroOutputOrder.waterOrderId)
startWaterSoluble(zeroOutputOrder.waterOrderId)
assert.equal(completeWaterSoluble(zeroOutputOrder.waterOrderId, 0).ok, false, '零产出无原因必须保持水溶中')
const zeroOutputPaused = completeWaterSoluble(zeroOutputOrder.waterOrderId, 0, '本批物料全部破损')
assert.equal(zeroOutputPaused.order?.status, 'PRODUCTION_PAUSED', '零产出有原因必须进入生产暂停')
assert.equal(zeroOutputPaused.order?.completedQty, 0, '生产暂停必须保留实际零产出事实')
assert.equal(resolveWaterSolublePause(zeroOutputOrder.waterOrderId, 'CONTINUE_WITH_ACTUAL_QTY').ok, false, '零产出不得按实际数量继续交出')
assert.equal(getWaterSolubleWorkOrderById(zeroOutputOrder.waterOrderId)?.status, 'PRODUCTION_PAUSED', '拒绝零数量交出后不得改变暂停状态')

resetWaterSolubleDomainForChecks()
const overPlanOrder = listWaterSolubleWorkOrders().find((item) => item.status === 'WAIT_FACTORY_ASSIGNMENT')!
assignWaterSolubleFactory(overPlanOrder.waterOrderId, 'F090')
markWaterSolubleMaterialReady(overPlanOrder.waterOrderId)
startWaterSoluble(overPlanOrder.waterOrderId)
assert.equal(
  completeWaterSoluble(overPlanOrder.waterOrderId, overPlanOrder.plannedQty + 1, '现场确认多完成 1 件').order?.status,
  'WAIT_HANDOVER',
  '超计划填写原因后允许按实际完成量进入待交出',
)

resetWaterSolubleDomainForChecks()
const pauseOrder = listWaterSolubleWorkOrders().find((item) => item.status === 'WAIT_FACTORY_ASSIGNMENT')!
assignWaterSolubleFactory(pauseOrder.waterOrderId, 'F090')
markWaterSolubleMaterialReady(pauseOrder.waterOrderId)
startWaterSoluble(pauseOrder.waterOrderId)
assert.equal(completeWaterSoluble(pauseOrder.waterOrderId, pauseOrder.plannedQty - 3).ok, false, '不足计划量且无原因必须阻断')
assert.equal(getWaterSolubleWorkOrderById(pauseOrder.waterOrderId)?.status, 'WATER_SOLUBLE_IN_PROGRESS', '不足无原因不得改变状态')
assert.equal(completeWaterSoluble(pauseOrder.waterOrderId, pauseOrder.plannedQty - 3, '物料破损').order?.status, 'PRODUCTION_PAUSED', '不足有原因必须生产暂停')
assert.equal(resolveWaterSolublePause(pauseOrder.waterOrderId, 'CONTINUE_PROCESSING').order?.status, 'WAIT_WATER_SOLUBLE', '继续加工必须回到待水溶')
startWaterSoluble(pauseOrder.waterOrderId)
const backwardComplete = completeWaterSoluble(pauseOrder.waterOrderId, pauseOrder.plannedQty - 4, '错误倒退数量')
assert.equal(backwardComplete.ok, false, '继续补做时累计完成数量不得倒退')
assert.match(backwardComplete.message, /累计完成数量/, '累计数量倒退必须返回中文原因')
assert.equal(getWaterSolubleWorkOrderById(pauseOrder.waterOrderId)?.status, 'WATER_SOLUBLE_IN_PROGRESS', '累计数量倒退不得改变状态')
assert.equal(getWaterSolubleWorkOrderById(pauseOrder.waterOrderId)?.completedQty, pauseOrder.plannedQty - 3, '累计数量倒退不得改变已有完成量')
assert.equal(completeWaterSoluble(pauseOrder.waterOrderId, pauseOrder.plannedQty - 2, '物料仍不足').order?.status, 'PRODUCTION_PAUSED', '继续补做仍不足时必须再次暂停')
assert.equal(resolveWaterSolublePause(pauseOrder.waterOrderId, 'CONTINUE_PROCESSING').order?.status, 'WAIT_WATER_SOLUBLE', '再次继续加工必须回到待水溶')
startWaterSoluble(pauseOrder.waterOrderId)
assert.equal(completeWaterSoluble(pauseOrder.waterOrderId, pauseOrder.plannedQty).order?.status, 'WAIT_HANDOVER', '累计补足计划量后必须待交出')

resetWaterSolubleDomainForChecks()
const continueActualOrder = listWaterSolubleWorkOrders().find((item) => item.status === 'WAIT_FACTORY_ASSIGNMENT')!
assignWaterSolubleFactory(continueActualOrder.waterOrderId, 'F090')
markWaterSolubleMaterialReady(continueActualOrder.waterOrderId)
startWaterSoluble(continueActualOrder.waterOrderId)
completeWaterSoluble(continueActualOrder.waterOrderId, continueActualOrder.plannedQty - 2, '按实际数量结束')
const continueActual = resolveWaterSolublePause(continueActualOrder.waterOrderId, 'CONTINUE_WITH_ACTUAL_QTY')
assert.equal(continueActual.order?.status, 'WAIT_HANDOVER', '按实际数量继续必须待交出')
assert.equal(continueActual.order?.handoverQty, continueActualOrder.plannedQty - 2, '按实际数量继续时批准交出量必须等于累计实际完成量')
assert.equal(submitWaterSolubleHandover(continueActualOrder.waterOrderId, 1).ok, false, '按实际数量批准后也不得部分交出')
assert.equal(submitWaterSolubleHandover(continueActualOrder.waterOrderId, continueActualOrder.plannedQty - 2).ok, true, '批准数量必须可以完整交出')

resetWaterSolubleDomainForChecks()
const syncBaseIds = new Set(listWaterSolubleWorkOrders().map((item) => item.waterOrderId))
const syncProductionOrderId = 'PO-WATER-SYNC-CHECK'
const syncSnapshot: ProductionOrderTechPackSnapshot = {
  ...artifactSnapshot,
  snapshotId: 'SNAP-WATER-SYNC-CHECK',
  productionOrderId: syncProductionOrderId,
  productionOrderNo: syncProductionOrderId,
  sourceTechPackVersionId: 'VERSION-WATER-SYNC-CHECK',
  bomItems: [{ ...artifactBomRows[0], unit: '公斤', unitConsumption: 1 }],
  processEntries: [{ ...waterArtifactEntry, linkedBomItemIds: ['ONLY-WATER'] }],
}
const syncProductionOrder: ProductionOrder = {
  ...artifactOrder,
  productionOrderId: syncProductionOrderId,
  productionOrderNo: syncProductionOrderId,
  selectedTechPackVersionId: syncSnapshot.sourceTechPackVersionId,
  techPackSnapshot: syncSnapshot,
}
productionOrders.push(syncProductionOrder)
let syncedOrderId = ''
try {
  syncWaterSolubleOrderStoreWithArtifacts()
  const syncedOrder = listWaterSolubleWorkOrders().find((item) => item.productionOrderId === syncProductionOrderId)
  assert(syncedOrder, '新增有效物料产物后必须同步新增水溶加工单')
  syncedOrderId = syncedOrder.waterOrderId
  assert(!syncBaseIds.has(syncedOrder.waterOrderId), '同步新增不得复用无关加工单身份')
  syncProductionOrder.selectedTechPackVersionId = 'UNPUBLISHED-DRAFT-X'
  syncWaterSolubleOrderStoreWithArtifacts()
  assert.equal(
    getWaterSolubleWorkOrderById(syncedOrder.waterOrderId)?.techPackVersionId,
    syncSnapshot.sourceTechPackVersionId,
    '未派厂加工单切换未发布草稿后也必须继续引用产物对应正式快照版本',
  )
  assert.equal(assignWaterSolubleFactory(syncedOrder.waterOrderId, 'F090').order?.status, 'WAIT_MATERIAL', '同步测试加工单必须可进入执行态')
  syncWaterSolubleOrderStoreWithArtifacts()
  const preservedSyncedOrder = getWaterSolubleWorkOrderById(syncedOrder.waterOrderId)
  assert.equal(preservedSyncedOrder?.status, 'WAIT_MATERIAL', '相同 generationKey 同步不得重置既有执行状态')
  assert.equal(preservedSyncedOrder?.factoryId, 'F090', '相同 generationKey 同步不得清理已分配工厂')
  assert((preservedSyncedOrder?.actionLogs.length ?? 0) > 1, '相同 generationKey 同步不得清理动作日志')
  syncProductionOrder.selectedTechPackVersionId = 'VERSION-WATER-SYNC-NEW-DRAFT'
  syncWaterSolubleOrderStoreWithArtifacts()
  const preservedAfterNewVersion = getWaterSolubleWorkOrderById(syncedOrder.waterOrderId)
  assert.equal(preservedAfterNewVersion?.status, 'WAIT_MATERIAL', '发布或选择新技术包版本不得改变已按旧正式快照生成的加工单状态')
  assert.equal(preservedAfterNewVersion?.techPackVersionId, syncSnapshot.sourceTechPackVersionId, '既有加工单必须继续引用旧正式快照版本')
  assert.equal(preservedAfterNewVersion?.factoryId, 'F090', '新技术包版本不得清理既有加工单派厂事实')
} finally {
  const syncOrderIndex = productionOrders.indexOf(syncProductionOrder)
  if (syncOrderIndex >= 0) productionOrders.splice(syncOrderIndex, 1)
}
syncWaterSolubleOrderStoreWithArtifacts()
assert.equal(getWaterSolubleWorkOrderById(syncedOrderId), null, '来源产物消失后必须移除对应水溶加工单')
resetWaterSolubleDomainForChecks()
const reworkOrder = listWaterSolubleWorkOrders().find((item) => item.status === 'WAIT_FACTORY_ASSIGNMENT')!
assignWaterSolubleFactory(reworkOrder.waterOrderId, 'F090')
markWaterSolubleMaterialReady(reworkOrder.waterOrderId)
startWaterSoluble(reworkOrder.waterOrderId)
completeWaterSoluble(reworkOrder.waterOrderId, reworkOrder.plannedQty - 1, '需要返工')
const rework = resolveWaterSolublePause(reworkOrder.waterOrderId, 'RETURN_FOR_REWORK')
assert.equal(rework.order?.status, 'WAIT_WATER_SOLUBLE', '返工必须回到待水溶')
assert.equal(rework.order?.completedQty, 0, '返工必须清理本次完成量')

resetWaterSolubleDomainForChecks()
const differenceOrder = listWaterSolubleWorkOrders().find((item) => item.status === 'WAIT_FACTORY_ASSIGNMENT')!
assignWaterSolubleFactory(differenceOrder.waterOrderId, 'F090')
markWaterSolubleMaterialReady(differenceOrder.waterOrderId)
startWaterSoluble(differenceOrder.waterOrderId)
completeWaterSoluble(differenceOrder.waterOrderId, differenceOrder.plannedQty)
submitWaterSolubleHandover(differenceOrder.waterOrderId, differenceOrder.plannedQty)
assert.equal(writeBackWaterSolubleReceipt(differenceOrder.waterOrderId, differenceOrder.plannedQty - 1).order?.status, 'RECEIPT_DIFFERENCE', '收货数量不同必须进入差异')
assert.equal(resolveWaterSolubleReceiptDifference(differenceOrder.waterOrderId).order?.status, 'DONE', '确认收货差异后必须完成')

const defaultCombinedDyeDemand = listPrepRequirementDemands('DYE')
  .find((item) => item.requiresWaterSoluble && item.processRoute.join('>') === 'WATER_SOLUBLE>DYE')
assert(defaultCombinedDyeDemand, '默认正式技术包快照必须持续提供一条同 BOM 水溶加染色需求')
assert.equal(defaultCombinedDyeDemand.demandId, 'RSXQ0260308101', '默认联合染色业务需求 ID 必须保持稳定')
const defaultCombinedArtifact = productionArtifactGeneration.listGeneratedProductionDemandArtifacts()
  .find((item) => item.artifactId === defaultCombinedDyeDemand.sourceArtifactId)
assert(defaultCombinedArtifact, '页面业务需求必须保留可追踪的底层产物 ID')
assert.equal(
  productionArtifactGeneration.buildProductionDemandBusinessId('RSXQ', defaultCombinedArtifact),
  defaultCombinedDyeDemand.demandId,
  'artifact 到业务需求 ID 必须复用共享稳定契约',
)
assert.equal(
  productionArtifactGeneration.buildProductionDemandBusinessId('RSXQ', { ...defaultCombinedArtifact, sortKey: '模拟列表换序', generationSortKey: '模拟列表换序' }),
  defaultCombinedDyeDemand.demandId,
  '业务需求 ID 不得依赖 artifact 当前列表顺序',
)
assert.notEqual(
  productionArtifactGeneration.buildProductionDemandBusinessId('RSXQ', { ...defaultCombinedArtifact, artifactId: `${defaultCombinedArtifact.artifactId}-NEW-VERSION` }),
  defaultCombinedDyeDemand.demandId,
  '同生产单同 BOM 的新 artifact/version 必须生成不同业务需求 ID',
)
const allDemandBusinessIds = productionArtifactGeneration.listGeneratedProductionDemandArtifacts()
  .map((artifact) => productionArtifactGeneration.buildProductionDemandBusinessId('DEMAND-', artifact))
assert.equal(new Set(allDemandBusinessIds).size, allDemandBusinessIds.length, '全量需求 artifact 的业务需求 ID 不得碰撞')
const defaultCombinedDyeOrder = listDyeWorkOrders()
  .find((item) => item.requiresWaterSoluble && item.sourceProductionOrderId === defaultCombinedDyeDemand.sourceProductionOrderId)
assert(defaultCombinedDyeOrder, 'PFOS 默认染色列表必须持续展示同一条含水溶染色加工单')
assert.equal(defaultCombinedDyeOrder.sourceType, 'PRODUCTION_ORDER', 'PFOS 默认染色详情来源必须归一为生产单')
assert.equal(defaultCombinedDyeOrder.sourceProductionOrderId, defaultCombinedDyeDemand.sourceProductionOrderId, 'PFOS 默认染色详情必须保留唯一生产单来源')
assert.equal(getProcessWorkOrderById(defaultCombinedDyeOrder.dyeOrderId)?.sourceProductionOrderId, defaultCombinedDyeDemand.sourceProductionOrderId, 'PFOS 统一加工单详情必须显示同一生产单来源')
assert.deepEqual(getProcessWorkOrderById(defaultCombinedDyeOrder.dyeOrderId)?.sourceArtifactIds, [defaultCombinedDyeDemand.sourceArtifactId], 'PFOS 统一加工单详情必须另行保留底层产物追踪 ID')
const defaultCombinedFcsOrder = listPrepProcessOrders('DYE')
  .find((item) => item.workOrderId === defaultCombinedDyeOrder.dyeOrderId)
assert(defaultCombinedFcsOrder, 'FCS 默认染色加工单列表必须读取同一条含水溶染色加工单')
assert.equal(defaultCombinedFcsOrder.taskId, defaultCombinedDyeOrder.taskId, 'FCS 与 PFOS 必须绑定同一 PDA 任务')
assert.equal(defaultCombinedFcsOrder.sourceProductionOrderId, defaultCombinedDyeDemand.sourceProductionOrderId, 'FCS 加工单必须使用同一生产单来源')
assert(defaultCombinedFcsOrder.sourceSummary.includes(defaultCombinedDyeDemand.sourceProductionOrderId), 'FCS 来源摘要必须显示生产单号')
assert(!defaultCombinedFcsOrder.sourceSummary.includes('DEMART-'), 'FCS 来源摘要不得暴露底层产物 ID')
const defaultCombinedDemandOrders = listPrepProcessOrders('DYE')
  .filter((order) => order.sourceProductionOrderId === defaultCombinedDyeDemand.sourceProductionOrderId)
assert.equal(defaultCombinedDemandOrders.filter((order) => order.workOrderId === defaultCombinedDyeOrder.dyeOrderId).length, 1, '默认联合染色加工单必须恰好映射一次')
assert(getMobileExecutionTaskById(defaultCombinedDyeOrder.taskId), '默认含水溶染色加工单必须可从 PDA 移动执行统一索引读取')
assert(
  !listWaterSolubleWorkOrders().some((item) => item.sourceProductionOrderId === defaultCombinedDyeDemand.sourceProductionOrderId),
  '同 BOM 水溶加染色不得进入独立水溶加工单列表',
)

const realBoundaryStock = listProcessWorkOrderStockMaterials({ processCode: 'DYE' })[0]!
const stockCreated = createDyeWorkOrderFromStock({
  stockMaterialId: realBoundaryStock.stockMaterialId,
  stockMaterialName: realBoundaryStock.stockMaterialName,
  materialSku: realBoundaryStock.materialSku,
  factoryId: realBoundaryStock.factoryId,
  plannedFinishAt: '2026-07-20 18:00:00',
  createdBy: '按备货创建边界检查',
  plannedQty: 10,
  qtyUnit: realBoundaryStock.qtyUnit,
  processName: '普通染色',
  targetColor: '深蓝',
})
assert.equal(stockCreated.ok, true, '按备货创建必须可按普通染色路径创建')
assert.equal(stockCreated.order?.sourceType, 'STOCK', '按备货创建必须记录备货来源')
assert.equal(stockCreated.order?.sourceProductionOrderId, undefined, '按备货创建不得伪造生产单来源')
assert.equal(stockCreated.order?.requiresWaterSoluble, false, '按备货创建不得附加水溶步骤')
assert.equal(getDyeExecutionRoute(stockCreated.order!.dyeOrderId).includes('WATER_SOLUBLE'), false, '按备货创建不得生成水溶执行节点')

let combinedSequence = 0
function registerCombinedDyeOrder(suffix: string, qtyUnit = '码', plannedQty = 9) {
  combinedSequence += 1
  return registerFormalProductionOrderDyeWorkOrder({
    workOrderId: `DYE-WATER-REGRESSION-${suffix}-${combinedSequence}`,
    workOrderNo: `RSJG-WATER-${suffix}-${combinedSequence}`,
    productionOrderId: `PO-WATER-REGRESSION-${suffix}-${combinedSequence}`,
    productionOrderNo: `PO-WATER-${suffix}-${combinedSequence}`,
    orderedAt: '2026-07-15 13:00:00',
    techPackVersionId: `TP-WATER-${suffix}`,
    techPackVersionLabel: '技术包 V1',
    materialId: `MAT-WATER-${suffix}`,
    materialName: `联合水溶染色面料 ${suffix}`,
    targetColor: '深蓝',
    plannedQty,
    qtyUnit,
    processCodes: ['DYE'],
    processName: '水溶后染色',
    factoryId: defaultCombinedDyeOrder.dyeFactoryId,
    factoryName: defaultCombinedDyeOrder.dyeFactoryName,
    spuCode: `SPU-WATER-${suffix}`,
    spuName: `联合水溶染色款 ${suffix}`,
    requiredDeliveryDate: '2026-07-22 18:00:00',
    requiresWaterSoluble: true,
  })
}

const combined = registerCombinedDyeOrder('MAIN')
assert.equal(combined.requiresWaterSoluble, true, '正式生产单注册入口必须生成含水溶染色加工单')
assert.deepEqual(getDyeExecutionRoute(combined.dyeOrderId), ['SAMPLE', 'MATERIAL_READY', 'VAT_PLAN', 'WATER_SOLUBLE', 'DYE', 'DEHYDRATE', 'DRY', 'SET', 'ROLL', 'PACK'], '联合水溶染色必须保持单一执行路线')
assert.equal(listPdaGenericProcessTasks().find((task) => task.taskId === combined.taskId)?.qtyDisplayUnit, '码', 'PDA 任务必须保留业务单位')
completeDyeMaterialReady(combined.dyeOrderId, { outputQty: combined.plannedQty, operatorName: '操作员' })
planDyeVat(combined.dyeOrderId, { dyeVatNo: 'VAT-WATER-REGRESSION', operatorName: '主管' })
assert.equal(startDyeWaterSolubleNode(combined.dyeOrderId, '操作员').ok, true, '完成染前准备后必须可开始水溶')
assert.equal(getMobileExecutionTaskById(combined.taskId)?.status, 'IN_PROGRESS', '开始水溶后 PDA 必须同步进行中')
assert.equal(startDyeWaterSolubleNode(combined.dyeOrderId, '操作员').ok, false, '重复开始水溶必须拦截')
assert.equal(completeDyeWaterSolubleNode(combined.dyeOrderId, 0, '').ok, false, '零产出未填原因必须拦截')
const paused = completeDyeWaterSolubleNode(combined.dyeOrderId, combined.plannedQty - 2, '现场数量不足')
assert.equal(paused.order?.status, 'PRODUCTION_PAUSED', '水溶短量必须暂停生产')
assert.equal(getMobileExecutionTaskById(combined.taskId)?.status, 'BLOCKED', '水溶暂停后 PDA 必须同步阻塞')
const beforeUnknownDecision = getDyeWorkOrderById(combined.dyeOrderId)
assert.equal(resolveDyeWaterSolublePause(combined.dyeOrderId, 'UNKNOWN' as never, '主管').ok, false, '未知暂停决定必须拦截')
assert.deepEqual(getDyeWorkOrderById(combined.dyeOrderId), beforeUnknownDecision, '未知暂停决定不得改写加工单')
assert.equal(resolveDyeWaterSolublePause(combined.dyeOrderId, 'CONTINUE_PROCESSING', '主管').order?.status, 'WAIT_WATER_SOLUBLE', '继续补做必须返回待水溶')
assert.equal(getMobileExecutionTaskById(combined.taskId)?.status, 'NOT_STARTED', '继续补做后 PDA 必须回到待执行')
startDyeWaterSolubleNode(combined.dyeOrderId, '操作员')
const beforeRollback = getDyeWorkOrderById(combined.dyeOrderId)
assert.equal(completeDyeWaterSolubleNode(combined.dyeOrderId, combined.plannedQty - 3, '错误回退').ok, false, '累计水溶数量不得回退')
assert.deepEqual(getDyeWorkOrderById(combined.dyeOrderId), beforeRollback, '数量回退失败不得改写加工单')
assert.equal(completeDyeWaterSolubleNode(combined.dyeOrderId, combined.plannedQty, '累计补足').ok, true, '累计补足后必须完成水溶')
assert.equal(getDyeExecutionNodeRecord(combined.dyeOrderId, 'WATER_SOLUBLE')?.qtyUnit, '码', '水溶节点必须保留业务单位')
assert.throws(() => submitDyeHandover(combined.dyeOrderId), /包装完成/, '水溶完成后不得生成中间交出')
startDyeing(combined.dyeOrderId, { dyeVatNo: 'VAT-WATER-REGRESSION', inputQty: combined.plannedQty, operatorName: '操作员' })
completeDyeing(combined.dyeOrderId, { inputQty: combined.plannedQty, outputQty: combined.plannedQty, operatorName: '操作员' })
const completedDyeSnapshot = getDyeWorkOrderById(combined.dyeOrderId)
assert.throws(() => completeDyeing(combined.dyeOrderId, { outputQty: combined.plannedQty }), /状态|已经完成|重复/, '重复完成染色必须拦截')
assert.deepEqual(getDyeWorkOrderById(combined.dyeOrderId), completedDyeSnapshot, '重复完成染色不得改写加工单')
for (const nodeCode of ['DEHYDRATE', 'DRY', 'SET', 'ROLL', 'PACK'] as const) {
  startDyeNode(combined.dyeOrderId, nodeCode, '操作员')
  completeDyeNode(combined.dyeOrderId, nodeCode, { outputQty: combined.plannedQty, operatorName: '操作员' })
  assert.equal(getDyeExecutionNodeRecord(combined.dyeOrderId, nodeCode)?.qtyUnit, '码', `${nodeCode} 节点必须保留业务单位`)
}
const combinedHandoverHeads = listHandoverOrdersByTaskId(combined.taskId)
assert.equal(combinedHandoverHeads.length, 1, '联合水溶染色完成包装后只能生成一次最终交出')
assert.equal(combinedHandoverHeads[0]?.qtyUnit, '码', '最终交出必须保留业务单位')

const zeroOutputCombined = registerCombinedDyeOrder('ZERO')
completeDyeMaterialReady(zeroOutputCombined.dyeOrderId, { outputQty: zeroOutputCombined.plannedQty })
planDyeVat(zeroOutputCombined.dyeOrderId, { dyeVatNo: 'VAT-WATER-ZERO' })
startDyeWaterSolubleNode(zeroOutputCombined.dyeOrderId, '操作员')
assert.equal(completeDyeWaterSolubleNode(zeroOutputCombined.dyeOrderId, 0, '本批物料全部不可用').order?.status, 'PRODUCTION_PAUSED', '零产出有原因必须进入暂停')
const beforeZeroActual = getDyeWorkOrderById(zeroOutputCombined.dyeOrderId)
assert.equal(resolveDyeWaterSolublePause(zeroOutputCombined.dyeOrderId, 'CONTINUE_WITH_ACTUAL_QTY', '主管').ok, false, '零产出不得按实际数量继续染色')
assert.deepEqual(getDyeWorkOrderById(zeroOutputCombined.dyeOrderId), beforeZeroActual, '拒绝零产出继续不得改写加工单')

const normalRegressionDemand = listPrepRequirementDemands('DYE').find((item) => !item.requiresWaterSoluble)
assert(normalRegressionDemand, '普通染色回归必须存在普通需求')
assert.equal(validateDyeStartPrerequisite(getDyeWorkOrderById('DWO-001')?.dyeOrderId || 'DWO-001', 1).ok, true, '普通染色不得受水溶前置影响')
assert(!getDyeExecutionRoute('DWO-001').includes('WATER_SOLUBLE'), '普通染色路线不得插入水溶节点')

const timingBoundaryFiles = [
  'src/data/fcs/production-preparation-timing.ts',
  'src/data/fcs/production-preparation-timing-runtime.ts',
  'src/pages/production/preparation-timing.ts',
  'scripts/check-production-preparation-timing.ts',
]
for (const file of timingBoundaryFiles) {
  assert.equal(readFileSync(file, 'utf8').includes('WATER_SOLUBLE'), false, `生产准备时效边界文件不得接入 WATER_SOLUBLE：${file}`)
}
const timingInput = {
  recordNo: 'PREP-WATER-BOUNDARY',
  productionDemandNo: 'PD-WATER-BOUNDARY',
  productionOrderNo: 'PO-WATER-BOUNDARY',
  outputReady: true,
  outputPublishedAt: '2026-07-12 12:00',
  workItemsConfirmedBy: '跟单员',
  workItemsConfirmedAt: '2026-07-12 11:00',
  items: [{ itemType: '辅料下单' as const, selectedByMerchandiser: true, status: '已完成' as const }],
}
const timingOutputsBeforeWaterDomain = buildPreparationOutputs(timingInput)
resetWaterSolubleDomainForChecks({ seedDemo: true })
const timingOutputsAfterWaterDomain = buildPreparationOutputs(timingInput)
assert.deepEqual(timingOutputsAfterWaterDomain, timingOutputsBeforeWaterDomain, '水溶加工单领域状态不得改变生产准备时效输出口径')
assert.equal(timingOutputsAfterWaterDomain.some((item) => item.outputType.includes('水溶')), false, '生产准备时效领域行为不得生成水溶输出')

console.log('water-soluble process checks passed')
