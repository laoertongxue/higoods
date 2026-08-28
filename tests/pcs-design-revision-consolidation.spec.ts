import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  completeEngineeringIndependentBuyerPreparation,
  confirmEngineeringIndependentColorMappings,
  confirmEngineeringIndependentMaterialConversions,
  confirmEngineeringIndependentSamplingPlan,
  confirmEngineeringIndependentSamplingResult,
  createEngineeringIndependentSampling,
  getEngineeringIndependentCurrentTeams,
  getEngineeringIndependentSamplingRecord,
  getEngineeringIndependentSamplingStep,
  listReusableEngineeringIndependentSamplingResults,
  replaceEngineeringIndependentDesignFiles,
  resetEngineeringIndependentSamplingRepository,
  startEngineeringIndependentProfessionalTask,
  submitEngineeringIndependentProfessionalTask,
} from '../src/data/pcs-engineering-master-sampling.ts'
import {
  confirmEngineeringBomPricingPlan,
  createEngineeringBomVersionsForOwner,
  getEngineeringBomPricingPlan,
  getEngineeringBomVersionById,
  listEngineeringBomHistory,
  resetEngineeringBomRepository,
  saveEngineeringBomPricingPlan,
  saveEngineeringBomVersion,
} from '../src/data/pcs-engineering-bom-repository.ts'
import { captureEngineeringUploadedFiles, validateEngineeringUploadFile } from '../src/data/pcs-engineering-file-upload.ts'
import { listMaterialArchives, listMaterialSkuRecordsByMaterialId } from '../src/data/pcs-material-archive-repository.ts'
import { listSkuArchivesByStyleId, resetSkuArchiveRepository } from '../src/data/pcs-sku-archive-repository.ts'
import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'

const root = process.cwd()
const merchandiser = { role: '跟单', userId: 'MERCH-TEST-01', userName: '跟单-测试' }
const buyer = { role: '买手', userId: 'BUYER-TEST-01', userName: '买手-测试' }
const patternMaker = { role: '版师', userId: 'PATTERN-TEST-01', userName: '版师-测试' }
const sampleTeam = { role: '制作团队', userId: 'SAMPLE-TEST-01', userName: '制作团队-测试' }

async function upload(name: string, type: string, purpose: Parameters<typeof captureEngineeringUploadedFiles>[0]['purpose'], teamName: string, actor = merchandiser) {
  return captureEngineeringUploadedFiles({
    files: [new File([`real-file:${name}`], name, { type })],
    purpose,
    actor: { userId: actor.userId, userName: actor.userName, teamName },
    uploadedAt: '2026-08-27 09:00:00',
  })
}

function assertThrowsMessage(action: () => unknown, expected: RegExp, label: string): void {
  assert.throws(action, expected, label)
}

resetStyleArchiveRepository()
resetSkuArchiveRepository()
resetEngineeringBomRepository()
resetEngineeringIndependentSamplingRepository(false)

const styles = listStyleArchives().filter((item) => item.mainImageUrl)
const sourceStyle = styles.find((item) => listSkuArchivesByStyleId(item.styleId).some((sku) => sku.archiveStatus === 'ACTIVE'))
const targetStyle = styles.find((item) => item.styleId !== sourceStyle?.styleId && listSkuArchivesByStyleId(item.styleId).some((sku) => sku.archiveStatus === 'ACTIVE'))
assert.ok(sourceStyle && targetStyle, '测试必须找到两张不同且已有 SKU 的款式档案')
assert.ok(sourceStyle.mainImageUrl && targetStyle.mainImageUrl, '参照款与目标款必须有真实款式图片')

const sourceSkus = listSkuArchivesByStyleId(sourceStyle.styleId).filter((sku) => sku.archiveStatus === 'ACTIVE')
const targetSkus = listSkuArchivesByStyleId(targetStyle.styleId).filter((sku) => sku.archiveStatus === 'ACTIVE')
const sourceColor = sourceSkus[0]?.colorName
const targetSizes = [...new Set(targetSkus.map((sku) => sku.sizeName).filter(Boolean))].slice(0, 2)
assert.ok(sourceColor && targetSizes.length, '参照款颜色与目标款尺码必须可用')

