import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import '../src/data/fcs/design-revision-process-work-order-adapter.ts'
import {
  DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS,
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
  regenerateEngineeringIndependentBomFromReference,
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
import { renderPcsIndependentSamplingDetailPage } from '../src/pages/pcs-independent-sampling.ts'

const root = process.cwd()
const merchandiser = { role: '跟单', userId: 'MERCH-TEST-01', userName: '跟单-测试' }
const buyer = { role: '买手', userId: 'BUYER-TEST-01', userName: '买手-测试' }
const patternMaker = { role: '版师', userId: 'PATTERN-TEST-01', userName: '版师-测试' }
const sampleTeam = { role: '制作团队', userId: 'SAMPLE-TEST-01', userName: '制作团队-测试' }

async function upload(name: string, type: string, purpose: Parameters<typeof captureEngineeringUploadedFiles>[0]['purpose'], teamName: string, actor = buyer) {
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

const firstDesign = await upload('design-v1.png', 'image/png', 'DESIGN_IMAGE', '买手')
const secondDesign = await upload('design-v2.jpg', 'image/jpeg', 'DESIGN_IMAGE', '买手')
const wrongTeamDesign = await upload('design-wrong.png', 'image/png', 'DESIGN_IMAGE', '跟单', merchandiser)

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
  buyer,
  createdAt: '2026-08-27 09:05:00',
}), /参照商品／款式档案不存在/, '参照款必须提前建档')
assertThrowsMessage(() => createEngineeringIndependentSampling({
  sourceStyleId: sourceStyle.styleId,
  targetStyleId: 'STYLE-NOT-FOUND',
  creationReason: '目标款不存在错误案例',
  designFiles: firstDesign,
  buyer,
  createdAt: '2026-08-27 09:05:00',
}), /目标商品／款式档案不存在/, '目标款必须提前建档')
assertThrowsMessage(() => createEngineeringIndependentSampling({
  sourceStyleId: sourceStyle.styleId,
  targetStyleId: sourceStyle.styleId,
  creationReason: '同款错误案例',
  designFiles: firstDesign,
  buyer,
  createdAt: '2026-08-27 09:05:00',
}), /不能相同/, '参照款与目标款相同必须阻断')
assertThrowsMessage(() => createEngineeringIndependentSampling({
  sourceStyleId: sourceStyle.styleId,
  targetStyleId: targetStyle.styleId,
  creationReason: '缺少设计稿错误案例',
  designFiles: [],
  buyer,
  createdAt: '2026-08-27 09:05:00',
}), /设计稿/, '缺少真实设计稿必须阻断')
assertThrowsMessage(() => createEngineeringIndependentSampling({
  sourceStyleId: sourceStyle.styleId,
  targetStyleId: targetStyle.styleId,
  creationReason: '错误团队上传案例',
  designFiles: wrongTeamDesign,
  buyer,
  createdAt: '2026-08-27 09:05:00',
}), /当前买手上传/, '设计稿不是当前买手上传必须阻断')
assertThrowsMessage(() => createEngineeringIndependentSampling({
  sourceStyleId: sourceStyle.styleId,
  targetStyleId: targetStyle.styleId,
  creationReason: '   ',
  designFiles: firstDesign,
  buyer,
  createdAt: '2026-08-27 09:05:00',
}), /请填写本次设计改款要求/, '本次设计改款要求必须填写')

let record = createEngineeringIndependentSampling({
  sourceStyleId: sourceStyle.styleId,
  targetStyleId: targetStyle.styleId,
  creationReason: '调整版型并制作销售展示样衣',
  designFiles: firstDesign,
  buyer,
  createdAt: '2026-08-27 09:10:00',
})
assert.match(record.samplingTaskCode, /^ES-DR-/, '统一任务编号必须使用 ES-DR')
assert.equal(record.samplingType, 'DESIGN_REVISION')
assert.equal(record.status, 'DRAFT')
assert.equal(record.professionalTasks.length, 0, '创建时不得提前生成专业任务')
assert.equal(record.bomVersionIds.length, 1, '创建时必须直接建立一份空白物料与费用方案')
assert.equal(record.colorMappings.length, 1, '领域内部只保留整款范围，不要求买手维护新款颜色')
assert.equal(getEngineeringIndependentSamplingStep(record), 'SCHEME_CONFIRMATION')
assert.deepEqual(getEngineeringIndependentCurrentTeams(record), ['买手'])
assertThrowsMessage(() => confirmEngineeringIndependentColorMappings({
  samplingTaskId: record.samplingTaskId,
  actor: buyer,
  mappings: [],
}), /不再维护新款颜色或参考色/, '旧的新款颜色确认入口必须被领域层阻断')
assertThrowsMessage(() => confirmEngineeringIndependentMaterialConversions({
  samplingTaskId: record.samplingTaskId,
  actor: buyer,
  decisions: [],
}), /不再处理参考物料/, '旧的参考物料处理入口必须被领域层阻断')
assertThrowsMessage(() => regenerateEngineeringIndependentBomFromReference({
  samplingTaskId: record.samplingTaskId,
  targetColor: '任意颜色',
  actor: buyer,
}), /不再支持按参考色生成 BOM/, '旧的参考色带料入口必须被领域层阻断')
const draftDetailHtml = renderPcsIndependentSamplingDetailPage(record.samplingTaskId)

