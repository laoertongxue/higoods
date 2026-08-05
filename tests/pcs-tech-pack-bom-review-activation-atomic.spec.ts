import assert from 'node:assert/strict'

import {
  createMaterialArchive,
  createMaterialSkuRecord,
  getMaterialSkuRecordById,
  updateMaterialSkuRecord,
} from '../src/data/pcs-material-archive-repository.ts'
import { getLatestPcsExchangeRate, updateLatestPcsExchangeRate } from '../src/data/pcs-exchange-rate-config.ts'
import {
  assertEngineeringBomPricingSnapshotValid,
  freezeTechnicalDataVersionBomPricingSnapshot,
} from '../src/data/pcs-engineering-bom-pricing.ts'
import * as bomPricingPublicApi from '../src/data/pcs-engineering-bom-pricing.ts'
import { submitTechPackFirstStageReview } from '../src/data/pcs-tech-pack-review.ts'
import {
  activateTechPackVersionForStyle,
  setTechPackActivationFailureStepForTesting,
} from '../src/data/pcs-tech-pack-version-activation.ts'
import {
  getProjectArchiveByProjectId,
  listProjectArchiveDocumentsByArchiveId,
  listProjectArchiveFilesByArchiveId,
  listProjectArchiveMissingItemsByArchiveId,
} from '../src/data/pcs-project-archive-repository.ts'
import { listProjectRelationsByProject } from '../src/data/pcs-project-relation-repository.ts'
import { getProjectById } from '../src/data/pcs-project-repository.ts'
import {
  getStyleArchiveById,
  listStyleArchives,
} from '../src/data/pcs-style-archive-repository.ts'
import {
  listTechPackVersionLogs,
  listTechPackVersionLogsByVersionId,
} from '../src/data/pcs-tech-pack-version-log-repository.ts'
import {
  createTechnicalDataVersionDraft,
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  getTechnicalDataVersionStoreSnapshot,
  listTechnicalDataVersions,
  publishTechnicalDataVersionRecord,
  updateTechnicalDataVersionContent,
} from '../src/data/pcs-technical-data-version-repository.ts'
import * as technicalVersionRepositoryPublicApi from '../src/data/pcs-technical-data-version-repository.ts'
import type {
  TechnicalBomItem,
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-types.ts'
import {
  getEngineeringMasterOrderById,
  assertEngineeringTaskCanComplete,
  createEngineeringMasterOrder,
  createEngineeringChangeTask,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  updateEngineeringTaskRecord,
} from '../src/data/pcs-engineering-master-repository.ts'
import { closeEngineeringMasterOrder } from '../src/data/pcs-engineering-master-repository.ts'
import { getEngineeringTaskDefinition } from '../src/data/pcs-engineering-dependency-policy.ts'
import { listPartTemplateRecords } from '../src/data/pcs-part-template-library.ts'
import { resolveEngineeringLinkedPartTemplateVersions } from '../src/data/pcs-engineering-bom-snapshot-source.ts'
import * as snapshotSourcePublicApi from '../src/data/pcs-engineering-bom-snapshot-source.ts'

function createMaterial(input: {
  costPrice: number
  pricingUnit: string
  usageUnit: string
  conversionFactor?: number
}) {
  const archive = createMaterialArchive({
    kind: 'fabric',
    materialName: `审核启用原子性面料 ${Date.now()} ${Math.random()}`,
    materialNameEn: 'Atomic activation material',
    categoryName: '测试面料',
    specSummary: '测试',
    composition: '棉',
    processTags: [],
    widthText: '150cm',
    gramWeightText: '180g',
    pricingUnit: input.pricingUnit,
    mainUnit: input.usageUnit,
    auxiliaryUnits: input.pricingUnit === input.usageUnit ? [] : [input.pricingUnit],
    unitConversions:
      input.pricingUnit === input.usageUnit || input.conversionFactor === undefined
        ? []
        : [{ fromUnit: input.usageUnit, toUnit: input.pricingUnit, factor: input.conversionFactor }],
    mainImageUrl: '',
    barcodeTemplateCode: '',
    remark: '',
  })
  const sku = createMaterialSkuRecord(archive.materialId, {
    colorName: '黑色',
    specName: '标准',
    sizeName: '-',
    skuImageUrl: '',
    costPrice: input.costPrice,
    freightCost: 0,
    weightKg: 0,
    lengthCm: 0,
    widthCm: 0,
    heightCm: 0,
    barcode: '',
  })
  assert.ok(sku)
  return sku
}

function changePrice(materialSkuId: string, costPrice: number): void {
  const sku = getMaterialSkuRecordById(materialSkuId)
  assert.ok(sku)
  assert.ok(updateMaterialSkuRecord(materialSkuId, {
    colorName: sku.colorName,
    specName: sku.specName,
    sizeName: sku.sizeName,
    skuImageUrl: sku.skuImageUrl,
    costPrice,
    freightCost: sku.freightCost,
    weightKg: sku.weightKg,
    lengthCm: sku.lengthCm,
    widthCm: sku.widthCm,
    heightCm: sku.heightCm,
    barcode: sku.barcode,
  }))
}

const baseRecord = listTechnicalDataVersions()[0]
const style = listStyleArchives()[0]
assert.ok(baseRecord)
assert.ok(style)
const productProjectId = style.sourceProjectId
assert.ok(productProjectId, '技术包启用原子性测试需要款式关联的商品项目')
assert.ok(getProjectById(productProjectId), '款式来源商品项目必须真实存在')
resetEngineeringMasterRepository()
const engineeringMaster = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserId: 'USER-M-A',
  merchandiserName: '跟单甲',
  createdById: 'USER-M-A', createdBy: '跟单甲', createdByRole: '跟单', preparationType: 'PURE_WOVEN',
  qualificationFact: { styleCode: style.styleCode, formalSaleStatus: 'NO_FORMAL_SALE', formalProductionStatus: 'NO_FORMAL_PRODUCTION', formalSaleSource: '正式销售订单', formalProductionSource: '正式生产单', checkedAt: '2026-08-04 09:00:00' },
  bulkProductionQualification: { basisType: 'TEST_APPROVED', triggerBusinessObjectType: '测款结果', triggerBusinessObjectId: 'TEST-ATOMIC', thresholdQuantity: 300, reachedQuantity: 320, reachedAt: '2026-08-04 09:00:00', reason: '已满足做大货要求', uniqueTriggerKey: 'TEST-ATOMIC' }, creationReason: '跟单核实创建',
}).masterOrderId)
const engineeringSourceTaskId = `${engineeringMaster.masterOrderId}-TECH_PACK_CONFIRMATION`

function completeActivationPrerequisites(): void {
  const dependencyTypes = getEngineeringTaskDefinition('TECH_PACK_CONFIRMATION').dependsOn
  for (const dependencyType of dependencyTypes) {
    const taskId = `${engineeringMaster.masterOrderId}-${dependencyType}`
    updateEngineeringTaskRecord(engineeringMaster.masterOrderId, taskId, (task) => {
      task.status = task.status === '未启用'
        ? '因需求变更结束'
        : '已完成'
      task.firstCompletedAt = '2026-08-01 09:00'
      task.effectiveCompletedAt = '2026-08-01 09:00'
      task.completedAt = '2026-08-01 09:00'
    })
  }
}

