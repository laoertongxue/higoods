import assert from 'node:assert/strict'

import { CURRENT_PCS_ENGINEERING_USER } from '../src/data/pcs-engineering-current-user.ts'
import {
  completeEngineeringIndependentBuyerPreparation,
  confirmEngineeringIndependentColorMappings,
  confirmEngineeringIndependentColorRequirement,
  confirmEngineeringIndependentMaterialConversions,
  confirmEngineeringIndependentSamplingPlan,
  confirmEngineeringIndependentSamplingResult,
  createEngineeringIndependentSampling,
  getEngineeringIndependentSamplingRecord,
  getEngineeringIndependentSamplingStep,
  listEngineeringIndependentSamplingRecords,
  listReusableEngineeringIndependentSamplingResults,
  regenerateEngineeringIndependentBomFromReference,
  resetEngineeringIndependentSamplingRepository,
  resolveEngineeringIndependentSamplingBomLines,
  returnEngineeringIndependentBuyerPreparation,
  reviewEngineeringIndependentProfessionalTask,
  startEngineeringIndependentProfessionalTask,
  submitEngineeringIndependentProfessionalTask,
} from '../src/data/pcs-engineering-master-sampling.ts'
import {
  confirmEngineeringBomPricingPlan,
  createEngineeringBomVersionsForOwner,
  getEngineeringBomVersionById,
  getEngineeringBomPricingPlan,
  listEngineeringBomHistory,
  listEngineeringBomVersions,
  resetEngineeringBomRepository,
  resolveEngineeringBomPricingPlan,
  saveEngineeringBomPricingPlan,
  saveEngineeringBomVersion,
} from '../src/data/pcs-engineering-bom-repository.ts'
import { captureEngineeringUploadedFiles, validateEngineeringUploadFile } from '../src/data/pcs-engineering-file-upload.ts'
import { resetEngineeringTaskUploadRepository } from '../src/data/pcs-engineering-task-upload-repository.ts'
import { listMaterialArchives, listMaterialSkuRecordsByMaterialId } from '../src/data/pcs-material-archive-repository.ts'
import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { listSkuArchivesByStyleId, resetSkuArchiveRepository } from '../src/data/pcs-sku-archive-repository.ts'

const buyer = { role: '买手', userId: 'BUYER-1', userName: '买手-王明' }
const patternMaker = { role: '版师', userId: 'PATTERN-1', userName: '版师-赵云' }
const sampleMaker = { role: '制作团队', userId: 'SAMPLE-1', userName: '样衣制作-阿兰' }
const artworkMaker = { role: '花型团队', userId: 'ARTWORK-1', userName: '花型-冰冰' }
const dyeFactory = { role: '染厂', userId: 'DYE-1', userName: '染厂-陈师傅' }

function realFile(name: string, type: string, body = 'real prototype file content'): File {
  return new File([body], name, { type })
}

async function uploaded(
  files: File[],
  purpose: Parameters<typeof captureEngineeringUploadedFiles>[0]['purpose'],
  actor: { userId: string; userName: string; teamName: string },
  roundNo = 1,
) {
  return captureEngineeringUploadedFiles({ files, purpose, actor, roundNo, uploadedAt: '2026-08-04 10:30:00' })
}

function firstActiveMaterialSku() {
  for (const material of listMaterialArchives()) {
    const sku = listMaterialSkuRecordsByMaterialId(material.materialId).find((item) => item.status === 'ACTIVE' && item.costPrice > 0 && Boolean(item.skuImageUrl || material.mainImageUrl))
    if (sku) return { material, sku }
  }
  throw new Error('测试数据缺少有标准单价的有效物料 SKU。')
}

function materialLine(materialSkuId: string, imageUrl: string, usageUnit: string, styleCode: string, productColor: string, applicableSkuIds: string[]) {
  return {
    materialSkuId,
    styleCode,
    productColor,
    materialType: '面料',
    materialImageUrl: imageUrl,
    usage: 1.25,
    sampleQuantity: 3,
    usageUnit,
    lossRate: 0.1,
    applicableSkuIds,
    printRequirement: '是' as const,
    dyeRequirement: '是' as const,
    purchaseRequirement: '否' as const,
    remark: 'A 款已完成且已确认的参考物料',
  }
}

function fillBomVersions(versionIds: string[], materialSkuId: string): void {
  versionIds.forEach((versionId, index) => {
    const version = getEngineeringBomVersionById(versionId)!
    const lines = version.materialLines.length
      ? version.materialLines
      : [{
          ...materialLine(materialSkuId, materialImageUrl, materialSku.pricingUnit, version.styleCode, version.productColor, version.applicableSkuIds),
          bomItemId: `${versionId}-LINE-${index + 1}`,
        }]
    saveEngineeringBomVersion({
      versionId,
      role: '买手',
      userId: buyer.userId,
      userName: buyer.userName,
      materialLines: lines,
      customCosts: [],
    })
  })
}

resetStyleArchiveRepository()
resetSkuArchiveRepository()
resetEngineeringBomRepository()
resetEngineeringTaskUploadRepository()
resetEngineeringIndependentSamplingRepository(true)
const revisionSeeds = listEngineeringIndependentSamplingRecords('REVISION')
assert.ok(revisionSeeds.length >= 2, 'Mock 必须提供多张改款打样单')
assert.ok(
  revisionSeeds.some((seed) => {
    const sources = seed.colorMappings.map((mapping) => mapping.sourceColor).filter(Boolean)
    return new Set(sources).size < sources.length
  }),
  'Mock 必须覆盖一个 A 款颜色对应多个 B 款颜色',
)
assert.ok(
  revisionSeeds.some((seed) => seed.colorMappings.some((mapping) => !mapping.sourceColor && mapping.mappingType === '无参考颜色')),
  'Mock 必须覆盖 B 款无来源的新颜色',
)
const confirmedSeedBom = listEngineeringBomVersions()
  .find((version) => version.ownerStage === 'TECH_PACK_DRAFT' && version.versionStatus === 'COMPLETED_CONFIRMED')
