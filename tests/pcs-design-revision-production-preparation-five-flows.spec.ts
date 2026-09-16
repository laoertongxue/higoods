import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import '../src/data/fcs/design-revision-process-work-order-adapter.ts'
import {
  acceptDyeWorkOrderPdaTask,
  assignDyeWorkOrderFactory,
  completeDyeNode,
  completeDyeWorkOrderDocument,
  completeDyeing,
  createDyeDispatchDocument,
  finishDyeDispatchDocument,
  getDyeDispatchAvailableQty,
  getDyeDispatchPartner,
  getDyeOrderHandoverRecords,
  getDyeWorkOrderById,
  isDyeYarnOrder,
  isDyeRollAvailable,
  listDyeVatOptions,
  markDyeOutputRolls,
  planDyeVat,
  saveDyeDispatchTransport,
  saveDyeOutputRolls,
  scanDyeDispatchRoll,
  startDyeNode,
  startDyeing,
  submitDyeHandover,
} from '../src/data/fcs/dyeing-task-domain.ts'
import {
  approveFactoryTransfer,
  getDefaultFactoryReceiptPosition,
  getFactoryReceivingSource,
  listFactoryReceivingSources,
} from '../src/data/fcs/factory-receiving.ts'
import { confirmFactoryMaterialReceipt } from '../src/data/fcs/factory-receiving-links.ts'
import { createDesignRevisionProcessMaterialTransfer } from '../src/data/fcs/design-revision-material-transfer.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { listPrintingFactoryOptions } from '../src/data/fcs/printing-factories.ts'
import { receivePreparationHandoverForTask } from '../src/data/fcs/pda-handover-events.ts'
import {
  acceptPrintWorkOrderPdaTask,
  assignPrintingWorkOrder,
  completePrintWorkOrderDocument,
  completePrintingWorkOrder,
  confirmPrintingDispatch,
  createPrintingDispatch,
  getPrintWorkOrderById,
  getPrintingWorkOrderById,
  markPrintingRollBarcodesPrinted,
  recordPrintingProductionStage,
  receivePrintingHandover,
  scanPrintingDispatchRoll,
  startPrintingProduction,
  updatePrintingRollBarcode,
} from '../src/data/fcs/printing-task-domain.ts'
import { readDesignRevisionProcessWorkOrderStatuses } from '../src/data/pcs-design-revision-process-work-order-port.ts'

import {
  confirmEngineeringIndependentColorRequirement,
  confirmEngineeringIndependentSamplingResult,
  confirmEngineeringIndependentSamplingScheme,
  createEngineeringIndependentSampling,
  getEngineeringIndependentSamplingRecord,
  linkCompletedTemporarySpuToStyleArchive,
  listEngineeringIndependentAvailablePatternVersions,
  listCompletedTemporarySpuDesignRevisions,
  resetEngineeringIndependentSamplingRepository,
  reviewEngineeringIndependentProfessionalTask,
  startEngineeringIndependentProfessionalTask,
  submitEngineeringIndependentProfessionalTask,
  suggestEngineeringIndependentTaskTypes,
} from '../src/data/pcs-engineering-master-sampling.ts'
import {
  confirmEngineeringBomPricingPlan,
  createEngineeringBomVersionsForOwner,
  getEngineeringBomPricingPlan,
  getEngineeringBomVersionById,
  listEngineeringBomVersionsByOwner,
  resetEngineeringBomRepository,
  saveEngineeringBomPricingPlan,
  saveEngineeringBomVersion,
} from '../src/data/pcs-engineering-bom-repository.ts'
import {
  captureEngineeringUploadedFiles,
  type EngineeringUploadedFile,
  type EngineeringUploadPurpose,
} from '../src/data/pcs-engineering-file-upload.ts'
import {
  closeEngineeringMasterOrder,
  confirmEngineeringMasterBomPricingPlan,
  confirmEngineeringMasterTaskPlan,
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  listEngineeringMasterPriorResultCandidates,
  resetEngineeringMasterRepository,
  startEngineeringTask,
  submitEngineeringTaskResult,
  validateEngineeringMasterOrderClose,
} from '../src/data/pcs-engineering-master-repository.ts'
import { resetEngineeringPatternResultVersions, submitEngineeringPatternResult } from '../src/data/pcs-engineering-pattern-result.ts'
import { createEngineeringMasterTechPackDraft } from '../src/data/pcs-engineering-tech-pack-workspace.ts'
import {
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  listTechnicalDataVersions,
  resetTechnicalDataVersionRepository,
  updateTechnicalDataVersionContent,
} from '../src/data/pcs-technical-data-version-repository.ts'
import { resetTechPackReviewNotificationRepository } from '../src/data/pcs-tech-pack-review-notification-repository.ts'
import { resetTechPackVersionLogRepository } from '../src/data/pcs-tech-pack-version-log-repository.ts'
import { approveTechPackReview, startTechPackReview, submitTechPackFirstStageReview } from '../src/data/pcs-tech-pack-review.ts'
import { getLegacyTechPackReviewer } from '../src/data/pcs-tech-pack-reviewer-directory.ts'
import { publishTechnicalDataVersion } from '../src/data/pcs-project-technical-data-writeback.ts'
import { activateTechPackVersionForStyle } from '../src/data/pcs-tech-pack-version-activation.ts'
import { resetEngineeringTaskUploadRepository } from '../src/data/pcs-engineering-task-upload-repository.ts'
import { listMaterialArchives, listMaterialSkuRecordsByMaterialId } from '../src/data/pcs-material-archive-repository.ts'
import { createSkuArchiveBatch, listSkuArchivesByStyleId, resetSkuArchiveRepository } from '../src/data/pcs-sku-archive-repository.ts'
import {
  createStyleArchiveShell,
  getStyleArchiveById,
  listStyleArchives,
  resetStyleArchiveRepository,
} from '../src/data/pcs-style-archive-repository.ts'
import type {
  EngineeringIndependentProfessionalTask,
  EngineeringIndependentProfessionalTaskType,
  EngineeringIndependentSamplingRecord,
  EngineeringTaskRecord,
  EngineeringTaskType,
} from '../src/data/pcs-engineering-master-types.ts'
import type { StyleArchiveShellRecord } from '../src/data/pcs-style-archive-types.ts'
import type { SkuArchiveRecord } from '../src/data/pcs-sku-archive-types.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalProcessEntry,
  TechnicalReviewNodeKey,
} from '../src/data/pcs-technical-data-version-types.ts'

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
  value: { localStorage: storage, location: { pathname: '/pcs/production-preparation/design-revision' }, dispatchEvent: () => true },
})

const fixedAt = '2026-09-15 10:00:00'
const receivedAt = '2030-01-01 10:00:00'
const buyer = { role: '买手', userId: 'BUYER-FIVE-FLOW', userName: '买手-五流程' }
const merchandiser = { role: '跟单', userId: 'MERCH-FIVE-FLOW', userName: '跟单-五流程' }
const patternMaker = { role: '版师', userId: 'PATTERN-FIVE-FLOW', userName: '版师-五流程' }
const sampleTeam = { role: '制作团队', userId: 'SAMPLE-FIVE-FLOW', userName: '制作团队-五流程' }
const artworkTeam = { role: '花型团队', userId: 'ART-FIVE-FLOW', userName: '花型团队-五流程' }
const dyeFactory = { role: '染厂', userId: 'DYE-FIVE-FLOW', userName: '染厂-五流程' }
const displaySampleAssignment = {
  teamId: 'PCS-DISPLAY-SAMPLE-TEAM',
  teamName: '制作团队',
  receivingLocationId: 'PCS-DISPLAY-SAMPLE-AREA',
  receivingLocationName: '销售展示样衣制作区',
  receivingFactoryId: 'ID-F014',
  receivingFactoryName: 'CV Satellite Tangerang Barat',
}
const recordPath = process.env.PCS_FIVE_FLOW_RECORD_PATH?.trim()
  || '/tmp/pcs-design-revision-production-preparation-five-flows.json'

type MaterialKind = 'fabric' | 'yarn'
type TargetMode = 'ARCHIVED_STYLE' | 'TEMPORARY_SPU'
type PatternHandling = 'REUSE' | 'REMAKE'
type ProcessMode = 'NONE' | 'PRINT' | 'DYE' | 'DYE_THEN_PRINT'

interface ScenarioSpec {
  id: string
  name: string
  targetMode: TargetMode
  patternHandling: PatternHandling
  materialKind: MaterialKind
  processMode: ProcessMode
  colors: string[]
  sizes: string[]
  preparationOrder: 'SAMPLE_FIRST' | 'SIZE_FIRST'
  reworkTaskType?: 'PATTERN_ARTWORK' | 'COLOR_YARN' | 'COLOR_FABRIC'
}

interface ScenarioRecord {
  id: string
  name: string
  result: '通过' | '失败'
  designRevisionTaskId: string
  targetStyleCode: string
  masterOrderId: string
  technicalVersionId: string
  processOrderIds: string[]
  checkpoints: string[]
  error: string
}

const scenarios: ScenarioSpec[] = [
  {
    id: 'FLOW-01', name: '已建档目标款、纸样复用、无需印染', targetMode: 'ARCHIVED_STYLE',
    patternHandling: 'REUSE', materialKind: 'fabric', processMode: 'NONE',
    colors: ['海军蓝', '米白'], sizes: ['M'], preparationOrder: 'SAMPLE_FIRST',
  },
  {
    id: 'FLOW-02', name: '线下临时 SPU、纸样复用、历史多行样衣要求汇总', targetMode: 'TEMPORARY_SPU',
    patternHandling: 'REUSE', materialKind: 'fabric', processMode: 'NONE',
    colors: ['曜石黑', '柠檬黄'], sizes: ['S', 'M'], preparationOrder: 'SIZE_FIRST',
  },
  {
    id: 'FLOW-03', name: '线下临时 SPU、重新制版、创建印花加工单', targetMode: 'TEMPORARY_SPU',
    patternHandling: 'REMAKE', materialKind: 'fabric', processMode: 'PRINT',
    colors: ['印花蓝'], sizes: ['M', 'L'], preparationOrder: 'SAMPLE_FIRST', reworkTaskType: 'PATTERN_ARTWORK',
  },
  {
    id: 'FLOW-04', name: '已建档目标款、纱线染色', targetMode: 'ARCHIVED_STYLE',
    patternHandling: 'REMAKE', materialKind: 'yarn', processMode: 'DYE',
    colors: ['浆果红', '炭灰'], sizes: ['M'], preparationOrder: 'SIZE_FIRST',
  },
  {
    id: 'FLOW-05', name: '同一物料先染后印、历史多行样衣输入', targetMode: 'ARCHIVED_STYLE',
    patternHandling: 'REMAKE', materialKind: 'fabric', processMode: 'DYE_THEN_PRINT',
    colors: ['深海蓝', '沙砾白', '苔藓绿'], sizes: ['S', 'M'], preparationOrder: 'SAMPLE_FIRST',
  },
]