function makeRecord(input: {
  id: string
  status: TechnicalDataVersionRecord['versionStatus']
  reviewStage: TechnicalDataVersionRecord['reviewStage']
}): TechnicalDataVersionRecord {
  return {
    ...baseRecord,
    technicalVersionId: input.id,
    technicalVersionCode: `TP-${input.id}`,
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    sourceProjectId: engineeringMaster.masterOrderId,
    sourceProjectCode: engineeringMaster.masterOrderCode,
    createdFromTaskType: 'ENGINEERING_MASTER',
    createdFromTaskId: engineeringSourceTaskId,
    createdFromTaskCode: engineeringSourceTaskId,
    versionStatus: input.status,
    reviewStage: input.reviewStage,
    buyerReview: undefined,
    patternMakerReview: undefined,
    merchandiserReview: undefined,
    reviewSubmittedAt: '',
    reviewSubmittedBy: '',
    returnedFromMerchandiserFlag: false,
    reviewUnlockedModuleKeys: [],
    publishedAt: input.status === 'PUBLISHED' ? '2026-08-01 10:00' : '',
    publishedBy: input.status === 'PUBLISHED' ? '跟单甲' : '',
    missingItemCodes: [],
    missingItemNames: [],
    updatedAt: '2026-08-01 10:00',
    updatedBy: '测试用户',
  }
}

function makeBomItem(id: string, materialSkuId: string, usageUnit: string): TechnicalBomItem {
  const sku = getMaterialSkuRecordById(materialSkuId)
  assert.ok(sku)
  return {
    id,
    type: '面料',
    name: sku.materialName,
    spec: sku.specName,
    materialCode: sku.materialCode,
    materialSkuId,
    unit: usageUnit,
    unitConsumption: 1,
    sampleQuantity: 1,
    lossRate: 0,
    supplier: '测试供应商',
  }
}

function makeContent(technicalVersionId: string, bomItems: TechnicalBomItem[]): TechnicalDataVersionContent {
  return {
    technicalVersionId,
    patternFiles: [],
    patternDesc: '',
    processEntries: [],
    processRouteStatus: 'CONFIRMED',
    processRouteConfirmedBy: '跟单甲',
    processRouteConfirmedAt: '2026-08-01 09:50',
    processRouteUpdatedBy: '跟单甲',
    processRouteUpdatedAt: '2026-08-01 09:50',
    processRouteChangeReason: '',
    sizeTable: [],
    bomItems,
    bomCustomCosts: [{ title: '车位费', amountIdr: 15000 }],
    qualityRules: [],
    colorMaterialMappings: [],
    patternDesigns: [],
    attachments: [],
    legacyCompatibleCostPayload: {},
  }
}

function getProjectArchiveFacts(projectId: string) {
  const archive = getProjectArchiveByProjectId(projectId)
  const byId = <T>(items: T[], getId: (item: T) => string) =>
    [...items].sort((left, right) => getId(left).localeCompare(getId(right)))
  return {
    archive,
    documents: archive ? byId(listProjectArchiveDocumentsByArchiveId(archive.projectArchiveId), (item) => item.archiveDocumentId) : [],
    files: archive ? byId(listProjectArchiveFilesByArchiveId(archive.projectArchiveId), (item) => item.archiveFileId) : [],
    missingItems: archive ? byId(listProjectArchiveMissingItemsByArchiveId(archive.projectArchiveId), (item) => item.archiveMissingItemId) : [],
  }
}

// 首次提交审核必须实时校验物料标准价，并在失败时保持审核状态、日志和内容原子不变。
const invalidPriceSku = createMaterial({ costPrice: 0, pricingUnit: '米', usageUnit: '米' })
const reviewVersionId = `task7_review_guard_${Date.now()}`
createTechnicalDataVersionDraft(
  makeRecord({ id: reviewVersionId, status: 'DRAFT', reviewStage: '未提交审核' }),
  makeContent(reviewVersionId, [makeBomItem('BOM-REVIEW-1', invalidPriceSku.materialSkuId, '米')]),
)
const reviewRecordBefore = getTechnicalDataVersionById(reviewVersionId)
const reviewContentBefore = getTechnicalDataVersionContent(reviewVersionId)
const reviewLogsBefore = listTechPackVersionLogsByVersionId(reviewVersionId)
assert.throws(
  () => submitTechPackFirstStageReview(reviewVersionId, '买手甲'),
  /标准单价|暂无标准单价/,
)
assert.deepEqual(getTechnicalDataVersionById(reviewVersionId), reviewRecordBefore)
assert.deepEqual(getTechnicalDataVersionContent(reviewVersionId), reviewContentBefore)
assert.deepEqual(listTechPackVersionLogsByVersionId(reviewVersionId), reviewLogsBefore)

// 正式启用必须先完整构建快照；后续行缺换算时，款式指针、内容快照和启用日志均不得变化。
const validSku = createMaterial({ costPrice: 8.7654, pricingUnit: '米', usageUnit: '米' })
const missingConversionSku = createMaterial({ costPrice: 12.3456, pricingUnit: '码', usageUnit: '米' })
const conversionReviewVersionId = `task7_review_conversion_guard_${Date.now()}`
createTechnicalDataVersionDraft(
  makeRecord({ id: conversionReviewVersionId, status: 'DRAFT', reviewStage: '未提交审核' }),
  makeContent(conversionReviewVersionId, [
    makeBomItem('BOM-REVIEW-CONVERSION-1', missingConversionSku.materialSkuId, '米'),
  ]),
)
const conversionReviewRecordBefore = getTechnicalDataVersionById(conversionReviewVersionId)
const conversionReviewContentBefore = getTechnicalDataVersionContent(conversionReviewVersionId)
const conversionReviewLogsBefore = listTechPackVersionLogsByVersionId(conversionReviewVersionId)
assert.throws(
  () => submitTechPackFirstStageReview(conversionReviewVersionId, '买手甲'),
  /单位换算/,
)
assert.deepEqual(getTechnicalDataVersionById(conversionReviewVersionId), conversionReviewRecordBefore)
assert.deepEqual(getTechnicalDataVersionContent(conversionReviewVersionId), conversionReviewContentBefore)
assert.deepEqual(listTechPackVersionLogsByVersionId(conversionReviewVersionId), conversionReviewLogsBefore)

const invalidActivationVersionId = `task7_activation_invalid_${Date.now()}`
createTechnicalDataVersionDraft(
  makeRecord({ id: invalidActivationVersionId, status: 'PUBLISHED', reviewStage: '已发布' }),
  makeContent(invalidActivationVersionId, [
    makeBomItem('BOM-ACT-1', validSku.materialSkuId, '米'),
    makeBomItem('BOM-ACT-2', missingConversionSku.materialSkuId, '米'),
  ]),
)
const styleBefore = getStyleArchiveById(style.styleId)
const invalidActivationRecordBefore = getTechnicalDataVersionById(invalidActivationVersionId)
const invalidContentBefore = getTechnicalDataVersionContent(invalidActivationVersionId)
const invalidLogsBefore = listTechPackVersionLogsByVersionId(invalidActivationVersionId)
assert.throws(
  () => activateTechPackVersionForStyle(style.styleId, invalidActivationVersionId, '跟单甲'),
  /单位换算/,
)
assert.deepEqual(getStyleArchiveById(style.styleId), styleBefore)
assert.deepEqual(getTechnicalDataVersionById(invalidActivationVersionId), invalidActivationRecordBefore)
assert.deepEqual(getTechnicalDataVersionContent(invalidActivationVersionId), invalidContentBefore)
assert.deepEqual(listTechPackVersionLogsByVersionId(invalidActivationVersionId), invalidLogsBefore)

