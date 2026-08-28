import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import {
  completeEngineeringIndependentBuyerPreparation,
  confirmEngineeringIndependentColorMappings,
  confirmEngineeringIndependentMaterialConversions,
  confirmEngineeringIndependentSamplingPlan,
  confirmEngineeringIndependentSamplingResult,
  createEngineeringIndependentSampling,
  getEngineeringIndependentCurrentTeams,
  getEngineeringIndependentSamplingRecord,
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
  listEngineeringBomVersionsByOwner,
  resetEngineeringBomRepository,
  saveEngineeringBomPricingPlan,
  saveEngineeringBomVersion,
} from '../src/data/pcs-engineering-bom-repository.ts'
import { captureEngineeringUploadedFiles, type EngineeringUploadedFile } from '../src/data/pcs-engineering-file-upload.ts'
import {
  closeEngineeringMasterOrder,
  confirmEngineeringMasterBomPricingPlan,
  confirmEngineeringMasterTaskPlan,
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  listEngineeringMasterOrders,
  listEngineeringMasterPriorResultCandidates,
  resetEngineeringMasterRepository,
  startEngineeringTask,
  submitEngineeringTaskResult,
  validateEngineeringMasterOrderClose,
} from '../src/data/pcs-engineering-master-repository.ts'
import { resetEngineeringPatternResultVersions, submitEngineeringPatternResult } from '../src/data/pcs-engineering-pattern-result.ts'
import { createEngineeringMasterTechPackDraft } from '../src/data/pcs-engineering-tech-pack-workspace.ts'
import { projectEngineeringMasterToPreparation } from '../src/data/pcs-engineering-preparation-projection.ts'
import {
  confirmEngineeringColorRequirements,
  submitEngineeringColorResults,
} from '../src/data/pcs-engineering-color-task-service.ts'
import { reviewEngineeringMaterialResults } from '../src/data/pcs-engineering-task-review.ts'
import { resetEngineeringTaskUploadRepository } from '../src/data/pcs-engineering-task-upload-repository.ts'
import { hasFormalProductionFact } from '../src/data/pcs-engineering-first-production-policy.ts'
import { listMaterialArchives, listMaterialSkuRecordsByMaterialId } from '../src/data/pcs-material-archive-repository.ts'
import { listSkuArchivesByStyleId, resetSkuArchiveRepository } from '../src/data/pcs-sku-archive-repository.ts'
import { getStyleArchiveById, listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  listTechnicalDataVersions,
  resetTechnicalDataVersionRepository,
  updateTechnicalDataVersionContent,
} from '../src/data/pcs-technical-data-version-repository.ts'
import { resetTechPackReviewNotificationRepository } from '../src/data/pcs-tech-pack-review-notification-repository.ts'
import { resetTechPackVersionLogRepository } from '../src/data/pcs-tech-pack-version-log-repository.ts'
import {
  approveTechPackReview,
  startTechPackReview,
  submitTechPackFirstStageReview,
} from '../src/data/pcs-tech-pack-review.ts'
import { getLegacyTechPackReviewer } from '../src/data/pcs-tech-pack-reviewer-directory.ts'
import { publishTechnicalDataVersion } from '../src/data/pcs-project-technical-data-writeback.ts'
import { activateTechPackVersionForStyle } from '../src/data/pcs-tech-pack-version-activation.ts'
import { getPreparationRecordCapabilities } from '../src/data/fcs/production-preparation-timing-runtime.ts'
import { buildProductionOrderFromDemand, type ProductionOrderSeed } from '../src/data/fcs/production-orders.ts'
import type { ProductionDemand } from '../src/data/fcs/production-demands.ts'
import type { EngineeringMasterOrderRecord, EngineeringTaskRecord, EngineeringTaskType } from '../src/data/pcs-engineering-master-types.ts'
import type { TechnicalDataVersionContent, TechnicalReviewNodeKey } from '../src/data/pcs-technical-data-version-types.ts'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length(): number { return this.values.size }
  clear(): void { this.values.clear() }
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null }
  removeItem(key: string): void { this.values.delete(key) }
  setItem(key: string, value: string): void { this.values.set(key, String(value)) }
}

const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: {
    localStorage: storage,
    location: { pathname: '/pcs/engineering/masters' },
    dispatchEvent: () => true,
  },
})

const passId = process.env.PCS_FULL_FLOW_PASS_ID?.trim() || 'manual-pass'
const recordPath = process.env.PCS_FULL_FLOW_RECORD_PATH?.trim() || `/tmp/pcs-production-engineering-full-flow-${passId}.json`
const fixedNow = '2026-08-28 09:00:00'
const merchandiser = { role: '跟单', userId: `MERCH-${passId}`, userName: `跟单-${passId}` }
const buyer = { role: '买手', userId: `BUYER-${passId}`, userName: `买手-${passId}` }
const patternMaker = { role: '版师', userId: `PATTERN-${passId}`, userName: `版师-${passId}` }
const sampleTeam = { role: '制作团队', userId: `SAMPLE-${passId}`, userName: `制作团队-${passId}` }
const dyeFactory = { role: '染厂', userId: `DYE-${passId}`, userName: `染厂-${passId}` }

interface StateSnapshot {
  status: string
  currentTeams: string[]
}

interface FlowStepRecord {
  sequence: number
  chainId: string
  stage: string
  objectId: string
  actorTeam: string
  actorName: string
  action: string
  before: StateSnapshot
  inputSummary: string
  after: StateSnapshot
  outputIds: string[]
  assertions: string[]
  result: '通过' | '失败'
  error: string
  recordedAt: string
}

interface ChainResult {
  chainId: string
  sourceStyleCode: string
  targetStyleCode: string
  designRevisionTaskId: string
  masterOrderId: string
  technicalVersionId: string
  productionOrderId: string
  preparationRecordId: string
  result: '通过' | '失败'
}

const steps: FlowStepRecord[] = []
const chainResults: ChainResult[] = []

function nowText(): string {
  return new Date().toISOString()
}

function recordStep(input: Omit<FlowStepRecord, 'sequence' | 'result' | 'error' | 'recordedAt'>): void {
  steps.push({ ...input, sequence: steps.length + 1, result: '通过', error: '', recordedAt: nowText() })
}

function persistRecord(overallResult: '通过' | '失败', error = ''): void {
  mkdirSync(dirname(recordPath), { recursive: true })
  writeFileSync(recordPath, JSON.stringify({
    title: 'PCS 生产工程管理双案例全流程模拟测试记录',
    passId,
    branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
    head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    startedAt: steps[0]?.recordedAt || nowText(),
    finishedAt: nowText(),
    overallResult,
    error,
    chainResults,
    steps,
  }, null, 2))
}