const material = listMaterialArchives().find((item) => item.status === 'ACTIVE' && item.mainImageUrl)
const materialSku = material
  ? listMaterialSkuRecordsByMaterialId(material.materialId).find((item) => item.status === 'ACTIVE' && item.costPrice > 0 && item.skuImageUrl)
  : undefined
assert.ok(material && materialSku, '测试必须找到有真实图片和标准单价的物料 SKU')

function sourceLine(applicableSkuIds: string[], usage: number) {
  return {
    materialSkuId: materialSku!.materialSkuId,
    materialType: material!.categoryName,
    materialImageUrl: materialSku!.skuImageUrl,
    usage,
    sampleQuantity: 1,
    usageUnit: materialSku!.pricingUnit,
    lossRate: 0,
    applicableSkuIds,
    printRequirement: '否' as const,
    dyeRequirement: '否' as const,
    purchaseRequirement: '否' as const,
    remark: '统一设计改款专项测试物料',
  }
}

function createConfirmedSourceBom(ownerId: string, confirmedAt: string, usage: number): string {
  const versions = createEngineeringBomVersionsForOwner({
    ownerStage: 'TECH_PACK_DRAFT',
    ownerId,
    ownerCode: ownerId,
    styleId: sourceStyle!.styleId,
    buyerId: buyer.userId,
    buyerName: buyer.userName,
    createdBy: buyer.userName,
    createdAt: confirmedAt,
  })
  versions.forEach((version) => saveEngineeringBomVersion({
    versionId: version.bomDraftVersionId,
    role: '买手',
    userId: buyer.userId,
    userName: buyer.userName,
    materialLines: [sourceLine(version.applicableSkuIds, usage)],
    updatedAt: confirmedAt,
  }))
  saveEngineeringBomPricingPlan({
    ownerStage: 'TECH_PACK_DRAFT',
    ownerId,
    role: '买手',
    userId: buyer.userId,
    userName: buyer.userName,
    customCostDecision: 'NO_CUSTOM_COST',
    customCosts: [],
    updatedAt: confirmedAt,
  })
  confirmEngineeringBomPricingPlan({
    ownerStage: 'TECH_PACK_DRAFT',
    ownerId,
    role: '买手',
    userId: buyer.userId,
    userName: buyer.userName,
    confirmedAt,
  })
  return versions.find((version) => version.productColor === sourceColor)?.bomDraftVersionId || ''
}

const olderSourceVersionId = createConfirmedSourceBom('SOURCE-BOM-OLDER', '2026-08-20 10:00:00', 1)
const latestSourceVersionId = createConfirmedSourceBom('SOURCE-BOM-LATEST', '2026-08-21 10:00:00', 2)
assert.ok(olderSourceVersionId && latestSourceVersionId)
assert.equal(listEngineeringBomHistory(sourceStyle.styleCode, sourceColor)[0]?.bomDraftVersionId, latestSourceVersionId, '多个有效来源 BOM 必须优先使用最近确认版本')

const firstDesign = await upload('design-v1.png', 'image/png', 'DESIGN_IMAGE', '跟单')
const secondDesign = await upload('design-v2.jpg', 'image/jpeg', 'DESIGN_IMAGE', '跟单')
const wrongTeamDesign = await upload('design-wrong.png', 'image/png', 'DESIGN_IMAGE', '买手', buyer)