assert.ok(confirmedSeedBom, 'Mock 必须包含独立于打样任务的已完成确认历史 BOM，供参考色承接')
assert.ok(
  listEngineeringIndependentSamplingRecords().flatMap((seed) => seed.bomVersionIds).every((versionId) => getEngineeringBomVersionById(versionId)?.versionStatus === 'DRAFT'),
  '独立打样完成后 BOM 仍应为草稿，不能绕过技术包审核形成正式版本',
)
const confirmedSeedBomSnapshot = JSON.stringify(confirmedSeedBom)
assert.doesNotThrow(
  () => resetEngineeringIndependentSamplingRepository(true),
  '独立打样记录重新初始化时不得尝试修改已有的已确认 BOM',
)
assert.equal(
  JSON.stringify(getEngineeringBomVersionById(confirmedSeedBom.bomDraftVersionId)),
  confirmedSeedBomSnapshot,
  '独立打样记录重新初始化时不得覆盖已有 BOM 内容和状态',
)
const confirmedSeedVersionId = revisionSeeds[0]!.bomVersionIds[0]!
const confirmedSeedVersion = getEngineeringBomVersionById(confirmedSeedVersionId)!
saveEngineeringBomPricingPlan({
  ownerStage: confirmedSeedVersion.ownerStage,
  ownerId: confirmedSeedVersion.ownerId,
  role: '买手',
  userId: buyer.userId,
  userName: buyer.userName,
  customCostDecision: 'NO_CUSTOM_COST',
  customCosts: [],
})
confirmEngineeringBomPricingPlan({
  ownerStage: confirmedSeedVersion.ownerStage,
  ownerId: confirmedSeedVersion.ownerId,
  role: '买手',
  userId: buyer.userId,
  userName: buyer.userName,
  confirmedAt: '2026-08-04 08:00:00',
})
const confirmedSeedVersionSnapshot = JSON.stringify(getEngineeringBomVersionById(confirmedSeedVersionId))
assert.doesNotThrow(
  () => resetEngineeringIndependentSamplingRepository(true),
  '重新补种独立打样任务时不得尝试修改已有的已确认 BOM',
)
assert.equal(
  JSON.stringify(getEngineeringBomVersionById(confirmedSeedVersionId)),
  confirmedSeedVersionSnapshot,
  '重新补种独立打样任务时不得覆盖已有 BOM 内容和状态',
)
resetEngineeringIndependentSamplingRepository(false)
resetEngineeringBomRepository()
const styles = listStyleArchives().filter((item) => item.mainImageUrl)
assert.ok(styles.length >= 2)
const { material, sku: materialSku } = firstActiveMaterialSku()
const materialImageUrl = materialSku.skuImageUrl || material.mainImageUrl
assert.ok(materialImageUrl, '测试物料必须有真实对应图片')

assert.throws(() => createEngineeringIndependentSampling({ samplingType: 'REVISION', sourceStyleId: styles[0].styleId, targetStyleId: styles[0].styleId, creationReason: '验证同款阻断', merchandiser: CURRENT_PCS_ENGINEERING_USER, createdAt: '2026-08-04 09:00:00' }), /不能相同/)
assert.throws(() => createEngineeringIndependentSampling({ samplingType: 'DESIGN', sourceStyleId: styles[0].styleId, targetStyleId: styles[1].styleId, creationReason: '错误填写来源款', merchandiser: CURRENT_PCS_ENGINEERING_USER, createdAt: '2026-08-04 09:00:00' }), /不应填写来源/)
assert.throws(() => createEngineeringIndependentSampling({ samplingType: 'DESIGN', targetStyleId: styles[1].styleId, creationReason: '', merchandiser: CURRENT_PCS_ENGINEERING_USER, createdAt: '2026-08-04 09:00:00' }), /打样原因/)

const sourceBomVersions = createEngineeringBomVersionsForOwner({
  ownerStage: 'INDEPENDENT_SAMPLING',
  ownerId: 'SOURCE-CONFIRMED-BOM',
  ownerCode: 'SOURCE-CONFIRMED-BOM',
  styleId: styles[0].styleId,
  buyerId: buyer.userId,
  buyerName: buyer.userName,
  createdBy: buyer.userName,
  createdAt: '2026-08-03 09:00:00',
})
sourceBomVersions.forEach((version, index) => {
  saveEngineeringBomVersion({
    versionId: version.bomDraftVersionId,
    role: '买手',
    userId: buyer.userId,
    userName: buyer.userName,
    materialLines: [{
      ...materialLine(materialSku.materialSkuId, materialImageUrl, materialSku.pricingUnit, version.styleCode, version.productColor, version.applicableSkuIds),
      bomItemId: `${version.bomDraftVersionId}-SOURCE-${index + 1}`,
    }],
    customCosts: [],
  })
})
saveEngineeringBomPricingPlan({
  ownerStage: 'INDEPENDENT_SAMPLING',
  ownerId: 'SOURCE-CONFIRMED-BOM',
  role: '买手',
  userId: buyer.userId,
  userName: buyer.userName,
  customCostDecision: 'NO_CUSTOM_COST',
  customCosts: [],
})
confirmEngineeringBomPricingPlan({
  ownerStage: 'INDEPENDENT_SAMPLING',
  ownerId: 'SOURCE-CONFIRMED-BOM',
  role: '买手',
  userId: buyer.userId,
  userName: buyer.userName,
})