// 技术包确认任务不能由“正式启用”绕过固定前置；拒绝必须发生在任何仓储写入之前。
const blockedByPrerequisiteVersionId = `task7_activation_prerequisite_${Date.now()}`
createTechnicalDataVersionDraft(
  makeRecord({ id: blockedByPrerequisiteVersionId, status: 'PUBLISHED', reviewStage: '已发布' }),
  makeContent(blockedByPrerequisiteVersionId, [makeBomItem('BOM-ACT-PREREQUISITE', validSku.materialSkuId, '米')]),
)
const prerequisiteTechnicalBefore = getTechnicalDataVersionStoreSnapshot()
const prerequisiteStyleBefore = getStyleArchiveById(style.styleId)
const prerequisiteEngineeringBefore = getEngineeringMasterOrderById(engineeringMaster.masterOrderId)
const prerequisiteLogsBefore = listTechPackVersionLogs()
const clonedMasterWithMissingDependency = structuredClone(prerequisiteEngineeringBefore!)
const clonedSourceTask = clonedMasterWithMissingDependency.tasks.find((task) => task.taskId === engineeringSourceTaskId)!
clonedMasterWithMissingDependency.tasks = clonedMasterWithMissingDependency.tasks.filter(
  (task) => task.taskId !== clonedSourceTask.dependsOnTaskIds[0],
)
assert.throws(
  () => assertEngineeringTaskCanComplete(clonedMasterWithMissingDependency, clonedSourceTask),
  /缺少固定前置依赖|固定依赖不存在|依赖不存在/,
  '依赖记录缺失必须独立阻断',
)
assert.throws(
  () => assertEngineeringTaskCanComplete(prerequisiteEngineeringBefore!, prerequisiteEngineeringBefore!.tasks.find((task) => task.taskId === engineeringSourceTaskId)!),
  /前置任务.*未完成/,
  '依赖记录存在但未完成必须独立阻断',
)
assert.throws(
  () => activateTechPackVersionForStyle(style.styleId, blockedByPrerequisiteVersionId, '跟单甲'),
  /前置任务|固定依赖/,
)
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), prerequisiteTechnicalBefore)
assert.deepEqual(getStyleArchiveById(style.styleId), prerequisiteStyleBefore)
assert.deepEqual(getEngineeringMasterOrderById(engineeringMaster.masterOrderId), prerequisiteEngineeringBefore)
assert.deepEqual(listTechPackVersionLogs(), prerequisiteLogsBefore)

completeActivationPrerequisites()

// 新工程来源技术包没有完整 BOM 定价字段时，正式启用必须失败且所有事实不变。
const missingSnapshotVersionId = `task7_activation_missing_snapshot_${Date.now()}`
createTechnicalDataVersionDraft(
  makeRecord({ id: missingSnapshotVersionId, status: 'PUBLISHED', reviewStage: '已发布' }),
  makeContent(missingSnapshotVersionId, []),
)
const missingSnapshotTechnicalBefore = getTechnicalDataVersionStoreSnapshot()
const missingSnapshotStyleBefore = getStyleArchiveById(style.styleId)
const missingSnapshotEngineeringBefore = getEngineeringMasterOrderById(engineeringMaster.masterOrderId)
assert.throws(
  () => activateTechPackVersionForStyle(style.styleId, missingSnapshotVersionId, '跟单甲'),
  /BOM.*正式快照|BOM.*定价字段|正式快照/,
)
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), missingSnapshotTechnicalBefore)
assert.deepEqual(getStyleArchiveById(style.styleId), missingSnapshotStyleBefore)
assert.deepEqual(getEngineeringMasterOrderById(engineeringMaster.masterOrderId), missingSnapshotEngineeringBefore)

// 任一启用写步骤失败，都必须恢复技术包、款式、项目、关系、归档及启用日志六类事实源。
const activationFailureSteps = ['PRICING_SNAPSHOT', 'ENGINEERING_TASK', 'STYLE', 'PROJECT', 'RELATION', 'ARCHIVE', 'LOG'] as const
for (const failureStep of activationFailureSteps) {
  const versionId = `task7_activation_rollback_${failureStep}_${Date.now()}_${Math.random()}`
  createTechnicalDataVersionDraft(
    makeRecord({ id: versionId, status: 'PUBLISHED', reviewStage: '已发布' }),
    makeContent(versionId, [makeBomItem(`BOM-ROLLBACK-${failureStep}`, validSku.materialSkuId, '米')]),
  )
  const technicalBefore = getTechnicalDataVersionStoreSnapshot()
  const projectBefore = getProjectById(productProjectId)
  const relationBefore = listProjectRelationsByProject(productProjectId)
  const masterRelationBefore = listProjectRelationsByProject(engineeringMaster.masterOrderId)
  const archiveBefore = getProjectArchiveFacts(productProjectId)
  const targetStyleBefore = getStyleArchiveById(style.styleId)
  const logsBefore = listTechPackVersionLogs()
  const engineeringBefore = getEngineeringMasterOrderById(engineeringMaster.masterOrderId)

  setTechPackActivationFailureStepForTesting(failureStep)
  assert.throws(
    () => activateTechPackVersionForStyle(style.styleId, versionId, '跟单甲'),
    new RegExp(`模拟启用${failureStep}写入失败`),
  )
  setTechPackActivationFailureStepForTesting(null)

  assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), technicalBefore, `${failureStep} 失败后技术包仓必须恢复`)
  assert.deepEqual(getStyleArchiveById(style.styleId), targetStyleBefore, `${failureStep} 失败后款式仓必须恢复`)
  assert.deepEqual(getProjectById(productProjectId), projectBefore, `${failureStep} 失败后项目仓必须恢复`)
  assert.deepEqual(listProjectRelationsByProject(productProjectId), relationBefore, `${failureStep} 失败后项目关系仓必须恢复`)
  assert.deepEqual(
    listProjectRelationsByProject(engineeringMaster.masterOrderId),
    masterRelationBefore,
    `${failureStep} 失败后不得残留以工程主单 ID 冒充商品项目 ID 的关系`,
  )
  assert.deepEqual(getProjectArchiveFacts(productProjectId), archiveBefore, `${failureStep} 失败后项目归档仓必须恢复`)
  assert.deepEqual(listTechPackVersionLogs(), logsBefore, `${failureStep} 失败后启用日志仓必须恢复`)
  assert.deepEqual(
    getEngineeringMasterOrderById(engineeringMaster.masterOrderId),
    engineeringBefore,
    `${failureStep} 失败后技术包确认任务必须恢复`,
  )
}