const executionRecords: ScenarioRecord[] = []
const scenarioProgress = new Map<string, ScenarioRecord>()

function resetAll(): void {
  executionRecords.splice(0)
  scenarioProgress.clear()
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

function binaryFor(fileName: string): ArrayBuffer {
  if (fileName.endsWith('.png')) {
    return Uint8Array.from(Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )).buffer
  }
  if (fileName.endsWith('.prj')) return new Uint8Array([80, 82, 74, 74, 1, 2, 3, 4, 5]).buffer
  if (fileName.endsWith('.ai')) return new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]).buffer
  return new Uint8Array([1, 2, 3, 4]).buffer
}

async function uploadFiles(
  names: string[],
  purpose: EngineeringUploadPurpose,
  actor: { userId: string; userName: string },
  teamName: string,
  roundNo = 1,
): Promise<EngineeringUploadedFile[]> {
  const files = names.map((name) => new File([binaryFor(name)], name, {
    type: name.endsWith('.png') ? 'image/png'
      : name.endsWith('.jpg') ? 'image/jpeg'
        : 'application/octet-stream',
  }))
  const uploaded = await captureEngineeringUploadedFiles({ files, purpose, actor: { ...actor, teamName }, roundNo, uploadedAt: fixedAt })
  assert.ok(uploaded.every((file) => file.status === '已保存' && file.dataUrl.startsWith('data:') && file.sizeBytes > 0))
  return uploaded
}

function materialFixture(kind: MaterialKind) {
  const material = listMaterialArchives().find((item) => item.kind === kind && item.status === 'ACTIVE' && item.mainImageUrl)
  const sku = material
    ? listMaterialSkuRecordsByMaterialId(material.materialId).find((item) => item.status === 'ACTIVE' && item.costPrice > 0 && item.skuImageUrl)
    : undefined
  assert.ok(material && sku, `必须存在带真实图片、有效单价的${kind === 'yarn' ? '纱线' : '面料'} SKU`)
  return { material, sku }
}

function createFormalTarget(template: StyleArchiveShellRecord, spec: ScenarioSpec, imageUrl: string): StyleArchiveShellRecord {
  const code = `STYLE-FIVE-${spec.id}`
  return createStyleArchiveShell({
    ...structuredClone(template),
    styleId: `style_five_${spec.id.toLowerCase()}`,
    styleCode: code,
    styleName: `${spec.name}目标款`,
    styleNameEn: `Five flow ${spec.id}`,
    styleNumber: code,
    sourceProjectId: `PROJECT-FIVE-${spec.id}`,
    sourceProjectCode: `PRJ-FIVE-${spec.id}`,
    sourceProjectName: `${spec.name}建档项目`,
    sourceProjectNodeId: `NODE-FIVE-${spec.id}`,
    archiveStatus: 'ACTIVE',
    currentTechPackVersionId: '',
    currentTechPackVersionCode: '',
    currentTechPackVersionLabel: '',
    currentTechPackVersionStatus: '',
    currentTechPackVersionActivatedAt: '',
    currentTechPackVersionActivatedBy: '',
    techPackVersionCount: 0,
    mainImageId: `IMG-FIVE-${spec.id}`,
    mainImageUrl: imageUrl,
    galleryImageIds: [`IMG-FIVE-${spec.id}`],
    galleryImageUrls: [imageUrl],
    imageSource: `五流程测试真实设计稿 ${spec.id}`,
    generatedAt: fixedAt,
    generatedBy: buyer.userName,
    updatedAt: fixedAt,
    updatedBy: buyer.userName,
    legacyOriginProject: '',
    temporarySpuName: '',
    linkedDesignRevisionTaskIds: [],
    inheritedDesignFileIds: [],
    inheritedPatternFileIds: [],
    inheritedBomVersionIds: [],
  })
}

function createFormalSource(template: StyleArchiveShellRecord, spec: ScenarioSpec): StyleArchiveShellRecord {
  const code = `STYLE-FIVE-SOURCE-${spec.id}`
  return createStyleArchiveShell({
    ...structuredClone(template),
    styleId: `style_five_source_${spec.id.toLowerCase()}`,
    styleCode: code,
    styleName: `${spec.name}参照款`,
    styleNameEn: `Five flow source ${spec.id}`,
    styleNumber: code,
    sourceProjectId: `PROJECT-FIVE-SOURCE-${spec.id}`,
    sourceProjectCode: `PRJ-FIVE-SOURCE-${spec.id}`,
    sourceProjectName: `${spec.name}参照款档案`,
    sourceProjectNodeId: `NODE-FIVE-SOURCE-${spec.id}`,
    archiveStatus: 'ACTIVE',
    currentTechPackVersionId: '',
    currentTechPackVersionCode: '',
    currentTechPackVersionLabel: '',
    currentTechPackVersionStatus: '',
    currentTechPackVersionActivatedAt: '',
    currentTechPackVersionActivatedBy: '',
    techPackVersionCount: 0,
    generatedAt: fixedAt,
    generatedBy: buyer.userName,
    updatedAt: fixedAt,
    updatedBy: buyer.userName,
    legacyOriginProject: '',
    temporarySpuName: '',
    linkedDesignRevisionTaskIds: [],
    inheritedDesignFileIds: [],
    inheritedPatternFileIds: [],
    inheritedBomVersionIds: [],
  })
}

function seedTargetSkuDimensions(
  target: StyleArchiveShellRecord,
  template: SkuArchiveRecord,
  spec: ScenarioSpec,
  colors: string[] = ['待定义'],
): void {
  createSkuArchiveBatch(colors.flatMap((color, colorIndex) => spec.sizes.map((size, sizeIndex) => ({
    ...structuredClone(template),
    skuId: `sku_five_${spec.id.toLowerCase()}_${colorIndex + 1}_${sizeIndex + 1}`,
    skuCode: `${target.styleCode}-${colorIndex + 1}-${size}`,
    styleId: target.styleId,
    styleCode: target.styleCode,
    styleName: target.styleName,
    skuName: `${target.styleName} ${color}/${size}`,
    colorName: color,
    sizeName: size,
    skuImageUrl: target.mainImageUrl,
    barcode: '',
    channelMappingCount: 0,
    listedChannelCount: 0,
    lastListingAt: '',
    techPackVersionId: '',
    techPackVersionCode: '',
    techPackVersionLabel: '',
    createdAt: fixedAt,
    createdBy: buyer.userName,
    updatedAt: fixedAt,
    updatedBy: buyer.userName,
    remark: `${spec.id} 商品档案尺码`,
  }))))
}

function buildBomLine(
  spec: ScenarioSpec,
  materialSkuId: string,
  materialType: string,
  imageUrl: string,
  usageUnit: string,
  applicableSkuIds: string[],
) {
  return {
    materialSkuId,
    materialType,
    materialImageUrl: imageUrl,
    usage: spec.materialKind === 'yarn' ? 1 : 1.2,
    sampleQuantity: 1,
    usageUnit,
    lossRate: 0.03,
    applicableSkuIds,
    printRequirement: (spec.processMode === 'PRINT' || spec.processMode === 'DYE_THEN_PRINT') ? '是' as const : '否' as const,
    printSide: (spec.processMode === 'PRINT' || spec.processMode === 'DYE_THEN_PRINT') ? '正面' as const : undefined,
    dyeRequirement: (spec.processMode === 'DYE' || spec.processMode === 'DYE_THEN_PRINT') ? '是' as const : '否' as const,
    purchaseRequirement: '否' as const,
    remark: `${spec.id} 实际打样用料`,
  }
}

function createConfirmedSourceBom(
  spec: ScenarioSpec,
  source: StyleArchiveShellRecord,
  sourceColor: string,
  materialSkuId: string,
  materialType: string,
  materialImageUrl: string,
  usageUnit: string,
): string {
  const ownerId = `SOURCE-BOM-${spec.id}`
  const versions = createEngineeringBomVersionsForOwner({
    ownerStage: 'TECH_PACK_DRAFT', ownerId, ownerCode: ownerId, styleId: source.styleId,
    buyerId: buyer.userId, buyerName: buyer.userName, createdBy: buyer.userName, createdAt: fixedAt,
  })
  versions.forEach((version) => saveEngineeringBomVersion({
    versionId: version.bomDraftVersionId, role: '买手', userId: buyer.userId, userName: buyer.userName,
    materialLines: [buildBomLine(spec, materialSkuId, materialType, materialImageUrl, usageUnit, version.applicableSkuIds)], updatedAt: fixedAt,
  }))
  saveEngineeringBomPricingPlan({
    ownerStage: 'TECH_PACK_DRAFT', ownerId, role: '买手', userId: buyer.userId, userName: buyer.userName,
    customCostDecision: 'NO_CUSTOM_COST', customCosts: [], updatedAt: fixedAt,
  })
  confirmEngineeringBomPricingPlan({
    ownerStage: 'TECH_PACK_DRAFT', ownerId, role: '买手', userId: buyer.userId, userName: buyer.userName, confirmedAt: fixedAt,
  })
  const matched = versions.find((version) => version.productColor === sourceColor) || versions[0]
  assert.ok(matched)
  return matched.bomDraftVersionId
}

function findProfessionalTask(record: EngineeringIndependentSamplingRecord, type: EngineeringIndependentProfessionalTaskType) {
  const task = record.professionalTasks.find((item) => item.taskType === type)
  assert.ok(task, `${record.samplingTaskCode} 必须存在 ${type}`)
  return task
}