const latestSourceBomVersions = createEngineeringBomVersionsForOwner({
  ownerStage: 'INDEPENDENT_SAMPLING',
  ownerId: 'SOURCE-CONFIRMED-BOM-LATEST',
  ownerCode: 'SOURCE-CONFIRMED-BOM-LATEST',
  styleId: styles[0].styleId,
  buyerId: buyer.userId,
  buyerName: buyer.userName,
  createdBy: buyer.userName,
  createdAt: '2026-08-03 10:00:00',
})
latestSourceBomVersions.forEach((version, index) => {
  saveEngineeringBomVersion({
    versionId: version.bomDraftVersionId,
    role: '买手',
    userId: buyer.userId,
    userName: buyer.userName,
    materialLines: [{
      ...materialLine(materialSku.materialSkuId, materialImageUrl, materialSku.pricingUnit, version.styleCode, version.productColor, version.applicableSkuIds),
      bomItemId: `${version.bomDraftVersionId}-LATEST-${index + 1}`,
      usage: 2 + index,
    }],
    customCosts: [],
    updatedAt: '2026-08-03 10:05:00',
  })
})
saveEngineeringBomPricingPlan({
  ownerStage: 'INDEPENDENT_SAMPLING',
  ownerId: 'SOURCE-CONFIRMED-BOM-LATEST',
  role: '买手',
  userId: buyer.userId,
  userName: buyer.userName,
  customCostDecision: 'NO_CUSTOM_COST',
  customCosts: [],
})
confirmEngineeringBomPricingPlan({
  ownerStage: 'INDEPENDENT_SAMPLING',
  ownerId: 'SOURCE-CONFIRMED-BOM-LATEST',
  role: '买手',
  userId: buyer.userId,
  userName: buyer.userName,
  confirmedAt: '2026-08-03 10:10:00',
})

const record = createEngineeringIndependentSampling({
  samplingType: 'REVISION',
  sourceStyleId: styles[0].styleId,
  targetStyleId: styles[1].styleId,
  creationReason: '在 A 款版型基础上调整为 B 款颜色并制作直播展示样衣',
  merchandiser: CURRENT_PCS_ENGINEERING_USER,
  createdAt: '2026-08-04 09:00:00',
})
assert.equal(record.status, 'DRAFT')
assert.equal(record.professionalTasks.length, 0, '创建打样单时不得提前生成专业任务')
assert.equal(record.bomVersionIds.length, 0, '创建任务时不得按目标款档案颜色提前生成 BOM')
assert.equal(getEngineeringIndependentSamplingStep(record), 'BUYER_PREPARATION')
assert.throws(() => confirmEngineeringIndependentSamplingPlan({ samplingTaskId: record.samplingTaskId, actor: CURRENT_PCS_ENGINEERING_USER, selectedTaskTypes: ['DISPLAY_SAMPLE'] }), /买手完成目标颜色/)