assertThrowsMessage(() => validateEngineeringUploadFile(
  new File(['not-an-image'], 'design.pdf', { type: 'application/pdf' }),
  'DESIGN_IMAGE',
), /设计稿仅支持/, '设计稿不是图片格式必须在读取前阻断')
assertThrowsMessage(() => validateEngineeringUploadFile(
  new File([], 'empty-design.png', { type: 'image/png' }),
  'DESIGN_IMAGE',
), /为空文件/, '空设计稿文件必须阻断')
assertThrowsMessage(() => createEngineeringIndependentSampling({
  sourceStyleId: 'STYLE-NOT-FOUND',
  targetStyleId: targetStyle.styleId,
  creationReason: '参照款不存在错误案例',
  designFiles: firstDesign,
  merchandiser,
  createdAt: '2026-08-27 09:05:00',
}), /参照商品／款式档案不存在/, '参照款必须提前建档')
assertThrowsMessage(() => createEngineeringIndependentSampling({
  sourceStyleId: sourceStyle.styleId,
  targetStyleId: 'STYLE-NOT-FOUND',
  creationReason: '目标款不存在错误案例',
  designFiles: firstDesign,
  merchandiser,
  createdAt: '2026-08-27 09:05:00',
}), /目标商品／款式档案不存在/, '目标款必须提前建档')
assertThrowsMessage(() => createEngineeringIndependentSampling({
  sourceStyleId: sourceStyle.styleId,
  targetStyleId: sourceStyle.styleId,
  creationReason: '同款错误案例',
  designFiles: firstDesign,
  merchandiser,
  createdAt: '2026-08-27 09:05:00',
}), /不能相同/, '参照款与目标款相同必须阻断')
assertThrowsMessage(() => createEngineeringIndependentSampling({
  sourceStyleId: sourceStyle.styleId,
  targetStyleId: targetStyle.styleId,
  creationReason: '缺少设计稿错误案例',
  designFiles: [],
  merchandiser,
  createdAt: '2026-08-27 09:05:00',
}), /设计稿/, '缺少真实设计稿必须阻断')
assertThrowsMessage(() => createEngineeringIndependentSampling({
  sourceStyleId: sourceStyle.styleId,
  targetStyleId: targetStyle.styleId,
  creationReason: '错误团队上传案例',
  designFiles: wrongTeamDesign,
  merchandiser,
  createdAt: '2026-08-27 09:05:00',
}), /当前跟单上传/, '设计稿不是当前跟单上传必须阻断')
assertThrowsMessage(() => createEngineeringIndependentSampling({
  sourceStyleId: sourceStyle.styleId,
  targetStyleId: targetStyle.styleId,
  creationReason: '   ',
  designFiles: firstDesign,
  merchandiser,
  createdAt: '2026-08-27 09:05:00',
}), /请填写本次设计改款要求/, '本次设计改款要求必须填写')

let record = createEngineeringIndependentSampling({
  sourceStyleId: sourceStyle.styleId,
  targetStyleId: targetStyle.styleId,
  creationReason: '调整版型并制作销售展示样衣',
  designFiles: firstDesign,
  merchandiser,
  createdAt: '2026-08-27 09:10:00',
})
assert.match(record.samplingTaskCode, /^ES-DR-/, '统一任务编号必须使用 ES-DR')
assert.equal(record.samplingType, 'DESIGN_REVISION')
assert.equal(record.status, 'DRAFT')
assert.equal(record.professionalTasks.length, 0, '创建时不得提前生成专业任务')
assert.equal(record.bomVersionIds.length, 0, '创建时不得提前生成 BOM')
assert.equal(getEngineeringIndependentSamplingStep(record), 'BUYER_PREPARATION')
assert.deepEqual(getEngineeringIndependentCurrentTeams(record), ['买手'])

record = replaceEngineeringIndependentDesignFiles({
  samplingTaskId: record.samplingTaskId,
  designFiles: secondDesign,
  actor: merchandiser,
  replacedAt: '2026-08-27 09:15:00',
})
assert.equal(record.designFiles.length, 2, '替换设计稿必须保留历史文件')
assert.ok(record.operationLogs.some((item) => item.action === '替换设计稿'), '替换设计稿必须保留操作记录')