// 成功启用只冻结一次当时的标准价和汇率；之后档案及系统汇率变化不影响正式快照。
const successVersionId = `task7_activation_success_${Date.now()}`
const linkedPartTemplateId = listPartTemplateRecords()[0]?.id
assert.ok(linkedPartTemplateId, '正式快照测试需要真实部件模板')
createTechnicalDataVersionDraft(
  {
    ...makeRecord({ id: successVersionId, status: 'PUBLISHED', reviewStage: '已发布' }),
    linkedPartTemplateIds: [linkedPartTemplateId],
  },
  makeContent(successVersionId, [
    {
      ...makeBomItem('BOM-ACT-OK-1', validSku.materialSkuId, '米'),
      applicableSkuCodes: ['SKU-RED-S'],
      linkedPatternIds: ['PATTERN-FRONT'],
      usageProcessCodes: ['SEWING'],
    },
    makeBomItem('BOM-ACT-OK-2', validSku.materialSkuId, '米'),
  ]),
)
updateLatestPcsExchangeRate({ idrPerCny: 2250, updatedBy: '系统管理员' })
activateTechPackVersionForStyle(style.styleId, successVersionId, '跟单甲')
const successContent = getTechnicalDataVersionContent(successVersionId)
assert.equal(successContent?.bomPricingSnapshot?.materialLines[0]?.standardUnitPriceCny, 8.7654)
assert.equal(successContent?.bomPricingSnapshot?.exchangeRateIdrPerCny, 2250)
assert.deepEqual(successContent?.bomPricingSnapshot?.bomItems.map((item) => item.id), ['BOM-ACT-OK-1', 'BOM-ACT-OK-2'])
assert.equal(successContent?.bomPricingSnapshot?.materialPriceSnapshots[0]?.standardUnitPriceCny, 8.7654)
assert.deepEqual(
  successContent?.bomPricingSnapshot?.materialPriceSnapshots.map((line) => (line as typeof line & { bomItemId?: string }).bomItemId),
  ['BOM-ACT-OK-1', 'BOM-ACT-OK-2'],
  '同一物料 SKU 的两条 BOM 行必须按稳定 bomItemId 分别固化价格',
)
assert.deepEqual(successContent?.bomPricingSnapshot?.customCostsIdr, [
  { title: '车位费', amountIdr: 15000, currency: 'IDR' },
])
assert.equal(successContent?.bomPricingSnapshot?.materialCostCny, 17.53)
assert.equal(successContent?.bomPricingSnapshot?.comprehensiveCostCny, 24.2)
assert.equal(successContent?.bomPricingSnapshot?.comprehensiveCostIdr, 54444)
assert.deepEqual(
  successContent?.bomPricingSnapshot?.linkedPartTemplateVersions.map((item) => item.partTemplateId),
  [linkedPartTemplateId],
)
const activatedMaster = getEngineeringMasterOrderById(engineeringMaster.masterOrderId)
const activatedConfirmationTask = activatedMaster?.tasks.find((task) => task.taskType === 'TECH_PACK_CONFIRMATION')
assert.equal(activatedConfirmationTask?.status, '已完成')
assert.ok(activatedConfirmationTask?.effectiveCompletedAt, '正式启用后技术包确认任务必须记录当前有效完成时间')
assert.equal(getStyleArchiveById(style.styleId)?.currentTechPackVersionId, successVersionId)
assert.equal(getProjectById(productProjectId)?.linkedTechPackVersionId, successVersionId)
assert.ok(
  listProjectRelationsByProject(productProjectId).some((item) => item.sourceObjectId === successVersionId),
  '正式技术包关系必须写入款式来源商品项目',
)
assert.equal(
  listProjectRelationsByProject(engineeringMaster.masterOrderId).some((item) => item.sourceObjectId === successVersionId),
  false,
  '不得生成以工程主单 ID 冒充商品项目 ID 的孤立关系',
)

// 快照 BOM 必须与普通 BOM 使用同等级深克隆，读取结果的嵌套数组变异不得污染仓储。
const mutableSnapshot = getTechnicalDataVersionContent(successVersionId)?.bomPricingSnapshot
assert.ok(mutableSnapshot)
mutableSnapshot.bomItems[0]!.applicableSkuCodes!.push('SKU-MUTATED')
mutableSnapshot.bomItems[0]!.linkedPatternIds!.push('PATTERN-MUTATED')
mutableSnapshot.bomItems[0]!.usageProcessCodes!.push('PROCESS-MUTATED')
const rereadSnapshot = getTechnicalDataVersionContent(successVersionId)?.bomPricingSnapshot
assert.deepEqual(rereadSnapshot?.bomItems[0]?.applicableSkuCodes, ['SKU-RED-S'])
assert.deepEqual(rereadSnapshot?.bomItems[0]?.linkedPatternIds, ['PATTERN-FRONT'])
assert.deepEqual(rereadSnapshot?.bomItems[0]?.usageProcessCodes, ['SEWING'])

function validateSnapshotAgainstCurrentTarget(
  technicalVersionId: string,
  snapshot: NonNullable<TechnicalDataVersionContent['bomPricingSnapshot']>,
  auditContext?: { frozenAt: string; frozenBy: string },
): void {
  const record = getTechnicalDataVersionById(technicalVersionId)
  const content = getTechnicalDataVersionContent(technicalVersionId)
  assert.ok(record)
  assert.ok(content)
  assertEngineeringBomPricingSnapshotValid(snapshot, {
    bomItems: content.bomItems,
    bomCustomCosts: content.bomCustomCosts ?? [],
    exchangeRateIdrPerCny: getLatestPcsExchangeRate().idrPerCny,
    linkedPartTemplateVersions: resolveEngineeringLinkedPartTemplateVersions(record.linkedPartTemplateIds),
    frozenAt: auditContext?.frozenAt,
    frozenBy: auditContext?.frozenBy,
  })
}

// 逐行价格快照必须与 BOM 行一一对应，重复 bomItemId、错 SKU 或用量口径错配均拒绝。
const mismatchedSnapshot = structuredClone(rereadSnapshot!)
Object.assign(mismatchedSnapshot.materialPriceSnapshots[1]!, { bomItemId: 'BOM-ACT-OK-1' })
assert.throws(() => assertEngineeringBomPricingSnapshotValid(mismatchedSnapshot), /bomItemId|一一对应|重复/)
assert.throws(
  () => validateSnapshotAgainstCurrentTarget(missingSnapshotVersionId, mismatchedSnapshot),
  /bomItemId|一一对应|重复|目标技术包|当前 BOM|不一致/,
  '受限仓储入口自身也必须拒绝无效正式快照',
)
const wrongSkuSnapshot = structuredClone(rereadSnapshot!)
wrongSkuSnapshot.materialPriceSnapshots[1]!.materialSkuId = 'MAT-SKU-WRONG'
assert.throws(() => assertEngineeringBomPricingSnapshotValid(wrongSkuSnapshot), /物料 SKU|一一对应|不一致/)