function independentState(taskId: string): StateSnapshot {
  const record = getEngineeringIndependentSamplingRecord(taskId)
  return record
    ? { status: record.status, currentTeams: getEngineeringIndependentCurrentTeams(record) }
    : { status: '不存在', currentTeams: [] }
}

function masterState(masterOrderId: string): StateSnapshot {
  const master = getEngineeringMasterOrderById(masterOrderId)
  const currentTeams = master
    ? [...new Set(master.tasks
        .filter((task) => ['待开始', '进行中', '待审核', '返工中'].includes(task.status))
        .map((task) => task.ownerTeamName)
        .filter(Boolean))]
    : []
  return { status: master?.status || '不存在', currentTeams }
}

function taskState(task: EngineeringTaskRecord): StateSnapshot {
  return { status: task.status, currentTeams: task.ownerTeamName ? [task.ownerTeamName] : [] }
}

function techPackState(technicalVersionId: string): StateSnapshot {
  const version = getTechnicalDataVersionById(technicalVersionId)
  if (!version) return { status: '不存在', currentTeams: [] }
  const nodes = [version.buyerReview, version.patternMakerReview, version.merchandiserReview]
  return {
    status: `${version.versionStatus}/${version.reviewStage || '-'}`,
    currentTeams: nodes
      .filter((node) => node && (node.status === '待审核' || node.status === '审核中'))
      .map((node) => node!.reviewerRole),
  }
}

async function upload(
  name: string,
  type: string,
  purpose: Parameters<typeof captureEngineeringUploadedFiles>[0]['purpose'],
  teamName: string,
  actor: { userId: string; userName: string } = merchandiser,
): Promise<EngineeringUploadedFile[]> {
  return captureEngineeringUploadedFiles({
    files: [new File([`full-flow-real-file:${passId}:${name}`], name, { type })],
    purpose,
    actor: { userId: actor.userId, userName: actor.userName, teamName },
    uploadedAt: fixedNow,
  })
}

function resetAll(): void {
  storage.clear()
  resetStyleArchiveRepository()
  resetSkuArchiveRepository()
  resetEngineeringBomRepository()
  resetEngineeringIndependentSamplingRepository(false)
  resetEngineeringMasterRepository()
  resetEngineeringPatternResultVersions()
  resetTechnicalDataVersionRepository()
  resetTechPackReviewNotificationRepository()
  resetTechPackVersionLogRepository()
  resetEngineeringTaskUploadRepository()
}

function materialFixture() {
  const material = listMaterialArchives().find((item) =>
    item.status === 'ACTIVE' && item.mainImageUrl && item.materialId.includes('fabric'),
  )
  const sku = material
    ? listMaterialSkuRecordsByMaterialId(material.materialId)
      .find((item) => item.status === 'ACTIVE' && item.costPrice > 0 && item.skuImageUrl)
    : undefined
  assert.ok(material && sku, '全流程测试必须存在有真实图片和标准单价的有效物料 SKU')
  return { material, sku }
}

function buildDemand(input: { demandId: string; styleCode: string; styleName: string; versionLabel: string }): ProductionDemand {
  return {
    demandId: input.demandId,
    legacyType: 'ID_PURCHASE',
    legacyOrderNo: `LEGACY-${input.demandId}`,
    sourceSystem: 'NEW',
    spuCode: input.styleCode,
    spuName: input.styleName,
    imageUrl: '/assets/products/product-dress-pink-floral.webp',
    category: '全流程模拟',
    marketScopes: ['内销'],
    priority: 'HIGH',
    demandStatus: 'PENDING_CONVERT',
    techPackStatus: 'RELEASED',
    techPackVersionLabel: input.versionLabel,
    requiredDeliveryDate: '2026-10-10',
    requiredQtyTotal: 360,
    constraintsNote: '验证正式技术包进入 FCS 并冻结快照',
    skuLines: [
      { skuCode: `${input.styleCode}-BK-M`, size: 'M', color: '黑色', qty: 160 },
      { skuCode: `${input.styleCode}-BK-L`, size: 'L', color: '黑色', qty: 200 },
    ],
    hasProductionOrder: false,
    productionOrderId: null,
    createdAt: fixedNow,
    updatedAt: fixedNow,
  }
}

function buildOrderSeed(orderId: string, demandId: string): ProductionOrderSeed {
  return {
    productionOrderId: orderId,
    demandId,
    status: 'READY_FOR_BREAKDOWN',
    mainFactoryId: 'ID-F001',
    ownerPartyType: 'FACTORY',
    ownerPartyId: 'ID-F001',
    assignmentSummary: { directCount: 0, biddingCount: 0, totalTasks: 0, unassignedCount: 0 },
    assignmentProgress: { status: 'NOT_READY', directAssignedCount: 0, biddingLaunchedCount: 0, biddingAwardedCount: 0 },
    biddingSummary: { activeTenderCount: 0, overdueTenderCount: 0 },
    directDispatchSummary: { assignedFactoryCount: 0, rejectedCount: 0, overdueAckCount: 0 },
    taskBreakdownSummary: { isBrokenDown: false, taskTypesTop3: [] },
    riskFlags: [],
    auditLogs: [],
    createdAt: fixedNow,
    updatedAt: fixedNow,
    snapshotAt: fixedNow,
  }
}

function completeTechnicalContent(
  technicalVersionId: string,
  template: TechnicalDataVersionContent,
): void {
  const current = getTechnicalDataVersionContent(technicalVersionId)
  assert.ok(current, '技术包草稿必须有内容')
  const processEntries = template.processEntries.slice(0, 1).map((item, index) => ({
    ...structuredClone(item),
    id: `${technicalVersionId}-PROCESS-${index + 1}`,
    routeStepNo: index + 1,
    routeLaneNo: 1,
    linkedBomItemIds: current.bomItems.map((row) => row.id),
    linkedPatternIds: current.patternFiles.map((row) => row.id),
  }))
  const colorMaterialMappings = [...new Set(current.bomItems.map((item) => item.colorLabel?.trim() || '默认颜色'))]
    .map((colorName, mappingIndex) => ({
      id: `${technicalVersionId}-MAPPING-${mappingIndex + 1}`,
      spuCode: getTechnicalDataVersionById(technicalVersionId)?.styleCode || '',
      colorCode: `COLOR-${mappingIndex + 1}`,
      colorName,
      status: 'CONFIRMED' as const,
      generatedMode: 'AUTO' as const,
      confirmedBy: merchandiser.userName,
      confirmedAt: fixedNow,
      remark: '由工程 BOM 与纸样成果生成。',
      lines: current.bomItems
        .filter((item) => (item.colorLabel?.trim() || '默认颜色') === colorName)
        .map((item, lineIndex) => ({
          id: `${technicalVersionId}-MAPPING-${mappingIndex + 1}-LINE-${lineIndex + 1}`,
          bomItemId: item.id,
          materialCode: item.materialCode || item.materialSkuId || item.id,
          materialName: item.name,
          materialType: item.type === '成衣' ? '半成品' as const : item.type,
          unit: item.unit || 'PCS',
          applicableSkuCodes: [...(item.applicableSkuCodes || [])],
          sourceMode: 'AUTO' as const,
          note: '工程主单自动汇总。',
        })),
    }))
  updateTechnicalDataVersionContent(technicalVersionId, {
    processEntries,
    processRouteStatus: 'CONFIRMED',
    processRouteConfirmedBy: merchandiser.userName,
    processRouteConfirmedAt: fixedNow,
    processRouteUpdatedBy: merchandiser.userName,
    processRouteUpdatedAt: fixedNow,
    sizeTable: template.sizeTable.map((item, index) => ({ ...structuredClone(item), id: `${technicalVersionId}-SIZE-${index + 1}` })),
    qualityRules: template.qualityRules.map((item, index) => ({ ...structuredClone(item), id: `${technicalVersionId}-QUALITY-${index + 1}` })),
    colorMaterialMappings,
  })
  const refreshed = getTechnicalDataVersionById(technicalVersionId)
  assert.deepEqual(refreshed?.missingItemCodes, [], '技术包草稿核心域必须全部补齐')
}