record = confirmEngineeringIndependentColorMappings({
  samplingTaskId: record.samplingTaskId,
  actor: buyer,
  mappings: [
    { targetColor: '测试墨绿', sourceColor, targetSizeNames: targetSizes, mappingType: '参考 A 款颜色' },
    { targetColor: '测试米白', sourceColor: '', targetSizeNames: [targetSizes[0]], mappingType: '无参考颜色' },
  ],
  confirmedAt: '2026-08-27 09:20:00',
})
assert.equal(record.colorMappings.length, 2, '目标颜色数量可独立于参照款定义')
assert.equal(record.bomVersionIds.length, 2, '每个目标颜色必须生成一个颜色物料方案')
const referencedBom = record.bomVersionIds.map(getEngineeringBomVersionById).find((item) => item?.productColor === '测试墨绿')
assert.equal(referencedBom?.sourceVersionId, latestSourceVersionId, '参照颜色必须承接最近已完成确认的来源 BOM')

record = confirmEngineeringIndependentMaterialConversions({
  samplingTaskId: record.samplingTaskId,
  actor: buyer,
  decisions: record.materialConversionLines.map((line) => ({
    conversionLineId: line.conversionLineId,
    decision: '沿用' as const,
    targetMaterialSkuId: line.sourceMaterialSkuId,
  })),
  confirmedAt: '2026-08-27 09:25:00',
})
const noReferenceBom = record.bomVersionIds.map(getEngineeringBomVersionById).find((item) => item?.productColor === '测试米白')
assert.ok(noReferenceBom)
saveEngineeringBomVersion({
  versionId: noReferenceBom.bomDraftVersionId,
  role: '买手',
  userId: buyer.userId,
  userName: buyer.userName,
  materialLines: [sourceLine(noReferenceBom.applicableSkuIds, 1.5)],
  updatedAt: '2026-08-27 09:27:00',
})
saveEngineeringBomPricingPlan({
  ownerStage: 'INDEPENDENT_SAMPLING',
  ownerId: record.samplingTaskId,
  role: '买手',
  userId: buyer.userId,
  userName: buyer.userName,
  customCostDecision: 'HAS_CUSTOM_COST',
  customCosts: [{ title: '车位费', amountIdr: 25000, note: '整款只计算一次' }],
  updatedAt: '2026-08-27 09:28:00',
})
const pricingPlan = getEngineeringBomPricingPlan('INDEPENDENT_SAMPLING', record.samplingTaskId)
assert.equal(pricingPlan?.customCosts.length, 1)
assert.equal(pricingPlan?.customCosts[0]?.amountIdr, 25000, '物料与整款费用必须在同一 BOM 与价格方案内确认')

record = completeEngineeringIndependentBuyerPreparation({
  samplingTaskId: record.samplingTaskId,
  actor: buyer,
  completedAt: '2026-08-27 09:30:00',
})
assert.equal(getEngineeringIndependentSamplingStep(record), 'WORK_PLAN')
assert.deepEqual(getEngineeringIndependentCurrentTeams(record), ['跟单'])
assert.ok(record.bomVersionIds.every((id) => Boolean(getEngineeringBomVersionById(id)?.editingLockedAt)), '买手完成资料准备后全部目标颜色 BOM 必须锁定')
const repeatedCompletion = completeEngineeringIndependentBuyerPreparation({ samplingTaskId: record.samplingTaskId, actor: buyer })
assert.equal(repeatedCompletion.operationLogs.length, record.operationLogs.length, '重复点击完成资料准备必须幂等')

