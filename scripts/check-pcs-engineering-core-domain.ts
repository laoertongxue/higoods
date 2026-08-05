#!/usr/bin/env node

import assert from 'node:assert/strict'
import {
  buildEngineeringTaskPlan,
  getEngineeringTaskDependencies,
} from '../src/data/pcs-engineering-dependency-policy.ts'
import {
  assertFirstProductionQualification,
  hasFormalProductionFact,
} from '../src/data/pcs-engineering-first-production-policy.ts'
import {
  confirmEngineeringMasterTaskPlan,
  createEngineeringMasterOrder,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  calculateEngineeringBomTotalRequirement,
  resolveEngineeringBomTechnicalProcessSequence,
} from '../src/data/pcs-engineering-bom-material-resolver.ts'
import { calculateEngineeringBomCost } from '../src/data/pcs-engineering-bom-pricing.ts'
import { copyEngineeringBomDraftVersion } from '../src/data/pcs-engineering-bom-version.ts'
import type {
  EngineeringFirstProductionQualificationFact,
  EngineeringPreparationType,
  EngineeringTaskType,
} from '../src/data/pcs-engineering-master-types.ts'

function enabled(type: EngineeringPreparationType): EngineeringTaskType[] {
  return buildEngineeringTaskPlan(type).filter((line) => line.enabled).map((line) => line.taskType)
}

assert.deepEqual(enabled('PURE_WOVEN'), [
  'BASE_PATTERN_WOVEN', 'PRE_PRODUCTION_SAMPLE', 'SIZE_PATTERN_WOVEN', 'TECH_PACK_CONFIRMATION',
])
assert.deepEqual(enabled('KNIT'), [
  'BASE_PATTERN_KNIT', 'PRE_PRODUCTION_SAMPLE', 'SIZE_PATTERN_KNIT', 'TECH_PACK_CONFIRMATION',
])
assert.deepEqual(enabled('KNIT_WOVEN'), [
  'BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT', 'PRE_PRODUCTION_SAMPLE',
  'SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT', 'TECH_PACK_CONFIRMATION',
])
assert.deepEqual(enabled('HEAT_TRANSFER_DIRECT_PRINT'), ['PATTERN_ARTWORK', 'TECH_PACK_CONFIRMATION'])
assert.deepEqual(getEngineeringTaskDependencies('PURE_WOVEN', 'PRE_PRODUCTION_SAMPLE'), ['BASE_PATTERN_WOVEN'])
assert.deepEqual(getEngineeringTaskDependencies('KNIT', 'PRE_PRODUCTION_SAMPLE'), ['BASE_PATTERN_KNIT'])
assert.deepEqual(
  getEngineeringTaskDependencies('KNIT_WOVEN', 'PRE_PRODUCTION_SAMPLE'),
  ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT'],
)

const conditions = {
  hasPrintRequirement: true,
  hasYarnDyeRequirement: true,
  hasFabricDyeRequirement: true,
  hasAccessoryPurchaseRequirement: true,
}
const conditionalPlan = buildEngineeringTaskPlan('PURE_WOVEN', conditions)
for (const taskType of ['PATTERN_ARTWORK', 'COLOR_YARN', 'COLOR_FABRIC', 'ACCESSORY_PURCHASE'] as const) {
  assert.equal(conditionalPlan.find((line) => line.taskType === taskType)?.enabled, true)
}

const qualified: EngineeringFirstProductionQualificationFact = {
  styleCode: 'SPU-CORE-CHECK',
  formalSaleStatus: 'NO_FORMAL_SALE',
  formalProductionStatus: 'NO_FORMAL_PRODUCTION',
  formalSaleSource: '正式销售订单事实',
  formalProductionSource: '正式生产单事实',
  checkedAt: '2026-08-04 10:00:00',
}
assert.doesNotThrow(() => assertFirstProductionQualification('SPU-CORE-CHECK', qualified))
assert.throws(
  () => assertFirstProductionQualification('SPU-CORE-CHECK', { ...qualified, formalSaleStatus: 'HAS_FORMAL_SALE' }),
  /已正式售卖/,
)