const sourceColor = sourceBomVersions[0]!.productColor
const targetSizes = [...new Set(listSkuArchivesByStyleId(styles[1].styleId).map((sku) => sku.sizeName).filter(Boolean))]
assert.ok(targetSizes.length, '目标款式必须已维护尺码与 SKU')
const targetColors = ['改款夜蓝', '改款雾蓝', '改款象牙白']
const mapped = confirmEngineeringIndependentColorMappings({
  samplingTaskId: record.samplingTaskId,
  actor: buyer,
  mappings: [
    { targetColor: targetColors[0], sourceColor, targetSizeNames: targetSizes },
    { targetColor: targetColors[1], sourceColor, targetSizeNames: targetSizes.slice(0, 1) },
    { targetColor: targetColors[2], sourceColor: '', targetSizeNames: targetSizes },
  ],
})
assert.equal(mapped.bomConversionStatus, 'WAIT_MATERIAL_DECISION')
assert.equal(mapped.colorMappings.length, 3, '新款颜色数量应由买手自定义')
assert.equal(mapped.bomVersionIds.length, 3, 'N 个目标颜色必须生成 N 个 BOM 与价格草稿')
assert.equal(mapped.colorMappings.filter((mapping) => mapping.sourceColor === sourceColor).length, 2, '一个旧款颜色可以同时作为多个新款颜色的参考')
assert.equal(mapped.colorMappings.find((mapping) => mapping.targetColor === targetColors[2])?.sourceColor, '', '新款颜色可以不选择旧款参考色')
assert.ok(mapped.materialConversionLines.length >= 2, '每个有来源的新款颜色都应形成物料处理行')
const selectedSourceBom = listEngineeringBomHistory(styles[0].styleCode, sourceColor)[0]!
assert.equal(
  getEngineeringBomVersionById(mapped.bomVersionIds[0])?.sourceVersionId,
  selectedSourceBom.bomDraftVersionId,
  '同一旧款颜色存在多份合格 BOM 时必须采用最近完成确认的一份',
)
assert.equal(
  getEngineeringBomVersionById(mapped.bomVersionIds[0])?.materialLines[0]?.usage,
  selectedSourceBom.materialLines[0]?.usage,
  '新款 BOM 初始物料必须来自最近一份合格旧款 BOM',
)
assert.throws(() => confirmEngineeringIndependentColorMappings({ samplingTaskId: record.samplingTaskId, actor: buyer, mappings: [{ targetColor: 'Black', sourceColor: '', targetSizeNames: targetSizes }, { targetColor: ' black ', sourceColor: '', targetSizeNames: targetSizes }] }), /不能重复/)
const manuallyEditedTarget = getEngineeringBomVersionById(mapped.bomVersionIds[0])!
saveEngineeringBomVersion({
  versionId: manuallyEditedTarget.bomDraftVersionId,
  role: '买手',
  userId: buyer.userId,
  userName: buyer.userName,
  materialLines: manuallyEditedTarget.materialLines.map((line) => ({ ...line, usage: 9 })),
  customCosts: [],
})
saveEngineeringBomPricingPlan({
  ownerStage: manuallyEditedTarget.ownerStage,
  ownerId: manuallyEditedTarget.ownerId,
  role: '买手',
  userId: buyer.userId,
  userName: buyer.userName,
  customCostDecision: 'HAS_CUSTOM_COST',
  customCosts: [{ title: '手工试版费', amountIdr: 20_000 }],
})
confirmEngineeringIndependentColorMappings({
  samplingTaskId: record.samplingTaskId,
  actor: buyer,
  mappings: [
    { targetColor: targetColors[0], sourceColor, targetSizeNames: targetSizes },
    { targetColor: targetColors[1], sourceColor, targetSizeNames: targetSizes.slice(0, 1) },
    { targetColor: targetColors[2], sourceColor: '', targetSizeNames: targetSizes },
  ],
})
assert.equal(getEngineeringBomVersionById(mapped.bomVersionIds[0])!.materialLines[0]?.usage, 9, '重新确认颜色对应不得静默覆盖买手已修改的 BOM')
assert.equal(getEngineeringBomPricingPlan(manuallyEditedTarget.ownerStage, manuallyEditedTarget.ownerId)?.customCosts[0]?.title, '手工试版费')
const sharedCostsBeforeRegenerate = JSON.stringify(getEngineeringBomPricingPlan(manuallyEditedTarget.ownerStage, manuallyEditedTarget.ownerId)?.customCosts)
const regenerated = regenerateEngineeringIndependentBomFromReference({
  samplingTaskId: record.samplingTaskId,
  targetColor: targetColors[0],
  actor: buyer,
  regeneratedAt: '2026-08-04 09:05:00',
})
const regeneratedBom = getEngineeringBomVersionById(mapped.bomVersionIds[0])!
const currentSourceBom = listEngineeringBomHistory(styles[0].styleCode, sourceColor)[0]!
assert.equal(regeneratedBom.materialLines[0]?.usage, currentSourceBom.materialLines[0]?.usage, '明确确认重新生成后才允许重置为参考 BOM')
assert.equal(
  JSON.stringify(getEngineeringBomPricingPlan(manuallyEditedTarget.ownerStage, manuallyEditedTarget.ownerId)?.customCosts),
  sharedCostsBeforeRegenerate,
  '重新生成单个颜色物料时不得改写整款共享费用',
)
assert.ok(regenerated.operationLogs.some((log) => log.action === '按参考色重新生成 BOM'))
const converted = confirmEngineeringIndependentMaterialConversions({
  samplingTaskId: record.samplingTaskId,
  actor: buyer,
  decisions: regenerated.materialConversionLines.map((line, index) => ({
    conversionLineId: line.conversionLineId,
    decision: index === 0 ? '沿用' as const : '重新染色' as const,
    targetMaterialSkuId: line.sourceMaterialSkuId,
    dyeRequirement: index === 0 ? '否' as const : '是' as const,
    printRequirement: line.printRequirement,
    note: index === 0 ? '沿用 A 款物料' : '按 B 款颜色重新染色',
  })),
})
assert.equal(converted.bomConversionStatus, 'WAIT_MATERIAL_DECISION', '应用参考物料不等于买手已完成资料准备')
assert.ok(converted.materialConversionLines.every((line) => line.confirmedBy === buyer.userName))
assert.ok(resolveEngineeringIndependentSamplingBomLines(converted).every((line) => line.styleCode === styles[1].styleCode), '转换后的 BOM 必须归属于 B 款')