// 专用保存入口必须把快照绑定到目标技术包当前 BOM；快照内部自洽也不能把外来 BOM 写入目标版本。
const foreignSnapshotTargetVersionId = `task7_foreign_snapshot_target_${Date.now()}`
createTechnicalDataVersionDraft(
  makeRecord({ id: foreignSnapshotTargetVersionId, status: 'PUBLISHED', reviewStage: '已发布' }),
  makeContent(foreignSnapshotTargetVersionId, [makeBomItem('BOM-TARGET', validSku.materialSkuId, '米')]),
)
const internallyConsistentForeignSnapshot = structuredClone(rereadSnapshot!)
internallyConsistentForeignSnapshot.bomItems = [
  { ...internallyConsistentForeignSnapshot.bomItems[0]!, id: 'BOM-FOREIGN', materialSkuId: 'SKU-FOREIGN' },
]
internallyConsistentForeignSnapshot.materialPriceSnapshots = [
  {
    ...internallyConsistentForeignSnapshot.materialPriceSnapshots[0]!,
    bomItemId: 'BOM-FOREIGN',
    materialSkuId: 'SKU-FOREIGN',
  },
]
internallyConsistentForeignSnapshot.materialLines = internallyConsistentForeignSnapshot.materialPriceSnapshots.map(
  ({ bomItemId: _bomItemId, ...line }) => line,
)
internallyConsistentForeignSnapshot.materialCostCny = internallyConsistentForeignSnapshot.materialPriceSnapshots[0]!.materialCostCny
internallyConsistentForeignSnapshot.comprehensiveCostCny = Number((
  internallyConsistentForeignSnapshot.materialCostCny
  + internallyConsistentForeignSnapshot.cost.customCostIdr / internallyConsistentForeignSnapshot.exchangeRateIdrPerCny
).toFixed(2))
internallyConsistentForeignSnapshot.comprehensiveCostIdr = Math.round(
  internallyConsistentForeignSnapshot.materialCostCny * internallyConsistentForeignSnapshot.exchangeRateIdrPerCny
  + internallyConsistentForeignSnapshot.cost.customCostIdr,
)
Object.assign(internallyConsistentForeignSnapshot.cost, {
  materialCostCny: internallyConsistentForeignSnapshot.materialCostCny,
  comprehensiveCostCny: internallyConsistentForeignSnapshot.comprehensiveCostCny,
  comprehensiveCostIdr: internallyConsistentForeignSnapshot.comprehensiveCostIdr,
})
const foreignSnapshotTargetBefore = getTechnicalDataVersionContent(foreignSnapshotTargetVersionId)
assert.throws(
  () => validateSnapshotAgainstCurrentTarget(foreignSnapshotTargetVersionId, internallyConsistentForeignSnapshot),
  /目标技术包|当前 BOM|BOM-TARGET|BOM-FOREIGN|不一致/,
)
assert.deepEqual(getTechnicalDataVersionContent(foreignSnapshotTargetVersionId), foreignSnapshotTargetBefore)

// 汇总字段必须由逐行价格、自定义 IDR 成本和汇率重算，不能只校验顶层与 cost 子对象彼此相等。
const forgedTotalsTargetVersionId = `task7_forged_totals_target_${Date.now()}`
createTechnicalDataVersionDraft(
  makeRecord({ id: forgedTotalsTargetVersionId, status: 'PUBLISHED', reviewStage: '已发布' }),
  makeContent(forgedTotalsTargetVersionId, structuredClone(rereadSnapshot!.bomItems)),
)
const forgedTotalsSnapshot = structuredClone(rereadSnapshot!)
forgedTotalsSnapshot.materialPriceSnapshots.forEach((line) => {
  line.standardUnitPriceCny = 999
  line.materialCostCny = 1
})
forgedTotalsSnapshot.customCostsIdr = [{ title: '车位费', amountIdr: 5000, currency: 'IDR' }]
forgedTotalsSnapshot.customCosts = structuredClone(forgedTotalsSnapshot.customCostsIdr)
forgedTotalsSnapshot.materialCostCny = 1
forgedTotalsSnapshot.comprehensiveCostCny = 1
forgedTotalsSnapshot.comprehensiveCostIdr = 1
Object.assign(forgedTotalsSnapshot.cost, {
  materialCostCny: 1,
  customCostIdr: 1,
  comprehensiveCostCny: 1,
  comprehensiveCostIdr: 1,
})
const forgedTotalsTargetBefore = getTechnicalDataVersionContent(forgedTotalsTargetVersionId)
assert.throws(
  () => validateSnapshotAgainstCurrentTarget(forgedTotalsTargetVersionId, forgedTotalsSnapshot),
  /物料成本|自定义成本|综合成本|重算|不一致/,
)
assert.deepEqual(getTechnicalDataVersionContent(forgedTotalsTargetVersionId), forgedTotalsTargetBefore)

function makeSelfConsistentSnapshotForTarget(input: {
  bomItem: TechnicalBomItem
  standardUnitPriceCny: number
  conversionToPricingUnit?: number
  customCostsIdr: Array<{ title: string; amountIdr: number; currency: 'IDR' }>
}) {
  const result = structuredClone(rereadSnapshot!)
  const conversionToPricingUnit = input.conversionToPricingUnit ?? 1
  const rawMaterialCostCny =
    input.bomItem.unitConsumption
    * (input.bomItem.sampleQuantity ?? 1)
    * (1 + input.bomItem.lossRate)
    * conversionToPricingUnit
    * input.standardUnitPriceCny
  const materialCostCny = Math.round((rawMaterialCostCny + Number.EPSILON) * 100) / 100
  const customCostIdr = Math.round(input.customCostsIdr.reduce((total, item) => total + item.amountIdr, 0))
  const comprehensiveCostCny = Math.round((rawMaterialCostCny + customCostIdr / result.exchangeRateIdrPerCny + Number.EPSILON) * 100) / 100
  const comprehensiveCostIdr = Math.round(rawMaterialCostCny * result.exchangeRateIdrPerCny + customCostIdr)
  result.bomItems = [structuredClone(input.bomItem)]
  result.materialPriceSnapshots = [{
    ...result.materialPriceSnapshots[0]!,
    bomItemId: input.bomItem.id,
    materialSkuId: input.bomItem.materialSkuId!,
    usage: input.bomItem.unitConsumption,
    sampleQuantity: input.bomItem.sampleQuantity ?? 1,
    usageUnit: input.bomItem.unit!,
    lossRate: input.bomItem.lossRate,
    conversionToPricingUnit,
    standardUnitPriceCny: input.standardUnitPriceCny,
    materialCostCny,
  }]
  result.materialLines = result.materialPriceSnapshots.map((line) => ({ ...line }))
  result.customCostsIdr = structuredClone(input.customCostsIdr)
  result.customCosts = structuredClone(input.customCostsIdr)
  result.materialCostCny = materialCostCny
  result.comprehensiveCostCny = comprehensiveCostCny
  result.comprehensiveCostIdr = comprehensiveCostIdr
  Object.assign(result.cost, {
    materialCostCny,
    customCostIdr,
    comprehensiveCostCny,
    comprehensiveCostIdr,
  })
  return result
}

function createSnapshotBindingTarget(id: string, bomItem: TechnicalBomItem, customCosts: Array<{ title: string; amountIdr: number }> = []): void {
  const content = makeContent(id, [bomItem])
  content.bomCustomCosts = customCosts
  createTechnicalDataVersionDraft(
    makeRecord({ id, status: 'PUBLISHED', reviewStage: '已发布' }),
    content,
  )
}

