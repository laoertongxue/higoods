import assert from 'node:assert/strict'

import { CURRENT_PCS_ENGINEERING_USER } from '../src/data/pcs-engineering-current-user.ts'
import {
  confirmEngineeringIndependentColorMappings,
  confirmEngineeringIndependentColorRequirement,
  confirmEngineeringIndependentMaterialConversions,
  confirmEngineeringIndependentSamplingPlan,
  confirmEngineeringIndependentSamplingResult,
  createEngineeringIndependentSampling,
  getEngineeringIndependentSamplingRecord,
  getEngineeringIndependentTargetColorGroups,
  listEngineeringIndependentSamplingRecords,
  listReusableEngineeringIndependentSamplingResults,
  resetEngineeringIndependentSamplingRepository,
  resolveEngineeringIndependentSamplingBomLines,
  reviewEngineeringIndependentProfessionalTask,
  startEngineeringIndependentProfessionalTask,
  submitEngineeringIndependentProfessionalTask,
} from '../src/data/pcs-engineering-master-sampling.ts'
import {
  confirmEngineeringBomVersion,
  createEngineeringBomVersionsForOwner,
  getEngineeringBomVersionById,
  resetEngineeringBomRepository,
  saveEngineeringBomVersion,
} from '../src/data/pcs-engineering-bom-repository.ts'
import { captureEngineeringUploadedFiles, validateEngineeringUploadFile } from '../src/data/pcs-engineering-file-upload.ts'
import { resetEngineeringTaskUploadRepository } from '../src/data/pcs-engineering-task-upload-repository.ts'
import { listMaterialArchives, listMaterialSkuRecordsByMaterialId } from '../src/data/pcs-material-archive-repository.ts'
import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'

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

function completeBomVersions(versionIds: string[], materialSkuId: string): void {
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
    confirmEngineeringBomVersion({ versionId, role: '买手', userId: buyer.userId, userName: buyer.userName })
  })
}

resetStyleArchiveRepository()
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
  revisionSeeds.some((seed) => seed.colorMappings.some((mapping) => !mapping.sourceColor && mapping.mappingType === 'B 款新增颜色')),
  'Mock 必须覆盖 B 款无来源的新颜色',
)
const confirmedSeedVersionId = revisionSeeds[0]!.bomVersionIds[0]!
confirmEngineeringBomVersion({
  versionId: confirmedSeedVersionId,
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
  confirmEngineeringBomVersion({ versionId: version.bomDraftVersionId, role: '买手', userId: buyer.userId, userName: buyer.userName })
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
assert.throws(() => confirmEngineeringIndependentSamplingPlan({ samplingTaskId: record.samplingTaskId, actor: CURRENT_PCS_ENGINEERING_USER, selectedTaskTypes: ['DISPLAY_SAMPLE'] }), /颜色和物料/)

const sourceColor = sourceBomVersions[0]!.productColor
const targetColorGroups = getEngineeringIndependentTargetColorGroups(record.samplingTaskId)
const mapped = confirmEngineeringIndependentColorMappings({
  samplingTaskId: record.samplingTaskId,
  actor: buyer,
  mappings: targetColorGroups.map((group, index) => ({
    targetColor: group.productColor,
    sourceColor,
    mappingType: index === 0 ? '沿用颜色' as const : '改为新颜色' as const,
  })),
})
assert.equal(mapped.bomConversionStatus, 'WAIT_MATERIAL_DECISION')
assert.ok(mapped.materialConversionLines.length >= targetColorGroups.length, '每个有来源的 B 款颜色都应形成物料处理行')
const converted = confirmEngineeringIndependentMaterialConversions({
  samplingTaskId: record.samplingTaskId,
  actor: buyer,
  decisions: mapped.materialConversionLines.map((line, index) => ({
    conversionLineId: line.conversionLineId,
    decision: index === 0 ? '沿用' as const : '重新染色' as const,
    targetMaterialSkuId: line.sourceMaterialSkuId,
    dyeRequirement: index === 0 ? '否' as const : '是' as const,
    printRequirement: line.printRequirement,
    note: index === 0 ? '沿用 A 款物料' : '按 B 款颜色重新染色',
  })),
})
assert.equal(converted.bomConversionStatus, 'CONFIRMED')
assert.ok(converted.materialConversionLines.every((line) => line.confirmedBy === buyer.userName))
assert.ok(resolveEngineeringIndependentSamplingBomLines(converted).every((line) => line.styleCode === styles[1].styleCode), '转换后的 BOM 必须归属于 B 款')

completeBomVersions(converted.bomVersionIds, materialSku.materialSkuId)
const independentBom = getEngineeringBomVersionById(converted.bomVersionIds[0])!
assert.throws(() => saveEngineeringBomVersion({ versionId: independentBom.bomDraftVersionId, role: '跟单', userId: CURRENT_PCS_ENGINEERING_USER.userId, userName: CURRENT_PCS_ENGINEERING_USER.userName, materialLines: independentBom.materialLines, customCosts: [] }), /只有买手|只有草稿/)
const resolvedBomLine = resolveEngineeringIndependentSamplingBomLines(converted)[0]
assert.equal(resolvedBomLine.totalRequirementQuantity, 4.125, '总需求量必须按单位用量 × 打样数量 ×（1 + 损耗率）计算')
assert.equal(resolvedBomLine.standardUnitPriceCurrency, 'CNY')
assert.ok(resolvedBomLine.materialImageUrl, 'BOM 物料必须带真实对应图片')

const planned = confirmEngineeringIndependentSamplingPlan({
  samplingTaskId: record.samplingTaskId,
  actor: CURRENT_PCS_ENGINEERING_USER,
  selectedTaskTypes: ['DISPLAY_SAMPLE', 'PATTERN_ARTWORK'],
  confirmedAt: '2026-08-04 09:10:00',
})
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
submitEngineeringIndependentProfessionalTask({
  taskId: sample.taskId,
  actor: sampleMaker,
  results: [{ title: 'B 款销售展示样衣', description: '直播销售展示样衣', sampleQuantity: 1, sampleColor: targetColorGroups[0]!.productColor, sampleSize: 'M', sourcePatternVersion: 'v1.0', files: sampleFiles }],
})

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
assert.equal(listReusableEngineeringIndependentSamplingResults(styles[1].styleCode)[0].samplingTaskId, record.samplingTaskId)
assert.equal(listEngineeringIndependentSamplingRecords('DESIGN').length, 0)

const colorRecord = createEngineeringIndependentSampling({ samplingType: 'DESIGN', targetStyleId: styles[0].styleId, creationReason: '原创设计并验证面料调色接力', merchandiser: CURRENT_PCS_ENGINEERING_USER, createdAt: '2026-08-04 19:00:00' })
completeBomVersions(colorRecord.bomVersionIds, materialSku.materialSkuId)
const colorPlan = confirmEngineeringIndependentSamplingPlan({ samplingTaskId: colorRecord.samplingTaskId, actor: CURRENT_PCS_ENGINEERING_USER, selectedTaskTypes: ['DISPLAY_SAMPLE', 'COLOR_FABRIC'] })
const colorTask = colorPlan.professionalTasks.find((task) => task.taskType === 'COLOR_FABRIC')!
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

console.log('pcs-independent-sampling.spec PASS')