fillBomVersions(converted.bomVersionIds, materialSku.materialSkuId)
const independentBom = getEngineeringBomVersionById(converted.bomVersionIds[0])!
assert.throws(() => saveEngineeringBomVersion({ versionId: independentBom.bomDraftVersionId, role: '跟单', userId: CURRENT_PCS_ENGINEERING_USER.userId, userName: CURRENT_PCS_ENGINEERING_USER.userName, materialLines: independentBom.materialLines, customCosts: [] }), /只有买手/)
const resolvedBomLine = resolveEngineeringIndependentSamplingBomLines(converted)[0]
assert.equal(resolvedBomLine.totalRequirementQuantity, 4.125, '总需求量必须按单位用量 × 打样数量 ×（1 + 损耗率）计算')
assert.equal(resolvedBomLine.standardUnitPriceCurrency, 'CNY')
assert.ok(resolvedBomLine.materialImageUrl, 'BOM 物料必须带真实对应图片')
const buyerReady = completeEngineeringIndependentBuyerPreparation({ samplingTaskId: record.samplingTaskId, actor: buyer, completedAt: '2026-08-04 09:08:00' })
assert.equal(getEngineeringIndependentSamplingStep(buyerReady), 'WORK_PLAN')
assert.equal(buyerReady.buyerPreparationConfirmedBy, buyer.userName)
const handoffLogCount = buyerReady.operationLogs.filter((log) => log.action === '完成新款资料准备').length
const repeatedBuyerReady = completeEngineeringIndependentBuyerPreparation({ samplingTaskId: record.samplingTaskId, actor: buyer, completedAt: '2026-08-04 09:08:01' })
assert.equal(repeatedBuyerReady.buyerPreparationConfirmedAt, buyerReady.buyerPreparationConfirmedAt, '重复交接不得改写首次交接时间')
assert.equal(repeatedBuyerReady.operationLogs.filter((log) => log.action === '完成新款资料准备').length, handoffLogCount, '重复交接不得新增重复日志')
const lockedBom = getEngineeringBomVersionById(buyerReady.bomVersionIds[0])!
assert.ok(lockedBom.editingLockedAt, '买手完成资料准备后必须锁定所有目标颜色 BOM')
assert.throws(
  () => saveEngineeringBomVersion({ versionId: lockedBom.bomDraftVersionId, role: '买手', userId: buyer.userId, userName: buyer.userName, materialLines: lockedBom.materialLines, customCosts: lockedBom.customCosts }),
  /跟单退回买手修改/,
  '买手完成后不得从独立 BOM 页面绕过交接继续修改',
)
assert.throws(
  () => confirmEngineeringIndependentColorMappings({ samplingTaskId: record.samplingTaskId, actor: buyer, mappings: [{ targetColor: '完成后改色', sourceColor: '', targetSizeNames: targetSizes }] }),
  /跟单退回买手修改/,
)
assert.throws(
  () => confirmEngineeringIndependentMaterialConversions({
    samplingTaskId: record.samplingTaskId,
    actor: buyer,
    decisions: buyerReady.materialConversionLines.map((line) => ({
      conversionLineId: line.conversionLineId,
      decision: line.decision || '沿用',
      targetMaterialSkuId: line.targetMaterialSkuId,
    })),
  }),
  /跟单退回买手修改/,
)

const planned = confirmEngineeringIndependentSamplingPlan({
  samplingTaskId: record.samplingTaskId,
  actor: CURRENT_PCS_ENGINEERING_USER,
  selectedTaskTypes: ['DISPLAY_SAMPLE', 'PATTERN_ARTWORK'],
  sampleRequirements: [
    { targetColor: targetColors[0], targetSize: targetSizes[0], requiredQuantity: 2, requirementNote: '直播主推色，制作 2 件' },
    { targetColor: targetColors[1], targetSize: targetSizes[0], requiredQuantity: 1, requirementNote: '直播辅助色，制作 1 件' },
  ],
  confirmedAt: '2026-08-04 09:10:00',
})
assert.throws(
  () => confirmEngineeringIndependentColorMappings({ samplingTaskId: record.samplingTaskId, actor: buyer, mappings: [{ targetColor: '计划后改色', sourceColor: '', targetSizeNames: targetSizes }] }),
  /工作安排确认后不能再修改颜色对应/,
  '工作安排确认后必须锁定目标颜色，避免专业团队使用的 BOM 对象发生变化',
)
assert.deepEqual(new Set(planned.professionalTasks.map((task) => task.taskType)), new Set(['BASE_PATTERN', 'DISPLAY_SAMPLE', 'PATTERN_ARTWORK']), '销售展示样衣必须自动补齐基码纸样')
const base = planned.professionalTasks.find((task) => task.taskType === 'BASE_PATTERN')!
const sample = planned.professionalTasks.find((task) => task.taskType === 'DISPLAY_SAMPLE')!
const pattern = planned.professionalTasks.find((task) => task.taskType === 'PATTERN_ARTWORK')!
assert.equal(sample.status, 'WAIT_DEPENDENCY')

assert.throws(() => validateEngineeringUploadFile(realFile('paper.jpg', 'image/jpeg'), 'PATTERN_SOURCE'), /仅支持/)
const baseFiles = await uploaded(
  [realFile('base-pattern-v1.prj', 'application/octet-stream')],
  'PATTERN_SOURCE',
  { userId: patternMaker.userId, userName: patternMaker.userName, teamName: '版师团队' },
)
startEngineeringIndependentProfessionalTask({ taskId: base.taskId, actor: patternMaker, startedAt: '2026-08-04 10:00:00' })
submitEngineeringIndependentProfessionalTask({
  taskId: base.taskId,
  actor: patternMaker,
  results: [{ title: 'B 款基码纸样', version: 'v1.0', description: '按 B 款胸围和衣长完成基码', applicablePartOrSize: 'M 码', files: baseFiles }],
  submittedAt: '2026-08-04 11:00:00',
})
assert.equal(getEngineeringIndependentSamplingRecord(record.samplingTaskId)!.professionalTasks.find((task) => task.taskId === sample.taskId)!.status, 'WAIT_START')