async function finishReviewableTask(
  spec: ScenarioSpec,
  task: EngineeringIndependentProfessionalTask,
  shouldRework: boolean,
): Promise<void> {
  const executor = task.taskType === 'PATTERN_ARTWORK' ? artworkTeam : dyeFactory
  const waitingStatuses = readDesignRevisionProcessWorkOrderStatuses(task.processWorkOrderRefs)
  assert.equal(waitingStatuses.length, task.processWorkOrderRefs.length)
  assert.ok(waitingStatuses.every((status) => status.status === 'WAIT_PROFESSIONAL_RESULT'), `${task.taskName}审核通过前，加工单必须等待专业成果`)
  assert.ok(waitingStatuses.every((status) => !status.professionalResultId && !status.professionalResultVersion))
  if (task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') {
    confirmEngineeringIndependentColorRequirement({
      taskId: task.taskId, actor: buyer, pantoneColorCode: `19-${spec.id.slice(-2)}00 TCX`,
      colorName: spec.colors.join(' / '), confirmedAt: fixedAt,
    })
  }
  startEngineeringIndependentProfessionalTask({ taskId: task.taskId, actor: executor, startedAt: fixedAt })
  const buildSubmission = async (roundNo: number) => {
    if (task.taskType === 'PATTERN_ARTWORK') {
      return {
        results: [{
          title: `${spec.id} 花型成果`, version: `ART-${spec.id}-V${roundNo}`,
          description: `${spec.id} 实际花型源文件与预览`,
          files: await uploadFiles([`${spec.id}-art-${roundNo}.png`, `${spec.id}-art-${roundNo}.ai`], 'PATTERN_ARTWORK', artworkTeam, '花型团队', roundNo),
        }],
      }
    }
    return {
      results: [{
        title: `${spec.id} 调色成果`, description: `${spec.id} 实际色样`,
        files: await uploadFiles([`${spec.id}-color-${roundNo}.png`], 'COLOR_RESULT', dyeFactory, '染厂', roundNo),
      }],
      dyeColorCode: `DYE-${spec.id}-V${roundNo}`,
    }
  }
  let record = submitEngineeringIndependentProfessionalTask({
    taskId: task.taskId, actor: executor, ...(await buildSubmission(1)), submittedAt: fixedAt,
  })
  let latest = findProfessionalTask(record, task.taskType)
  if (shouldRework) {
    record = reviewEngineeringIndependentProfessionalTask({
      taskId: task.taskId, actor: buyer,
      decisions: latest.results.map((result) => ({ resultId: result.resultId, approved: false, reason: '首轮颜色或图案未达到设计稿要求' })),
      reviewedAt: fixedAt,
    })
    assert.equal(findProfessionalTask(record, task.taskType).status, 'REWORK')
    assert.ok(
      readDesignRevisionProcessWorkOrderStatuses(task.processWorkOrderRefs)
        .every((status) => status.status === 'WAIT_PROFESSIONAL_RESULT' && !status.professionalResultId),
      '退回成果不得提前解锁或绑定加工单',
    )
    record = submitEngineeringIndependentProfessionalTask({
      taskId: task.taskId, actor: executor, ...(await buildSubmission(2)), submittedAt: fixedAt,
    })
    latest = findProfessionalTask(record, task.taskType)
  }
  record = reviewEngineeringIndependentProfessionalTask({
    taskId: task.taskId, actor: buyer,
    decisions: latest.results.map((result) => ({ resultId: result.resultId, approved: true })), reviewedAt: fixedAt,
  })
  const completedTask = findProfessionalTask(record, task.taskType)
  assert.equal(completedTask.status, 'COMPLETED')
  const readyStatuses = readDesignRevisionProcessWorkOrderStatuses(completedTask.processWorkOrderRefs)
  assert.equal(readyStatuses.length, completedTask.processWorkOrderRefs.length)
  readyStatuses.forEach((status) => {
    assert.equal(status.status, 'WAIT_ASSIGNMENT', `${completedTask.taskName}成果通过后应交给加工单分厂，不得继续等待专业成果`)
    assert.ok(status.professionalResultId)
    assert.ok(status.professionalResultVersion)
    const order = status.processType === 'DYEING'
      ? getDyeWorkOrderById(status.processOrderId)
      : getPrintWorkOrderById(status.processOrderId)
    assert.equal(order?.sourceSnapshot?.professionalResultId, status.professionalResultId)
    assert.equal(order?.sourceSnapshot?.professionalResultVersion, status.professionalResultVersion)
    assert.equal(order?.sourceSnapshot?.professionalResultApprovedBy, buyer.userName)
    assert.ok(order?.sourceSnapshot?.professionalResultAttachments?.length)
    assert.ok(order?.sourceSnapshot?.professionalResultAttachments?.every((file) => file.dataUrl.startsWith('data:') && file.sizeBytes > 0))
  })
}

type ProcessRef = EngineeringIndependentProfessionalTask['processWorkOrderRefs'][number]