// 即使 id 与 SKU 相同，调用方也不能篡改目标 BOM 的名称、供应商、适用 SKU 等其余业务字段。
const fullFieldTargetVersionId = `task10_full_field_target_${Date.now()}`
const fullFieldTargetBomItem: TechnicalBomItem = {
  ...makeBomItem('BOM-TARGET', validSku.materialSkuId, '米'),
  name: '目标物料名称',
  supplier: '目标供应商',
  applicableSkuCodes: ['SKU-TARGET'],
  linkedPatternIds: ['PATTERN-TARGET'],
  usageProcessCodes: ['SEWING', 'CUTTING'],
}
createSnapshotBindingTarget(fullFieldTargetVersionId, fullFieldTargetBomItem)
const tamperedFullFieldSnapshot = makeSelfConsistentSnapshotForTarget({
  bomItem: {
    ...fullFieldTargetBomItem,
    name: '篡改物料名称',
    supplier: '篡改供应商',
    applicableSkuCodes: ['SKU-TAMPERED'],
  },
  standardUnitPriceCny: 8.7654,
  customCostsIdr: [],
})
const fullFieldTargetBefore = getTechnicalDataVersionContent(fullFieldTargetVersionId)
assert.throws(
  () => validateSnapshotAgainstCurrentTarget(fullFieldTargetVersionId, tamperedFullFieldSnapshot),
  /目标技术包|当前 BOM|业务字段|不一致/,
)
assert.deepEqual(getTechnicalDataVersionContent(fullFieldTargetVersionId), fullFieldTargetBefore)
const reorderedNestedArraySnapshot = makeSelfConsistentSnapshotForTarget({
  bomItem: {
    ...fullFieldTargetBomItem,
    usageProcessCodes: ['CUTTING', 'SEWING'],
  },
  standardUnitPriceCny: 8.7654,
  customCostsIdr: [],
})
assert.throws(
  () => validateSnapshotAgainstCurrentTarget(fullFieldTargetVersionId, reorderedNestedArraySnapshot),
  /目标技术包|当前 BOM|业务字段|不一致/,
  'BOM 内业务数组按原顺序比较，调用方不能通过重排数组改写正式事实',
)
assert.deepEqual(getTechnicalDataVersionContent(fullFieldTargetVersionId), fullFieldTargetBefore)

// 调用方把标准价改成 999 并同步伪造所有成本字段，也不能覆盖当前物料档案可信标准价。
const trustedPriceTargetVersionId = `task10_trusted_price_target_${Date.now()}`
const trustedPriceTargetBomItem = { ...fullFieldTargetBomItem, id: 'BOM-TRUSTED-PRICE' }
createSnapshotBindingTarget(trustedPriceTargetVersionId, trustedPriceTargetBomItem)
const tamperedTrustedPriceSnapshot = makeSelfConsistentSnapshotForTarget({
  bomItem: trustedPriceTargetBomItem,
  standardUnitPriceCny: 999,
  customCostsIdr: [],
})
const trustedPriceTargetBefore = getTechnicalDataVersionContent(trustedPriceTargetVersionId)
assert.throws(
  () => validateSnapshotAgainstCurrentTarget(trustedPriceTargetVersionId, tamperedTrustedPriceSnapshot),
  /标准单价|物料价格|当前物料档案|不一致/,
)
assert.deepEqual(getTechnicalDataVersionContent(trustedPriceTargetVersionId), trustedPriceTargetBefore)
const tamperedConversionSnapshot = makeSelfConsistentSnapshotForTarget({
  bomItem: trustedPriceTargetBomItem,
  standardUnitPriceCny: 8.7654,
  conversionToPricingUnit: 2,
  customCostsIdr: [],
})
assert.throws(
  () => validateSnapshotAgainstCurrentTarget(trustedPriceTargetVersionId, tamperedConversionSnapshot),
  /单位换算|当前物料档案|不一致/,
)
assert.deepEqual(getTechnicalDataVersionContent(trustedPriceTargetVersionId), trustedPriceTargetBefore)

// 正式快照自定义成本必须绑定目标技术包，而不是接受调用方自洽的任意金额。
const trustedCustomCostTargetVersionId = `task10_trusted_custom_cost_target_${Date.now()}`
const trustedCustomCostTargetBomItem = { ...fullFieldTargetBomItem, id: 'BOM-TRUSTED-CUSTOM-COST' }
createSnapshotBindingTarget(trustedCustomCostTargetVersionId, trustedCustomCostTargetBomItem)
const tamperedCustomCostSnapshot = makeSelfConsistentSnapshotForTarget({
  bomItem: trustedCustomCostTargetBomItem,
  standardUnitPriceCny: 8.7654,
  customCostsIdr: [{ title: '伪造加工费', amountIdr: 5000, currency: 'IDR' }],
})
const trustedCustomCostTargetBefore = getTechnicalDataVersionContent(trustedCustomCostTargetVersionId)
assert.throws(
  () => validateSnapshotAgainstCurrentTarget(trustedCustomCostTargetVersionId, tamperedCustomCostSnapshot),
  /目标技术包|自定义成本|不一致/,
)
assert.deepEqual(getTechnicalDataVersionContent(trustedCustomCostTargetVersionId), trustedCustomCostTargetBefore)

function recalculateSnapshotTotalsForRate(
  snapshot: NonNullable<TechnicalDataVersionContent['bomPricingSnapshot']>,
  exchangeRateIdrPerCny: number,
): void {
  const rawMaterialCostCny = snapshot.materialPriceSnapshots.reduce(
    (total, line) => total + line.usage * line.sampleQuantity * (1 + line.lossRate) * line.conversionToPricingUnit * line.standardUnitPriceCny,
    0,
  )
  const customCostIdr = Math.round(snapshot.customCostsIdr.reduce((total, item) => total + item.amountIdr, 0))
  const materialCostCny = Math.round((rawMaterialCostCny + Number.EPSILON) * 100) / 100
  const comprehensiveCostCny = Math.round((rawMaterialCostCny + customCostIdr / exchangeRateIdrPerCny + Number.EPSILON) * 100) / 100
  const comprehensiveCostIdr = Math.round(rawMaterialCostCny * exchangeRateIdrPerCny + customCostIdr)
  snapshot.exchangeRateIdrPerCny = exchangeRateIdrPerCny
  snapshot.materialCostCny = materialCostCny
  snapshot.comprehensiveCostCny = comprehensiveCostCny
  snapshot.comprehensiveCostIdr = comprehensiveCostIdr
  Object.assign(snapshot.cost, {
    exchangeRateIdrPerCny,
    materialCostCny,
    customCostIdr,
    comprehensiveCostCny,
    comprehensiveCostIdr,
  })
}

const trustedTemplateRecords = listPartTemplateRecords().slice(0, 2)
assert.equal(trustedTemplateRecords.length, 2, '正式快照可信模板测试需要两个真实部件模板')
const trustedSnapshotSourceVersionId = `task10_trusted_snapshot_source_${Date.now()}`
const trustedSnapshotSourceBomItem = { ...fullFieldTargetBomItem, id: 'BOM-TRUSTED-SNAPSHOT-SOURCE' }
createTechnicalDataVersionDraft(
  {
    ...makeRecord({ id: trustedSnapshotSourceVersionId, status: 'PUBLISHED', reviewStage: '已发布' }),
    linkedPartTemplateIds: trustedTemplateRecords.map((item) => item.id),
  },
  {
    ...makeContent(trustedSnapshotSourceVersionId, [trustedSnapshotSourceBomItem]),
    bomCustomCosts: [],
  },
)
updateLatestPcsExchangeRate({ idrPerCny: 2300, updatedBy: '系统管理员' })
const trustedSnapshotSourceBefore = getTechnicalDataVersionContent(trustedSnapshotSourceVersionId)