const sampleFiles = await uploaded(
  [realFile('display-sample.jpg', 'image/jpeg')],
  'SAMPLE_RESULT',
  { userId: sampleMaker.userId, userName: sampleMaker.userName, teamName: '制作团队' },
)
startEngineeringIndependentProfessionalTask({ taskId: sample.taskId, actor: sampleMaker })
const firstSampleRequirement = sample.sampleRequirements?.[0]
assert.ok(firstSampleRequirement)
assert.throws(
  () => submitEngineeringIndependentProfessionalTask({
    taskId: sample.taskId,
    actor: sampleMaker,
    results: (sample.sampleRequirements || []).map((requirement, index) => ({
      title: `B 款销售展示样衣纸样版本测试 ${index + 1}`,
      description: requirement.requirementNote || '直播销售展示样衣',
      requirementLineId: requirement.requirementLineId,
      sampleQuantity: requirement.requiredQuantity,
      sampleColor: requirement.targetColor,
      sampleSize: requirement.targetSize,
      sourcePatternVersion: '不存在的纸样版本',
      files: sampleFiles,
    })),
  }),
  /只能选择已完成的基码纸样版本/,
  '销售展示样衣不得手填或引用不存在的纸样版本',
)
assert.throws(
  () => submitEngineeringIndependentProfessionalTask({
    taskId: sample.taskId,
    actor: sampleMaker,
    results: (sample.sampleRequirements || []).map((requirement, index) => ({
      title: `B 款销售展示样衣差异测试 ${index + 1}`,
      description: requirement.requirementNote || '直播销售展示样衣',
      requirementLineId: requirement.requirementLineId,
      sampleQuantity: requirement.requiredQuantity,
      sampleColor: index === 0 ? '实际改色' : requirement.targetColor,
      sampleSize: requirement.targetSize,
      sourcePatternVersion: 'v1.0',
      files: sampleFiles,
    })),
  }),
  /实际交付与制作要求不一致，请填写差异说明/,
  '销售展示样衣与跟单要求不一致时必须填写差异说明',
)
submitEngineeringIndependentProfessionalTask({
  taskId: sample.taskId,
  actor: sampleMaker,
  results: [
    {
      title: 'B 款销售展示样衣 1-1',
      description: firstSampleRequirement.requirementNote,
      requirementLineId: firstSampleRequirement.requirementLineId,
      sampleQuantity: 1,
      sampleColor: firstSampleRequirement.targetColor,
      sampleSize: firstSampleRequirement.targetSize,
      sourcePatternVersion: 'v1.0',
      files: sampleFiles,
    },
    {
      title: 'B 款销售展示样衣 1-2',
      description: firstSampleRequirement.requirementNote,
      requirementLineId: firstSampleRequirement.requirementLineId,
      sampleQuantity: 1,
      sampleColor: firstSampleRequirement.targetColor,
      sampleSize: firstSampleRequirement.targetSize,
      sourcePatternVersion: 'v1.0',
      files: sampleFiles,
    },
    ...(sample.sampleRequirements || []).slice(1).map((requirement, index) => ({
      title: `B 款销售展示样衣 ${index + 2}`,
      description: requirement.requirementNote,
      requirementLineId: requirement.requirementLineId,
      sampleQuantity: requirement.requiredQuantity,
      sampleColor: requirement.targetColor,
      sampleSize: requirement.targetSize,
      sourcePatternVersion: 'v1.0',
      files: sampleFiles,
    })),
  ],
})
assert.equal(
  getEngineeringIndependentSamplingRecord(record.samplingTaskId)!.professionalTasks.find((task) => task.taskId === sample.taskId)!.results.length,
  3,
  '同一制作要求必须允许制作团队分多行提交多件实际样衣',
)

const artworkFilesA = await uploaded(
  [realFile('artwork-a.jpg', 'image/jpeg'), realFile('artwork-a.ai', 'application/postscript')],
  'PATTERN_ARTWORK',
  { userId: artworkMaker.userId, userName: artworkMaker.userName, teamName: '花型团队' },
)
const artworkFilesB = await uploaded(
  [realFile('artwork-b.jpg', 'image/jpeg'), realFile('artwork-b.psd', 'image/vnd.adobe.photoshop')],
  'PATTERN_ARTWORK',
  { userId: artworkMaker.userId, userName: artworkMaker.userName, teamName: '花型团队' },
)
startEngineeringIndependentProfessionalTask({ taskId: pattern.taskId, actor: artworkMaker })
submitEngineeringIndependentProfessionalTask({
  taskId: pattern.taskId,
  actor: artworkMaker,
  results: [
    { title: '花型 A', version: 'v1.0', description: '正面主花', files: artworkFilesA },
    { title: '花型 B', version: 'v1.0', description: '袖口辅花', files: artworkFilesB },
  ],
})
let current = getEngineeringIndependentSamplingRecord(record.samplingTaskId)!
let patternTask = current.professionalTasks.find((task) => task.taskId === pattern.taskId)!
assert.equal(patternTask.status, 'WAIT_REVIEW')
assert.ok(patternTask.results.flatMap((result) => result.files).every((file) => file.dataUrl.startsWith('data:') && file.uploadedByName === artworkMaker.userName))
reviewEngineeringIndependentProfessionalTask({
  taskId: pattern.taskId,
  actor: buyer,
  decisions: patternTask.results.map((result, index) => ({ resultId: result.resultId, approved: index === 0, reason: index ? '花色偏深' : '' })),
})
patternTask = getEngineeringIndependentSamplingRecord(record.samplingTaskId)!.professionalTasks.find((task) => task.taskId === pattern.taskId)!
assert.equal(patternTask.status, 'REWORK')
assert.equal(patternTask.results[1].rejectReason, '花色偏深')
const artworkReworkFiles = await uploaded(
  [realFile('artwork-b-v2.jpg', 'image/jpeg'), realFile('artwork-b-v2.ai', 'application/postscript')],
  'PATTERN_ARTWORK',
  { userId: artworkMaker.userId, userName: artworkMaker.userName, teamName: '花型团队' },
  2,
)
submitEngineeringIndependentProfessionalTask({ taskId: pattern.taskId, actor: artworkMaker, results: [{ title: '花型 B 改进版', version: 'v2.0', description: '降低饱和度', files: artworkReworkFiles }] })
patternTask = getEngineeringIndependentSamplingRecord(record.samplingTaskId)!.professionalTasks.find((task) => task.taskId === pattern.taskId)!
reviewEngineeringIndependentProfessionalTask({ taskId: pattern.taskId, actor: buyer, decisions: patternTask.results.map((result) => ({ resultId: result.resultId, approved: true })) })
assert.equal(getEngineeringIndependentSamplingRecord(record.samplingTaskId)!.status, 'WAIT_CONFIRMATION')
confirmEngineeringIndependentSamplingResult({ samplingTaskId: record.samplingTaskId, actor: CURRENT_PCS_ENGINEERING_USER, resultVersion: 'v1.0', resultSummary: 'A 款已转换为 B 款并完成销售展示成果', confirmedAt: '2026-08-04 18:00:00' })
assert.ok(
  converted.bomVersionIds.every((versionId) => getEngineeringBomVersionById(versionId)?.versionStatus === 'DRAFT'),
  '独立打样完成不应把 BOM 草稿提前变成正式版本，正式版本仍由技术包审核形成',
)
assert.equal(listReusableEngineeringIndependentSamplingResults(styles[1].styleCode)[0].samplingTaskId, record.samplingTaskId)
assert.equal(listEngineeringIndependentSamplingRecords('DESIGN').length, 0)