record = confirmEngineeringIndependentSamplingPlan({
  samplingTaskId: record.samplingTaskId,
  actor: merchandiser,
  selectedTaskTypes: ['DISPLAY_SAMPLE'],
  sampleRequirements: [
    { targetColor: '测试墨绿', targetSize: targetSizes[0], requiredQuantity: 2, requirementNote: '直播展示' },
    { targetColor: '测试米白', targetSize: targetSizes[0], requiredQuantity: 1, requirementNote: '陈列展示' },
  ],
  confirmedAt: '2026-08-27 09:35:00',
})
assert.equal(record.professionalTasks.length, 2, '销售展示样衣必须自动补齐基码纸样前置任务')
const basePattern = record.professionalTasks.find((item) => item.taskType === 'BASE_PATTERN')
const displaySample = record.professionalTasks.find((item) => item.taskType === 'DISPLAY_SAMPLE')
assert.ok(basePattern && displaySample)
assert.deepEqual(displaySample.dependsOnTaskIds, [basePattern.taskId])
assert.deepEqual(displaySample.sampleRequirements?.map((item) => item.requiredQuantity), [2, 1], '跟单必须按颜色、尺码、数量下达制作要求')
assertThrowsMessage(() => replaceEngineeringIndependentDesignFiles({
  samplingTaskId: record.samplingTaskId,
  designFiles: secondDesign,
  actor: merchandiser,
}), /工作安排确认后不能替换/, '工作安排确认后不得静默替换设计稿')

record = startEngineeringIndependentProfessionalTask({
  taskId: basePattern.taskId,
  actor: patternMaker,
  startedAt: '2026-08-27 10:00:00',
})
const patternFile = await upload('base-pattern.prj', 'application/octet-stream', 'PATTERN_SOURCE', '版师', patternMaker)
record = submitEngineeringIndependentProfessionalTask({
  taskId: basePattern.taskId,
  actor: patternMaker,
  results: [{
    title: '基码纸样 v1.0',
    version: 'v1.0',
    description: '基码纸样实际源文件',
    applicablePartOrSize: targetSizes[0],
    files: patternFile,
  }],
  submittedAt: '2026-08-27 10:30:00',
})
assert.equal(record.professionalTasks.find((item) => item.taskId === basePattern.taskId)?.status, 'COMPLETED')
assert.equal(record.professionalTasks.find((item) => item.taskId === displaySample.taskId)?.status, 'WAIT_START', '基码纸样完成后才解锁销售展示样衣')

record = startEngineeringIndependentProfessionalTask({
  taskId: displaySample.taskId,
  actor: sampleTeam,
  startedAt: '2026-08-27 11:00:00',
})
const refreshedDisplay = record.professionalTasks.find((item) => item.taskId === displaySample.taskId)!
const sampleFiles = await Promise.all((refreshedDisplay.sampleRequirements || []).map((line, index) =>
  upload(`sample-${index + 1}.jpg`, 'image/jpeg', 'SAMPLE_RESULT', '制作团队', sampleTeam),
))
record = submitEngineeringIndependentProfessionalTask({
  taskId: displaySample.taskId,
  actor: sampleTeam,
  results: (refreshedDisplay.sampleRequirements || []).map((line, index) => ({
    title: `${line.targetColor}-${line.targetSize}销售展示样衣`,
    description: '按跟单要求制作',
    requirementLineId: line.requirementLineId,
    sampleQuantity: line.requiredQuantity,
    sampleColor: line.targetColor,
    sampleSize: line.targetSize,
    sourcePatternVersion: 'v1.0',
    files: sampleFiles[index],
  })),
  submittedAt: '2026-08-27 12:00:00',
})
assert.equal(record.status, 'WAIT_CONFIRMATION')
assert.equal(getEngineeringIndependentSamplingStep(record), 'RESULT_CONFIRMATION')
assert.deepEqual(getEngineeringIndependentCurrentTeams(record), ['跟单'])

record = confirmEngineeringIndependentSamplingResult({
  samplingTaskId: record.samplingTaskId,
  actor: merchandiser,
  resultVersion: 'DR-v1.0',
  resultSummary: '设计改款成果已确认，可供工程主单判断是否复用。',
  confirmedAt: '2026-08-27 12:10:00',
})
assert.equal(record.status, 'COMPLETED')
assert.equal(getEngineeringIndependentSamplingStep(record), 'COMPLETED')
assert.ok(listReusableEngineeringIndependentSamplingResults(targetStyle.styleCode).some((item) => item.samplingTaskId === record.samplingTaskId), '整单完成后才可作为工程主单复用输入')