function buildTrustedSnapshotCandidate(): NonNullable<TechnicalDataVersionContent['bomPricingSnapshot']> {
  const snapshot = makeSelfConsistentSnapshotForTarget({
    bomItem: trustedSnapshotSourceBomItem,
    standardUnitPriceCny: 8.7654,
    customCostsIdr: [],
  })
  snapshot.frozenAt = '2026-08-02 12:00'
  snapshot.frozenBy = '跟单甲'
  snapshot.linkedPartTemplateVersions = resolveEngineeringLinkedPartTemplateVersions(
    trustedTemplateRecords.map((item) => item.id),
  )
  recalculateSnapshotTotalsForRate(snapshot, getLatestPcsExchangeRate().idrPerCny)
  return snapshot
}

// 即使调用方按伪造汇率同步重算全部成本，也必须绑定首次固化时的系统最新汇率。
const forgedExchangeRateSnapshot = buildTrustedSnapshotCandidate()
recalculateSnapshotTotalsForRate(forgedExchangeRateSnapshot, 9999)
assert.throws(
  () => validateSnapshotAgainstCurrentTarget(trustedSnapshotSourceVersionId, forgedExchangeRateSnapshot),
  /系统最新汇率|汇率.*不一致/,
)
assert.deepEqual(getTechnicalDataVersionContent(trustedSnapshotSourceVersionId), trustedSnapshotSourceBefore)

function assertForgedTemplateSnapshotRejected(
  mutate: (snapshot: NonNullable<TechnicalDataVersionContent['bomPricingSnapshot']>) => void,
): void {
  const snapshot = buildTrustedSnapshotCandidate()
  mutate(snapshot)
  assert.throws(
    () => validateSnapshotAgainstCurrentTarget(trustedSnapshotSourceVersionId, snapshot),
    /关联部件模板|模板版本|模板摘要|不一致/,
  )
  assert.deepEqual(getTechnicalDataVersionContent(trustedSnapshotSourceVersionId), trustedSnapshotSourceBefore)
}

assertForgedTemplateSnapshotRejected((snapshot) => {
  snapshot.linkedPartTemplateVersions = snapshot.linkedPartTemplateVersions.slice(0, 1)
})
assertForgedTemplateSnapshotRejected((snapshot) => {
  snapshot.linkedPartTemplateVersions.push({
    partTemplateId: 'PART-TEMPLATE-FAKE',
    templatePackageId: 'PACKAGE-FAKE',
    templateName: '伪造模板',
    updatedAt: '2026-08-02 12:00',
    geometryHash: 'fake-hash',
    sourceDxfFileName: 'fake.dxf',
    sourceRulFileName: 'fake.rul',
  })
})
assertForgedTemplateSnapshotRejected((snapshot) => {
  snapshot.linkedPartTemplateVersions.reverse()
})
assertForgedTemplateSnapshotRejected((snapshot) => {
  Object.assign(snapshot.linkedPartTemplateVersions[0]!, {
    templatePackageId: 'PACKAGE-TAMPERED',
    templateName: '篡改模板名称',
    updatedAt: '2099-01-01 00:00',
    geometryHash: 'tampered-hash',
    sourceDxfFileName: 'tampered.dxf',
    sourceRulFileName: 'tampered.rul',
  })
})

// 审计字段也必须来自同一规范构建对象，不能把持久化快照克隆后伪造操作时间、操作人或汇率来源。
for (const mutateAudit of [
  (snapshot: NonNullable<TechnicalDataVersionContent['bomPricingSnapshot']>) => { snapshot.frozenAt = '2099-01-01 00:00' },
  (snapshot: NonNullable<TechnicalDataVersionContent['bomPricingSnapshot']>) => { snapshot.frozenBy = '伪造操作人' },
  (snapshot: NonNullable<TechnicalDataVersionContent['bomPricingSnapshot']>) => {
    ;(snapshot as typeof snapshot & { exchangeRateSource: string }).exchangeRateSource = '调用方汇率'
  },
]) {
  const snapshot = buildTrustedSnapshotCandidate()
  mutateAudit(snapshot)
  assert.throws(
    () => validateSnapshotAgainstCurrentTarget(trustedSnapshotSourceVersionId, snapshot, {
      frozenAt: '2026-08-02 12:00',
      frozenBy: '跟单甲',
    }),
    /固化信息|审计字段|汇率来源|规范构建|不一致/,
  )
  assert.deepEqual(getTechnicalDataVersionContent(trustedSnapshotSourceVersionId), trustedSnapshotSourceBefore)
}

// 公共 API 不再暴露 attester、任意快照保存或可供外部拼装后保存的 canonical builder。
// 因此外部即使持有完全自洽的深克隆，也没有任何接受 snapshot 对象的正式持久化入口。
const clonedCanonicalSnapshot = structuredClone(buildTrustedSnapshotCandidate())
assert.equal('attestEngineeringBomPricingSnapshot' in snapshotSourcePublicApi, false)
assert.equal('savePublishedTechnicalDataVersionBomPricingSnapshot' in technicalVersionRepositoryPublicApi, false)
assert.equal('buildTechnicalDataVersionBomPricingSnapshot' in bomPricingPublicApi, false)
assert.equal('saveTechnicalDataVersionBomPricingSnapshot' in bomPricingPublicApi, false)
assert.doesNotThrow(() => validateSnapshotAgainstCurrentTarget(
  trustedSnapshotSourceVersionId,
  clonedCanonicalSnapshot,
  { frozenAt: '2026-08-02 12:00', frozenBy: '跟单甲' },
), '历史快照离线校验仍允许校验可信且自洽的持久化形态')
assert.deepEqual(getTechnicalDataVersionContent(trustedSnapshotSourceVersionId), trustedSnapshotSourceBefore)

// 通用 CRUD 不得把调用方快照先塞进新工程草稿，再通过发布入口洗成正式事实。
const genericUpdateBypassVersionId = `task10_generic_update_bypass_${Date.now()}`
createTechnicalDataVersionDraft(
  makeRecord({ id: genericUpdateBypassVersionId, status: 'DRAFT', reviewStage: '未提交审核' }),
  makeContent(genericUpdateBypassVersionId, [trustedSnapshotSourceBomItem]),
)
const genericUpdateBypassBefore = getTechnicalDataVersionStoreSnapshot()
assert.throws(
  () => {
    updateTechnicalDataVersionContent(genericUpdateBypassVersionId, {
      bomPricingSnapshot: structuredClone(clonedCanonicalSnapshot),
    })
    publishTechnicalDataVersionRecord(genericUpdateBypassVersionId, '2026-08-02 12:01', '伪造操作人')
  },
  /新工程来源|正式快照|规范固化|禁止提供/,
  'DRAFT 通用更新后发布不能持久化调用方伪造快照',
)
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), genericUpdateBypassBefore)