function processRefs(record: EngineeringIndependentSamplingRecord): ProcessRef[] {
  const refs = record.professionalTasks.flatMap((task) => task.processWorkOrderRefs)
  const seen = new Set<string>()
  return refs.filter((ref) => {
    const key = `${ref.processType}:${ref.processOrderId}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function selectProcessFactories() {
  const printFactory = listPrintingFactoryOptions().find((factory) => factory.id === 'F090')
    || listPrintingFactoryOptions().find((factory) => {
      try { return Boolean(getDefaultFactoryReceiptPosition(factory.id)) } catch { return false }
    })
  assert.ok(printFactory, '必须有可派单且维护了待加工库位的印花加工厂')
  const dyeFactoryOption = listFactoryMasterRecords().find((factory) => (
    factory.status === 'active'
    && factory.eligibility.allowDispatch
    && factory.processAbilities.some((ability) => ability.processCode === 'DYE' && (ability.status ?? 'ACTIVE') === 'ACTIVE' && ability.canReceiveTask !== false)
    && listDyeVatOptions(factory.id).length > 0
    && (() => { try { return Boolean(getDefaultFactoryReceiptPosition(factory.id)) } catch { return false } })()
  ))
  assert.ok(dyeFactoryOption, '必须有可派单、已维护染缸和待加工库位的染色工厂')
  return { printFactory, dyeFactoryOption }
}

function assignAndAcceptProcessOrders(
  spec: ScenarioSpec,
  record: EngineeringIndependentSamplingRecord,
): void {
  const refs = processRefs(record)
  if (!refs.length) return
  const { printFactory, dyeFactoryOption } = selectProcessFactories()

  // 先分配印花工厂，先染后印时由正式领域动作把该工厂反写为染色交出目标。
  refs.filter((ref) => ref.processType === 'PRINTING').forEach((ref) => {
    assignPrintingWorkOrder(ref.processOrderId, {
      factoryId: printFactory.id,
      factoryName: printFactory.name,
      operatorName: merchandiser.userName,
    })
    const order = getPrintWorkOrderById(ref.processOrderId)
    assert.ok(order)
    acceptPrintWorkOrderPdaTask(order.taskId, artworkTeam.userName, fixedAt)
    assert.equal(order.sourceSnapshot?.receivingTeamId, displaySampleAssignment.teamId)
    assert.equal(order.sourceSnapshot?.receivingLocationId, displaySampleAssignment.receivingLocationId)
    assert.equal(order.sourceSnapshot?.receivingFactoryId, displaySampleAssignment.receivingFactoryId)
    assert.equal(order.sourceSnapshot?.receivingFactoryName, displaySampleAssignment.receivingFactoryName)
  })
  refs.filter((ref) => ref.processType === 'DYEING').forEach((ref) => {
    assignDyeWorkOrderFactory(ref.processOrderId, {
      factoryId: dyeFactoryOption.id,
      factoryName: dyeFactoryOption.name,
      assignedAt: fixedAt,
      assignedBy: merchandiser.userName,
    })
    const order = getDyeWorkOrderById(ref.processOrderId)
    assert.ok(order)
    acceptDyeWorkOrderPdaTask(order.taskId, dyeFactory.userName, fixedAt)
    assert.equal(order.sourceSnapshot?.receivingTeamId, displaySampleAssignment.teamId)
    assert.equal(order.sourceSnapshot?.receivingLocationId, displaySampleAssignment.receivingLocationId)
    assert.equal(order.sourceSnapshot?.receivingFactoryId, displaySampleAssignment.receivingFactoryId)
    assert.equal(order.sourceSnapshot?.receivingFactoryName, displaySampleAssignment.receivingFactoryName)
    if (order.sourceSnapshot?.downstreamWorkOrderId) {
      const partner = getDyeDispatchPartner(order.dyeOrderId)
      assert.equal(partner.kind, 'FACTORY', '先染后印时染色交出目标必须是已分配的实际印花工厂')
      assert.equal(partner.id, printFactory.id)
    }
  })

  const acceptedStatuses = readDesignRevisionProcessWorkOrderStatuses(refs)
  acceptedStatuses.forEach((status) => {
    if (status.processType === 'PRINTING' && status.prerequisiteProcessOrderId) {
      assert.equal(status.status, 'WAIT_PREREQUISITE_PROCESS', '同物料先染后印时，印花接单后仍必须等待染色实际交出')
      assert.ok(status.blockReason.includes('染色'))
      return
    }
    assert.ok(
      ['WAIT_MATERIAL', 'READY_TO_PROCESS'].includes(status.status),
      `${status.processOrderCode} 分厂接单后应进入备料或可加工状态，实际为 ${status.status}`,
    )
  })
  if (spec.processMode === 'DYE_THEN_PRINT') {
    assert.ok(acceptedStatuses.some((status) => status.processType === 'PRINTING' && status.status === 'WAIT_PREREQUISITE_PROCESS'))
  }
}

function registerAndReceiveDyeInput(spec: ScenarioSpec, ref: ProcessRef, sequence: number): void {
  const order = getDyeWorkOrderById(ref.processOrderId)
  assert.ok(order?.dyeFactoryId && order.outputMaterial, `${ref.processOrderCode} 必须已分厂并承接实际物料快照`)
  const source = createDesignRevisionProcessMaterialTransfer({
    processType: 'DYEING',
    processOrderId: ref.processOrderId,
    issuedBy: merchandiser.userName,
    issuedAt: fixedAt,
  })
  assert.equal(source.lines[0]?.dyeOrderId, ref.processOrderId)
  assert.equal(source.lines[0]?.material.sku, order.rawMaterialSku)
  assert.ok(source.lines[0]?.material.imageUrl)
  approveFactoryTransfer(source.id, merchandiser.userName, fixedAt)
  const position = getDefaultFactoryReceiptPosition(order.dyeFactoryId)
  const isYarn = order.outputMaterial.kind === 'YARN'
  const isFabric = order.outputMaterial.kind === 'FABRIC'
  assert.ok(isYarn || isFabric, '五流程染色投入必须是面料或纱线')
  const sourceLine = source.lines[0]
  assert.ok(sourceLine)
  const rolls = isFabric ? sourceLine.rolls : []
  const netKg = isYarn ? Number(order.plannedQty.toFixed(3)) : 0
  const tubes = { PAPER: isYarn ? 1 : 0, CONICAL: 0, PAGODA: 0 }
  const grossKg = Number((netKg + (isYarn ? 0.062 : 0)).toFixed(3))
  confirmFactoryMaterialReceipt({
    id: `${source.id}-RECEIPT`,
    factoryId: order.dyeFactoryId,
    operatorId: `${order.dyeFactoryId}-WAREHOUSE`,
    operatorName: `${order.dyeFactoryName} 仓管`,
    receivedAt: fixedAt,
    remark: `${spec.id} 染色投入实际接收`,
    lines: [{
      sourceId: source.id,
      sourceLineId: sourceLine.id,
      ...position,
      ...(isFabric ? { rolls: rolls.map((roll) => ({ ...roll, ...position })) } : {
        grossKg,
        tubes,
        pcs: 1,
        businessQty: order.plannedQty,
        businessUnit: order.qtyUnit,
      }),
    }],
  })
  const received = getDyeWorkOrderById(order.dyeOrderId)
  assert.ok(received?.materialReceipts?.some((item) => item.receiptId.startsWith('FRP-') && item.qty > 0))
  assert.equal(received.status, 'WAIT_VAT_PLAN', '调色成果与实际来料均就绪后必须允许排缸')
}

function registerAndReceiveDirectPrintInput(spec: ScenarioSpec, ref: ProcessRef, sequence: number): void {
  const order = getPrintWorkOrderById(ref.processOrderId)
  const business = getPrintingWorkOrderById(ref.processOrderId)
  assert.ok(order?.printFactoryId && business, `${ref.processOrderCode} 必须已分配实际印花工厂`)
  assert.ok(
    business.plannedInput.sku && business.plannedInput.materialName && business.plannedInput.imageUrl,
    '本组直接印花案例必须在印花执行事实中承接真实物料 SKU、名称和图片',
  )
  const source = createDesignRevisionProcessMaterialTransfer({
    processType: 'PRINTING',
    processOrderId: ref.processOrderId,
    issuedBy: merchandiser.userName,
    issuedAt: fixedAt,
  })
  const sourceLine = source.lines[0]
  assert.ok(sourceLine)
  assert.equal(sourceLine.printingOrderId, ref.processOrderId)
  assert.equal(sourceLine.material.sku, business.plannedInput.sku)
  assert.ok(sourceLine.material.imageUrl)
  approveFactoryTransfer(source.id, merchandiser.userName, fixedAt)
  const position = getDefaultFactoryReceiptPosition(order.printFactoryId)
  const rolls = sourceLine.rolls
  assert.ok(rolls.length, '设计改款面料调拨必须生成真实卷码')
  confirmFactoryMaterialReceipt({
    id: `${source.id}-RECEIPT`,
    factoryId: order.printFactoryId,
    operatorId: `${order.printFactoryId}-WAREHOUSE`,
    operatorName: `${order.printFactoryName} 仓管`,
    receivedAt: fixedAt,
    remark: `${spec.id} 印花投入实际接收`,
    lines: [{ sourceId: source.id, sourceLineId: sourceLine.id, ...position, rolls: rolls.map((roll) => ({ ...roll, ...position })) }],
  })
  const received = getPrintingWorkOrderById(order.printOrderId)
  assert.ok(received?.actualInput.receipts?.some((item) => item.receiptId.startsWith('FRP-')))
  assert.equal(received?.actualInput.receivedQty, business.plannedInput.plannedQty)
}

function receiveDyeDispatchAtPrintFactory(printOrderId: string, dyeOrderId: string, sequence: number): void {
  const printOrder = getPrintWorkOrderById(printOrderId)
  assert.ok(printOrder?.printFactoryId)
  const source = listFactoryReceivingSources(printOrder.printFactoryId)
    .find((item) => item.type === 'HANDOUT' && item.lines.some((line) => line.printingOrderId === printOrderId) && item.workOrderNo === getDyeWorkOrderById(dyeOrderId)?.dyeOrderNo)
  assert.ok(source, '染色实际交出后必须为对应印花工厂生成可接收来源')
  const line = source.lines.find((item) => item.printingOrderId === printOrderId)
  assert.ok(line?.rolls.length)
  const position = getDefaultFactoryReceiptPosition(printOrder.printFactoryId)
  confirmFactoryMaterialReceipt({
    id: `RECEIVE-${source.id}-${sequence}`,
    factoryId: printOrder.printFactoryId,
    operatorId: `${printOrder.printFactoryId}-WAREHOUSE`,
    operatorName: `${printOrder.printFactoryName} 仓管`,
    receivedAt,
    remark: '已按染色交出卷逐卷实收并入待印花库位',
    lines: [{
      sourceId: source.id,
      sourceLineId: line.id,
      ...position,
      rolls: line.rolls.map((roll) => ({ ...roll, ...position })),
    }],
  })
  const received = getPrintingWorkOrderById(printOrderId)
  assert.ok(received?.actualInput.receipts?.some((item) => item.upstreamRecordId === source.id))
  assert.ok(received.actualInput.receivedQty > 0)
}

function completeDyeProcessOrder(spec: ScenarioSpec, ref: ProcessRef, displaySampleTaskId: string, sequence: number): void {
  let order = getDyeWorkOrderById(ref.processOrderId)
  assert.ok(order)
  const vat = listDyeVatOptions(order.dyeFactoryId)[0]
  assert.ok(vat, `${order.dyeFactoryName} 必须存在可用染缸`)
  planDyeVat(order.dyeOrderId, { dyeVatNo: vat.dyeVatNo, operatorName: dyeFactory.userName })
  startDyeing(order.dyeOrderId, { dyeVatNo: vat.dyeVatNo, inputQty: order.plannedQty, operatorName: dyeFactory.userName, materialSku: order.rawMaterialSku })
  completeDyeing(order.dyeOrderId, { outputQty: order.plannedQty, operatorName: dyeFactory.userName })
  for (const nodeCode of ['DEHYDRATE', 'DRY', 'SET', 'ROLL', 'PACK'] as const) {
    startDyeNode(order.dyeOrderId, nodeCode, dyeFactory.userName)
    completeDyeNode(order.dyeOrderId, nodeCode, { outputQty: order.plannedQty, operatorName: dyeFactory.userName })
  }

  order = getDyeWorkOrderById(order.dyeOrderId)!
  if (isDyeYarnOrder(order)) {
    const partner = getDyeDispatchPartner(order.dyeOrderId)
    assert.equal(partner.kind, 'FACTORY', '纱线染色产出必须交给方案指定的实际制作工厂')
    const netKg = Number(order.plannedQty.toFixed(3))
    const tubes = { PAPER: 1, CONICAL: 0, PAGODA: 0 }
    const handover = submitDyeHandover(order.dyeOrderId, {
      handoverQty: netKg,
      handoverPerson: dyeFactory.userName,
      handoverAt: fixedAt,
      yarn: {
        commandId: `${spec.id}-YARN-HANDOVER-${sequence}`,
        grossKg: Number((netKg + 0.062).toFixed(3)),
        pcs: 1,
        tubes,
        receiverFactoryId: partner.id,
      },
    })
    assert.equal(handover.recordIds.length, 1)
    const source = getFactoryReceivingSource(`YARN-SHIP-${spec.id}-YARN-HANDOVER-${sequence}`)
    assert.ok(source)
    const line = source.lines[0]
    const position = getDefaultFactoryReceiptPosition(partner.id)
    confirmFactoryMaterialReceipt({
      id: `${spec.id}-YARN-OUTPUT-RECEIPT-${sequence}`,
      factoryId: partner.id,
      operatorId: `${partner.id}-WAREHOUSE`,
      operatorName: `${partner.name} 仓管`,
      receivedAt,
      remark: '制作工厂已按筒数、毛重和净重实收染色纱线',
      lines: [{ sourceId: source.id, sourceLineId: line.id, ...position, grossKg: Number((netKg + 0.062).toFixed(3)), pcs: 1, tubes }],
    })
  } else {
    const rolls = saveDyeOutputRolls(order.dyeOrderId, [{
      qty: order.plannedQty,
      weightKg: Math.max(0.1, Number((order.plannedQty * 0.3).toFixed(3))),
      widthCm: 150,
      gsm: 180,
      vatNo: vat.dyeVatNo,
      remark: `${spec.id} 染色实际产出卷`,
    }])
    const outputRoll = rolls.at(-1)
    assert.ok(outputRoll, `${order.dyeOrderNo} 必须形成实际产出卷`)
    markDyeOutputRolls(order.dyeOrderId, [outputRoll.id], 'print')
    const printedRoll = getDyeWorkOrderById(order.dyeOrderId)?.outputRolls?.find((item) => item.id === outputRoll.id)
    assert.ok(printedRoll?.printedAt, `${order.dyeOrderNo} 产出卷必须先打印标签`)
    assert.ok(
      printedRoll && isDyeRollAvailable(order.dyeOrderId, printedRoll),
      `${order.dyeOrderNo} 产出卷应可交出：卷数量 ${printedRoll?.qty ?? 0}，可交数量 ${getDyeDispatchAvailableQty(order.dyeOrderId)}`,
    )
    const dispatch = createDyeDispatchDocument([{ orderId: order.dyeOrderId, rollIds: [outputRoll.id] }], dyeFactory.userName)
    scanDyeDispatchRoll(dispatch.id, outputRoll.barcode, dyeFactory.userName)
    saveDyeDispatchTransport(dispatch.id, { driver: '五流程司机', vehicle: '厢式货车', plate: `TEST-${sequence}`, note: `${spec.id} 实际交出` })
    finishDyeDispatchDocument(dispatch.id, 'confirm')
    if (ref.prerequisiteProcessOrderId) throw new Error('染色加工单引用不应声明自己的前置加工单')
    const downstreamPrintId = order.sourceSnapshot?.downstreamWorkOrderId
    if (downstreamPrintId) {
      receiveDyeDispatchAtPrintFactory(downstreamPrintId, order.dyeOrderId, sequence)
    } else {
      const handovers = getDyeOrderHandoverRecords(order.dyeOrderId)
      assert.equal(handovers.length, 1)
      const handover = handovers[0]
      receivePreparationHandoverForTask(handover.handoverRecordId || handover.recordId, {
        receiptId: `${spec.id}-DYE-TERMINAL-RECEIPT-${sequence}`,
        targetTaskOrderId: displaySampleTaskId,
        qty: handover.submittedQty ?? handover.plannedQty ?? 0,
        qtyUnit: handover.qtyUnit || order.qtyUnit,
        receiverName: `${displaySampleAssignment.teamName} 收料员`,
        receivedAt,
      })
    }
  }
  order = getDyeWorkOrderById(order.dyeOrderId)!
  assert.equal(order.status, 'WAIT_MANUAL_COMPLETION', '染色产出必须由实际接收方收齐后才允许具名完单')
  completeDyeWorkOrderDocument(order.dyeOrderId, { completedBy: merchandiser.userName, completedAt: receivedAt, remark: `${spec.id} 染色加工单实际闭环` })
  assert.equal(getDyeWorkOrderById(order.dyeOrderId)?.status, 'COMPLETED')
}

function completePrintProcessOrder(spec: ScenarioSpec, ref: ProcessRef, sequence: number): void {
  const order = getPrintWorkOrderById(ref.processOrderId)
  let business = getPrintingWorkOrderById(ref.processOrderId)
  assert.ok(order && business)
  assert.ok(business.actualInput.receivedQty > 0, '印花开工前必须已有工厂实际收料事实')
  if (!business.actualInput.receipts?.some((item) => item.receiptId.startsWith('FRP-'))) {
    throw new Error('印花投入必须来自工厂待接收的真实收料记录')
  }
  recordPrintingProductionStage(order.printOrderId, { id: `${spec.id}-PRINT-SAMPLE-${sequence}`, stage: 'SAMPLE', action: 'FINISH', operatorName: artworkTeam.userName })
  startPrintingProduction(order.printOrderId, { id: `${spec.id}-PRINT-START-${sequence}`, qty: business.plannedInput.plannedQty, operatorName: artworkTeam.userName })
  recordPrintingProductionStage(order.printOrderId, { id: `${spec.id}-PRINT-RUN-${sequence}`, stage: 'PRINT', action: 'START', operatorName: artworkTeam.userName })
  recordPrintingProductionStage(order.printOrderId, { id: `${spec.id}-PRINT-FINISH-${sequence}`, stage: 'PRINT', action: 'FINISH', qty: business.plannedInput.plannedQty, operatorName: artworkTeam.userName })
  business = getPrintingWorkOrderById(order.printOrderId)!
  if (/热转印|转印/.test(`${business.requirement.type} ${business.requirement.craftName}`)) {
    recordPrintingProductionStage(order.printOrderId, { id: `${spec.id}-TRANSFER-START-${sequence}`, stage: 'TRANSFER', action: 'START', operatorName: artworkTeam.userName })
    recordPrintingProductionStage(order.printOrderId, { id: `${spec.id}-TRANSFER-FINISH-${sequence}`, stage: 'TRANSFER', action: 'FINISH', qty: business.plannedInput.plannedQty, operatorName: artworkTeam.userName })
  }
  const batchId = `${spec.id}-PRINT-BATCH-${sequence}`
  completePrintingWorkOrder(order.printOrderId, {
    usedQty: business.plannedInput.plannedQty,
    usedRollCount: business.actualInput.receivedRollCount,
    completedQty: business.plannedInput.plannedQty,
    completedRollCount: 1,
    printerNo: `PRINT-${sequence}`,
    operatorName: artworkTeam.userName,
    batchId,
    lossQty: 0,
    finishOrder: true,
  })
  business = getPrintingWorkOrderById(order.printOrderId)!
  const producedBarcodes = business.barcodes.filter((barcode) => barcode.batchId === batchId)
  assert.equal(producedBarcodes.length, 1, '本批最终产出必须生成一条独立且可追溯的卷码')
  updatePrintingRollBarcode(order.printOrderId, producedBarcodes[0].id, {
    lengthY: business.output.completedQty,
    gsm: business.output.gsm || 180,
    widthCm: business.output.widthCm || 150,
    vatNo: `${spec.id}-PRINT-${sequence}`,
    warehouseName: `${order.printFactoryName} 待交出区`,
    remark: `${spec.id} 印花实际产出卷`,
  })
  business = getPrintingWorkOrderById(order.printOrderId)!
  const outputBarcodes = business.barcodes.filter((barcode) => barcode.batchId === batchId)
  markPrintingRollBarcodesPrinted(order.printOrderId, outputBarcodes.map((item) => item.id), artworkTeam.userName)
  business = getPrintingWorkOrderById(order.printOrderId)!
  assert.ok(
    business.barcodes.filter((barcode) => barcode.batchId === batchId).every((barcode) => barcode.status === '已打印' && barcode.printedAt && barcode.printedBy === artworkTeam.userName),
    '印花产出卷必须先真实打印条码，再进入交出单',
  )
  const dispatchId = createPrintingDispatch([{ workOrderId: order.printOrderId, barcodeIds: outputBarcodes.map((item) => item.id) }], artworkTeam.userName)
  outputBarcodes.forEach((barcode) => scanPrintingDispatchRoll(dispatchId, barcode.barcode, artworkTeam.userName))
  confirmPrintingDispatch(dispatchId, artworkTeam.userName)
  business = getPrintingWorkOrderById(order.printOrderId)!
  receivePrintingHandover(order.printOrderId, {
    receivedQty: business.handover.handedOverQty,
    receiverName: `${displaySampleAssignment.teamName} 收料员`,
  })
  completePrintWorkOrderDocument(order.printOrderId, { operatorName: merchandiser.userName })
  assert.equal(getPrintWorkOrderById(order.printOrderId)?.status, 'COMPLETED')
}

function completeProcessWorkOrders(spec: ScenarioSpec, record: EngineeringIndependentSamplingRecord): void {
  const refs = processRefs(record)
  if (!refs.length) return
  const displaySampleTask = findProfessionalTask(record, 'DISPLAY_SAMPLE')
  assignAndAcceptProcessOrders(spec, record)
  refs.filter((ref) => ref.processType === 'DYEING').forEach((ref, index) => registerAndReceiveDyeInput(spec, ref, index + 1))
  refs.filter((ref) => ref.processType === 'PRINTING' && !ref.prerequisiteProcessOrderId)
    .forEach((ref, index) => registerAndReceiveDirectPrintInput(spec, ref, index + 1))
  refs.filter((ref) => ref.processType === 'DYEING')
    .forEach((ref, index) => completeDyeProcessOrder(spec, ref, displaySampleTask.taskId, index + 1))
  refs.filter((ref) => ref.processType === 'PRINTING')
    .forEach((ref, index) => completePrintProcessOrder(spec, ref, index + 1))
  const completed = readDesignRevisionProcessWorkOrderStatuses(refs)
  completed.forEach((status) => assert.equal(status.status, 'COMPLETED', `${status.processOrderCode} 必须完成真实实物闭环`))
}

async function completeDesignRevisionPrerequisiteWork(spec: ScenarioSpec, samplingId: string): Promise<EngineeringIndependentSamplingRecord> {
  let record = getEngineeringIndependentSamplingRecord(samplingId)!
  const baseTask = record.professionalTasks.find((task) => task.taskType === 'BASE_PATTERN')
  if (baseTask) {
    startEngineeringIndependentProfessionalTask({ taskId: baseTask.taskId, actor: patternMaker, startedAt: fixedAt })
    const files = await uploadFiles([`${spec.id}-base-pattern.prj`], 'PATTERN_SOURCE', patternMaker, '版师')
    record = submitEngineeringIndependentProfessionalTask({
      taskId: baseTask.taskId, actor: patternMaker, submittedAt: fixedAt,
      results: [{ title: `${spec.id} 基码纸样`, version: `PATTERN-${spec.id}-V1`, description: '实际 PRJ 基码纸样', applicablePartOrSize: '基码', files }],
    })
  }

  for (const type of ['COLOR_YARN', 'COLOR_FABRIC', 'PATTERN_ARTWORK'] as const) {
    record = getEngineeringIndependentSamplingRecord(samplingId)!
    const task = record.professionalTasks.find((item) => item.taskType === type)
    if (task) await finishReviewableTask(spec, task, spec.reworkTaskType === type)
  }

  return getEngineeringIndependentSamplingRecord(samplingId)!
}

async function completeDesignRevisionDisplaySample(spec: ScenarioSpec, samplingId: string): Promise<EngineeringIndependentSamplingRecord> {
  let record = getEngineeringIndependentSamplingRecord(samplingId)!
  const sampleTask = findProfessionalTask(record, 'DISPLAY_SAMPLE')
  assert.equal(sampleTask.status, 'WAIT_START')
  const patternVersion = listEngineeringIndependentAvailablePatternVersions(record)[0]?.value
  assert.ok(patternVersion, '销售展示样衣必须取得已上传的基码纸样版本')
  startEngineeringIndependentProfessionalTask({ taskId: sampleTask.taskId, actor: sampleTeam, startedAt: fixedAt })
  const displayRequirements = sampleTask.sampleRequirements || []
  assert.ok(displayRequirements.length > 0, '销售展示样衣必须带有买手确认的颜色、尺码和数量要求')
  const sampleFiles = await Promise.all(displayRequirements.map((line, index) =>
    uploadFiles([`${spec.id}-display-${index + 1}.png`], 'SAMPLE_RESULT', sampleTeam, '制作团队'),
  ))
  record = submitEngineeringIndependentProfessionalTask({
    taskId: sampleTask.taskId, actor: sampleTeam, submittedAt: fixedAt,
    results: displayRequirements.map((line, index) => ({
      title: `${line.targetColor}-${line.targetSize} 销售展示样衣`, description: '按买手确认方案制作',
      requirementLineId: line.requirementLineId, sampleQuantity: line.requiredQuantity,
      sampleColor: line.targetColor, sampleSize: line.targetSize, sourcePatternVersion: patternVersion,
      files: sampleFiles[index],
    })),
  })
  assert.equal(record.status, 'WAIT_CONFIRMATION')
  record = confirmEngineeringIndependentSamplingResult({
    samplingTaskId: samplingId, actor: buyer, resultVersion: `${spec.id}-DESIGN-V1`,
    resultSummary: `${spec.name}全部专业成果已由买手确认`, confirmedAt: fixedAt,
  })
  assert.equal(record.status, 'COMPLETED')
  return record
}

function latestMasterTask(masterOrderId: string, type: EngineeringTaskType): EngineeringTaskRecord {
  const task = getEngineeringMasterOrderById(masterOrderId)?.tasks.find((item) => item.taskType === type)
  assert.ok(task, `${masterOrderId} 必须存在 ${type}`)
  return task
}

async function completeFirstSample(masterOrderId: string, spec: ScenarioSpec): Promise<void> {
  let task = latestMasterTask(masterOrderId, 'PRE_PRODUCTION_SAMPLE')
  assert.equal(task.status, '待开始')
  const master = getEngineeringMasterOrderById(masterOrderId)
  const basePatternReuse = master?.priorResultReuseLines.find((line) =>
    line.decision === '复用' && ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT'].includes(line.resultType),
  )
  assert.ok(basePatternReuse, '首单样衣必须读取主单已确认的设计改款基码纸样')
  const sourcePatternVersion = `${basePatternReuse.resultType === 'BASE_PATTERN_KNIT' ? '毛织' : '梭织'}基码纸样 ${basePatternReuse.sourceResultVersion}`
  startEngineeringTask({ masterOrderId, taskId: task.taskId, operatorId: sampleTeam.userId, operatorName: sampleTeam.userName })
  task = latestMasterTask(masterOrderId, 'PRE_PRODUCTION_SAMPLE')
  const images = await Promise.all((task.sampleRequirements || []).map((_, index) =>
    uploadFiles([`${spec.id}-first-sample-${index + 1}.png`], 'SAMPLE_RESULT', sampleTeam, '制作团队'),
  ))
  submitEngineeringTaskResult(masterOrderId, task.taskId, {
    sampleActuals: (task.sampleRequirements || []).map((line, index) => ({
      requirementLineId: line.requirementLineId, actualColor: line.targetColor, actualSize: line.targetSize,
      actualQuantity: line.requiredQuantity, sourcePatternVersion,
      productionNote: '按首单样衣要求完成', differenceNote: '', imageFileIds: [images[index][0].fileId],
      submittedBy: sampleTeam.userName,
    })),
  })
  assert.equal(latestMasterTask(masterOrderId, 'PRE_PRODUCTION_SAMPLE').status, '已完成')
}

async function completeSizePattern(masterOrderId: string, spec: ScenarioSpec): Promise<void> {
  let task = latestMasterTask(masterOrderId, 'SIZE_PATTERN_WOVEN')
  assert.equal(task.status, '待开始')
  startEngineeringTask({ masterOrderId, taskId: task.taskId, operatorId: patternMaker.userId, operatorName: patternMaker.userName })
  const sourceFiles = await uploadFiles([`${spec.id}-full-size-pattern.prj`], 'PATTERN_SOURCE', patternMaker, '版师')
  submitEngineeringPatternResult({
    masterOrderId, taskId: task.taskId, applicableSizes: [], sourceFiles, previewFiles: [],
    note: '', submittedBy: patternMaker.userName,
  })
  task = latestMasterTask(masterOrderId, 'SIZE_PATTERN_WOVEN')
  assert.equal(task.status, '已完成')
}

function completeTechnicalContent(technicalVersionId: string, template: TechnicalDataVersionContent): void {
  const current = getTechnicalDataVersionContent(technicalVersionId)
  assert.ok(current)
  const hasProcessRequirement = (value: string | undefined, process: 'PRINT' | 'DYE') => {
    const normalized = value?.trim() || ''
    const negative = process === 'PRINT'
      ? ['', '无', '否', '无印花', '无需印花', '不印花']
      : ['', '无', '否', '无染色', '无需染色', '不染色']
    return !negative.includes(normalized)
  }
  const printDesign = current.patternDesigns.find((item) => item.designSideType === 'FRONT' && item.imageUrl?.startsWith('data:image/'))
  const bomItems = current.bomItems.map((item) => {
    const printRequired = hasProcessRequirement(item.printRequirement, 'PRINT')
    const dyeRequired = hasProcessRequirement(item.dyeRequirement, 'DYE')
    if (!printRequired) return { ...item, printRequirement: '无', dyeRequirement: dyeRequired ? item.dyeRequirement : '无' }
    assert.ok(printDesign, `${item.name}存在印花要求，正式技术包必须绑定已上传的正面花型图`)
    return {
      ...item,
      dyeRequirement: dyeRequired ? item.dyeRequirement : '无',
      printSideMode: 'SINGLE' as const,
      frontPatternDesignId: printDesign.id,
      frontPatternDesignIds: [printDesign.id],
    }
  })
  const processTemplate = template.processEntries[0]
  assert.ok(processTemplate, '技术包测试模板必须包含一条可复制的工艺资料')
  const processEntries: TechnicalProcessEntry[] = []
  bomItems.forEach((item, itemIndex) => {
    const requirements = [
      ...(hasProcessRequirement(item.dyeRequirement, 'DYE') ? [{ code: 'DYE', name: '染色' }] : []),
      ...(hasProcessRequirement(item.printRequirement, 'PRINT') ? [{ code: 'PRINT', name: '印花' }] : []),
    ]
    requirements.forEach((requirement, requirementIndex) => {
      const id = `${technicalVersionId}-${requirement.code}-${itemIndex + 1}`
      const predecessor = requirement.code === 'PRINT'
        ? processEntries.find((entry) => entry.routeObjectKey === `BOM:${item.id}` && entry.processCode === 'DYE')
        : undefined
      processEntries.push({
        ...structuredClone(processTemplate),
        id,
        entryType: 'PROCESS_BASELINE',
        stageCode: 'PREP',
        stageName: '生产准备',
        processCode: requirement.code,
        processName: requirement.name,
        isSpecialCraft: false,
        routeStepNo: requirementIndex + 1,
        routeLaneNo: itemIndex + 1,
        routeObjectKey: `BOM:${item.id}`,
        inputObjectType: 'BOM_MATERIAL',
        outputObjectType: 'BOM_MATERIAL',
        linkedBomItemIds: [item.id],
        linkedPatternIds: current.patternFiles.map((row) => row.id),
        predecessorEntryIds: predecessor ? [predecessor.id] : [],
      })
    })
  })
  if (!processEntries.length) {
    processEntries.push({
      ...structuredClone(processTemplate),
      id: `${technicalVersionId}-PREP-1`,
      entryType: 'PROCESS_BASELINE',
      stageCode: 'PREP',
      stageName: '生产准备',
      processCode: 'PREP',
      processName: '生产准备核对',
      isSpecialCraft: false,
      routeStepNo: 1,
      routeLaneNo: 1,
      routeObjectKey: bomItems[0] ? `BOM:${bomItems[0].id}` : 'GARMENT:MAIN',
      inputObjectType: 'BOM_MATERIAL',
      outputObjectType: 'BOM_MATERIAL',
      linkedBomItemIds: bomItems.map((row) => row.id),
      linkedPatternIds: current.patternFiles.map((row) => row.id),
      predecessorEntryIds: [],
    })
  }
  const colorMaterialMappings = [...new Set(bomItems.map((item) => item.colorLabel?.trim() || '默认颜色'))].map((colorName, index) => ({
    id: `${technicalVersionId}-COLOR-${index + 1}`, spuCode: getTechnicalDataVersionById(technicalVersionId)?.styleCode || '',
    colorCode: `COLOR-${index + 1}`, colorName, status: 'CONFIRMED' as const, generatedMode: 'AUTO' as const,
    confirmedBy: merchandiser.userName, confirmedAt: fixedAt, remark: '来源工程 BOM。',
    lines: bomItems.filter((item) => (item.colorLabel?.trim() || '默认颜色') === colorName).map((item, lineIndex) => ({
      id: `${technicalVersionId}-COLOR-${index + 1}-LINE-${lineIndex + 1}`, bomItemId: item.id,
      materialCode: item.materialCode || item.materialSkuId || item.id, materialName: item.name,
      materialType: item.type === '成衣' ? '半成品' as const : item.type === '纱线' ? '其他' as const : item.type,
      unit: item.unit || 'PCS',
      applicableSkuCodes: [...(item.applicableSkuCodes || [])], sourceMode: 'AUTO' as const, note: '生产准备单汇总。',
    })),
  }))
  updateTechnicalDataVersionContent(technicalVersionId, {
    bomItems, processEntries, processRouteStatus: 'CONFIRMED', processRouteConfirmedBy: merchandiser.userName,
    processRouteConfirmedAt: fixedAt, processRouteUpdatedBy: merchandiser.userName, processRouteUpdatedAt: fixedAt,
    sizeTable: template.sizeTable.map((item, index) => ({ ...structuredClone(item), id: `${technicalVersionId}-SIZE-${index + 1}` })),
    qualityRules: template.qualityRules.map((item, index) => ({ ...structuredClone(item), id: `${technicalVersionId}-QUALITY-${index + 1}` })),
    colorMaterialMappings,
  })
  assert.deepEqual(getTechnicalDataVersionById(technicalVersionId)?.missingItemCodes, [])
}

function reviewTechPackNode(technicalVersionId: string, nodeKey: TechnicalReviewNodeKey): void {
  const version = getTechnicalDataVersionById(technicalVersionId)!
  const node = nodeKey === 'BUYER' ? version.buyerReview : nodeKey === 'PATTERN_MAKER' ? version.patternMakerReview : version.merchandiserReview
  assert.ok(node)
  if (node.status === '无需审核') return
  const operator = { id: node.assignedReviewerId, name: node.assignedReviewerName }
  startTechPackReview(technicalVersionId, nodeKey, { operator, opinion: '开始审核五流程测试资料。' })
  approveTechPackReview(technicalVersionId, nodeKey, '资料正确，审核通过。', operator)
}

async function publishFormalTechPack(masterOrderId: string, styleId: string, template: TechnicalDataVersionContent): Promise<string> {
  const draft = createEngineeringMasterTechPackDraft(masterOrderId, merchandiser.userName)
  completeTechnicalContent(draft.technicalVersionId, template)
  submitTechPackFirstStageReview(draft.technicalVersionId, {
    buyerReviewerId: getLegacyTechPackReviewer('买手').reviewerId,
    patternMakerReviewerId: getLegacyTechPackReviewer('版师').reviewerId,
    merchandiserReviewerId: getLegacyTechPackReviewer('跟单').reviewerId,
    operator: { id: merchandiser.userId, name: merchandiser.userName },
  })
  reviewTechPackNode(draft.technicalVersionId, 'BUYER')
  reviewTechPackNode(draft.technicalVersionId, 'PATTERN_MAKER')
  reviewTechPackNode(draft.technicalVersionId, 'MERCHANDISER')
  const published = publishTechnicalDataVersion(draft.technicalVersionId, merchandiser.userName)
  activateTechPackVersionForStyle(styleId, published.technicalVersionId, merchandiser.userName)
  const finalVersion = getTechnicalDataVersionById(published.technicalVersionId)!
  assert.equal(finalVersion.versionStatus, 'PUBLISHED')
  assert.equal(finalVersion.reviewStage, '已发布')
  assert.equal(getStyleArchiveById(styleId)?.currentTechPackVersionId, finalVersion.technicalVersionId)
  assert.ok(getTechnicalDataVersionContent(finalVersion.technicalVersionId)?.bomPricingSnapshot)
  assert.equal(latestMasterTask(masterOrderId, 'TECH_PACK_CONFIRMATION').status, '已完成')
  return finalVersion.technicalVersionId
}

async function runScenario(
  spec: ScenarioSpec,
  sourceTemplate: StyleArchiveShellRecord,
  archiveTemplate: StyleArchiveShellRecord,
  technicalTemplate: TechnicalDataVersionContent,
): Promise<ScenarioRecord> {
  const checkpoints: string[] = []
  const processOrderIds: string[] = []
  const progress: ScenarioRecord = {
    id: spec.id,
    name: spec.name,
    result: '失败',
    designRevisionTaskId: '',
    targetStyleCode: '',
    masterOrderId: '',
    technicalVersionId: '',
    processOrderIds,
    checkpoints,
    error: '',
  }
  scenarioProgress.set(spec.id, progress)
  const sourceSkuTemplate = listSkuArchivesByStyleId(sourceTemplate.styleId).find((sku) => sku.archiveStatus === 'ACTIVE')
  assert.ok(sourceSkuTemplate)
  const source = createFormalSource(sourceTemplate, spec)
  seedTargetSkuDimensions(source, sourceSkuTemplate, spec, ['参考色'])
  const sourceSkus = listSkuArchivesByStyleId(source.styleId).filter((sku) => sku.archiveStatus === 'ACTIVE')
  const sourceColor = sourceSkus[0]?.colorName
  assert.ok(sourceColor)
  const { material, sku } = materialFixture(spec.materialKind)
  const sourceBomId = createConfirmedSourceBom(
    spec,
    source,
    sourceColor,
    sku.materialSkuId,
    spec.materialKind === 'yarn' ? '纱线' : '面料',
    sku.skuImageUrl,
    sku.pricingUnit,
  )
  assert.ok(sourceBomId)
  checkpoints.push('参照款 BOM 与价格已确认')

  const designFiles = await uploadFiles([`${spec.id}-design.png`], 'DESIGN_IMAGE', buyer, '买手')
  const reusedPatternFiles = spec.patternHandling === 'REUSE'
    ? await uploadFiles([`${spec.id}-reused-base.prj`], 'PATTERN_SOURCE', buyer, '买手')
    : []
  let targetStyle: StyleArchiveShellRecord | null = spec.targetMode === 'ARCHIVED_STYLE'
    ? createFormalTarget(archiveTemplate, spec, designFiles[0].dataUrl)
    : null
  if (targetStyle) seedTargetSkuDimensions(targetStyle, sourceSkus[0], spec)
  let sampling = createEngineeringIndependentSampling({
    sourceStyleId: source.styleId, targetMode: spec.targetMode, targetStyleId: targetStyle?.styleId,
    temporarySpuName: spec.targetMode === 'TEMPORARY_SPU' ? `${spec.id} 线下临时 SPU` : undefined,
    creationReason: spec.name, designFiles, patternHandling: spec.patternHandling, reusedPatternFiles, buyer, createdAt: fixedAt,
  })
  progress.designRevisionTaskId = sampling.samplingTaskId
  progress.targetStyleCode = sampling.targetStyleCode
  assert.equal(sampling.status, 'DRAFT')
  assert.equal(sampling.designFiles[0].uploadedByTeam, '买手')
  checkpoints.push('买手上传真实设计稿并创建设计改款')

  assert.equal(sampling.bomVersionIds.length, 1, '新任务只允许一份整款物料与费用方案')
  const wholeStyleBom = getEngineeringBomVersionById(sampling.bomVersionIds[0])
  assert.ok(wholeStyleBom)
  assert.equal(wholeStyleBom.sourceVersionId, '', '设计改款不得带入参照款 BOM')
  assert.equal(wholeStyleBom.materialLines.length, 0, '新任务必须从空白物料表开始')
  saveEngineeringBomVersion({
    versionId: wholeStyleBom.bomDraftVersionId,
    role: '买手',
    userId: buyer.userId,
    userName: buyer.userName,
    materialLines: [buildBomLine(
      spec,
      sku.materialSkuId,
      spec.materialKind === 'yarn' ? '纱线' : '面料',
      sku.skuImageUrl,
      sku.pricingUnit,
      wholeStyleBom.applicableSkuIds,
    )],
    updatedAt: fixedAt,
  })
  const manuallyMaintainedBom = getEngineeringBomVersionById(wholeStyleBom.bomDraftVersionId)
  assert.equal(manuallyMaintainedBom?.materialLines.length, 1)
  assert.ok(manuallyMaintainedBom?.materialLines.every((line) => Boolean(line.materialImageUrl || sku.skuImageUrl)))
  checkpoints.push('新任务建立空白整款方案，买手手工新增物料')
  saveEngineeringBomPricingPlan({
    ownerStage: 'INDEPENDENT_SAMPLING', ownerId: sampling.samplingTaskId, role: '买手', userId: buyer.userId,
    userName: buyer.userName, customCostDecision: 'NO_CUSTOM_COST', customCosts: [], updatedAt: fixedAt,
  })
  const sampleRequirements = spec.colors.flatMap((color) => spec.sizes.map((size, index) => ({
    targetColor: color, targetSize: size, requiredQuantity: index + 1, requirementNote: `${color}/${size} 销售展示`,
  })))
  const suggested = suggestEngineeringIndependentTaskTypes(sampling)
  sampling = confirmEngineeringIndependentSamplingScheme({
    samplingTaskId: sampling.samplingTaskId, actor: buyer, selectedTaskTypes: suggested,
    displaySampleAssignment,
    sampleRequirements, confirmedAt: fixedAt,
  })
  assert.equal(sampling.displaySampleTeamId, displaySampleAssignment.teamId)
  assert.equal(sampling.displaySampleTeamName, displaySampleAssignment.teamName)
  assert.equal(sampling.displaySampleReceivingLocationId, displaySampleAssignment.receivingLocationId)
  assert.equal(sampling.displaySampleReceivingLocationName, displaySampleAssignment.receivingLocationName)
  assert.equal(sampling.professionalTasks.some((task) => task.taskType === 'BASE_PATTERN'), spec.patternHandling === 'REMAKE')
  const displayRequirement = sampling.professionalTasks.find((task) => task.taskType === 'DISPLAY_SAMPLE')?.sampleRequirements || []
  const expectedSampleQuantity = sampleRequirements.reduce((sum, line) => sum + line.requiredQuantity, 0)
  assert.equal(displayRequirement.length, 1, '销售展示样衣只能保存一条整款要求')
  assert.equal(displayRequirement[0]?.targetSize, 'M', '销售展示样衣尺码固定为 M')
  assert.equal(displayRequirement[0]?.requiredQuantity, expectedSampleQuantity, '历史多行要求必须完整汇总总件数')
  checkpoints.push('物料、费用、印染要求和 M 码销售展示总件数一次确认')

  const processTasks = sampling.professionalTasks.filter((task) => ['PATTERN_ARTWORK', 'COLOR_YARN', 'COLOR_FABRIC'].includes(task.taskType))
  processTasks.forEach((task) => {
    assert.ok(task.processWorkOrderRefs.length > 0, `${task.taskName}生成时必须同步创建加工单`)
    task.processWorkOrderRefs.forEach((ref) => {
      processOrderIds.push(ref.processOrderId)
      const processOrder = ref.processType === 'DYEING'
        ? getDyeWorkOrderById(ref.processOrderId)
        : getPrintWorkOrderById(ref.processOrderId)
      assert.ok(processOrder, `${ref.processOrderId} 必须已写入 FCS 加工单事实源`)
      assert.equal(processOrder.sourceType, 'DESIGN_REVISION')
      assert.equal(processOrder.sourceSnapshot?.designRevisionTaskId, sampling.samplingTaskId)
      assert.equal(processOrder.sourceSnapshot?.professionalTaskId, task.taskId)
      assert.equal(
        processOrder.sourceSnapshot?.targetSpuCode,
        sampling.targetStyleCode || `TEMP-${sampling.samplingTaskCode}`,
      )
      assert.equal(processOrder.sourceSnapshot?.targetColorName, ref.targetColor)
      assert.equal(processOrder.sourceSnapshot?.bomVersionId, ref.bomVersionId)
      assert.ok(processOrder.sourceSnapshot?.bomItemIds?.includes(ref.bomItemId))
      assert.equal(processOrder.sourceSnapshot?.receivingTeamName, '制作团队')
      assert.equal(processOrder.sourceSnapshot?.receivingFactoryId, displaySampleAssignment.receivingFactoryId)
      assert.equal(processOrder.sourceSnapshot?.receivingFactoryName, displaySampleAssignment.receivingFactoryName)
      assert.ok(ref.processOrderCode, 'PCS 专业任务必须保存 FCS 加工单业务编号')
    })
  })
  if (spec.processMode === 'NONE') assert.equal(processOrderIds.length, 0)
  if (spec.processMode === 'DYE_THEN_PRINT') {
    const dyeRefs = processTasks.flatMap((task) => task.processWorkOrderRefs).filter((ref) => ref.processType === 'DYEING')
    const printRefs = processTasks.flatMap((task) => task.processWorkOrderRefs).filter((ref) => ref.processType === 'PRINTING')
    assert.equal(dyeRefs.length, printRefs.length)
    printRefs.forEach((ref) => assert.ok(dyeRefs.some((dye) => dye.processOrderId === ref.prerequisiteProcessOrderId && dye.bomItemId === ref.bomItemId)))
    checkpoints.push('同物料染色加工单是印花加工单的前置')
  }
  if (processOrderIds.length) checkpoints.push('方案确认时同步创建印花／染色加工单')
  progress.processOrderIds = [...new Set(processOrderIds)]

  sampling = await completeDesignRevisionPrerequisiteWork(spec, sampling.samplingTaskId)
  checkpoints.push(spec.reworkTaskType ? '专业成果退回后完成第二轮重提并通过' : '专业任务成果全部通过')
  if (processOrderIds.length) {
    const blockedDisplaySample = findProfessionalTask(sampling, 'DISPLAY_SAMPLE')
    assert.equal(blockedDisplaySample.status, 'WAIT_START')
    assert.throws(
      () => startEngineeringIndependentProfessionalTask({
        taskId: blockedDisplaySample.taskId,
        actor: sampleTeam,
        startedAt: fixedAt,
      }),
      /印花|染色|尚未全部交到制作团队|尚未完成/,
      '印花／染色加工单未形成实际完成事实前不得开始销售展示样衣',
    )
    assert.equal(findProfessionalTask(getEngineeringIndependentSamplingRecord(sampling.samplingTaskId)!, 'DISPLAY_SAMPLE').status, 'WAIT_START')
    checkpoints.push('加工单未完成时销售展示样衣被真实门禁阻断')
    completeProcessWorkOrders(spec, sampling)
    checkpoints.push('专业成果绑定加工单，完成分厂、接单、实际收料、加工、交出、实收和具名完单')
  }
  sampling = await completeDesignRevisionDisplaySample(spec, sampling.samplingTaskId)
  if (processOrderIds.length) checkpoints.push('全部印染加工单完成后销售展示样衣解除门禁并完成')

  if (spec.targetMode === 'TEMPORARY_SPU') {
    assert.ok(listCompletedTemporarySpuDesignRevisions().some((record) => record.samplingTaskId === sampling.samplingTaskId))
    targetStyle = createFormalTarget(archiveTemplate, spec, designFiles[0].dataUrl)
    seedTargetSkuDimensions(targetStyle, sourceSkus[0], spec, spec.colors)
    sampling = linkCompletedTemporarySpuToStyleArchive({
      samplingTaskId: sampling.samplingTaskId, styleId: targetStyle.styleId,
      actor: { userId: buyer.userId, userName: buyer.userName }, linkedAt: fixedAt,
    })
    assert.equal(sampling.linkedFormalStyleId, targetStyle.styleId)
    assert.ok(getStyleArchiveById(targetStyle.styleId)?.inheritedDesignFileIds?.includes(designFiles[0].fileId))
    checkpoints.push('线下临时 SPU 建档关联并承接设计稿、纸样和 BOM')
  }
  assert.ok(targetStyle)
  progress.targetStyleCode = targetStyle.styleCode

  let master = createEngineeringMasterOrder({
    styleId: targetStyle.styleId, styleCode: targetStyle.styleCode, merchandiserId: merchandiser.userId,
    merchandiserName: merchandiser.userName, createdById: merchandiser.userId, createdBy: merchandiser.userName,
    createdByRole: '跟单', preparationType: 'PURE_WOVEN',
    qualificationFact: {
      styleCode: targetStyle.styleCode, formalSaleStatus: 'NO_FORMAL_SALE', formalProductionStatus: 'NO_FORMAL_PRODUCTION',
      formalSaleSource: '五流程测试事实', formalProductionSource: '五流程测试事实', checkedAt: fixedAt,
    },
    bulkProductionQualification: {
      basisType: 'DESIGN_REVISION_READY', triggerBusinessObjectType: '设计改款任务',
      triggerBusinessObjectId: sampling.samplingTaskId, thresholdQuantity: null, reachedQuantity: null, reachedAt: fixedAt,
      reason: '设计改款完成，进入生产准备', uniqueTriggerKey: `FIVE-${spec.id}`,
    },
    creationReason: spec.name,
  })
  progress.masterOrderId = master.masterOrderId
  const candidates = listEngineeringMasterPriorResultCandidates(targetStyle.styleCode, 'PURE_WOVEN')
  const candidateByType = new Map<EngineeringTaskType, (typeof candidates)[number]>()
  candidates.forEach((candidate) => { if (!candidateByType.has(candidate.engineeringTaskType)) candidateByType.set(candidate.engineeringTaskType, candidate) })
  const baseCandidate = candidateByType.get('BASE_PATTERN_WOVEN')
  assert.ok(baseCandidate, '生产准备单必须能复用设计改款阶段已确认的真实 PRJ 基码纸样')
  const selectedConditional = [
    ...(spec.processMode === 'PRINT' || spec.processMode === 'DYE_THEN_PRINT' ? ['PATTERN_ARTWORK' as const] : []),
    ...(spec.processMode === 'DYE' || spec.processMode === 'DYE_THEN_PRINT'
      ? [spec.materialKind === 'yarn' ? 'COLOR_YARN' as const : 'COLOR_FABRIC' as const]
      : []),
  ]
  const priorTypes = ['BASE_PATTERN_WOVEN' as const, ...selectedConditional]
  master = confirmEngineeringMasterTaskPlan(master.masterOrderId, {
    confirmedBy: merchandiser.userName, confirmedById: merchandiser.userId, confirmedByRole: '跟单', preparationType: 'PURE_WOVEN',
    bomConditions: {
      hasPrintRequirement: selectedConditional.includes('PATTERN_ARTWORK'),
      hasYarnDyeRequirement: selectedConditional.includes('COLOR_YARN'),
      hasFabricDyeRequirement: selectedConditional.includes('COLOR_FABRIC'),
      hasAccessoryPurchaseRequirement: false,
    },
    selectedConditionalTaskTypes: selectedConditional,
    priorResultDecisions: priorTypes.map((type) => {
      const candidate = candidateByType.get(type)
      assert.ok(candidate, `必须能承接设计改款专业成果 ${type}`)
      return {
        engineeringTaskType: type, sourceSamplingTaskId: candidate.source.samplingTaskId,
        sourceProfessionalTaskId: candidate.source.professionalTaskId, sourceResultVersion: candidate.source.resultVersion,
        decision: '复用' as const,
      }
    }),
    preProductionSampleRequirements: sampleRequirements,
  })
  assert.equal(master.tasks.some((task) => task.taskType.startsWith('BASE_PATTERN') && task.status !== '未启用'), false)
  confirmEngineeringMasterBomPricingPlan({ masterOrderId: master.masterOrderId, role: '买手', userId: buyer.userId, userName: buyer.userName })
  assert.equal(getEngineeringBomPricingPlan('ENGINEERING_MASTER', master.masterOrderId)?.status, 'COMPLETED_CONFIRMED')
  assert.ok(listEngineeringBomVersionsByOwner('ENGINEERING_MASTER', master.masterOrderId).every((version) => version.versionStatus === 'COMPLETED_CONFIRMED'))
  master = getEngineeringMasterOrderById(master.masterOrderId)!
  selectedConditional.forEach((taskType) => assert.equal(
    master.tasks.find((task) => task.taskType === taskType)?.status,
    '已完成',
    `${taskType} 必须直接承接设计改款已确认成果，不能重复执行`,
  ))
  checkpoints.push('生产准备单承接设计改款 BOM、纸样与专业成果并发布')

  if (spec.preparationOrder === 'SAMPLE_FIRST') {
    await completeFirstSample(master.masterOrderId, spec)
    await completeSizePattern(master.masterOrderId, spec)
    checkpoints.push('首单样衣先完成，齐码纸样后完成')
  } else {
    await completeSizePattern(master.masterOrderId, spec)
    await completeFirstSample(master.masterOrderId, spec)
    checkpoints.push('齐码纸样先完成，验证两项允许并行且不互相阻断')
  }
  const technicalVersionId = await publishFormalTechPack(master.masterOrderId, targetStyle.styleId, technicalTemplate)
  progress.technicalVersionId = technicalVersionId
  assert.equal(validateEngineeringMasterOrderClose(master.masterOrderId).canClose, true)
  master = closeEngineeringMasterOrder(master.masterOrderId, merchandiser.userName)
  assert.equal(master.status, '已关闭')
  checkpoints.push('技术包三段审核、正式发布、启用并关闭生产准备主单')

  progress.result = '通过'
  return progress
}

async function main(): Promise<void> {
  resetAll()
  const technicalTemplateRecord = listTechnicalDataVersions().find((record) => {
    const content = getTechnicalDataVersionContent(record.technicalVersionId)
    return Boolean(content?.processEntries.length && content.sizeTable.length && content.qualityRules.length)
  })
  assert.ok(technicalTemplateRecord, '必须存在工艺、尺码和质量完整的技术包模板数据')
  const technicalTemplate = getTechnicalDataVersionContent(technicalTemplateRecord.technicalVersionId)!
  const sourceStyles = listStyleArchives().filter((style) =>
    style.archiveStatus === 'ACTIVE' && style.mainImageUrl
    && listSkuArchivesByStyleId(style.styleId).some((sku) => sku.archiveStatus === 'ACTIVE'),
  ).slice(0, scenarios.length)
  assert.equal(sourceStyles.length, scenarios.length, '必须有 5 个带真实图片和有效 SKU 的参照款')
  const archiveTemplate = sourceStyles[0]

  try {
    for (let index = 0; index < scenarios.length; index += 1) {
      const spec = scenarios[index]
      try {
        const result = await runScenario(spec, sourceStyles[index], archiveTemplate, technicalTemplate)
        executionRecords.push(result)
        console.log(`${spec.id} PASS ${spec.name} -> ${result.technicalVersionId}`)
      } catch (error) {
        const message = error instanceof Error ? error.stack || error.message : String(error)
        const progress = scenarioProgress.get(spec.id) || {
          id: spec.id, name: spec.name, result: '失败' as const, designRevisionTaskId: '', targetStyleCode: '',
          masterOrderId: '', technicalVersionId: '', processOrderIds: [], checkpoints: [], error: '',
        }
        progress.error = message
        executionRecords.push(progress)
        console.error(`${spec.id} FAIL ${spec.name}\n${message}`)
      }
    }
    assert.equal(executionRecords.length, 5)
    assert.ok(
      executionRecords.every((record) => record.result === '通过'),
      `五流程存在失败：${executionRecords.filter((record) => record.result === '失败').map((record) => record.id).join('、')}`,
    )
    assert.equal(new Set(executionRecords.map((record) => record.designRevisionTaskId)).size, 5)
    assert.equal(new Set(executionRecords.map((record) => record.masterOrderId)).size, 5)
    assert.equal(new Set(executionRecords.map((record) => record.technicalVersionId)).size, 5)
  } finally {
    mkdirSync(dirname(recordPath), { recursive: true })
    writeFileSync(recordPath, JSON.stringify({
      title: 'PCS 设计改款至生产准备正式技术包五组全流程测试记录',
      branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
      head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
      executedAt: new Date().toISOString(),
      overallResult: executionRecords.length === 5 && executionRecords.every((record) => record.result === '通过') ? '通过' : '失败',
      scenarioCount: executionRecords.length,
      records: executionRecords,
    }, null, 2))
  }
  console.log(`pcs-design-revision-production-preparation-five-flows.spec PASS (${executionRecords.length}/5)`)
  console.log(`record: ${recordPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