record = replaceEngineeringIndependentDesignFiles({
  samplingTaskId: record.samplingTaskId,
  designFiles: secondDesign,
  actor: buyer,
  replacedAt: '2026-08-27 09:15:00',
})
assert.equal(record.designFiles.length, 2, '替换设计稿必须保留历史文件')
assert.ok(record.operationLogs.some((item) => item.action === '替换设计稿'), '替换设计稿必须保留操作记录')

const manualBom = getEngineeringBomVersionById(record.bomVersionIds[0])
assert.ok(manualBom)
assert.equal(manualBom.sourceVersionId, '', '新任务不得自动带入参照款物料')
assert.equal(manualBom.materialLines.length, 0, '新任务的物料必须由买手手工添加')
saveEngineeringBomVersion({
  versionId: manualBom.bomDraftVersionId,
  role: '买手',
  userId: buyer.userId,
  userName: buyer.userName,
  materialLines: [sourceLine(manualBom.applicableSkuIds, 1.5)],
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
assert.equal(getEngineeringIndependentSamplingStep(record), 'SCHEME_CONFIRMATION')
assert.deepEqual(getEngineeringIndependentCurrentTeams(record), ['买手'])
assert.ok(record.bomVersionIds.every((id) => Boolean(getEngineeringBomVersionById(id)?.editingLockedAt)), '买手完成方案后物料与费用必须锁定')
const repeatedCompletion = completeEngineeringIndependentBuyerPreparation({ samplingTaskId: record.samplingTaskId, actor: buyer })
assert.equal(repeatedCompletion.operationLogs.length, record.operationLogs.length, '重复点击完成资料准备必须幂等')

record = confirmEngineeringIndependentSamplingPlan({
  samplingTaskId: record.samplingTaskId,
  actor: buyer,
  selectedTaskTypes: ['BASE_PATTERN', 'DISPLAY_SAMPLE'],
  displaySampleAssignment: { ...DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0] },
  sampleRequirements: [
    { targetColor: '页面不采集颜色', targetSize: 'XL', requiredQuantity: 3, requirementNote: '注意领口平整' },
  ],
  confirmedAt: '2026-08-27 09:35:00',
})
assert.equal(record.professionalTasks.length, 2, '重新制版时方案必须同时包含基码纸样与销售展示样衣')
assert.equal(getEngineeringIndependentSamplingStep(record), 'PROFESSIONAL_WORK')
assert.deepEqual(
  [record.displaySampleTeamId, record.displaySampleTeamName, record.displaySampleReceivingLocationId, record.displaySampleReceivingLocationName],
  ['PCS-DISPLAY-SAMPLE-TEAM', '制作团队', 'PCS-DISPLAY-SAMPLE-AREA', '销售展示样衣制作区'],
  '方案确认必须保存销售展示样衣的承接团队和接收位置',
)
const basePattern = record.professionalTasks.find((item) => item.taskType === 'BASE_PATTERN')
const displaySample = record.professionalTasks.find((item) => item.taskType === 'DISPLAY_SAMPLE')
assert.ok(basePattern && displaySample)
assert.deepEqual(displaySample.dependsOnTaskIds, [basePattern.taskId])
assert.equal(displaySample.sampleRequirements?.length, 1, '销售展示样衣制作安排必须只保存一项总数量')
assert.equal(displaySample.sampleRequirements?.[0]?.targetSize, 'M', '销售展示样衣默认尺码必须固定为 M')
assert.equal(displaySample.sampleRequirements?.[0]?.requiredQuantity, 3, '销售展示样衣必须保存买手填写的总件数')
assert.equal(displaySample.sampleRequirements?.[0]?.requirementNote, '注意领口平整', '销售展示样衣必须保留制作要求')
assertThrowsMessage(() => replaceEngineeringIndependentDesignFiles({
  samplingTaskId: record.samplingTaskId,
  designFiles: secondDesign,
  actor: buyer,
}), /方案确认后不能替换/, '方案确认后不得静默替换设计稿')

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
    description: '按买手确认要求制作',
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
assert.deepEqual(getEngineeringIndependentCurrentTeams(record), ['买手'])

record = confirmEngineeringIndependentSamplingResult({
  samplingTaskId: record.samplingTaskId,
  actor: buyer,
  resultVersion: 'DR-v1.0',
  resultSummary: '设计改款成果已确认，可供生产准备单判断是否复用。',
  confirmedAt: '2026-08-27 12:10:00',
})
assert.equal(record.status, 'COMPLETED')
assert.equal(getEngineeringIndependentSamplingStep(record), 'COMPLETED')
assert.ok(listReusableEngineeringIndependentSamplingResults(targetStyle.styleCode).some((item) => item.samplingTaskId === record.samplingTaskId), '整单完成后才可作为生产准备单复用输入')

const detailHtml = renderPcsIndependentSamplingDetailPage(record.samplingTaskId)
assert.match(detailHtml, /data-design-revision-basic-info/, '详情页必须以一张大卡片归纳设计改款基本信息')
assert.match(detailHtml, new RegExp(record.samplingTaskCode), '基本信息大卡片必须以任务号作为主标题')
assert.match(detailHtml, /data-design-revision-basic-columns/, '基本信息与设计稿必须使用左右两列布局')
assert.match(detailHtml, /data-design-revision-objective/, '设计改款目标必须使用独立的重点信息区')
assert.match(detailHtml, new RegExp(record.creationReason), '基本信息大卡片必须完整展示设计改款目标')
assert.match(detailHtml, /data-design-revision-design-files/, '设计稿必须归入基本信息大卡片')
assert.ok(
  detailHtml.indexOf('data-design-revision-objective') < detailHtml.indexOf('data-design-revision-design-files')
    && detailHtml.indexOf('data-design-revision-design-files') < detailHtml.indexOf('aria-label="设计改款任务步骤"'),
  '基本信息大卡片内必须先突出目标，再展示设计稿，之后才进入任务步骤',
)
assert.match(draftDetailHtml, /data-design-revision-material-pricing/, '物料与加工要求、整款费用和综合成本必须归入同一张大卡片')
assert.doesNotMatch(draftDetailHtml, /<h3[^>]*>物料与费用<\/h3>/, '合并卡片不得重复显示“物料与费用”外层标题')
assert.match(draftDetailHtml, /space-y-4 rounded-lg border bg-white p-4/, '物料表与费用表之间必须保留卡片间距')
assert.doesNotMatch(draftDetailHtml, /customCostDecision|>其他费用<\/span>/, '费用维护不得保留“其他费用”选择器')
assert.doesNotMatch(draftDetailHtml, /待校验/, '物料、费用和汇率必须直接展示可计算值')
assert.match(draftDetailHtml, /1 CNY = 2[.,]200 IDR/, '未单独维护汇率时必须展示系统默认汇率')
assert.match(detailHtml, /data-image-url=/, '已选物料必须展示可点击的真实缩略图')
assert.match(draftDetailHtml, /data-design-revision-display-sample-arrangement/, '详情页必须展示精简后的销售展示样衣制作安排')
assert.match(draftDetailHtml, /默认尺码/, '销售展示样衣制作安排必须展示默认尺码')
assert.match(draftDetailHtml, />M</, '销售展示样衣默认尺码必须展示为 M')
assert.match(draftDetailHtml, /样衣数量（件）/, '销售展示样衣制作安排必须只采集样衣总件数')
assert.match(draftDetailHtml, /制作要求/, '销售展示样衣制作安排必须保留制作要求')
assert.doesNotMatch(draftDetailHtml, />新款颜色</, '详情页不得保留新款颜色模块')
assert.doesNotMatch(draftDetailHtml, /参考物料处理|重新带入参考物料/, '详情页不得保留任何参考物料处理入口')
assert.doesNotMatch(draftDetailHtml, /add-sample-requirement|remove-sample-requirement/, '销售展示样衣制作安排不得保留多行增删入口')

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
assert.match(routes, /\/pcs\/production-preparation\/design-revision/)
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
  '专业任务不得保留绕过生产准备单生成正式技术包的旧字段、状态或文案',
)
assert.doesNotMatch(
  engineeringTaskFieldPolicy,
  /missing\.push\(['"]技术包版本['"]\)/,
  '制版完成不得以正式技术包尚未生成作为阻断条件',
)

console.log('PCS 设计改款合并、工程变更删除与生产准备时效收口专项契约：通过')