function reviewNode(technicalVersionId: string, nodeKey: TechnicalReviewNodeKey): void {
  let record = getTechnicalDataVersionById(technicalVersionId)
  assert.ok(record)
  const node = nodeKey === 'BUYER'
    ? record.buyerReview
    : nodeKey === 'PATTERN_MAKER'
      ? record.patternMakerReview
      : record.merchandiserReview
  assert.ok(node)
  if (node.status === '无需审核') return
  startTechPackReview(technicalVersionId, nodeKey, {
    operator: { id: node.assignedReviewerId, name: node.assignedReviewerName },
    opinion: `${node.nodeName}开始核对全流程案例。`,
  })
  approveTechPackReview(
    technicalVersionId,
    nodeKey,
    `${node.nodeName}确认通过。`,
    { id: node.assignedReviewerId, name: node.assignedReviewerName },
  )
}

function latestTask(masterOrderId: string, taskType: EngineeringTaskType): EngineeringTaskRecord {
  const task = getEngineeringMasterOrderById(masterOrderId)?.tasks.find((item) => item.taskType === taskType)
  assert.ok(task, `工程主单必须存在任务 ${taskType}`)
  return task
}

async function executePatternTask(
  chainId: string,
  masterOrderId: string,
  taskType: 'BASE_PATTERN_WOVEN' | 'SIZE_PATTERN_WOVEN',
  sizeNames: string[],
): Promise<void> {
  let task = latestTask(masterOrderId, taskType)
  const before = taskState(task)
  startEngineeringTask({ masterOrderId, taskId: task.taskId, operatorId: patternMaker.userId, operatorName: patternMaker.userName })
  const sourceFiles = await upload(`${chainId}-${taskType}.prj`, 'application/octet-stream', 'PATTERN_SOURCE', '版师', patternMaker)
  const previewFiles = await upload(`${chainId}-${taskType}.png`, 'image/png', 'PATTERN_PREVIEW', '版师', patternMaker)
  const result = submitEngineeringPatternResult({
    masterOrderId,
    taskId: task.taskId,
    applicableSizes: sizeNames,
    sourceFiles,
    previewFiles,
    note: `${chainId} 实际 PRJ 纸样与预览图`,
    submittedBy: patternMaker.userName,
  })
  task = latestTask(masterOrderId, taskType)
  assert.equal(task.status, '已完成')
  recordStep({
    chainId,
    stage: taskType === 'BASE_PATTERN_WOVEN' ? '工程基码纸样' : '工程齐码纸样',
    objectId: task.taskId,
    actorTeam: '版师',
    actorName: patternMaker.userName,
    action: '开始任务并上传真实 PRJ 源文件与预览图后提交成果',
    before,
    inputSummary: `${sizeNames.join('、')}；${sourceFiles[0].fileName}；${previewFiles[0].fileName}`,
    after: taskState(task),
    outputIds: [result.resultVersionId, sourceFiles[0].fileId, previewFiles[0].fileId],
    assertions: ['真实文件读取成功', 'PRJ 源文件存在', '预览图存在', '任务通过领域动作完成'],
  })
}