resetStyleArchiveRepository()
resetEngineeringMasterRepository()
const style = listStyleArchives().find((item) => !hasFormalProductionFact(item.styleCode))
assert.ok(style, '应存在可用于首单领域检查的款式档案')
const master = createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserId: 'USER-M-1',
  merchandiserName: '跟单A',
  createdById: 'USER-M-1',
  createdBy: '跟单A',
  createdByRole: '跟单',
  preparationType: 'PURE_WOVEN',
  qualificationFact: { ...qualified, styleCode: style.styleCode },
  bulkProductionQualification: {
    basisType: 'TEST_APPROVED',
    triggerBusinessObjectType: '测款结果',
    triggerBusinessObjectId: 'TEST-1',
    thresholdQuantity: 300,
    reachedQuantity: 320,
    reachedAt: '2026-08-04 09:00:00',
    reason: '已满足做大货条件',
    uniqueTriggerKey: 'TEST-1-SPU',
  },
  creationReason: '跟单核实后人工创建',
})
assert.equal(master.status, '草稿')
assert.equal(master.tasks.length, 0)
assert.throws(() => createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserId: 'USER-M-1',
  merchandiserName: '跟单A',
  createdById: 'USER-M-1',
  createdBy: '跟单A',
  createdByRole: '跟单',
  preparationType: 'PURE_WOVEN',
  qualificationFact: { ...qualified, styleCode: style.styleCode },
  bulkProductionQualification: {
    basisType: 'TEST_APPROVED', triggerBusinessObjectType: '测款结果', triggerBusinessObjectId: 'TEST-1',
    thresholdQuantity: 300, reachedQuantity: 320, reachedAt: '2026-08-04 09:00:00',
    reason: '已满足做大货条件', uniqueTriggerKey: 'TEST-1-SPU',
  },
  creationReason: '重复创建',
}), /未关闭的工程主单/)
const published = confirmEngineeringMasterTaskPlan(master.masterOrderId, {
  confirmedBy: '跟单A',
  confirmedById: 'USER-M-1',
  confirmedByRole: '跟单',
  selectedConditionalTaskTypes: [],
})
assert.equal(published.tasks.length, 10, '方案确认应一次性生成全部任务骨架')
assert.equal(published.tasks.find((task) => task.taskType === 'BASE_PATTERN_WOVEN')?.status, '待开始')
assert.equal(published.tasks.find((task) => task.taskType === 'BASE_PATTERN_KNIT')?.status, '未启用')
assert.equal(published.tasks.find((task) => task.taskType === 'ACCESSORY_PURCHASE')?.status, '未启用')
assert.equal(published.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')?.dependsOnTaskIds.length, 1)
assert.ok(published.tasks.every((task) => task.sourceType === 'ENGINEERING_MASTER' && task.events.generatedAt))
assert.throws(
  () => assertFirstProductionQualification('SPU-CORE-CHECK', { ...qualified, formalSaleStatus: 'UNAVAILABLE' }),
  /暂不可用/,
)

assert.equal(calculateEngineeringBomTotalRequirement({ usage: 1.2, sampleQuantity: 3, lossRate: 0.05 }), 3.78)
assert.deepEqual(resolveEngineeringBomTechnicalProcessSequence({
  waterSolubleRequirementText: '需要水溶',
  dyeRequirement: '是',
}), ['水溶', '染色'])
const cost = calculateEngineeringBomCost({
  exchangeRateIdrPerCny: 2200,
  materialLines: [{
    materialSkuId: 'MAT-1',
    usage: 1.25,
    sampleQuantity: 1,
    usageUnit: '米',
    pricingUnit: '码',
    conversionToPricingUnit: 1.0936,
    lossRate: 0.05,
    standardUnitPriceCny: 12.3456,
  }],
  customCosts: [{ title: '车位费', amountIdr: 44000 }],
})
assert.deepEqual(cost, {
  materialCostCny: 17.72,
  customCostIdr: 44000,
  comprehensiveCostCny: 37.72,
  comprehensiveCostIdr: 82985,
  exchangeRateIdrPerCny: 2200,
})

const sourceDraft = {
  bomDraftVersionId: 'BOM-V1',
  versionStatus: 'COMPLETED_CONFIRMED' as const,
  styleCode: 'SPU-1',
  productColor: '黑色',
  materialLines: [{
    bomItemId: 'LINE-1',
    materialSkuId: 'MAT-1',
    usage: 1,
    sampleQuantity: 1,
    usageUnit: '米',
    lossRate: 0,
  }],
  customCosts: [{ title: '车位费', amountIdr: 10000 }],
}
const copied = copyEngineeringBomDraftVersion({
  source: sourceDraft,
  targetVersionId: 'BOM-V2',
  copiedAt: '2026-08-04 11:00:00',
  copiedBy: '买手A',
})
assert.equal(copied.versionStatus, 'DRAFT')
assert.equal(copied.sourceVersionId, 'BOM-V1')
assert.notEqual(copied.materialLines, sourceDraft.materialLines)

console.log('check-pcs-engineering-core-domain PASS')