const colorRecord = createEngineeringIndependentSampling({ samplingType: 'DESIGN', targetStyleId: styles[0].styleId, creationReason: '原创设计并验证面料调色接力', merchandiser: CURRENT_PCS_ENGINEERING_USER, createdAt: '2026-08-04 19:00:00' })
assert.equal(colorRecord.bomVersionIds.length, 0)
const designSizes = [...new Set(listSkuArchivesByStyleId(styles[0].styleId).map((sku) => sku.sizeName).filter(Boolean))]
const designMapped = confirmEngineeringIndependentColorMappings({
  samplingTaskId: colorRecord.samplingTaskId,
  actor: buyer,
  mappings: [
    { targetColor: '设计火焰红', sourceColor: '', targetSizeNames: designSizes },
    { targetColor: '设计石墨黑', sourceColor: '', targetSizeNames: designSizes.slice(0, 1) },
  ],
})
assert.equal(designMapped.bomVersionIds.length, 2)
fillBomVersions(designMapped.bomVersionIds, materialSku.materialSkuId)
saveEngineeringBomPricingPlan({
  ownerStage: 'INDEPENDENT_SAMPLING',
  ownerId: colorRecord.samplingTaskId,
  role: '买手',
  userId: buyer.userId,
  userName: buyer.userName,
  customCostDecision: 'HAS_CUSTOM_COST',
  customCosts: [{
    customCostId: '',
    title: '车位费',
    amountIdr: 15000,
    note: '统一作用于整款',
    displayOrder: 1,
    maintainedBy: buyer.userName,
    maintainedAt: '2026-08-04 19:05:00',
  }],
})
assert.equal(
  resolveEngineeringBomPricingPlan('INDEPENDENT_SAMPLING', colorRecord.samplingTaskId).resolved.cost.customCostIdr,
  15000,
  '多个目标颜色共用一份整款费用，综合成本只能计入一次车位费',
)
completeEngineeringIndependentBuyerPreparation({ samplingTaskId: colorRecord.samplingTaskId, actor: buyer })
const returnedToBuyer = returnEngineeringIndependentBuyerPreparation({
  samplingTaskId: colorRecord.samplingTaskId,
  actor: CURRENT_PCS_ENGINEERING_USER,
  reason: '目标颜色说明需要补充后再安排专业工作',
  returnedAt: '2026-08-04 19:20:00',
})
assert.equal(getEngineeringIndependentSamplingStep(returnedToBuyer), 'BUYER_PREPARATION')
assert.equal(returnedToBuyer.buyerPreparationConfirmedAt, '')
assert.match(returnedToBuyer.operationLogs[0].detail, /目标颜色说明需要补充/)
const unlockedBom = getEngineeringBomVersionById(returnedToBuyer.bomVersionIds[0])!
assert.equal(unlockedBom.editingLockedAt, '', '跟单退回后必须重新开放 BOM 与价格维护')
assert.doesNotThrow(() => saveEngineeringBomVersion({
  versionId: unlockedBom.bomDraftVersionId,
  role: '买手',
  userId: buyer.userId,
  userName: buyer.userName,
  materialLines: unlockedBom.materialLines,
  customCosts: unlockedBom.customCosts,
}))
completeEngineeringIndependentBuyerPreparation({ samplingTaskId: colorRecord.samplingTaskId, actor: buyer })
const colorPlan = confirmEngineeringIndependentSamplingPlan({ samplingTaskId: colorRecord.samplingTaskId, actor: CURRENT_PCS_ENGINEERING_USER, selectedTaskTypes: ['DISPLAY_SAMPLE', 'COLOR_FABRIC'] })
const colorTask = colorPlan.professionalTasks.find((task) => task.taskType === 'COLOR_FABRIC')!
assert.ok(
  colorPlan.professionalTasks.find((task) => task.taskType === 'DISPLAY_SAMPLE')?.sampleRequirements?.length,
  '设计打样也必须由跟单下达销售展示样衣制作要求',
)
assert.throws(() => startEngineeringIndependentProfessionalTask({ taskId: colorTask.taskId, actor: dyeFactory }), /先由跟单/)
confirmEngineeringIndependentColorRequirement({ taskId: colorTask.taskId, actor: CURRENT_PCS_ENGINEERING_USER, pantoneColorCode: '18-1664 TCX', colorName: '火焰红' })
startEngineeringIndependentProfessionalTask({ taskId: colorTask.taskId, actor: dyeFactory })
const colorFiles = await uploaded(
  [realFile('fabric-color-result.jpg', 'image/jpeg')],
  'COLOR_RESULT',
  { userId: dyeFactory.userId, userName: dyeFactory.userName, teamName: '染厂' },
)
submitEngineeringIndependentProfessionalTask({ taskId: colorTask.taskId, actor: dyeFactory, results: [{ title: '面料色样', description: '按潘通色号完成调色', files: colorFiles }], dyeColorCode: 'DYE-01' })
const waitingColor = getEngineeringIndependentSamplingRecord(colorRecord.samplingTaskId)!.professionalTasks.find((task) => task.taskId === colorTask.taskId)!
assert.equal(waitingColor.status, 'WAIT_REVIEW')
assert.throws(() => reviewEngineeringIndependentProfessionalTask({ taskId: colorTask.taskId, actor: buyer, decisions: [{ resultId: waitingColor.results[0].resultId, approved: false }] }), /未通过原因/)