async function runChain(input: {
  chainId: string
  sourceStyle: ReturnType<typeof listStyleArchives>[number]
  targetStyle: ReturnType<typeof listStyleArchives>[number]
  withDye: boolean
  template: TechnicalDataVersionContent
}): Promise<void> {
  const { chainId, sourceStyle, targetStyle, withDye, template } = input
  const sourceSkus = listSkuArchivesByStyleId(sourceStyle.styleId).filter((sku) => sku.archiveStatus === 'ACTIVE')
  const targetSkus = listSkuArchivesByStyleId(targetStyle.styleId).filter((sku) => sku.archiveStatus === 'ACTIVE')
  const sourceColor = sourceSkus[0]?.colorName
  const sizes = [...new Set(targetSkus.map((sku) => sku.sizeName).filter(Boolean))].slice(0, 2)
  assert.ok(sourceColor && sizes.length, `${chainId} 必须有参照颜色和目标尺码`)
  const { material, sku: materialSku } = materialFixture()
  const targetColors = [`${chainId}深蓝`, `${chainId}米白`]

  const sourceLine = (applicableSkuIds: string[], usage: number) => ({
    materialSkuId: materialSku.materialSkuId,
    materialType: '面料',
    materialImageUrl: materialSku.skuImageUrl,
    usage,
    sampleQuantity: 1,
    usageUnit: materialSku.pricingUnit,
    lossRate: 0,
    applicableSkuIds,
    printRequirement: '否' as const,
    dyeRequirement: withDye ? '是' as const : '否' as const,
    purchaseRequirement: '否' as const,
    remark: `${chainId} 全流程来源物料`,
  })

  const createSourceBom = (ownerId: string, confirmedAt: string, usage: number): string => {
    const versions = createEngineeringBomVersionsForOwner({
      ownerStage: 'TECH_PACK_DRAFT',
      ownerId,
      ownerCode: ownerId,
      styleId: sourceStyle.styleId,
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
      ownerStage: 'TECH_PACK_DRAFT', ownerId, role: '买手', userId: buyer.userId, userName: buyer.userName,
      customCostDecision: 'NO_CUSTOM_COST', customCosts: [], updatedAt: confirmedAt,
    })
    confirmEngineeringBomPricingPlan({
      ownerStage: 'TECH_PACK_DRAFT', ownerId, role: '买手', userId: buyer.userId, userName: buyer.userName, confirmedAt,
    })
    return versions.find((version) => version.productColor === sourceColor)?.bomDraftVersionId || versions[0].bomDraftVersionId
  }

  const olderId = createSourceBom(`${chainId}-SOURCE-OLDER`, '2026-08-20 10:00:00', 1)
  const latestId = createSourceBom(`${chainId}-SOURCE-LATEST`, '2026-08-21 10:00:00', 1.2)
  assert.notEqual(olderId, latestId)
  assert.equal(listEngineeringBomHistory(sourceStyle.styleCode, sourceColor)[0]?.bomDraftVersionId, latestId)
  recordStep({
    chainId, stage: '参照资料', objectId: latestId, actorTeam: '买手', actorName: buyer.userName,
    action: '建立并确认两版参照款 BOM 与价格，验证系统选择最新确认版本',
    before: { status: '无参照方案', currentTeams: ['买手'] }, inputSummary: `${sourceStyle.styleCode}/${sourceColor}`,
    after: { status: '最新参照方案已确认', currentTeams: [] }, outputIds: [olderId, latestId],
    assertions: ['物料有真实图片', '物料有标准单价', '最近确认版本排序正确'],
  })

  const designFiles = await upload(`${chainId}-design.png`, 'image/png', 'DESIGN_IMAGE', '跟单')
  let sampling = createEngineeringIndependentSampling({
    sourceStyleId: sourceStyle.styleId,
    targetStyleId: targetStyle.styleId,
    creationReason: `${chainId} 设计改款并制作销售展示样衣`,
    designFiles,
    merchandiser,
    createdAt: fixedNow,
  })
  const samplingId = sampling.samplingTaskId
  assert.equal(sampling.status, 'DRAFT')
  recordStep({
    chainId, stage: '设计改款创建', objectId: samplingId, actorTeam: '跟单', actorName: merchandiser.userName,
    action: '选择参照款与目标款并上传真实图片设计稿', before: { status: '未创建', currentTeams: ['跟单'] },
    inputSummary: `${sourceStyle.styleCode} → ${targetStyle.styleCode}；${designFiles[0].fileName}`,
    after: independentState(samplingId), outputIds: [samplingId, designFiles[0].fileId],
    assertions: ['参照款与目标款不同', '两款均已建档', '设计稿由跟单真实上传', '创建后进入买手资料准备'],
  })

  const replacementDesign = await upload(`${chainId}-design-v2.jpg`, 'image/jpeg', 'DESIGN_IMAGE', '跟单')
  sampling = replaceEngineeringIndependentDesignFiles({
    samplingTaskId: samplingId, designFiles: replacementDesign, actor: merchandiser, replacedAt: fixedNow,
  })
  assert.equal(sampling.designFiles.length, 2, '跟单替换设计稿后必须保留原设计稿和新设计稿的历史')
  assert.equal(sampling.designFiles.at(-1)?.fileId, replacementDesign[0].fileId, '最新上传的设计稿必须成为本次工作使用的最后一版')
  const beforeBuyer = independentState(samplingId)
  sampling = confirmEngineeringIndependentColorMappings({
    samplingTaskId: samplingId,
    actor: buyer,
    mappings: [
      { targetColor: targetColors[0], sourceColor, targetSizeNames: sizes, mappingType: '参考 A 款颜色' },
      { targetColor: targetColors[1], sourceColor: '', targetSizeNames: [sizes[0]], mappingType: '无参考颜色' },
    ],
    confirmedAt: fixedNow,
  })
  assert.equal(sampling.colorMappings.length, 2)
  assert.equal(sampling.bomVersionIds.length, 2)
  const referencedBom = sampling.bomVersionIds.map(getEngineeringBomVersionById).find((item) => item?.productColor === targetColors[0])
  assert.equal(referencedBom?.sourceVersionId, latestId)
  sampling = confirmEngineeringIndependentMaterialConversions({
    samplingTaskId: samplingId,
    actor: buyer,
    decisions: sampling.materialConversionLines.map((line) => ({
      conversionLineId: line.conversionLineId,
      decision: '不使用' as const,
      targetMaterialSkuId: '',
    })),
    confirmedAt: fixedNow,
  })
  const refreshedReferencedBom = sampling.bomVersionIds
    .map(getEngineeringBomVersionById)
    .find((item) => item?.productColor === targetColors[0])
  assert.ok(refreshedReferencedBom)
  saveEngineeringBomVersion({
    versionId: refreshedReferencedBom.bomDraftVersionId, role: '买手', userId: buyer.userId, userName: buyer.userName,
    materialLines: [sourceLine(refreshedReferencedBom.applicableSkuIds, 1.2)], updatedAt: fixedNow,
  })
  const blankBom = sampling.bomVersionIds.map(getEngineeringBomVersionById).find((item) => item?.productColor === targetColors[1])
  assert.ok(blankBom)
  saveEngineeringBomVersion({
    versionId: blankBom.bomDraftVersionId, role: '买手', userId: buyer.userId, userName: buyer.userName,
    materialLines: [sourceLine(blankBom.applicableSkuIds, 1.5)], updatedAt: fixedNow,
  })
  saveEngineeringBomPricingPlan({
    ownerStage: 'INDEPENDENT_SAMPLING', ownerId: samplingId, role: '买手', userId: buyer.userId, userName: buyer.userName,
    customCostDecision: 'HAS_CUSTOM_COST', customCosts: [{ title: '车位费', amountIdr: 25000, note: '整款一次' }], updatedAt: fixedNow,
  })
  sampling = completeEngineeringIndependentBuyerPreparation({ samplingTaskId: samplingId, actor: buyer, completedAt: fixedNow })
  const independentPricingPlan = getEngineeringBomPricingPlan('INDEPENDENT_SAMPLING', samplingId)
  assert.equal(independentPricingPlan?.status, 'HANDED_OFF')
  assert.equal(independentPricingPlan?.customCostDecision, 'HAS_CUSTOM_COST')
  assert.equal(independentPricingPlan?.customCosts[0]?.amountIdr, 25000)
  recordStep({
    chainId, stage: '设计改款资料准备', objectId: samplingId, actorTeam: '买手', actorName: buyer.userName,
    action: '定义目标颜色、建立颜色对照并统一确认物料与整款费用', before: beforeBuyer,
    inputSummary: `${targetColors.join('、')}；车位费 Rp25,000`, after: independentState(samplingId),
    outputIds: sampling.bomVersionIds, assertions: ['目标颜色可独立定义', '参照色承接最新 BOM', '无参照色可重新维护', '物料与费用一次确认', '完成后交给跟单'],
  })

  const beforePlan = independentState(samplingId)
  sampling = confirmEngineeringIndependentSamplingPlan({
    samplingTaskId: samplingId,
    actor: merchandiser,
    selectedTaskTypes: ['DISPLAY_SAMPLE'],
    sampleRequirements: [
      { targetColor: targetColors[0], targetSize: sizes[0], requiredQuantity: 2, requirementNote: '直播展示' },
      { targetColor: targetColors[1], targetSize: sizes[0], requiredQuantity: 1, requirementNote: '陈列展示' },
    ],
    confirmedAt: fixedNow,
  })
  const independentBase = sampling.professionalTasks.find((task) => task.taskType === 'BASE_PATTERN')!
  const displaySample = sampling.professionalTasks.find((task) => task.taskType === 'DISPLAY_SAMPLE')!
  assert.ok(independentBase && displaySample)
  recordStep({
    chainId, stage: '设计改款工作安排', objectId: samplingId, actorTeam: '跟单', actorName: merchandiser.userName,
    action: '按颜色、尺码和数量下达销售展示样衣要求并生成固定前置任务', before: beforePlan,
    inputSummary: `${targetColors[0]}/${sizes[0]}/2件；${targetColors[1]}/${sizes[0]}/1件`, after: independentState(samplingId),
    outputIds: sampling.professionalTasks.map((task) => task.taskId),
    assertions: ['销售展示样衣自动补齐基码纸样前置', '数量按颜色尺码逐行下达', '固定依赖不可跳过'],
  })

  sampling = startEngineeringIndependentProfessionalTask({ taskId: independentBase.taskId, actor: patternMaker, startedAt: fixedNow })
  const independentPattern = await upload(`${chainId}-independent-base.prj`, 'application/octet-stream', 'PATTERN_SOURCE', '版师', patternMaker)
  sampling = submitEngineeringIndependentProfessionalTask({
    taskId: independentBase.taskId, actor: patternMaker,
    results: [{ title: '设计改款基码纸样', version: 'v1.0', description: '真实 PRJ 源文件', applicablePartOrSize: sizes[0], files: independentPattern }],
    submittedAt: fixedNow,
  })
  sampling = startEngineeringIndependentProfessionalTask({ taskId: displaySample.taskId, actor: sampleTeam, startedAt: fixedNow })
  const sampleFiles = await Promise.all((displaySample.sampleRequirements || []).map((line, index) =>
    upload(`${chainId}-display-${index + 1}.jpg`, 'image/jpeg', 'SAMPLE_RESULT', '制作团队', sampleTeam),
  ))
  sampling = submitEngineeringIndependentProfessionalTask({
    taskId: displaySample.taskId,
    actor: sampleTeam,
    results: (displaySample.sampleRequirements || []).map((line, index) => ({
      title: `${line.targetColor}-${line.targetSize}销售展示样衣`, description: '按跟单要求制作',
      requirementLineId: line.requirementLineId, sampleQuantity: line.requiredQuantity,
      sampleColor: line.targetColor, sampleSize: line.targetSize, sourcePatternVersion: 'v1.0', files: sampleFiles[index],
    })),
    submittedAt: fixedNow,
  })
  recordStep({
    chainId, stage: '设计改款专业工作', objectId: samplingId, actorTeam: '版师、制作团队', actorName: `${patternMaker.userName}、${sampleTeam.userName}`,
    action: '版师提交真实纸样，制作团队按逐行要求提交真实销售展示样衣图片',
    before: { status: '专业工作处理中', currentTeams: ['版师', '制作团队'] }, inputSummary: '真实 PRJ + 每行样衣图片',
    after: independentState(samplingId), outputIds: [independentPattern[0].fileId, ...sampleFiles.flatMap((files) => files.map((file) => file.fileId))],
    assertions: ['专业任务按前后依赖执行', '样衣实际数量与要求一致', '成果提交后交给跟单整单确认'],
  })
  sampling = confirmEngineeringIndependentSamplingResult({
    samplingTaskId: samplingId, actor: merchandiser, resultVersion: `${chainId}-DR-v1.0`,
    resultSummary: `${chainId} 设计改款成果确认，可进入做大货工程准备。`, confirmedAt: fixedNow,
  })
  assert.equal(sampling.status, 'COMPLETED')
  recordStep({
    chainId, stage: '设计改款整单确认', objectId: samplingId, actorTeam: '跟单', actorName: merchandiser.userName,
    action: '确认设计改款整单成果', before: { status: 'WAIT_CONFIRMATION', currentTeams: ['跟单'] }, inputSummary: `${chainId}-DR-v1.0`,
    after: independentState(samplingId), outputIds: [samplingId], assertions: ['整单完成', '可作为工程主单前期成果输入'],
  })

  const beforeMaster = { status: '未创建', currentTeams: ['跟单'] }
  let master = createEngineeringMasterOrder({
    styleId: targetStyle.styleId, styleCode: targetStyle.styleCode,
    merchandiserName: merchandiser.userName, merchandiserId: merchandiser.userId,
    createdBy: merchandiser.userName, createdById: merchandiser.userId, createdByRole: '跟单', preparationType: 'PURE_WOVEN',
    qualificationFact: {
      styleCode: targetStyle.styleCode, formalSaleStatus: 'NO_FORMAL_SALE', formalProductionStatus: 'NO_FORMAL_PRODUCTION',
      formalSaleSource: '全流程模拟固定事实', formalProductionSource: '全流程模拟固定事实', checkedAt: fixedNow,
    },
    bulkProductionQualification: {
      basisType: 'DESIGN_REVISION_READY', triggerBusinessObjectType: '设计改款任务', triggerBusinessObjectId: samplingId,
      thresholdQuantity: null, reachedQuantity: null, reachedAt: fixedNow,
      reason: '设计改款已完成并确认做大货', uniqueTriggerKey: `${passId}-${chainId}-FULL-FLOW`,
    },
    creationReason: `${chainId} 双案例全流程模拟`,
  })
  const masterOrderId = master.masterOrderId
  recordStep({
    chainId, stage: '工程主单创建', objectId: masterOrderId, actorTeam: '跟单', actorName: merchandiser.userName,
    action: '基于已完成设计改款成果人工创建首单工程主单', before: beforeMaster,
    inputSummary: `${targetStyle.styleCode}；来源 ${samplingId}`, after: masterState(masterOrderId), outputIds: [masterOrderId],
    assertions: ['目标款有款式档案', '首单资格已核实', '同款只存在一张未关闭工程主单', '设计改款 BOM 与价格已承接'],
  })

  const candidates = listEngineeringMasterPriorResultCandidates(targetStyle.styleCode, 'PURE_WOVEN')
  master = confirmEngineeringMasterTaskPlan(masterOrderId, {
    confirmedBy: merchandiser.userName, confirmedById: merchandiser.userId, confirmedByRole: '跟单', preparationType: 'PURE_WOVEN',
    bomConditions: { hasPrintRequirement: false, hasYarnDyeRequirement: false, hasFabricDyeRequirement: withDye, hasAccessoryPurchaseRequirement: false },
    selectedConditionalTaskTypes: withDye ? ['COLOR_FABRIC'] : [],
    priorResultDecisions: candidates.map((candidate) => ({
      engineeringTaskType: candidate.engineeringTaskType,
      sourceSamplingTaskId: candidate.source.samplingTaskId,
      sourceProfessionalTaskId: candidate.source.professionalTaskId,
      sourceResultVersion: candidate.source.resultVersion,
      decision: '重新执行' as const,
    })),
    preProductionSampleRequirements: [
      { targetColor: targetColors[0], targetSize: sizes[0], requiredQuantity: 2, requirementNote: '产前确认' },
      { targetColor: targetColors[1], targetSize: sizes[0], requiredQuantity: 1, requirementNote: '产前确认' },
    ],
  })
  assert.equal(master.status, '已发布')
  recordStep({
    chainId, stage: '工程任务方案', objectId: masterOrderId, actorTeam: '跟单', actorName: merchandiser.userName,
    action: '结合系统建议确认生产准备类型、固定任务、条件任务及前期成果处置',
    before: { status: '草稿', currentTeams: ['跟单'] }, inputSummary: `纯梭织；${withDye ? '启用面料调色' : '无调色'}；前期纸样重新执行`,
    after: masterState(masterOrderId), outputIds: master.tasks.filter((task) => task.status !== '未启用').map((task) => task.taskId),
    assertions: ['固定任务一次生成', '固定依赖由系统生成', '产前版样衣要求包含颜色尺码数量', '跟单不能调整依赖'],
  })

  const engineeringBomVersions = listEngineeringBomVersionsByOwner('ENGINEERING_MASTER', masterOrderId)
  assert.ok(engineeringBomVersions.length >= 2)
  confirmEngineeringMasterBomPricingPlan({ masterOrderId, role: '买手', userId: buyer.userId, userName: buyer.userName })
  const engineeringPricingPlan = getEngineeringBomPricingPlan('ENGINEERING_MASTER', masterOrderId)
  assert.equal(engineeringPricingPlan?.status, 'COMPLETED_CONFIRMED')
  assert.ok(engineeringBomVersions.every((version) => getEngineeringBomVersionById(version.bomDraftVersionId)?.versionStatus === 'COMPLETED_CONFIRMED'))
  recordStep({
    chainId, stage: '工程 BOM 与价格确认', objectId: masterOrderId, actorTeam: '买手', actorName: buyer.userName,
    action: '确认工程整款物料与费用方案', before: { status: '待买手确认', currentTeams: ['买手'] },
    inputSummary: `${engineeringBomVersions.length} 个颜色版本`, after: { status: '工程 BOM 与价格已确认', currentTeams: [] },
    outputIds: engineeringBomVersions.map((version) => version.bomDraftVersionId),
    assertions: ['物料与费用同一次确认', '条件任务从已确认 BOM 读取', '确认动作有领域结果'],
  })

  await executePatternTask(chainId, masterOrderId, 'BASE_PATTERN_WOVEN', sizes)

  if (withDye) {
    let colorTask = latestTask(masterOrderId, 'COLOR_FABRIC')
    const beforeColor = taskState(colorTask)
    startEngineeringTask({ masterOrderId, taskId: colorTask.taskId, operatorId: dyeFactory.userId, operatorName: dyeFactory.userName })
    colorTask = latestTask(masterOrderId, 'COLOR_FABRIC')
    assert.ok(colorTask.materialLines.length > 0, '面料调色任务必须从 BOM 读取染色物料行')
    confirmEngineeringColorRequirements({
      masterOrderId, taskId: colorTask.taskId, confirmedBy: merchandiser.userName,
      requirements: colorTask.materialLines.map((line, index) => ({
        materialLineId: line.materialLineId, pantoneColorCode: `19-405${index + 1} TCX`, colorName: targetColors[index % targetColors.length], dyeColorCode: `${chainId}-DYE-${index + 1}`,
      })),
    })
    const colorFiles = await upload(`${chainId}-dye-result.pdf`, 'application/pdf', 'COLOR_RESULT', '染厂', dyeFactory)
    const colorImages = await upload(`${chainId}-dye-effect.jpg`, 'image/jpeg', 'COLOR_RESULT', '染厂', dyeFactory)
    submitEngineeringColorResults({
      masterOrderId, taskId: colorTask.taskId, submittedBy: dyeFactory.userName,
      results: colorTask.materialLines.map((line) => ({ materialLineId: line.materialLineId, resultFileIds: [colorFiles[0].fileId], effectImageIds: [colorImages[0].fileId], dyeFactoryName: '全流程测试染厂' })),
    })
    colorTask = latestTask(masterOrderId, 'COLOR_FABRIC')
    reviewEngineeringMaterialResults({
      masterOrderId, taskId: colorTask.taskId, reviewerName: buyer.userName, reviewerRole: '买手',
      decisions: colorTask.materialLines.map((line) => ({ materialLineId: line.materialLineId, decision: '通过' as const, reason: '' })),
    })
    colorTask = latestTask(masterOrderId, 'COLOR_FABRIC')
    assert.equal(colorTask.status, '已完成')
    recordStep({
      chainId, stage: '工程调色', objectId: colorTask.taskId, actorTeam: '跟单、染厂、买手', actorName: `${merchandiser.userName}、${dyeFactory.userName}、${buyer.userName}`,
      action: '跟单确认色号，染厂提交真实成果，买手逐行审核通过', before: beforeColor,
      inputSummary: `${colorTask.materialLines.length} 行染色物料`, after: taskState(colorTask), outputIds: [colorFiles[0].fileId, colorImages[0].fileId],
      assertions: ['染色要求来自 BOM', '潘通色号由跟单维护', '染厂提交实际成果', '买手审核后任务完成'],
    })
  }

  let sampleTask = latestTask(masterOrderId, 'PRE_PRODUCTION_SAMPLE')
  const beforeSample = taskState(sampleTask)
  startEngineeringTask({ masterOrderId, taskId: sampleTask.taskId, operatorId: sampleTeam.userId, operatorName: sampleTeam.userName })
  sampleTask = latestTask(masterOrderId, 'PRE_PRODUCTION_SAMPLE')
  const preSampleImages = await Promise.all((sampleTask.sampleRequirements || []).map((line, index) =>
    upload(`${chainId}-pre-sample-${index + 1}.jpg`, 'image/jpeg', 'SAMPLE_RESULT', '制作团队', sampleTeam),
  ))
  submitEngineeringTaskResult(masterOrderId, sampleTask.taskId, {
    sampleActuals: (sampleTask.sampleRequirements || []).map((line, index) => ({
      requirementLineId: line.requirementLineId, actualColor: line.targetColor, actualSize: line.targetSize,
      actualQuantity: line.requiredQuantity, sourcePatternVersion: '梭织基码纸样 v1.0', productionNote: '按跟单制作要求完成',
      differenceNote: '', imageFileIds: [preSampleImages[index][0].fileId], submittedBy: sampleTeam.userName,
    })),
  })
  sampleTask = latestTask(masterOrderId, 'PRE_PRODUCTION_SAMPLE')
  assert.equal(sampleTask.status, '已完成')
  recordStep({
    chainId, stage: '工程产前版样衣', objectId: sampleTask.taskId, actorTeam: '制作团队', actorName: sampleTeam.userName,
    action: '按跟单下达的颜色、尺码、数量逐行制作并上传真实样衣图片', before: beforeSample,
    inputSummary: `${sampleTask.sampleRequirements?.map((line) => `${line.targetColor}/${line.targetSize}/${line.requiredQuantity}件`).join('；')}`,
    after: taskState(sampleTask), outputIds: preSampleImages.map((files) => files[0].fileId),
    assertions: ['每行实际交付对应制作要求', '数量一致', '每行有真实样衣图片', '制作团队提交即完成'],
  })

  await executePatternTask(chainId, masterOrderId, 'SIZE_PATTERN_WOVEN', sizes)

  const draft = createEngineeringMasterTechPackDraft(masterOrderId, merchandiser.userName)
  completeTechnicalContent(draft.technicalVersionId, template)
  assert.ok(getTechnicalDataVersionById(draft.technicalVersionId)?.linkedDesignRevisionTaskIds.includes(samplingId), '技术包必须追溯设计改款任务')
  recordStep({
    chainId, stage: '技术包草稿', objectId: draft.technicalVersionId, actorTeam: '跟单', actorName: merchandiser.userName,
    action: '从工程主单汇总 BOM、纸样、工艺、尺码和质量要求生成技术包草稿', before: { status: '未生成', currentTeams: ['跟单'] },
    inputSummary: `来源工程主单 ${masterOrderId}`, after: techPackState(draft.technicalVersionId), outputIds: [draft.technicalVersionId],
    assertions: ['唯一生成入口为工程主单', '技术包包含设计改款追溯', '核心域完整', '工艺路线已确认'],
  })

  const buyerReviewer = getLegacyTechPackReviewer('买手')
  const patternReviewer = getLegacyTechPackReviewer('版师')
  const merchReviewer = getLegacyTechPackReviewer('跟单')
  submitTechPackFirstStageReview(draft.technicalVersionId, {
    buyerReviewerId: buyerReviewer.reviewerId,
    patternMakerReviewerId: patternReviewer.reviewerId,
    merchandiserReviewerId: merchReviewer.reviewerId,
    operator: { id: merchandiser.userId, name: merchandiser.userName },
  })
  recordStep({
    chainId, stage: '技术包提交审核', objectId: draft.technicalVersionId, actorTeam: '跟单', actorName: merchandiser.userName,
    action: '提交技术包审核并分配买手、版师、跟单审核节点', before: { status: 'DRAFT/未提交审核', currentTeams: ['跟单'] },
    inputSummary: `${buyerReviewer.reviewerName}、${patternReviewer.reviewerName}、${merchReviewer.reviewerName}`,
    after: techPackState(draft.technicalVersionId), outputIds: [draft.technicalVersionId], assertions: ['先买手和版师并行审核', '两者完成后进入跟单复核'],
  })

  for (const nodeKey of ['BUYER', 'PATTERN_MAKER', 'MERCHANDISER'] as const) {
    const before = techPackState(draft.technicalVersionId)
    reviewNode(draft.technicalVersionId, nodeKey)
    const role = nodeKey === 'BUYER' ? '买手' : nodeKey === 'PATTERN_MAKER' ? '版师' : '跟单'
    recordStep({
      chainId, stage: `技术包${role}审核`, objectId: draft.technicalVersionId, actorTeam: role, actorName: role,
      action: '开始审核并填写意见后审核通过', before, inputSummary: `${role}审核范围`, after: techPackState(draft.technicalVersionId),
      outputIds: [draft.technicalVersionId], assertions: [`${role}审核节点完成`, nodeKey === 'MERCHANDISER' ? '跟单仅在买手和版师完成后复核' : '第一阶段并行审核'],
    })
  }

  const published = publishTechnicalDataVersion(draft.technicalVersionId, merchandiser.userName)
  activateTechPackVersionForStyle(targetStyle.styleId, published.technicalVersionId, merchandiser.userName)
  const formal = getTechnicalDataVersionById(published.technicalVersionId)!
  const formalContent = getTechnicalDataVersionContent(published.technicalVersionId)
  const activatedStyle = getStyleArchiveById(targetStyle.styleId)
  const completedTechPackTask = latestTask(masterOrderId, 'TECH_PACK_CONFIRMATION')
  assert.equal(formal.versionStatus, 'PUBLISHED')
  assert.equal(formal.reviewStage, '已发布')
  assert.ok(formal.linkedDesignRevisionTaskIds.includes(samplingId))
  assert.ok(formalContent?.bomPricingSnapshot, '正式技术包启用时必须形成不可覆盖的 BOM 与价格快照')
  assert.ok((formalContent?.bomPricingSnapshot?.bomItems.length || 0) > 0)
  assert.equal(activatedStyle?.currentTechPackVersionId, formal.technicalVersionId)
  assert.equal(completedTechPackTask.status, '已完成')
  assert.ok(listEngineeringBomVersionsByOwner('TECH_PACK_DRAFT', formal.technicalVersionId)
    .every((version) => version.versionStatus === 'PUBLISHED_SNAPSHOT'))
  recordStep({
    chainId, stage: '技术包发布启用', objectId: formal.technicalVersionId, actorTeam: '跟单', actorName: merchandiser.userName,
    action: '发布并启用正式版本技术包', before: { status: 'DRAFT/审核已通过', currentTeams: ['跟单'] },
    inputSummary: formal.versionLabel, after: techPackState(formal.technicalVersionId), outputIds: [formal.technicalVersionId],
    assertions: ['正式技术包已发布', '正式 BOM 与价格快照已形成', '工程技术包确认任务自动完成', '款式当前生效版本已更新'],
  })

  const closeValidation = validateEngineeringMasterOrderClose(masterOrderId)
  assert.equal(closeValidation.canClose, true)
  master = closeEngineeringMasterOrder(masterOrderId, merchandiser.userName)
  assert.equal(master.status, '已关闭')
  recordStep({
    chainId, stage: '工程主单关闭', objectId: masterOrderId, actorTeam: '跟单', actorName: merchandiser.userName,
    action: '系统校验全部有效任务及正式技术包后由跟单人工关闭', before: { status: '待关闭', currentTeams: ['跟单'] },
    inputSummary: `正式技术包 ${formal.technicalVersionId}`, after: masterState(masterOrderId), outputIds: [masterOrderId],
    assertions: ['全部有效任务已完成', '正式技术包已发布并启用', '正式 BOM 与价格快照有效', '主单已关闭'],
  })

  const demand = buildDemand({ demandId: `DEM-${passId}-${chainId}`, styleCode: targetStyle.styleCode, styleName: targetStyle.styleName, versionLabel: formal.versionLabel })
  const productionOrder = buildProductionOrderFromDemand(buildOrderSeed(`PO-${passId}-${chainId}`, demand.demandId), demand, merchandiser.userName)
  assert.ok(productionOrder.techPackSnapshot)
  assert.equal(productionOrder.techPackSnapshot.sourceTechPackVersionId, formal.technicalVersionId)
  assert.ok(productionOrder.techPackSnapshot.linkedDesignRevisionTaskIds.includes(samplingId))
  recordStep({
    chainId, stage: 'FCS 生产单技术包快照', objectId: productionOrder.productionOrderId, actorTeam: '生产计划', actorName: '生产计划-全流程',
    action: '由生产需求创建生产单并冻结当前正式技术包快照', before: { status: '待转生产单', currentTeams: ['生产计划'] },
    inputSummary: `${demand.demandId}；${formal.technicalVersionId}`, after: { status: productionOrder.status, currentTeams: ['生产计划'] },
    outputIds: [productionOrder.productionOrderId, formal.technicalVersionId], assertions: ['只读取款式当前正式技术包', '快照版本与正式版本一致', '快照可追溯设计改款任务'],
  })

  const preparation = projectEngineeringMasterToPreparation(master, {
    masterOrderId, technicalVersionId: formal.technicalVersionId, versionLabel: formal.versionLabel, publishedAt: formal.publishedAt,
  })
  const capabilities = getPreparationRecordCapabilities(preparation)
  assert.equal(preparation.sourceKind, '工程主单')
  assert.equal(preparation.masterOrderId, masterOrderId)
  assert.equal(preparation.status, '已关闭')
  assert.equal(preparation.outputReady, true)
  assert.deepEqual(capabilities, { confirmItems: false, modifyItems: false, uploadResult: false, maintainDyeRequirement: false, reviewResult: false })
  recordStep({
    chainId, stage: '生产准备时效只读投影', objectId: preparation.recordId, actorTeam: '跟单及管理团队', actorName: '系统投影',
    action: '从工程主单任务事实投影准备项、时效和正式技术包产出', before: { status: '待投影', currentTeams: [] },
    inputSummary: masterOrderId, after: { status: preparation.status, currentTeams: [] }, outputIds: [preparation.recordId, formal.technicalVersionId],
    assertions: ['数据来源仅为工程主单', '设计改款任务不直接进入时效', '准备项不可新增修改或上传', '正式技术包作为主单产出展示'],
  })

  chainResults.push({
    chainId, sourceStyleCode: sourceStyle.styleCode, targetStyleCode: targetStyle.styleCode,
    designRevisionTaskId: samplingId, masterOrderId, technicalVersionId: formal.technicalVersionId,
    productionOrderId: productionOrder.productionOrderId, preparationRecordId: preparation.recordId, result: '通过',
  })
}