// 通用创建入口也不能直接创建携带调用方快照的已发布新工程版本。
const genericCreateBypassVersionId = `task10_generic_create_bypass_${Date.now()}`
const genericCreateBypassContent = makeContent(genericCreateBypassVersionId, [trustedSnapshotSourceBomItem])
genericCreateBypassContent.bomPricingSnapshot = structuredClone(clonedCanonicalSnapshot)
const genericCreateBypassBefore = getTechnicalDataVersionStoreSnapshot()
assert.throws(
  () => createTechnicalDataVersionDraft(
    makeRecord({ id: genericCreateBypassVersionId, status: 'PUBLISHED', reviewStage: '已发布' }),
    genericCreateBypassContent,
  ),
  /新工程来源|正式快照|规范固化|禁止提供/,
  'createTechnicalDataVersionDraft 不能直接持久化调用方伪造快照',
)
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), genericCreateBypassBefore)

const genericDraftCreateBypassVersionId = `task10_generic_draft_create_bypass_${Date.now()}`
const genericDraftCreateBypassContent = makeContent(genericDraftCreateBypassVersionId, [trustedSnapshotSourceBomItem])
genericDraftCreateBypassContent.bomPricingSnapshot = structuredClone(clonedCanonicalSnapshot)
const genericDraftCreateBypassBefore = getTechnicalDataVersionStoreSnapshot()
assert.throws(
  () => createTechnicalDataVersionDraft(
    makeRecord({ id: genericDraftCreateBypassVersionId, status: 'DRAFT', reviewStage: '未提交审核' }),
    genericDraftCreateBypassContent,
  ),
  /新工程来源|正式快照|规范固化|禁止提供/,
  '草稿状态也不能通过通用创建入口预置调用方快照',
)
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), genericDraftCreateBypassBefore)

// 即使仓储中已存在快照，通用发布入口也不能再次把它当作调用方可发布字段接受。
const genericPublishBypassBefore = getTechnicalDataVersionStoreSnapshot()
assert.throws(
  () => publishTechnicalDataVersionRecord(successVersionId, '2026-08-02 12:02', '伪造操作人'),
  /新工程来源|预置.*快照|规范固化|禁止发布/,
)
assert.deepEqual(getTechnicalDataVersionStoreSnapshot(), genericPublishBypassBefore)

const canonicalTrustedSnapshot = freezeTechnicalDataVersionBomPricingSnapshot(
  trustedSnapshotSourceVersionId,
  '2026-08-02 12:00',
  '跟单甲',
)
assert.deepEqual(
  getTechnicalDataVersionContent(trustedSnapshotSourceVersionId)?.bomPricingSnapshot,
  canonicalTrustedSnapshot,
  '目标 BOM、价格、汇率、模板与审计字段全部可信时允许首次固化',
)

// 新来源正式技术包发布后，公开内容更新入口不能改写 BOM/COST 正式字段。
assert.throws(
  () => updateTechnicalDataVersionContent(successVersionId, { bomItems: [] }),
  /已发布|正式字段|禁止修改/,
)
assert.throws(
  () => updateTechnicalDataVersionContent(successVersionId, { bomCustomCosts: [] }),
  /已发布|正式字段|禁止修改/,
)
assert.throws(
  () => updateTechnicalDataVersionContent(successVersionId, { bomPricingSnapshot: mismatchedSnapshot }),
  /已发布|正式字段|禁止修改/,
)
const publishedSnapshotBeforeExplicitUndefined = getTechnicalDataVersionContent(successVersionId)?.bomPricingSnapshot
assert.throws(
  () => updateTechnicalDataVersionContent(successVersionId, { bomPricingSnapshot: undefined }),
  /已发布|正式字段|禁止修改|规范固化/,
  'update 显式提交 undefined 仍属于删除正式快照的尝试，不能按 create 兼容规则放行',
)
assert.deepEqual(
  getTechnicalDataVersionContent(successVersionId)?.bomPricingSnapshot,
  publishedSnapshotBeforeExplicitUndefined,
)

// 工程变更来源正式启用只切换技术包事实，不得改写已关闭主单的任何专业任务。
closeEngineeringMasterOrder(engineeringMaster.masterOrderId, '跟单甲')
const engineeringChange = createEngineeringChangeTask({
  sourceMasterOrderId: engineeringMaster.masterOrderId,
  createdBy: '跟单甲',
})
const masterTasksBeforeChangeActivation = getEngineeringMasterOrderById(engineeringMaster.masterOrderId)?.tasks
const changeVersionId = `task7_change_activation_${Date.now()}`
createTechnicalDataVersionDraft(
  {
    ...makeRecord({ id: changeVersionId, status: 'PUBLISHED', reviewStage: '已发布' }),
    sourceProjectId: engineeringChange.engineeringChangeTaskId,
    sourceProjectCode: engineeringChange.engineeringChangeTaskCode,
    sourceProjectName: engineeringChange.title,
    createdFromTaskType: 'ENGINEERING_CHANGE',
    createdFromTaskId: engineeringChange.engineeringChangeTaskId,
    createdFromTaskCode: engineeringChange.engineeringChangeTaskCode,
  },
  makeContent(changeVersionId, [makeBomItem('BOM-CHANGE-ACT-1', validSku.materialSkuId, '米')]),
)
activateTechPackVersionForStyle(style.styleId, changeVersionId, '跟单甲')
assert.deepEqual(
  getEngineeringMasterOrderById(engineeringMaster.masterOrderId)?.tasks,
  masterTasksBeforeChangeActivation,
  '工程变更技术包启用不得修改来源主单任务',
)
assert.equal(getProjectArchiveFacts(productProjectId).archive?.currentTechnicalVersionId, changeVersionId)

changePrice(validSku.materialSkuId, 19.9999)
updateLatestPcsExchangeRate({ idrPerCny: 2500, updatedBy: '系统管理员' })
const frozenContent = getTechnicalDataVersionContent(successVersionId)
assert.equal(frozenContent?.bomPricingSnapshot?.materialLines[0]?.standardUnitPriceCny, 8.7654)
assert.equal(frozenContent?.bomPricingSnapshot?.exchangeRateIdrPerCny, 2250)

// 仓储读取必须深克隆正式快照，调用方修改返回值不能污染正式事实。
assert.ok(frozenContent?.bomPricingSnapshot)
frozenContent.bomPricingSnapshot.bomItems[0].name = '外部篡改'
frozenContent.bomPricingSnapshot.materialPriceSnapshots[0].materialName = '外部篡改'
frozenContent.bomPricingSnapshot.customCostsIdr[0].title = '外部篡改'
frozenContent.bomPricingSnapshot.linkedPartTemplateVersions[0].templateName = '外部篡改'
const rereadFrozenContent = getTechnicalDataVersionContent(successVersionId)
assert.notEqual(rereadFrozenContent?.bomPricingSnapshot?.bomItems[0]?.name, '外部篡改')
assert.notEqual(rereadFrozenContent?.bomPricingSnapshot?.materialPriceSnapshots[0]?.materialName, '外部篡改')
assert.notEqual(rereadFrozenContent?.bomPricingSnapshot?.customCostsIdr[0]?.title, '外部篡改')
assert.deepEqual(
  rereadFrozenContent?.bomPricingSnapshot?.linkedPartTemplateVersions.map((item) => item.partTemplateId),
  [linkedPartTemplateId],
)

console.log('pcs-tech-pack-bom-review-activation-atomic.spec.ts PASS')