const boundaryRecord = createEngineeringIndependentSampling({
  samplingType: 'DESIGN',
  targetStyleId: styles[1].styleId,
  creationReason: '验证目标颜色原子保存和删除边界',
  merchandiser: CURRENT_PCS_ENGINEERING_USER,
  createdAt: '2026-08-04 20:00:00',
})
const boundarySkuCount = listSkuArchivesByStyleId(styles[1].styleId).length
assert.throws(
  () => confirmEngineeringIndependentColorMappings({
    samplingTaskId: boundaryRecord.samplingTaskId,
    actor: buyer,
    mappings: [
      { targetColor: '原子有效色', sourceColor: '', targetSizeNames: targetSizes },
      { targetColor: '原子缺尺码色', sourceColor: '', targetSizeNames: [] },
    ],
  }),
  /至少选择一个尺码/,
)
assert.equal(getEngineeringIndependentSamplingRecord(boundaryRecord.samplingTaskId)!.bomVersionIds.length, 0, '任一目标颜色不合法时不得留下部分 BOM')
assert.equal(listSkuArchivesByStyleId(styles[1].styleId).length, boundarySkuCount, '任一目标颜色不合法时不得留下部分 SKU')

const boundaryMapped = confirmEngineeringIndependentColorMappings({
  samplingTaskId: boundaryRecord.samplingTaskId,
  actor: buyer,
  mappings: [
    { targetColor: '保留色', sourceColor: '', targetSizeNames: targetSizes },
    { targetColor: '本任务删除色', sourceColor: '', targetSizeNames: targetSizes.slice(0, 1) },
  ],
})
assert.equal(boundaryMapped.bomVersionIds.length, 2)
const removedColorSkuIds = listSkuArchivesByStyleId(styles[1].styleId).filter((sku) => sku.colorName === '本任务删除色').map((sku) => sku.skuId)
assert.ok(removedColorSkuIds.length > 0)
const afterRemoval = confirmEngineeringIndependentColorMappings({
  samplingTaskId: boundaryRecord.samplingTaskId,
  actor: buyer,
  mappings: [{ targetColor: '保留色', sourceColor: '', targetSizeNames: targetSizes }],
})
assert.equal(afterRemoval.colorMappings.length, 1)
assert.equal(afterRemoval.bomVersionIds.length, 1, '删除目标颜色只应删除当前打样任务内对应的 BOM 草稿')
assert.ok(
  removedColorSkuIds.every((skuId) => listSkuArchivesByStyleId(styles[1].styleId).some((sku) => sku.skuId === skuId)),
  '删除目标颜色不得删除目标款式档案中已经建立的 SKU',
)

let preparationError = ''
try {
  completeEngineeringIndependentBuyerPreparation({ samplingTaskId: boundaryRecord.samplingTaskId, actor: buyer })
} catch (error) {
  preparationError = error instanceof Error ? error.message : String(error)
}
assert.match(preparationError, /目标颜色“保留色”尚未维护物料/, '买手交接必须指出缺少物料的具体目标颜色')
assert.match(preparationError, /尚未确认本次是否有自定义费用/, '买手交接必须同时指出整款费用尚未决定')
assert.equal(getEngineeringIndependentSamplingRecord(boundaryRecord.samplingTaskId)?.buyerPreparationConfirmedAt, '', '任一资料不完整时不得推进打样任务')
assert.ok(!getEngineeringBomVersionById(afterRemoval.bomVersionIds[0])?.editingLockedAt, '任一资料不完整时不得留下部分锁定')

fillBomVersions(afterRemoval.bomVersionIds, materialSku.materialSkuId)
saveEngineeringBomPricingPlan({
  ownerStage: 'INDEPENDENT_SAMPLING',
  ownerId: boundaryRecord.samplingTaskId,
  role: '买手',
  userId: buyer.userId,
  userName: buyer.userName,
  customCostDecision: 'HAS_CUSTOM_COST',
  customCosts: [],
})
assert.throws(
  () => confirmEngineeringBomPricingPlan({
    ownerStage: 'INDEPENDENT_SAMPLING',
    ownerId: boundaryRecord.samplingTaskId,
    role: '买手',
    userId: buyer.userId,
    userName: buyer.userName,
  }),
  /至少填写一项费用/,
  '所有共用的整款确认入口都必须阻断“选择有费用但没有费用明细”',
)
assert.equal(getEngineeringBomPricingPlan('INDEPENDENT_SAMPLING', boundaryRecord.samplingTaskId)?.status, 'DRAFT', '确认失败后整款方案必须保持可编辑')
assert.ok(afterRemoval.bomVersionIds.every((versionId) => getEngineeringBomVersionById(versionId)?.versionStatus === 'DRAFT'), '确认失败后所有颜色物料方案必须保持草稿，不得部分确认')

console.log('pcs-independent-sampling.spec PASS')