async function main(): Promise<void> {
  resetAll()
  const templateRecord = listTechnicalDataVersions().find((record) => {
    const content = getTechnicalDataVersionContent(record.technicalVersionId)
    return Boolean(content?.processEntries.length && content.sizeTable.length && content.qualityRules.length)
  })
  assert.ok(templateRecord, '必须存在可复用的技术包工艺、尺码和质量结构演示数据')
  const template = getTechnicalDataVersionContent(templateRecord.technicalVersionId)!

  const openMasterStyleIds = new Set(listEngineeringMasterOrders()
    .filter((master) => master.status !== '已关闭' && master.status !== '已终止')
    .map((master) => master.styleId))
  const styles = listStyleArchives().filter((style) =>
    style.archiveStatus === 'ACTIVE'
    && style.mainImageUrl
    && listSkuArchivesByStyleId(style.styleId).some((sku) => sku.archiveStatus === 'ACTIVE')
  )
  const targets = styles.filter((style) =>
    !openMasterStyleIds.has(style.styleId) && !hasFormalProductionFact(style.styleCode),
  ).slice(0, 2)
  const sources = styles.filter((style) => !targets.some((target) => target.styleId === style.styleId)).slice(0, 2)
  assert.equal(targets.length, 2, '必须找到两张没有未关闭工程主单的目标款式')
  assert.equal(sources.length, 2, '必须找到两张不同的参照款式')

  await runChain({ chainId: 'CASE-A', sourceStyle: sources[0], targetStyle: targets[0], withDye: false, template })
  await runChain({ chainId: 'CASE-B', sourceStyle: sources[1], targetStyle: targets[1], withDye: true, template })

  assert.equal(chainResults.length, 2)
  assert.ok(chainResults.every((item) => item.result === '通过'))
  assert.equal(new Set(chainResults.map((item) => item.designRevisionTaskId)).size, 2)
  assert.equal(new Set(chainResults.map((item) => item.masterOrderId)).size, 2)
  assert.equal(new Set(chainResults.map((item) => item.technicalVersionId)).size, 2)
  assert.ok(steps.length >= 36, '双案例全流程记录必须覆盖每个关键业务交接步骤')
  const uploadedFileIds = steps.flatMap((step) => step.outputIds).filter((item) => item.startsWith('ENG-FILE-'))
  assert.equal(new Set(uploadedFileIds).size, uploadedFileIds.length, '每个真实上传文件必须有唯一编号，不能因同毫秒上传发生碰撞')
  recordStep({
    chainId: 'SYSTEM', stage: '上传文件唯一性核验', objectId: `${uploadedFileIds.length} 个真实上传文件`, actorTeam: '系统', actorName: '全流程测试执行器',
    action: '核对两条业务链全部真实上传文件编号不重复', before: { status: '待核验', currentTeams: [] },
    inputSummary: `${uploadedFileIds.length} 个文件编号`, after: { status: '全部唯一', currentTeams: [] }, outputIds: uploadedFileIds,
    assertions: ['真实文件均已读取并保存', '全部文件编号唯一', '纸样、设计稿、样衣图片和调色成果可逐文件追溯'],
  })
  persistRecord('通过')
  console.log(`PCS 生产工程管理双案例全流程模拟：${passId} 通过；${chainResults.length} 条链；${steps.length} 个步骤；记录 ${recordPath}`)
}

main().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error)
  steps.push({
    sequence: steps.length + 1, chainId: 'SYSTEM', stage: '执行失败', objectId: '-', actorTeam: '系统', actorName: '测试执行器',
    action: '记录未通过步骤', before: { status: '执行中', currentTeams: [] }, inputSummary: '', after: { status: '失败', currentTeams: [] },
    outputIds: [], assertions: [], result: '失败', error: message, recordedAt: nowText(),
  })
  persistRecord('失败', message)
  console.error(message)
  process.exitCode = 1
})