const appShell = readFileSync(join(root, 'src/data/app-shell-config.ts'), 'utf8')
const routes = readFileSync(join(root, 'src/router/routes-pcs.ts'), 'utf8')
const handlers = readFileSync(join(root, 'src/main-handlers/pcs-handlers.ts'), 'utf8')
const independentPage = readFileSync(join(root, 'src/pages/pcs-independent-sampling.ts'), 'utf8')
const masterRepository = readFileSync(join(root, 'src/data/pcs-engineering-master-repository.ts'), 'utf8')
const preparationProjection = readFileSync(join(root, 'src/data/pcs-engineering-preparation-projection.ts'), 'utf8')
const techPackWorkspace = readFileSync(join(root, 'src/data/pcs-engineering-tech-pack-workspace.ts'), 'utf8')
const techPackTaskGeneration = readFileSync(join(root, 'src/data/pcs-tech-pack-task-generation.ts'), 'utf8')
const technicalDataWriteback = readFileSync(join(root, 'src/data/pcs-project-technical-data-writeback.ts'), 'utf8')
const projectDomainContract = readFileSync(join(root, 'src/data/pcs-project-domain-contract.ts'), 'utf8')
const engineeringTaskFieldPolicy = readFileSync(join(root, 'src/data/pcs-engineering-task-field-policy.ts'), 'utf8')
const taskSourceNormalizer = readFileSync(join(root, 'src/data/pcs-task-source-normalizer.ts'), 'utf8')
const techPackVersionLogTypes = readFileSync(join(root, 'src/data/pcs-tech-pack-version-log-types.ts'), 'utf8')
const allCurrentSource = [appShell, routes, handlers, independentPage, masterRepository, preparationProjection, techPackWorkspace, techPackTaskGeneration, technicalDataWriteback, projectDomainContract, engineeringTaskFieldPolicy, taskSourceNormalizer, techPackVersionLogTypes].join('\n')

assert.match(appShell, /设计改款任务/)
assert.match(routes, /\/pcs\/engineering\/design-revision/)
assert.doesNotMatch(allCurrentSource, /改款打样任务|设计打样任务|工程变更/)
assert.ok(!existsSync(join(root, 'src/pages/pcs-engineering-change.ts')))
assert.ok(!existsSync(join(root, 'src/data/pcs-engineering-change-workspace.ts')))
assert.ok(!existsSync(join(root, 'src/data/pcs-revision-task-repository.ts')))
assert.doesNotMatch(routes, /revision-sampling|design-sampling|engineering\/changes/)
assert.match(independentPage, /当前需处理的团队/)
assert.match(independentPage, /列设置/)
assert.match(masterRepository, /listReusableEngineeringIndependentProfessionalResults/)
assert.doesNotMatch(preparationProjection, /listEngineeringIndependentSamplingRecords|INDEPENDENT_SAMPLING/)
assert.match(techPackWorkspace, /ENGINEERING_MASTER/)
assert.doesNotMatch(techPackWorkspace, /INDEPENDENT_DESIGN_REVISION/)
assert.doesNotMatch(techPackTaskGeneration, /generateTechPackVersionFromPlateTask|generateTechPackVersionFromPatternTask|getPatternTechPackActionMeta/, '专业任务不得保留直接生成或写入技术包的入口')
assert.doesNotMatch(technicalDataWriteback, /generateTechPackVersionFromPlateTask|generateTechPackVersionFromPatternTask/, '技术资料写回层不得重新导出专业任务生成技术包入口')
assert.doesNotMatch(
  allCurrentSource,
  /技术包主挂载入口|制版生成技术包|花型生成新版本|改版生成新版本|primaryTechPackGenerated|已生成技术包/,
  '专业任务不得保留绕过工程主单生成正式技术包的旧字段、状态或文案',
)
assert.doesNotMatch(
  engineeringTaskFieldPolicy,
  /missing\.push\(['"]技术包版本['"]\)/,
  '制版完成不得以正式技术包尚未生成作为阻断条件',
)

console.log('PCS 设计改款合并、工程变更删除与生产准备时效收口专项契约：通过')
