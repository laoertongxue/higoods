import { POST_FINISHING_PRODUCTION_SOURCE_FIXTURES } from './fcs/post-finishing-production-source-fixtures.ts'
import {
  calculateEngineeringBomTotalRequirement,
  resolveEngineeringBomMaterialLine,
} from './pcs-engineering-bom-material-resolver.ts'
import {
  getMaterialArchiveById,
  getMaterialSkuRecordById,
  listMaterialArchives,
  listMaterialSkuRecordsByMaterialId,
} from './pcs-material-archive-repository.ts'
import {
  bindDesignRevisionApprovedProfessionalResult,
  prepareDesignRevisionProcessWorkOrders,
  readDesignRevisionProcessWorkOrderStatuses,
  type DesignRevisionProcessWorkOrderLineInput,
} from './pcs-design-revision-process-work-order-port.ts'
import type { EngineeringBomMaterialLineDraft } from './pcs-engineering-bom-types.ts'
import type {
  EngineeringIndependentColorMapping,
  EngineeringIndependentMaterialConversionLine,
  EngineeringIndependentMaterialDecision,
  EngineeringIndependentProcessWorkOrderRef,
  EngineeringIndependentProfessionalResult,
  EngineeringIndependentProfessionalTask,
  EngineeringIndependentProfessionalTaskType,
  EngineeringIndependentReusableProfessionalResult,
  EngineeringIndependentSamplingRecord,
  EngineeringIndependentSamplingStep,
  EngineeringIndependentSamplingType,
  EngineeringSampleRequirementLine,
} from './pcs-engineering-master-types.ts'
import {
  captureStyleArchiveRepositoryState,
  getStyleArchiveById,
  listStyleArchives,
  restoreStyleArchiveRepositoryState,
  updateStyleArchive,
} from './pcs-style-archive-repository.ts'
import {
  createSkuArchiveBatch,
  listSkuArchives,
  listSkuArchivesByStyleId,
  replaceSkuArchiveStore,
} from './pcs-sku-archive-repository.ts'
import type { SkuArchiveRecord } from './pcs-sku-archive-types.ts'
import {
  captureEngineeringBomRepositoryState,
  confirmEngineeringBomVersion,
  createEngineeringBomVersionsForOwner,
  getEngineeringBomPricingPlan,
  getEngineeringBomVersionById,
  listEngineeringBomHistory,
  listEngineeringBomVersionsByOwner,
  reconcileEngineeringBomVersionsForTargetColors,
  rebindEngineeringBomOwnerStyle,
  regenerateEngineeringBomVersionFromSource,
  resolveEngineeringBomPricingPlan,
  restoreEngineeringBomRepositoryState,
  saveEngineeringBomVersion,
  setEngineeringBomVersionsEditingLock,
} from './pcs-engineering-bom-repository.ts'
import type { EngineeringUploadedFile } from './pcs-engineering-file-upload.ts'
import { assertEngineeringUploadedFilesReady } from './pcs-engineering-file-upload.ts'
import { getEngineeringTaskUploadedFile } from './pcs-engineering-task-upload-repository.ts'
import { upsertProjectRelation } from './pcs-project-relation-repository.ts'

const STORAGE_KEY = 'higood-pcs-design-revision-v1'
const DESIGN_REVISION_WHOLE_STYLE_SCOPE = '整款'
const DESIGN_REVISION_DEFAULT_SAMPLE_SIZE = 'M'
const TASK_META: Record<EngineeringIndependentProfessionalTaskType, { name: string; team: string }> = {
  BASE_PATTERN: { name: '基码纸样', team: '版师' },
  DISPLAY_SAMPLE: { name: '销售展示样衣任务', team: '制作团队' },
  PATTERN_ARTWORK: { name: '花型任务', team: '花型团队' },
  COLOR_YARN: { name: '调色任务（纱线）', team: '染厂' },
  COLOR_FABRIC: { name: '调色任务（面料）', team: '染厂' },
}

export const DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS = [
  {
    teamId: 'PCS-DISPLAY-SAMPLE-TEAM',
    teamName: '制作团队',
    receivingFactoryId: 'ID-F014',
    receivingFactoryName: 'CV Satellite Tangerang Barat',
    receivingLocationId: 'PCS-DISPLAY-SAMPLE-AREA',
    receivingLocationName: '销售展示样衣制作区',
  },
] as const

export interface EngineeringIndependentDisplaySampleAssignment {
  teamId: string
  teamName: string
  receivingFactoryId: string
  receivingFactoryName: string
  receivingLocationId: string
  receivingLocationName: string
}

let memoryRecords: EngineeringIndependentSamplingRecord[] | null = null

export interface EngineeringIndependentSamplingRepositoryState {
  records: EngineeringIndependentSamplingRecord[]
}

function nowText(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function cloneSampleRequirement(line: EngineeringSampleRequirementLine): EngineeringSampleRequirementLine {
  return { ...line }
}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function'
}

function cloneResult(result: EngineeringIndependentProfessionalResult): EngineeringIndependentProfessionalResult {
  return {
    ...result,
    version: result.version || '',
    description: result.description || '',
    applicablePartOrSize: result.applicablePartOrSize || '',
    sampleQuantity: Number(result.sampleQuantity) || 0,
    sampleColor: result.sampleColor || '',
    sampleSize: result.sampleSize || '',
    sourcePatternVersion: result.sourcePatternVersion || '',
    requirementLineId: result.requirementLineId || '',
    differenceNote: result.differenceNote || '',
    files: (result.files || []).map((file) => ({ ...file })),
  }
}

function cloneTask(task: EngineeringIndependentProfessionalTask): EngineeringIndependentProfessionalTask {
  return {
    ...task,
    colorRequirementConfirmedBy: task.colorRequirementConfirmedBy || '',
    colorRequirementConfirmedAt: task.colorRequirementConfirmedAt || '',
    dependsOnTaskIds: [...task.dependsOnTaskIds],
    sampleRequirements: (task.sampleRequirements || []).map(cloneSampleRequirement),
    processWorkOrderRefs: (task.processWorkOrderRefs || []).map((item) => ({ ...item })),
    results: task.results.map(cloneResult),
  }
}

function cloneRecord(record: EngineeringIndependentSamplingRecord): EngineeringIndependentSamplingRecord {
  return {
    ...record,
    designFiles: (record.designFiles || []).map((file) => ({ ...file })),
    reusedPatternFiles: (record.reusedPatternFiles || []).map((file) => ({ ...file })),
    relatedProfessionalTaskIds: [...record.relatedProfessionalTaskIds],
    professionalTasks: record.professionalTasks.map(cloneTask),
    selectedTaskTypes: [...record.selectedTaskTypes],
    suggestedTaskTypes: [...record.suggestedTaskTypes],
    colorMappings: record.colorMappings.map((item) => ({ ...item, targetSkuIds: [...item.targetSkuIds], targetSizeNames: [...(item.targetSizeNames || [])] })),
    materialConversionLines: record.materialConversionLines.map((item) => ({ ...item })),
    bomVersionIds: [...(record.bomVersionIds || (record.bomDraftVersionId ? [record.bomDraftVersionId] : []))],
    operationLogs: record.operationLogs.map((log) => ({ ...log })),
  }
}

function normalizeRecord(record: EngineeringIndependentSamplingRecord): EngineeringIndependentSamplingRecord {
  const normalized: EngineeringIndependentSamplingRecord = {
    ...record,
    samplingType: 'DESIGN_REVISION',
    designFiles: Array.isArray(record.designFiles) ? record.designFiles.map((file) => ({ ...file })) : [],
    reusedPatternFiles: Array.isArray(record.reusedPatternFiles) ? record.reusedPatternFiles.map((file) => ({ ...file })) : [],
    targetMode: record.targetMode || 'ARCHIVED_STYLE',
    temporarySpuName: record.temporarySpuName || '',
    linkedFormalStyleId: record.linkedFormalStyleId || '',
    linkedFormalStyleCode: record.linkedFormalStyleCode || '',
    linkedFormalStyleName: record.linkedFormalStyleName || '',
    linkedAt: record.linkedAt || '',
    linkedBy: record.linkedBy || '',
    patternHandling: record.patternHandling || 'REMAKE',
    buyerId: record.buyerId || record.merchandiserId || '',
    buyerName: record.buyerName || record.merchandiserName || '待分配买手',
    displaySampleTeamId: record.displaySampleTeamId || '',
    displaySampleTeamName: record.displaySampleTeamName || '',
    displaySampleReceivingLocationId: record.displaySampleReceivingLocationId || '',
    displaySampleReceivingLocationName: record.displaySampleReceivingLocationName || '',
    relatedProfessionalTaskIds: Array.isArray(record.relatedProfessionalTaskIds) ? record.relatedProfessionalTaskIds : [],
    professionalTasks: Array.isArray(record.professionalTasks) ? record.professionalTasks.map(cloneTask) : [],
    selectedTaskTypes: Array.isArray(record.selectedTaskTypes) ? record.selectedTaskTypes : [],
    suggestedTaskTypes: Array.isArray(record.suggestedTaskTypes) ? record.suggestedTaskTypes : [],
    taskPlanConfirmedBy: record.taskPlanConfirmedBy || '',
    taskPlanConfirmedAt: record.taskPlanConfirmedAt || '',
    creationReason: record.creationReason || '',
    colorMappings: Array.isArray(record.colorMappings) ? record.colorMappings.map((item) => ({ ...item, targetSkuIds: [...(item.targetSkuIds || [])], targetSizeNames: [...(item.targetSizeNames || [])] })) : [],
    materialConversionLines: Array.isArray(record.materialConversionLines) ? record.materialConversionLines.map((item) => ({ ...item })) : [],
    bomConversionStatus: record.bomConversionStatus || 'WAIT_COLOR_MAPPING',
    bomConversionConfirmedBy: record.bomConversionConfirmedBy || '',
    bomConversionConfirmedAt: record.bomConversionConfirmedAt || '',
    buyerPreparationConfirmedBy: record.buyerPreparationConfirmedBy || (record.bomConversionStatus === 'CONFIRMED' ? record.bomConversionConfirmedBy || '买手' : ''),
    buyerPreparationConfirmedAt: record.buyerPreparationConfirmedAt || (record.bomConversionStatus === 'CONFIRMED' ? record.bomConversionConfirmedAt || record.taskPlanConfirmedAt || '' : ''),
    buyerPreparationReturnedBy: record.buyerPreparationReturnedBy || '',
    buyerPreparationReturnedAt: record.buyerPreparationReturnedAt || '',
    buyerPreparationReturnReason: record.buyerPreparationReturnReason || '',
    sourceResultVersionId: record.sourceResultVersionId || '',
    reuseDecision: record.reuseDecision || 'PENDING',
    bomVersionIds: Array.isArray(record.bomVersionIds) && record.bomVersionIds.length
      ? [...record.bomVersionIds]
      : record.bomDraftVersionId ? [record.bomDraftVersionId] : [],
    operationLogs: Array.isArray(record.operationLogs) ? record.operationLogs.map((log) => ({ ...log })) : [],
  }
  normalized.professionalTasks.forEach((task) => {
    task.results.forEach((result) => {
      result.files = result.files.map((file) => {
        if (file.dataUrl) return file
        return getEngineeringTaskUploadedFile(file.fileId) || file
      })
      if (!result.imageUrl) result.imageUrl = result.files.find((file) => file.mimeType.startsWith('image/'))?.dataUrl || ''
    })
  })
  return normalized
}

function createPersistedRecords(records: EngineeringIndependentSamplingRecord[]): EngineeringIndependentSamplingRecord[] {
  return records.map((record) => {
    const persisted = cloneRecord(record)
    persisted.professionalTasks.forEach((task) => {
      task.results.forEach((result) => {
        const uploadedIds = new Set(result.files.filter((file) => getEngineeringTaskUploadedFile(file.fileId)?.dataUrl).map((file) => file.fileId))
        if (result.files.some((file) => uploadedIds.has(file.fileId) && file.dataUrl === result.imageUrl)) result.imageUrl = ''
        result.files = result.files.map((file) => uploadedIds.has(file.fileId) ? { ...file, dataUrl: '' } : file)
      })
    })
    return persisted
  })
}

function createDefaultBomLines(styleCode: string): EngineeringBomMaterialLineDraft[] {
  const candidate = listMaterialArchives()
    .filter((archive) => archive.status === 'ACTIVE' && archive.mainImageUrl)
    .flatMap((archive) => listMaterialSkuRecordsByMaterialId(archive.materialId)
      .filter((sku) => sku.status === 'ACTIVE' && Number.isFinite(sku.costPrice) && sku.costPrice > 0)
      .map((sku) => ({ archive, sku })))
    .at(0)
  if (!candidate) return []
  return [{
    bomItemId: `BOM-LINE-${styleCode}-001`,
    materialSkuId: candidate.sku.materialSkuId,
    sequenceNo: 1,
    styleCode,
    productColor: '默认色',
    materialType: candidate.archive.kind,
    materialImageUrl: candidate.sku.skuImageUrl || candidate.archive.mainImageUrl,
    specification: [candidate.sku.colorName, candidate.sku.specName, candidate.sku.sizeName].filter(Boolean).join(' / '),
    usage: 1,
    sampleQuantity: 1,
    usageUnit: candidate.sku.pricingUnit,
    lossRate: 0,
    printRequirement: '否',
    dyeRequirement: '否',
    purchaseRequirement: '否',
    waterSolubleRequirementText: '无',
    printSide: '无',
    linkedPatternResultIds: [],
    remark: '',
  }]
}

function createSeedUploadedFile(
  taskId: string,
  purpose: EngineeringUploadedFile['purpose'],
  imageUrl: string,
  createdAt: string,
  index = 1,
): EngineeringUploadedFile {
  const operator = purpose === 'DESIGN_IMAGE'
    ? { id: 'U-BUYER-DEMO', name: '买手-阿乐', team: '买手' }
    : purpose === 'PATTERN_SOURCE'
    ? { id: 'PCS-PATTERN-MAKER-ZHOU', name: '周师傅', team: '版师' }
    : purpose === 'SAMPLE_RESULT'
    ? { id: 'PCS-SAMPLE-MAKER-LINA', name: 'Lina', team: '制作团队' }
    : purpose === 'PATTERN_ARTWORK'
    ? { id: 'PCS-ARTWORK-MAKER-CHEN', name: '陈敏', team: '花型团队' }
    : { id: 'PCS-DYE-FACTORY-RUDI', name: 'Rudi', team: '染厂' }
  return {
    fileId: `${taskId}-FILE-${index}`,
    purpose,
    fileName: `${taskId.toLowerCase()}-${index}.${purpose === 'PATTERN_SOURCE' ? 'prj' : 'jpg'}`,
    extension: purpose === 'PATTERN_SOURCE' ? 'prj' : 'jpg',
    mimeType: purpose === 'PATTERN_SOURCE' ? 'application/octet-stream' : 'image/jpeg',
    sizeBytes: purpose === 'PATTERN_SOURCE' ? 48 : 286_720 + index * 1024,
    dataUrl: purpose === 'PATTERN_SOURCE' ? 'data:application/octet-stream;base64,SElHT09EUyBQUkogUEFUVEVSTiBGSUxF' : imageUrl,
    status: '已保存',
    uploadedById: operator.id,
    uploadedByName: operator.name,
    uploadedByTeam: operator.team,
    uploadedAt: createdAt,
    roundNo: 1,
    errorMessage: '',
  }
}

function seedRecords(): EngineeringIndependentSamplingRecord[] {
  // 后道验收专用款不参与既有设计改款样本轮换，保持原 24 条样本的目标款和成果身份。
  const styles = listStyleArchives().filter((style) => style.mainImageUrl
    && !POST_FINISHING_PRODUCTION_SOURCE_FIXTURES.some((source) => source.spuCode === style.styleCode))
  if (styles.length < 2) return []
  const buyer = { role: '买手' as const, userId: 'U-BUYER-DEMO', userName: '买手-阿乐' }
  // 设计改款只能引用已经完成确认的历史物料方案；这些演示历史方案不属于任何设计改款任务，
  // 避免把“设计改款完成”错误表现成“BOM 已形成正式技术包版本”。
  styles.forEach((style, styleIndex) => {
    if (listEngineeringBomHistory(style.styleCode).length) return
    const versions = createEngineeringBomVersionsForOwner({
      ownerStage: 'TECH_PACK_DRAFT',
      ownerId: `SEED-TECH-PACK-${style.styleId}`,
      ownerCode: `TP-SEED-${String(styleIndex + 1).padStart(3, '0')}`,
      styleId: style.styleId,
      buyerId: buyer.userId,
      buyerName: buyer.userName,
      createdBy: buyer.userName,
      createdAt: '2026-06-30 09:00:00',
    })
    versions.forEach((version, versionIndex) => {
      const lines = createDefaultBomLines(style.styleCode)
      if (!lines.length || version.versionStatus !== 'DRAFT') return
      saveEngineeringBomVersion({
        versionId: version.bomDraftVersionId,
        role: '买手',
        userId: buyer.userId,
        userName: buyer.userName,
        materialLines: lines.map((line, lineIndex) => ({
          ...line,
          bomItemId: `${version.bomDraftVersionId}-HISTORY-${lineIndex + 1}`,
          productColor: version.productColor,
          applicableSkuIds: [...version.applicableSkuIds],
        })),
        customCosts: versionIndex === 0 ? [{ title: '车位费', amountIdr: 15_000, note: '历史方案演示费用' }] : [],
        updatedAt: '2026-06-30 09:00:00',
      })
    })
    const firstVersion = versions[0]
    if (firstVersion) {
      confirmEngineeringBomVersion({
        versionId: firstVersion.bomDraftVersionId,
        role: '买手',
        userId: buyer.userId,
        userName: buyer.userName,
        confirmedAt: '2026-06-30 10:00:00',
      })
    }
  })
  const statuses = ['DRAFT', 'IN_PROGRESS', 'WAIT_CONFIRMATION', 'COMPLETED', 'IN_PROGRESS', 'COMPLETED'] as const
  return Array.from({ length: 24 }, (_, index) => {
    const target = styles[index % styles.length]
    const type: EngineeringIndependentSamplingType = 'DESIGN_REVISION'
    const source = styles[(index + 1) % styles.length]
    const createdAt = `2026-07-${String(index + 1).padStart(2, '0')} 09:00:00`
    const selected: EngineeringIndependentProfessionalTaskType[] = index % 3 === 0
      ? ['BASE_PATTERN', 'DISPLAY_SAMPLE', 'PATTERN_ARTWORK']
      : ['PATTERN_ARTWORK', index % 2 ? 'COLOR_FABRIC' : 'COLOR_YARN']
    const code = `ES-DR-${String(index + 1).padStart(3, '0')}`
    const taskId = code.replace(/^ES-/, 'ES-ID-')
    const existingBomVersionIds = new Set(
      listEngineeringBomVersionsByOwner('INDEPENDENT_SAMPLING', taskId)
        .map((version) => version.bomDraftVersionId),
    )
    const record = buildRecord({
      samplingType: type,
      sourceStyleId: source.styleId,
      targetStyleId: target.styleId,
      creationReason: '基于参照款和设计稿完成目标款式的设计改款。',
      designFiles: [createSeedUploadedFile(`${code}-DESIGN`, 'DESIGN_IMAGE', target.mainImageUrl, createdAt)],
      buyer,
      targetMode: 'ARCHIVED_STYLE',
      temporarySpuName: '',
      patternHandling: 'REMAKE',
      reusedPatternFiles: [],
      createdAt,
    }, code)
    initializeEngineeringIndependentManualMaterialPlan(record, buyer, createdAt)
    const defaultLines = createDefaultBomLines(target.styleCode).map((line) => ({
      ...line,
      printRequirement: index % 3 === 0 ? '是' as const : '否' as const,
      printRequirementText: index % 3 === 0 ? '满印花型' : '无',
      dyeRequirement: index % 4 === 0 ? '是' as const : '否' as const,
      purchaseRequirement: index % 5 === 0 ? '是' as const : '否' as const,
    }))
    record.bomVersionIds.forEach((versionId) => {
      const version = getEngineeringBomVersionById(versionId)
      if (!version || version.versionStatus !== 'DRAFT' || !defaultLines.length || version.materialLines.length || existingBomVersionIds.has(versionId)) return
      saveEngineeringBomVersion({
        versionId,
        role: '买手',
        userId: 'U-BUYER-DEMO',
        userName: '买手-阿乐',
        materialLines: defaultLines.map((line, lineIndex) => ({
          ...line,
          bomItemId: `${versionId}-LINE-${lineIndex + 1}`,
          productColor: version.productColor,
          applicableSkuIds: [...version.applicableSkuIds],
          sequenceNo: lineIndex + 1,
        })),
        customCosts: [{ title: '车位费', amountIdr: 15_000, note: '演示费用' }],
        updatedAt: createdAt,
      })
    })
    record.bomConversionConfirmedBy = buyer.userName
    record.bomConversionConfirmedAt = createdAt
    // STYLE-PRJ-202603-011 同时提供一条已完成且已确认的前期成果，供生产准备单
    // 草稿 EM-002 在命名页面演示“复用／重做／不采用”。其余场景仍保留进行中与返工。
    const seedStatus = index === 1 ? 'COMPLETED' : statuses[index % statuses.length]
    const buyerPreparationReady = seedStatus !== 'DRAFT' || index % 12 === 6
    if (buyerPreparationReady) {
      record.bomConversionStatus = 'CONFIRMED'
      record.buyerPreparationConfirmedBy = buyer.userName
      record.buyerPreparationConfirmedAt = createdAt
      record.suggestedTaskTypes = suggestEngineeringIndependentTaskTypes(record)
      const lockableVersionIds = record.bomVersionIds.filter((versionId) => getEngineeringBomVersionById(versionId)?.versionStatus === 'DRAFT')
      const pricingPlan = getEngineeringBomPricingPlan('INDEPENDENT_SAMPLING', record.samplingTaskId)
      if (
        pricingPlan?.status === 'DRAFT'
        && lockableVersionIds.length === record.bomVersionIds.length
        && lockableVersionIds.length
      ) {
        setEngineeringBomVersionsEditingLock({
          versionIds: lockableVersionIds,
          locked: true,
          actorName: buyer.userName,
          changedAt: createdAt,
          reason: '买手已完成新款资料准备',
        })
      }
    }
    if (seedStatus !== 'DRAFT') {
      record.selectedTaskTypes = [...selected]
      record.taskPlanConfirmedBy = buyer.userName
      record.taskPlanConfirmedAt = createdAt
      const seededSampleRequirements = selected.includes('DISPLAY_SAMPLE')
        ? normalizeIndependentSampleRequirements(record, undefined, buyer.userName, createdAt)
        : []
      record.professionalTasks = createProfessionalTasks(record, selected, createdAt, seededSampleRequirements)
      record.relatedProfessionalTaskIds = record.professionalTasks.map((task) => task.taskId)
      record.status = seedStatus
      if (record.status === 'WAIT_CONFIRMATION' || record.status === 'COMPLETED') {
        record.professionalTasks.forEach((task) => {
          task.status = 'COMPLETED'; task.startedAt = createdAt; task.submittedAt = createdAt; task.completedAt = createdAt
          task.results = task.taskType === 'DISPLAY_SAMPLE'
            ? (task.sampleRequirements || []).map((requirement, resultIndex) => ({
                resultId: `${task.taskId}-R${resultIndex + 1}`,
                title: `${requirement.targetColor} / ${requirement.targetSize} 销售展示样衣`,
                version: 'v1.0',
                description: '已按买手确认的颜色、尺码和数量完成销售展示样衣。',
                applicablePartOrSize: '',
                sampleQuantity: requirement.requiredQuantity,
                sampleColor: requirement.targetColor,
                sampleSize: requirement.targetSize,
                sourcePatternVersion: '基码纸样 v1.0',
                requirementLineId: requirement.requirementLineId,
                differenceNote: '',
                imageUrl: target.mainImageUrl,
                files: [createSeedUploadedFile(`${task.taskId}-${resultIndex + 1}`, 'SAMPLE_RESULT', target.mainImageUrl, createdAt)],
                status: 'APPROVED' as const,
                rejectReason: '',
              }))
            : [{
            resultId: `${task.taskId}-R1`,
            title: `${task.taskName}成果`,
            version: 'v1.0',
            description: '本轮成果已完成。',
            applicablePartOrSize: task.taskType === 'BASE_PATTERN' ? '基码 / M 码' : '',
            sampleQuantity: 0,
            sampleColor: '',
            sampleSize: '',
            sourcePatternVersion: '',
            imageUrl: target.mainImageUrl,
            files: [createSeedUploadedFile(task.taskId, task.taskType === 'BASE_PATTERN' ? 'PATTERN_SOURCE' : task.taskType === 'PATTERN_ARTWORK' ? 'PATTERN_ARTWORK' : 'COLOR_RESULT', target.mainImageUrl, createdAt)],
            status: 'APPROVED',
            rejectReason: '',
          }]
        })
      } else if (record.professionalTasks[0]) {
        record.professionalTasks[0].status = index === 7 ? 'REWORK' : 'IN_PROGRESS'
        record.professionalTasks[0].startedAt = createdAt
        if (index === 7) {
          record.professionalTasks[0].results = [{
            resultId: `${record.professionalTasks[0].taskId}-R1`,
            title: `${record.professionalTasks[0].taskName}成果（待返工）`,
            version: 'v1.0',
            description: '花型比例需要调整。',
            applicablePartOrSize: '',
            sampleQuantity: 0,
            sampleColor: '',
            sampleSize: '',
            sourcePatternVersion: '',
            imageUrl: target.mainImageUrl,
            files: [createSeedUploadedFile(record.professionalTasks[0].taskId, 'PATTERN_ARTWORK', target.mainImageUrl, createdAt)],
            status: 'REJECTED',
            rejectReason: '花型比例需要调整后重新提交。',
          }]
        }
        if (index === 1 && record.professionalTasks[1]) {
          record.professionalTasks[1].status = 'WAIT_REVIEW'
          record.professionalTasks[1].startedAt = createdAt
          record.professionalTasks[1].submittedAt = createdAt
          record.professionalTasks[1].results = [{
            resultId: `${record.professionalTasks[1].taskId}-R1`,
            title: `${record.professionalTasks[1].taskName}成果（待审核）`,
            version: 'v1.0',
            description: '等待买手审核本轮成果。',
            applicablePartOrSize: '',
            sampleQuantity: 0,
            sampleColor: '',
            sampleSize: '',
            sourcePatternVersion: '',
            imageUrl: target.mainImageUrl,
            files: [createSeedUploadedFile(record.professionalTasks[1].taskId, 'PATTERN_ARTWORK', target.mainImageUrl, createdAt)],
            status: 'WAIT_REVIEW',
            rejectReason: '',
          }]
        }
      }
      if (record.status === 'COMPLETED') {
        record.resultVersion = 'v1.0'; record.resultSummary = '前期样衣与专业成果已完成并确认。'; record.confirmedBy = buyer.userName; record.confirmedAt = createdAt
      }
    }
    return record
  })
}

function readRecords(): EngineeringIndependentSamplingRecord[] {
  if (memoryRecords) return memoryRecords.map(cloneRecord)
  if (canUseStorage()) {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as EngineeringIndependentSamplingRecord[]
      if (Array.isArray(parsed) && parsed.length) {
        memoryRecords = parsed.map(normalizeRecord)
        return memoryRecords.map(cloneRecord)
      }
    } catch { /* 使用演示种子 */ }
  }
  memoryRecords = seedRecords()
  writeRecords(memoryRecords)
  return memoryRecords.map(cloneRecord)
}

function writeRecords(records: EngineeringIndependentSamplingRecord[]): void {
  const nextRecords = records.map(cloneRecord)
  if (canUseStorage()) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(createPersistedRecords(nextRecords)))
    } catch {
      throw new Error('浏览器存储空间不足，本次操作未保存。请删除不需要的草稿文件后重试。')
    }
  }
  memoryRecords = nextRecords
}

function requireMerchandiser(actor: { role: string; userId: string; userName: string }): void {
  if (actor.role !== '跟单' || !actor.userId.trim() || !actor.userName.trim()) throw new Error('只有当前登录的跟单可以操作生产准备单。')
}

function addLog(record: EngineeringIndependentSamplingRecord, action: string, actor: { userId: string; userName: string }, detail: string, occurredAt = nowText()): void {
  record.operationLogs.unshift({ logId: `${record.samplingTaskId}-LOG-${record.operationLogs.length + 1}`, action, operatorId: actor.userId, operatorName: actor.userName, occurredAt, detail })
  record.updatedAt = occurredAt
}

function syncDesignRevisionProjectRelation(record: EngineeringIndependentSamplingRecord): void {
  if (record.targetMode === 'TEMPORARY_SPU' && !record.linkedFormalStyleId) return
  const target = getStyleArchiveById(record.targetStyleId)
  if (!target?.sourceProjectId || !target.sourceProjectCode) return
  upsertProjectRelation({
    projectRelationId: '',
    projectId: target.sourceProjectId,
    projectCode: target.sourceProjectCode,
    projectNodeId: target.sourceProjectNodeId || null,
    stepCode: '',
    stepName: '',
    relationRole: '执行记录',
    sourceModule: '设计改款任务',
    sourceObjectType: '设计改款任务',
    sourceObjectId: record.samplingTaskId,
    sourceObjectCode: record.samplingTaskCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: `${record.targetStyleName}设计改款`,
    sourceStatus: record.status,
    businessDate: record.updatedAt || record.createdAt,
    ownerName: record.buyerName,
    createdAt: record.createdAt,
    createdBy: record.createdBy,
    updatedAt: record.updatedAt,
    updatedBy: record.confirmedBy || record.buyerName,
    note: `参照款式 ${record.sourceStyleCode}，目标款式 ${record.targetStyleCode}。`,
  })
}

export interface CreateEngineeringIndependentSamplingInput {
  samplingType?: EngineeringIndependentSamplingType
  sourceStyleId: string
  targetMode?: 'ARCHIVED_STYLE' | 'TEMPORARY_SPU'
  targetStyleId?: string
  temporarySpuName?: string
  creationReason: string
  designFiles: EngineeringUploadedFile[]
  patternHandling?: 'REUSE' | 'REMAKE'
  reusedPatternFiles?: EngineeringUploadedFile[]
  buyer: { role: string; userId: string; userName: string }
  createdAt: string
}

function buildRecord(input: CreateEngineeringIndependentSamplingInput, code: string): EngineeringIndependentSamplingRecord {
  requireBuyer(input.buyer)
  const targetMode = input.targetMode || 'ARCHIVED_STYLE'
  const target = targetMode === 'ARCHIVED_STYLE' ? getStyleArchiveById(input.targetStyleId || '') : null
  if (targetMode === 'ARCHIVED_STYLE' && !target) throw new Error('目标商品／款式档案不存在。')
  const temporarySpuName = targetMode === 'TEMPORARY_SPU' ? input.temporarySpuName?.trim() || '' : ''
  if (targetMode === 'TEMPORARY_SPU' && !temporarySpuName) throw new Error('请填写线下临时 SPU 名称。')
  const source = getStyleArchiveById(input.sourceStyleId)
  if (!source) throw new Error('参照商品／款式档案不存在。')
  if (target && (source.styleId === target.styleId || source.styleCode === target.styleCode)) throw new Error('参照 SPU 与目标 SPU 不能相同。')
  assertEngineeringUploadedFilesReady(input.designFiles, '设计稿')
  if (input.designFiles.some((file) => file.purpose !== 'DESIGN_IMAGE')) throw new Error('设计稿文件类型不正确。')
  if (input.designFiles.some((file) => file.uploadedById !== input.buyer.userId || file.uploadedByTeam !== '买手')) throw new Error('设计稿必须由当前买手上传。')
  const patternHandling = input.patternHandling || 'REMAKE'
  const reusedPatternFiles = input.reusedPatternFiles || []
  if (patternHandling === 'REUSE') {
    assertEngineeringUploadedFilesReady(reusedPatternFiles, '复用基码纸样')
    if (!reusedPatternFiles.some((file) => file.purpose === 'PATTERN_SOURCE' && file.extension === 'prj')) throw new Error('纸样不变时必须由买手上传并保存真实 .prj 基码纸样。')
    if (reusedPatternFiles.some((file) => file.uploadedById !== input.buyer.userId || file.uploadedByTeam !== '买手')) throw new Error('复用基码纸样必须由当前买手上传。')
  }
  const creationReason = input.creationReason?.trim() || ''
  if (!creationReason) throw new Error('请填写本次设计改款要求。')
  const taskId = code.replace(/^ES-/, 'ES-ID-')
  const record: EngineeringIndependentSamplingRecord = {
    samplingTaskId: taskId, samplingTaskCode: code, samplingType: 'DESIGN_REVISION',
    sourceStyleId: source.styleId, sourceStyleCode: source.styleCode,
    targetMode,
    targetStyleId: target?.styleId || '', targetStyleCode: target?.styleCode || '', targetStyleName: target?.styleName || temporarySpuName,
    temporarySpuName,
    linkedFormalStyleId: '', linkedFormalStyleCode: '', linkedFormalStyleName: '', linkedAt: '', linkedBy: '',
    status: 'DRAFT', creationReason, designFiles: input.designFiles.map((file) => ({ ...file })),
    patternHandling, reusedPatternFiles: reusedPatternFiles.map((file) => ({ ...file })),
    buyerId: input.buyer.userId, buyerName: input.buyer.userName,
    merchandiserId: '', merchandiserName: '',
    displaySampleTeamId: '', displaySampleTeamName: '',
    displaySampleReceivingLocationId: '', displaySampleReceivingLocationName: '',
    relatedProfessionalTaskIds: [], professionalTasks: [],
    bomDraftVersionId: '',
    bomVersionIds: [],
    resultVersion: '', resultSummary: '', confirmedBy: '', confirmedAt: '',
    selectedTaskTypes: [], suggestedTaskTypes: [], taskPlanConfirmedBy: '', taskPlanConfirmedAt: '',
    colorMappings: [], materialConversionLines: [],
    bomConversionStatus: 'WAIT_COLOR_MAPPING',
    bomConversionConfirmedBy: '', bomConversionConfirmedAt: '', sourceResultVersionId: '', reuseDecision: 'PENDING',
    buyerPreparationConfirmedBy: '', buyerPreparationConfirmedAt: '',
    buyerPreparationReturnedBy: '', buyerPreparationReturnedAt: '', buyerPreparationReturnReason: '',
    operationLogs: [], createdBy: input.buyer.userName, createdAt: input.createdAt, updatedAt: input.createdAt,
  }
  addLog(record, '创建任务', input.buyer, `设计改款任务已创建，并上传设计稿：${record.designFiles.map((file) => file.fileName).join('、')}。${patternHandling === 'REUSE' ? `已上传复用纸样：${record.reusedPatternFiles.map((file) => file.fileName).join('、')}。` : '本次需要重新制版。'}${record.creationReason}`, input.createdAt)
  return record
}

function initializeEngineeringIndependentManualMaterialPlan(
  record: EngineeringIndependentSamplingRecord,
  actor: { userId: string; userName: string },
  createdAt: string,
): void {
  const applicableSkuIds = record.targetMode === 'ARCHIVED_STYLE'
    ? listSkuArchivesByStyleId(record.targetStyleId)
        .filter((sku) => sku.archiveStatus === 'ACTIVE')
        .map((sku) => sku.skuId)
    : []
  const existingVersions = listEngineeringBomVersionsByOwner('INDEPENDENT_SAMPLING', record.samplingTaskId)
  const version = existingVersions.find((item) => item.productColor === DESIGN_REVISION_WHOLE_STYLE_SCOPE)
    || existingVersions[0]
    || reconcileEngineeringBomVersionsForTargetColors({
      ownerStage: 'INDEPENDENT_SAMPLING',
      ownerId: record.samplingTaskId,
      ownerCode: record.samplingTaskCode,
      styleId: record.targetStyleId,
      ownerStyle: record.targetMode === 'TEMPORARY_SPU'
        ? {
            styleId: '',
            styleCode: '',
            styleName: record.temporarySpuName,
            styleImageUrl: record.designFiles.at(-1)?.dataUrl || '',
          }
        : undefined,
      buyerId: actor.userId,
      buyerName: actor.userName,
      createdBy: actor.userName,
      createdAt,
      colors: [{ productColor: DESIGN_REVISION_WHOLE_STYLE_SCOPE, applicableSkuIds }],
    })[0]
  if (!version) throw new Error('设计改款物料与费用方案建立失败。')
  record.bomDraftVersionId = version.bomDraftVersionId
  record.bomVersionIds = [version.bomDraftVersionId]
  record.colorMappings = [{
    mappingId: `${record.samplingTaskId}-WHOLE-STYLE`,
    sourceColor: '',
    targetColor: DESIGN_REVISION_WHOLE_STYLE_SCOPE,
    targetSkuIds: applicableSkuIds,
    targetSizeNames: [DESIGN_REVISION_DEFAULT_SAMPLE_SIZE],
    mappingType: '无参考颜色',
    confirmedBy: actor.userName,
    confirmedAt: createdAt,
  }]
  record.materialConversionLines = []
  record.bomConversionStatus = 'WAIT_MATERIAL_DECISION'
  addLog(record, '建立物料与费用方案', actor, '物料由买手手工添加；系统未带入参照款物料。', createdAt)
}

export function createEngineeringIndependentSampling(input: CreateEngineeringIndependentSamplingInput): EngineeringIndependentSamplingRecord {
  const records = readRecords()
  const code = `ES-DR-${String(records.length + 1).padStart(3, '0')}`
  const bomSnapshot = captureEngineeringBomRepositoryState()
  try {
    const record = buildRecord(input, code)
    initializeEngineeringIndependentManualMaterialPlan(record, input.buyer, input.createdAt)
    writeRecords([...records, record])
    syncDesignRevisionProjectRelation(record)
    return cloneRecord(record)
  } catch (error) {
    restoreEngineeringBomRepositoryState(bomSnapshot)
    throw error
  }
}

export function replaceEngineeringIndependentDesignFiles(input: {
  samplingTaskId: string
  designFiles: EngineeringUploadedFile[]
  actor: { role: string; userId: string; userName: string }
  replacedAt?: string
}): EngineeringIndependentSamplingRecord {
  requireBuyer(input.actor)
  assertEngineeringUploadedFilesReady(input.designFiles, '设计稿')
  if (input.designFiles.some((file) => file.purpose !== 'DESIGN_IMAGE')) throw new Error('设计稿文件类型不正确。')
  const allowedUploadTeam = input.actor.role === '管理员' ? '管理员' : '买手'
  if (input.designFiles.some((file) => file.uploadedById !== input.actor.userId || file.uploadedByTeam !== allowedUploadTeam)) throw new Error('设计稿必须由任务买手或管理员上传。')
  const records = readRecords()
  const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record) throw new Error('设计改款任务不存在。')
  if (!isTaskBuyerOrAdministrator(record, input.actor)) throw new Error('只有任务买手本人或管理员可以替换设计稿。')
  if (record.taskPlanConfirmedAt) throw new Error('方案确认后不能替换设计稿。')
  const replacedAt = input.replacedAt || nowText()
  record.designFiles.push(...input.designFiles.map((file) => ({ ...file })))
  addLog(record, '替换设计稿', input.actor, `已上传新的设计稿：${input.designFiles.map((file) => file.fileName).join('、')}。历史设计稿继续保留。`, replacedAt)
  writeRecords(records)
  return cloneRecord(record)
}

export function listEngineeringIndependentSamplingRecords(): EngineeringIndependentSamplingRecord[] {
  return readRecords().map(cloneRecord)
}

export function getEngineeringIndependentSamplingRecord(id: string): EngineeringIndependentSamplingRecord | null {
  const record = readRecords().find((item) => item.samplingTaskId === id || item.samplingTaskCode === id)
  return record ? cloneRecord(record) : null
}

function requireBuyer(actor: { role: string; userId: string; userName: string }): void {
  if ((actor.role !== '买手' && actor.role !== '管理员') || !actor.userId.trim() || !actor.userName.trim()) throw new Error('只有当前登录的买手或管理员可以维护设计改款方案。')
}

function isTaskBuyerOrAdministrator(record: EngineeringIndependentSamplingRecord, actor: { role: string; userId: string }): boolean {
  return actor.role === '管理员' || record.buyerId === actor.userId
}

export function listEngineeringIndependentSourceBomReferences(samplingTaskId: string) {
  const record = getEngineeringIndependentSamplingRecord(samplingTaskId)
  if (!record) return []
  return listEngineeringBomHistory(record.sourceStyleCode)
}

export function getEngineeringIndependentTargetColorGroups(samplingTaskId: string): Array<{ productColor: string; skuIds: string[] }> {
  const record = getEngineeringIndependentSamplingRecord(samplingTaskId)
  if (!record) return []
  if (record.colorMappings.length) {
    return record.colorMappings.map((mapping) => ({ productColor: mapping.targetColor, skuIds: [...mapping.targetSkuIds] }))
  }
  return []
}

export function listEngineeringIndependentTargetColorSuggestions(samplingTaskId: string): Array<{ productColor: string; skuIds: string[]; sizeNames: string[] }> {
  const record = getEngineeringIndependentSamplingRecord(samplingTaskId)
  if (!record || record.targetMode === 'TEMPORARY_SPU') return []
  const groups = new Map<string, string[]>()
  listSkuArchivesByStyleId(record.targetStyleId).filter((sku) => sku.archiveStatus === 'ACTIVE').forEach((sku) => {
    const productColor = sku.colorName.trim() || '待确认颜色'
    groups.set(productColor, [...(groups.get(productColor) || []), sku.skuId])
  })
  return [...groups.entries()].map(([productColor, skuIds]) => ({
    productColor,
    skuIds,
    sizeNames: [...new Set(skuIds.map((skuId) => listSkuArchives().find((sku) => sku.skuId === skuId)?.sizeName || '').filter(Boolean))],
  }))
}

function normalizeColorKey(value: string): string {
  return value.trim().toLocaleLowerCase()
}

function targetColorCode(value: string): string {
  const ascii = value.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8)
  return ascii || `CLR${Math.abs([...value].reduce((sum, char) => sum + char.charCodeAt(0), 0))}`
}

function ensureTargetColorSkus(input: {
  record: EngineeringIndependentSamplingRecord
  targetColor: string
  targetSizeNames: string[]
  actorName: string
  at: string
  sequence: number
}): { skuIds: string[]; sizeNames: string[] } {
  const requestedSizeNames = [...new Set(input.targetSizeNames.map((size) => size.trim()).filter(Boolean))]
  if (input.record.targetMode === 'TEMPORARY_SPU') {
    return { skuIds: [], sizeNames: requestedSizeNames }
  }
  const activeTargetSkus = listSkuArchivesByStyleId(input.record.targetStyleId).filter((sku) => sku.archiveStatus === 'ACTIVE')
  const availableSizeNames = [...new Set(activeTargetSkus.map((sku) => sku.sizeName.trim()).filter(Boolean))]
  if (!availableSizeNames.length) throw new Error('目标款式尚未维护尺码和 SKU，请先完成商品／款式档案。')
  const effectiveSizeNames = requestedSizeNames.length ? requestedSizeNames : availableSizeNames
  const invalidSize = effectiveSizeNames.find((size) => !availableSizeNames.some((item) => item.toLocaleLowerCase() === size.toLocaleLowerCase()))
  if (invalidSize) throw new Error(`目标尺码“${invalidSize}”不属于当前目标款式。`)
  const canonicalSizes = effectiveSizeNames.map((size) => availableSizeNames.find((item) => item.toLocaleLowerCase() === size.toLocaleLowerCase())!)
  const existing = activeTargetSkus.filter((sku) => normalizeColorKey(sku.colorName) === normalizeColorKey(input.targetColor) && canonicalSizes.includes(sku.sizeName))
  const missingSizes = canonicalSizes.filter((size) => !existing.some((sku) => sku.sizeName === size))
  if (missingSizes.length) {
    const allSkuCodes = new Set(listSkuArchives().map((sku) => sku.skuCode))
    const records: SkuArchiveRecord[] = missingSizes.map((sizeName, index) => {
      const template = activeTargetSkus.find((sku) => sku.sizeName === sizeName) || activeTargetSkus[0]
      const suffix = `${targetColorCode(input.targetColor)}-${sizeName.replace(/\s+/g, '')}-${input.record.samplingTaskCode.replace(/[^A-Z0-9]/gi, '')}`
      let skuCode = `${input.record.targetStyleCode}-${suffix}`
      let duplicateNo = 1
      while (allSkuCodes.has(skuCode)) skuCode = `${input.record.targetStyleCode}-${suffix}-${++duplicateNo}`
      allSkuCodes.add(skuCode)
      return {
        ...template,
        skuId: `skuSampling_${input.record.samplingTaskId}_${input.sequence}_${index + 1}_${Date.now().toString(36)}`,
        skuCode,
        skuName: `${input.record.targetStyleName} ${input.targetColor}/${sizeName}`,
        colorName: input.targetColor,
        sizeName,
        barcode: '',
        channelMappingCount: 0,
        listedChannelCount: 0,
        lastListingAt: '',
        createdAt: input.at,
        createdBy: input.actorName,
        updatedAt: input.at,
        updatedBy: input.actorName,
        remark: `由${input.record.samplingTaskCode}目标颜色确认生成`,
      }
    })
    createSkuArchiveBatch(records)
  }
  const resolved = listSkuArchivesByStyleId(input.record.targetStyleId)
    .filter((sku) => sku.archiveStatus === 'ACTIVE')
    .filter((sku) => normalizeColorKey(sku.colorName) === normalizeColorKey(input.targetColor) && canonicalSizes.includes(sku.sizeName))
  return { skuIds: resolved.map((sku) => sku.skuId), sizeNames: canonicalSizes }
}

function applyEngineeringIndependentColorMappings(input: {
  record: EngineeringIndependentSamplingRecord
  actor: { userId: string; userName: string }
  mappings: Array<{ targetColor: string; sourceColor: string; targetSizeNames: string[] }>
  confirmedAt: string
}): void {
  const { record } = input
  if (!input.mappings.length) throw new Error('请至少新增一个目标颜色。')
  const normalized = input.mappings.map((item) => ({
    targetColor: item.targetColor.trim(),
    sourceColor: item.sourceColor.trim(),
    targetSizeNames: item.targetSizeNames.map((size) => size.trim()).filter(Boolean),
  }))
  if (normalized.some((item) => !item.targetColor)) throw new Error('目标颜色名称不能为空。')
  const colorKeys = normalized.map((item) => normalizeColorKey(item.targetColor))
  if (new Set(colorKeys).size !== colorKeys.length) throw new Error('目标颜色名称不能重复。')
  const sourceColors = [...new Set(listSkuArchivesByStyleId(record.sourceStyleId).filter((sku) => sku.archiveStatus === 'ACTIVE').map((sku) => sku.colorName.trim()).filter(Boolean))]

  const mapped = normalized.map((mapping, index) => {
    const canonicalSource = mapping.sourceColor
      ? sourceColors.find((color) => normalizeColorKey(color) === normalizeColorKey(mapping.sourceColor))
      : ''
    if (mapping.sourceColor && !canonicalSource) throw new Error(`A 款参考颜色“${mapping.sourceColor}”不存在。`)
    const target = ensureTargetColorSkus({
      record,
      targetColor: mapping.targetColor,
      targetSizeNames: mapping.targetSizeNames,
      actorName: input.actor.userName,
      at: input.confirmedAt,
      sequence: index + 1,
    })
    const sourceVersion = canonicalSource ? listEngineeringBomHistory(record.sourceStyleCode, canonicalSource)[0] : undefined
    return {
      mappingId: `${record.samplingTaskId}-COLOR-${index + 1}`,
      sourceColor: canonicalSource || '',
      targetColor: mapping.targetColor,
      targetSkuIds: target.skuIds,
      targetSizeNames: target.sizeNames,
      mappingType: canonicalSource ? '参考 A 款颜色' as const : '无参考颜色' as const,
      confirmedBy: input.actor.userName,
      confirmedAt: input.confirmedAt,
      sourceVersion,
    }
  })

  const bomVersions = reconcileEngineeringBomVersionsForTargetColors({
    ownerStage: 'INDEPENDENT_SAMPLING',
    ownerId: record.samplingTaskId,
    ownerCode: record.samplingTaskCode,
    styleId: record.targetStyleId,
    ownerStyle: record.targetMode === 'TEMPORARY_SPU'
      ? {
          styleId: '',
          styleCode: '',
          styleName: record.temporarySpuName,
          styleImageUrl: record.designFiles.at(-1)?.dataUrl || '',
        }
      : undefined,
    buyerId: input.actor.userId,
    buyerName: input.actor.userName,
    createdBy: input.actor.userName,
    createdAt: input.confirmedAt,
    colors: mapped.map((mapping) => ({
      productColor: mapping.targetColor,
      applicableSkuIds: mapping.targetSkuIds,
      sourceVersionId: mapping.sourceVersion?.bomDraftVersionId,
    })),
  })
  record.colorMappings = mapped.map(({ sourceVersion: _sourceVersion, ...mapping }) => mapping)
  record.bomVersionIds = bomVersions.map((version) => version.bomDraftVersionId)
  record.bomDraftVersionId = record.bomVersionIds[0] || ''
  record.materialConversionLines = mapped.flatMap((mapping) => (mapping.sourceVersion?.materialLines || []).map((line, index) => {
    const resolved = resolveEngineeringBomMaterialLine(line)
    return {
      conversionLineId: `${record.samplingTaskId}-CONVERT-${mapping.mappingId}-${index + 1}`,
      sourceBomVersionId: mapping.sourceVersion!.bomDraftVersionId,
      sourceBomItemId: line.bomItemId || `${mapping.sourceVersion!.bomDraftVersionId}-LINE-${index + 1}`,
      sourceProductColor: mapping.sourceColor,
      sourceMaterialSkuId: line.materialSkuId,
      sourceMaterialName: resolved.materialName,
      sourceMaterialImageUrl: resolved.materialImageUrl || '',
      targetProductColor: mapping.targetColor,
      decision: '' as const,
      targetMaterialSkuId: line.materialSkuId,
      targetMaterialName: resolved.materialName,
      targetMaterialImageUrl: resolved.materialImageUrl || '',
      dyeRequirement: line.dyeRequirement || '否',
      printRequirement: line.printRequirement || '否',
      note: '',
      confirmedBy: '',
      confirmedAt: '',
    }
  }))
  record.bomConversionStatus = 'WAIT_MATERIAL_DECISION'
  record.bomConversionConfirmedBy = ''
  record.bomConversionConfirmedAt = ''
  record.buyerPreparationConfirmedBy = ''
  record.buyerPreparationConfirmedAt = ''
  record.buyerPreparationReturnedBy = ''
  record.buyerPreparationReturnedAt = ''
  record.buyerPreparationReturnReason = ''
}

export function confirmEngineeringIndependentColorMappings(input: {
  samplingTaskId: string
  actor: { role: string; userId: string; userName: string }
  mappings: Array<{ targetColor: string; sourceColor: string; targetSizeNames: string[]; mappingType?: EngineeringIndependentColorMapping['mappingType'] }>
  confirmedAt?: string
}): EngineeringIndependentSamplingRecord {
  throw new Error('设计改款不再维护新款颜色或参考色，请在整款物料与费用方案中手工新增物料。')

}

export function confirmEngineeringIndependentMaterialConversions(input: {
  samplingTaskId: string
  actor: { role: string; userId: string; userName: string }
  decisions: Array<{
    conversionLineId: string
    decision: EngineeringIndependentMaterialDecision
    targetMaterialSkuId?: string
    dyeRequirement?: '是' | '否'
    printRequirement?: '是' | '否'
    note?: string
  }>
  confirmedAt?: string
}): EngineeringIndependentSamplingRecord {
  throw new Error('设计改款不再处理参考物料，所有物料必须由买手在整款方案中手工新增。')

}

export function completeEngineeringIndependentBuyerPreparation(input: {
  samplingTaskId: string
  actor: { role: string; userId: string; userName: string }
  completedAt?: string
}): EngineeringIndependentSamplingRecord {
  requireBuyer(input.actor)
  const records = readRecords()
  const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record) throw new Error('设计改款任务不存在。')
  // 浏览器重复点击或重复提交同一交接动作时直接返回既有事实，避免重复日志、
  // 重复锁定或把第一次成功反馈覆盖成“已经交接”的失败提示。
  if (record.status === 'DRAFT' && record.buyerPreparationConfirmedAt && !record.taskPlanConfirmedAt) {
    return cloneRecord(record)
  }
  if (record.status !== 'DRAFT' || record.taskPlanConfirmedAt) throw new Error('方案确认后不能再修改。')
  const issues: string[] = []
  if (!record.bomVersionIds.length) issues.push('物料与费用方案不存在，请刷新页面后重试。')
  const pricingPlan = getEngineeringBomPricingPlan('INDEPENDENT_SAMPLING', record.samplingTaskId)
  if (!pricingPlan) {
    issues.push('物料与费用方案不存在，请刷新页面后重试。')
  } else {
    if (pricingPlan.customCostDecision === 'UNDECIDED') issues.push('尚未确认本次是否有自定义费用；没有费用时请选择“本次无自定义费用”。')
    if (pricingPlan.customCostDecision === 'HAS_CUSTOM_COST' && !pricingPlan.customCosts.length) issues.push('已选择“本次有自定义费用”，但尚未维护费用明细。')
    if (pricingPlan.customCostDecision === 'NO_CUSTOM_COST' && pricingPlan.customCosts.length) issues.push('已选择“本次无自定义费用”，但仍存在费用明细。')
    pricingPlan.customCosts.forEach((cost, index) => {
      if (!cost.title.trim()) issues.push(`第 ${index + 1} 项自定义费用尚未填写费用名称。`)
      if (!Number.isFinite(cost.amountIdr) || cost.amountIdr <= 0) issues.push(`自定义费用“${cost.title || `第 ${index + 1} 项`}”的金额必须大于 0 IDR。`)
    })
  }
  record.bomVersionIds.forEach((versionId) => {
    const version = getEngineeringBomVersionById(versionId)
    if (!version) {
      issues.push(`物料方案 ${versionId} 不存在，请刷新页面后重试。`)
      return
    }
    if (version.versionStatus !== 'DRAFT') issues.push('物料方案已交接或确认，请刷新任务状态。')
    if (version.editingLockedAt) issues.push('物料方案已经锁定，请刷新任务状态。')
    if (!version.materialLines.length) issues.push('尚未添加物料。')
    version.materialLines.forEach((line, index) => {
      try {
        const resolved = resolveEngineeringBomMaterialLine(line)
        if (resolved.priceStatus === '标准单价失效') issues.push(`第 ${index + 1} 行物料 ${resolved.materialSkuCode} 标准单价失效。`)
      } catch (error) {
        issues.push(`第 ${index + 1} 行物料不完整：${error instanceof Error ? error.message : '请检查物料、用量、样衣数量、损耗率和单位。'}`)
      }
    })
  })
  if (!issues.length) {
    try {
      resolveEngineeringBomPricingPlan('INDEPENDENT_SAMPLING', record.samplingTaskId)
    } catch (error) {
      issues.push(`综合成本暂时无法计算：${error instanceof Error ? error.message : '请检查物料、费用及系统汇率。'}`)
    }
  }
  if (issues.length) throw new Error(`本次方案尚未完整：\n${issues.map((issue, index) => `${index + 1}. ${issue}`).join('\n')}`)
  const at = input.completedAt || nowText()
  const bomSnapshot = captureEngineeringBomRepositoryState()
  const recordSnapshot = cloneRecord(record)
  try {
    setEngineeringBomVersionsEditingLock({
      versionIds: record.bomVersionIds,
      locked: true,
      actorName: input.actor.userName,
      changedAt: at,
      reason: '买手已确认本次方案',
    })
    record.bomConversionStatus = 'CONFIRMED'
    record.bomConversionConfirmedBy = input.actor.userName
    record.bomConversionConfirmedAt = at
    record.buyerPreparationConfirmedBy = input.actor.userName
    record.buyerPreparationConfirmedAt = at
    record.buyerPreparationReturnedBy = ''
    record.buyerPreparationReturnedAt = ''
    record.buyerPreparationReturnReason = ''
    record.suggestedTaskTypes = suggestEngineeringIndependentTaskTypes(record)
    addLog(record, '完成方案资料', input.actor, '已确认本次使用物料、加工要求、整款费用和销售展示样衣制作安排。', at)
    writeRecords(records)
    return cloneRecord(record)
  } catch (error) {
    restoreEngineeringBomRepositoryState(bomSnapshot)
    const recordIndex = records.findIndex((item) => item.samplingTaskId === record.samplingTaskId)
    if (recordIndex >= 0) records[recordIndex] = recordSnapshot
    writeRecords(records)
    throw error
  }
}

export function returnEngineeringIndependentBuyerPreparation(input: {
  samplingTaskId: string
  actor: { role: string; userId: string; userName: string }
  reason: string
  returnedAt?: string
}): EngineeringIndependentSamplingRecord {
  requireBuyer(input.actor)
  const records = readRecords()
  const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record) throw new Error('设计改款任务不存在。')
  if (!isTaskBuyerOrAdministrator(record, input.actor)) throw new Error('只有任务买手本人或管理员可以重新打开方案资料。')
  if (record.status !== 'DRAFT' || !record.buyerPreparationConfirmedAt || record.taskPlanConfirmedAt) {
    throw new Error('专业工作已生成，不能再重新打开方案。')
  }
  const reason = input.reason.trim()
  if (!reason) throw new Error('请填写重新打开方案的原因。')
  const at = input.returnedAt || nowText()
  const bomSnapshot = captureEngineeringBomRepositoryState()
  const recordSnapshot = cloneRecord(record)
  try {
    setEngineeringBomVersionsEditingLock({
      versionIds: record.bomVersionIds,
      locked: false,
      actorName: input.actor.userName,
      changedAt: at,
    })
    record.bomConversionStatus = 'WAIT_MATERIAL_DECISION'
    record.buyerPreparationConfirmedBy = ''
    record.buyerPreparationConfirmedAt = ''
    record.buyerPreparationReturnedBy = input.actor.userName
    record.buyerPreparationReturnedAt = at
    record.buyerPreparationReturnReason = reason
    addLog(record, '重新打开方案资料', input.actor, `修改原因：${reason}。整款物料与费用方案已重新开放维护。`, at)
    writeRecords(records)
    return cloneRecord(record)
  } catch (error) {
    restoreEngineeringBomRepositoryState(bomSnapshot)
    const recordIndex = records.findIndex((item) => item.samplingTaskId === record.samplingTaskId)
    if (recordIndex >= 0) records[recordIndex] = recordSnapshot
    writeRecords(records)
    throw error
  }
}

export function regenerateEngineeringIndependentBomFromReference(input: {
  samplingTaskId: string
  targetColor: string
  actor: { role: string; userId: string; userName: string }
  regeneratedAt?: string
}): EngineeringIndependentSamplingRecord {
  throw new Error('设计改款不再支持按参考色生成 BOM，所有物料必须由买手手工新增。')

}

export function suggestEngineeringIndependentTaskTypesForBomLines(
  record: EngineeringIndependentSamplingRecord,
  bomLines: Array<Pick<EngineeringBomMaterialLineDraft, 'materialSkuId' | 'dyeRequirement' | 'printRequirement'>>,
): EngineeringIndependentProfessionalTaskType[] {
  const suggestions = new Set<EngineeringIndependentProfessionalTaskType>(['DISPLAY_SAMPLE'])
  if (record.patternHandling === 'REMAKE') suggestions.add('BASE_PATTERN')
  if (bomLines.some((line) => line.printRequirement === '是')) suggestions.add('PATTERN_ARTWORK')
  bomLines.filter((line) => line.dyeRequirement === '是').forEach((line) => {
    const sku = getMaterialSkuRecordById(line.materialSkuId)
    const kind = sku ? getMaterialArchiveById(sku.materialId)?.kind : undefined
    if (kind === 'yarn') suggestions.add('COLOR_YARN')
    else suggestions.add('COLOR_FABRIC')
  })
  return [...suggestions]
}

export function suggestEngineeringIndependentTaskTypes(recordOrId: EngineeringIndependentSamplingRecord | string): EngineeringIndependentProfessionalTaskType[] {
  const record = typeof recordOrId === 'string' ? getEngineeringIndependentSamplingRecord(recordOrId) : recordOrId
  if (!record) return []
  const bomLines = record.bomVersionIds.map(getEngineeringBomVersionById).flatMap((version) => version?.materialLines || [])
  return suggestEngineeringIndependentTaskTypesForBomLines(record, bomLines)
}

export function getEngineeringIndependentCurrentTeam(recordOrId: EngineeringIndependentSamplingRecord | string): string {
  return getEngineeringIndependentCurrentTeams(recordOrId).join('、') || '-'
}

export function getEngineeringIndependentProfessionalTaskCurrentTeam(
  task: EngineeringIndependentProfessionalTask,
): string {
  if (task.status === 'COMPLETED' || task.status === 'WAIT_DEPENDENCY') return ''
  if (task.status === 'WAIT_REVIEW') return '买手'
  if ((task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && !task.colorRequirementConfirmedAt) {
    return '买手'
  }
  return task.ownerTeamName
}

export function getEngineeringIndependentCurrentTeams(
  recordOrId: EngineeringIndependentSamplingRecord | string,
): string[] {
  const record = typeof recordOrId === 'string' ? getEngineeringIndependentSamplingRecord(recordOrId) : recordOrId
  if (!record || record.status === 'COMPLETED') return []
  if (record.status === 'DRAFT') return ['买手']
  if (record.status === 'WAIT_CONFIRMATION') return ['买手']
  const teams = record.professionalTasks
    .filter((task) => ['WAIT_START', 'IN_PROGRESS', 'WAIT_REVIEW', 'REWORK'].includes(task.status))
    .map(getEngineeringIndependentProfessionalTaskCurrentTeam)
    .filter(Boolean)
  return [...new Set(teams.length ? teams : ['买手'])]
}

export function getEngineeringIndependentSamplingStep(
  recordOrId: EngineeringIndependentSamplingRecord | string,
): EngineeringIndependentSamplingStep {
  const record = typeof recordOrId === 'string' ? getEngineeringIndependentSamplingRecord(recordOrId) : recordOrId
  if (!record || record.status === 'COMPLETED') return 'COMPLETED'
  if (record.status === 'DRAFT') return 'SCHEME_CONFIRMATION'
  if (record.status === 'WAIT_CONFIRMATION') return 'RESULT_CONFIRMATION'
  return 'PROFESSIONAL_WORK'
}

function normalizeIndependentSampleRequirements(
  record: EngineeringIndependentSamplingRecord,
  requirements: Array<Pick<EngineeringSampleRequirementLine, 'targetColor' | 'targetSize' | 'requiredQuantity' | 'requirementNote'> & { requirementLineId?: string }> | undefined,
  issuedBy: string,
  issuedAt: string,
): EngineeringSampleRequirementLine[] {
  const source = requirements?.length ? requirements : undefined
  source?.forEach((item) => {
    if (!Number.isInteger(Number(item.requiredQuantity)) || Number(item.requiredQuantity) <= 0) {
      throw new Error('销售展示样衣数量必须为大于 0 的整数。')
    }
  })
  const quantity = source
    ? source.reduce((sum, item) => sum + Number(item.requiredQuantity), 0)
    : 1
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('销售展示样衣数量必须为大于 0 的整数。')
  const notes = source
    ? [...new Set(source.map((item) => item.requirementNote.trim()).filter(Boolean))].join('；')
    : ''
  return [{
    requirementLineId: source?.[0]?.requirementLineId?.trim() || `${record.samplingTaskId}-DISPLAY-REQ-1`,
    targetColor: record.colorMappings[0]?.targetColor || DESIGN_REVISION_WHOLE_STYLE_SCOPE,
    targetSize: DESIGN_REVISION_DEFAULT_SAMPLE_SIZE,
    requiredQuantity: quantity,
    requirementNote: notes,
    issuedBy,
    issuedAt,
  }]
}

function createProfessionalTasks(
  record: EngineeringIndependentSamplingRecord,
  selected: EngineeringIndependentProfessionalTaskType[],
  createdAt: string,
  sampleRequirements: EngineeringSampleRequirementLine[] = [],
  displaySampleAssignment?: EngineeringIndependentDisplaySampleAssignment,
): EngineeringIndependentProfessionalTask[] {
  const selectedSet = new Set(selected)
  if (record.patternHandling === 'REMAKE' && selectedSet.has('DISPLAY_SAMPLE')) selectedSet.add('BASE_PATTERN')
  if (record.patternHandling === 'REUSE') selectedSet.delete('BASE_PATTERN')
  return [...selectedSet].map((taskType) => {
    const meta = TASK_META[taskType]
    const dependencies = taskType === 'DISPLAY_SAMPLE'
      ? [...selectedSet].filter((item) => item !== 'DISPLAY_SAMPLE').map((item) => `${record.samplingTaskId}-${item}`)
      : []
    return {
      taskId: `${record.samplingTaskId}-${taskType}`, taskType, taskName: meta.name,
      ownerTeamName: taskType === 'DISPLAY_SAMPLE' ? displaySampleAssignment?.teamName || meta.team : meta.team,
      status: dependencies.length ? 'WAIT_DEPENDENCY' : 'WAIT_START', dependsOnTaskIds: dependencies,
      plannedCompleteAt: createdAt.slice(0, 10), startedAt: '', submittedAt: '', completedAt: '',
      pantoneColorCode: '', colorName: '', dyeColorCode: '', results: [],
      colorRequirementConfirmedBy: '', colorRequirementConfirmedAt: '',
      sampleRequirements: taskType === 'DISPLAY_SAMPLE' ? sampleRequirements.map(cloneSampleRequirement) : [],
      processWorkOrderRefs: [],
    }
  })
}

function targetSpuIdentity(record: EngineeringIndependentSamplingRecord): { code: string; name: string } {
  if (record.targetStyleCode) return { code: record.targetStyleCode, name: record.targetStyleName }
  return {
    code: `TEMP-${record.samplingTaskCode}`,
    name: record.temporarySpuName || record.targetStyleName || record.samplingTaskCode,
  }
}

function processTaskForLine(
  tasks: EngineeringIndependentProfessionalTask[],
  processCode: 'DYE' | 'PRINT',
  materialSkuId: string,
): EngineeringIndependentProfessionalTask {
  const sku = getMaterialSkuRecordById(materialSkuId)
  const kind = sku ? getMaterialArchiveById(sku.materialId)?.kind : undefined
  const type: EngineeringIndependentProfessionalTaskType = processCode === 'PRINT'
    ? 'PATTERN_ARTWORK'
    : kind === 'yarn' ? 'COLOR_YARN' : 'COLOR_FABRIC'
  const task = tasks.find((item) => item.taskType === type)
  if (!task) throw new Error(`物料 ${sku?.materialSkuCode || materialSkuId} 需要${processCode === 'PRINT' ? '印花' : '染色'}，但未生成对应专业任务。`)
  return task
}

function normalizeProcessQuantityUnit(unit: string): string {
  const value = unit.trim().toLowerCase()
  return ['公斤', '千克', 'kgs'].includes(value) ? 'kg' : value
}

function resolveDesignRevisionProcessQuantity(input: {
  processType: 'DYEING' | 'PRINTING'
  plannedQty: number
  qtyUnit: string
  materialSkuId: string
  materialName: string
}): { plannedQty: number; qtyUnit: string } {
  const sku = getMaterialSkuRecordById(input.materialSkuId)
  const archive = sku ? getMaterialArchiveById(sku.materialId) : null
  if (!sku || !archive) throw new Error(`物料 ${input.materialSkuId} 不存在，无法确定加工数量。`)

  let plannedQty = input.plannedQty
  let qtyUnit = input.qtyUnit.trim()
  if (input.processType === 'DYEING' && archive.kind === 'yarn') {
    const sourceUnit = normalizeProcessQuantityUnit(qtyUnit)
    if (sourceUnit !== 'kg') {
      const conversions = sku.unitConversions?.length ? sku.unitConversions : archive.unitConversions ?? []
      const direct = conversions.find((item) => (
        normalizeProcessQuantityUnit(item.fromUnit) === sourceUnit
        && normalizeProcessQuantityUnit(item.toUnit) === 'kg'
        && Number.isFinite(item.factor)
        && item.factor > 0
      ))
      const reverse = conversions.find((item) => (
        normalizeProcessQuantityUnit(item.fromUnit) === 'kg'
        && normalizeProcessQuantityUnit(item.toUnit) === sourceUnit
        && Number.isFinite(item.factor)
        && item.factor > 0
      ))
      const weightBasedFactor = ['卷', '筒', 'pcs', '件'].includes(sourceUnit) && Number.isFinite(sku.weightKg) && sku.weightKg > 0
        ? sku.weightKg
        : 0
      const factor = direct?.factor || (reverse ? 1 / reverse.factor : weightBasedFactor)
      if (!factor) throw new Error(`纱线物料 ${sku.materialSkuCode || input.materialName} 缺少 ${qtyUnit} 到 kg 的单位换算或单件重量，不能生成染色加工单。`)
      plannedQty *= factor
    }
    qtyUnit = 'kg'
  }

  const precision = normalizeProcessQuantityUnit(qtyUnit) === 'kg' ? 3 : 2
  plannedQty = Number(plannedQty.toFixed(precision))
  if (!Number.isFinite(plannedQty) || plannedQty <= 0) {
    throw new Error(`${input.materialName} 的加工数量按 ${precision} 位小数计量后必须大于 0。`)
  }
  return { plannedQty, qtyUnit }
}

function buildDesignRevisionProcessEntries(input: {
  record: EngineeringIndependentSamplingRecord
  tasks: EngineeringIndependentProfessionalTask[]
  sampleRequirements: EngineeringSampleRequirementLine[]
}): DesignRevisionProcessWorkOrderLineInput[] {
  const targetSpuImageUrl = input.record.designFiles.find((file) => file.mimeType.startsWith('image/'))?.dataUrl || ''
  if (!targetSpuImageUrl) throw new Error('设计改款任务缺少已上传的真实设计稿，不能建立印花／染色加工单。')
  const sampleQuantity = input.sampleRequirements.reduce((sum, item) => sum + item.requiredQuantity, 0)
  return input.record.bomVersionIds.flatMap((versionId) => {
    const version = getEngineeringBomVersionById(versionId)
    if (!version) throw new Error(`物料与费用方案 ${versionId} 不存在。`)
    const mapping = input.record.colorMappings.find((item) => item.targetColor === version.productColor)
    if (!mapping) throw new Error(`颜色“${version.productColor}”缺少已确认的颜色关系。`)
    return version.materialLines.flatMap((line, index): DesignRevisionProcessWorkOrderLineInput[] => {
      const processTypes: Array<'DYEING' | 'PRINTING'> = [
        ...(line.dyeRequirement === '是' ? ['DYEING' as const] : []),
        ...(line.printRequirement === '是' ? ['PRINTING' as const] : []),
      ]
      if (!processTypes.length) return []
      if (sampleQuantity <= 0) throw new Error('存在需要印花／染色的物料，请先填写销售展示样衣数量。')
      const sku = getMaterialSkuRecordById(line.materialSkuId)
      const archive = sku ? getMaterialArchiveById(sku.materialId) : null
      if (!sku || !archive) throw new Error(`物料 ${line.materialSkuId} 不存在，无法建立加工单。`)
      const resolved = resolveEngineeringBomMaterialLine({ ...line, sampleQuantity })
      const bomItemId = line.bomItemId || `${versionId}-LINE-${index + 1}`
      const plannedQty = Math.round(calculateEngineeringBomTotalRequirement({
          usage: line.usage,
          sampleQuantity,
          lossRate: line.lossRate,
          conversionToPricingUnit: resolved.conversionToPricingUnit,
        }) * 10_000) / 10_000
      return processTypes.map((processType) => {
        const task = processTaskForLine(input.tasks, processType === 'PRINTING' ? 'PRINT' : 'DYE', line.materialSkuId)
        const processQuantity = resolveDesignRevisionProcessQuantity({
          processType,
          plannedQty,
          qtyUnit: resolved.pricingUnit,
          materialSkuId: line.materialSkuId,
          materialName: archive.materialName,
        })
        return {
          processType,
          professionalTaskId: task.taskId,
          professionalTaskNo: task.taskId,
          targetSpuImageUrl,
          targetColorId: mapping.mappingId,
          targetColor: version.productColor,
          bomVersionId: version.bomDraftVersionId,
          bomVersionLabel: version.versionCode,
          bomItemId,
          materialId: archive.materialId,
          materialSkuId: line.materialSkuId,
          materialSkuCode: sku.materialSkuCode,
          materialName: archive.materialName,
          materialType: archive.kind,
          materialReceivingKind: archive.kind === 'fabric' ? 'FABRIC' : archive.kind === 'yarn' ? 'YARN' : 'ACCESSORY',
          materialImageUrl: sku.skuImageUrl || archive.mainImageUrl,
          materialComposition: archive.composition,
          materialSpecification: [sku.specName, archive.specSummary].filter(Boolean).join(' / '),
          plannedQty: processQuantity.plannedQty,
          qtyUnit: processQuantity.qtyUnit,
        }
      })
    })
  })
}

export function confirmEngineeringIndependentSamplingPlan(input: {
  samplingTaskId: string
  actor: { role: string; userId: string; userName: string }
  selectedTaskTypes: EngineeringIndependentProfessionalTaskType[]
  displaySampleAssignment: EngineeringIndependentDisplaySampleAssignment
  sampleRequirements?: Array<Pick<EngineeringSampleRequirementLine, 'targetColor' | 'targetSize' | 'requiredQuantity' | 'requirementNote'> & { requirementLineId?: string }>
  confirmedAt?: string
}): EngineeringIndependentSamplingRecord {
  requireBuyer(input.actor)
  const records = readRecords(); const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record) throw new Error('设计改款任务不存在。')
  if (!isTaskBuyerOrAdministrator(record, input.actor)) throw new Error('只有任务买手本人或管理员可以确认设计改款方案。')
  if (record.status !== 'DRAFT') throw new Error('只有草稿任务可以确认任务方案。')
  if (!record.buyerPreparationConfirmedAt || record.bomConversionStatus !== 'CONFIRMED') throw new Error('请先由买手完成整款物料与费用方案。')
  const incompleteBom = record.bomVersionIds.map(getEngineeringBomVersionById).find((version) => version && version.materialLines.length === 0)
  if (incompleteBom) throw new Error('整款物料与费用方案尚未添加物料，不能确认本次工作安排。')
  if (!input.selectedTaskTypes.length) throw new Error('请至少选择一个专业任务。')
  if (!input.selectedTaskTypes.includes('DISPLAY_SAMPLE')) throw new Error('设计改款任务必须包含销售展示样衣任务。')
  const assignment = {
    teamId: input.displaySampleAssignment.teamId.trim(),
    teamName: input.displaySampleAssignment.teamName.trim(),
    receivingFactoryId: input.displaySampleAssignment.receivingFactoryId.trim(),
    receivingFactoryName: input.displaySampleAssignment.receivingFactoryName.trim(),
    receivingLocationId: input.displaySampleAssignment.receivingLocationId.trim(),
    receivingLocationName: input.displaySampleAssignment.receivingLocationName.trim(),
  }
  if (!assignment.teamId || !assignment.teamName || !assignment.receivingFactoryId || !assignment.receivingFactoryName || !assignment.receivingLocationId || !assignment.receivingLocationName) {
    throw new Error('请选择销售展示样衣制作团队、实际接收工厂和接收地点。')
  }
  const requiredTypes = suggestEngineeringIndependentTaskTypes(record)
  const missingRequired = requiredTypes.filter((taskType) => !input.selectedTaskTypes.includes(taskType))
  if (missingRequired.length) throw new Error(`当前方案必须包含：${missingRequired.map((item) => TASK_META[item].name).join('、')}。请先修改物料工艺需求再取消。`)
  const at = input.confirmedAt || nowText()
  const sampleRequirements = normalizeIndependentSampleRequirements(record, input.sampleRequirements, input.actor.userName, at)
  const recordSnapshot = cloneRecord(record)
  const nextSelectedTaskTypes = [...new Set(input.selectedTaskTypes)]
  const nextTasks = createProfessionalTasks(record, nextSelectedTaskTypes, at, sampleRequirements, assignment)
  const targetSpu = targetSpuIdentity(record)
  const processTransaction = prepareDesignRevisionProcessWorkOrders({
    designRevisionTaskId: record.samplingTaskId,
    designRevisionTaskNo: record.samplingTaskCode,
    targetSpuCode: targetSpu.code,
    targetSpuName: targetSpu.name,
    createdAt: at,
    createdBy: input.actor.userName,
    receivingTeamId: assignment.teamId,
    receivingTeamName: assignment.teamName,
    receivingFactoryId: assignment.receivingFactoryId,
    receivingFactoryName: assignment.receivingFactoryName,
    receivingLocationId: assignment.receivingLocationId,
    receivingLocationName: assignment.receivingLocationName,
    lines: buildDesignRevisionProcessEntries({ record, tasks: nextTasks, sampleRequirements }),
  })
  try {
    record.suggestedTaskTypes = suggestEngineeringIndependentTaskTypes(record)
    record.selectedTaskTypes = nextSelectedTaskTypes
    record.professionalTasks = nextTasks
    processTransaction.refs.forEach(({ professionalTaskId, ...ref }) => {
      const task = nextTasks.find((item) => item.taskId === professionalTaskId)
      if (!task) throw new Error(`加工单对应的专业任务 ${professionalTaskId} 不存在。`)
      task.processWorkOrderRefs.push(ref)
    })
    record.relatedProfessionalTaskIds = record.professionalTasks.map((task) => task.taskId)
    record.displaySampleTeamId = assignment.teamId
    record.displaySampleTeamName = assignment.teamName
    record.displaySampleReceivingLocationId = assignment.receivingLocationId
    record.displaySampleReceivingLocationName = assignment.receivingLocationName
    record.taskPlanConfirmedBy = input.actor.userName
    record.taskPlanConfirmedAt = at
    record.status = 'IN_PROGRESS'
    addLog(record, '确认方案并生成工作', input.actor, `已生成 ${record.professionalTasks.length} 个专业任务、${processTransaction.refs.length} 张印染加工单，并确认 ${sampleRequirements.length} 行销售展示样衣制作要求。`, at)
    writeRecords(records)
    const committedRefs = processTransaction.commit()
    committedRefs.forEach(({ professionalTaskId, ...committedRef }) => {
      const task = record.professionalTasks.find((item) => item.taskId === professionalTaskId)
      const storedRef = task?.processWorkOrderRefs.find((item) => item.processOrderId === committedRef.processOrderId)
      if (storedRef) Object.assign(storedRef, committedRef)
    })
    writeRecords(records)
    return cloneRecord(record)
  } catch (error) {
    const recordIndex = records.findIndex((item) => item.samplingTaskId === record.samplingTaskId)
    if (recordIndex >= 0) records[recordIndex] = recordSnapshot
    writeRecords(records)
    try { processTransaction.rollback() } catch { /* 保留原始失败 */ }
    throw error
  }
}

export function repairEngineeringIndependentProfessionalTaskProcessOrders(input: {
  taskId: string
  actor: { role: string; userId: string; userName: string }
  repairedAt?: string
}): EngineeringIndependentSamplingRecord {
  requireBuyer(input.actor)
  const records = readRecords()
  const { record, task } = findTask(records, input.taskId)
  if (!isTaskBuyerOrAdministrator(record, input.actor)) throw new Error('只有任务买手本人或管理员可以修复加工单关联。')
  if (!['PATTERN_ARTWORK', 'COLOR_YARN', 'COLOR_FABRIC'].includes(task.taskType)) throw new Error('当前任务不需要印花／染色加工单。')
  const sampleRequirements = record.professionalTasks.find((item) => item.taskType === 'DISPLAY_SAMPLE')?.sampleRequirements || []
  const targetSpu = targetSpuIdentity(record)
  const transaction = prepareDesignRevisionProcessWorkOrders({
    designRevisionTaskId: record.samplingTaskId,
    designRevisionTaskNo: record.samplingTaskCode,
    targetSpuCode: targetSpu.code,
    targetSpuName: targetSpu.name,
    createdAt: input.repairedAt || nowText(),
    createdBy: input.actor.userName,
    receivingTeamId: record.displaySampleTeamId,
    receivingTeamName: record.displaySampleTeamName,
    receivingFactoryId: DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0].receivingFactoryId,
    receivingFactoryName: DESIGN_REVISION_DISPLAY_SAMPLE_ASSIGNMENTS[0].receivingFactoryName,
    receivingLocationId: record.displaySampleReceivingLocationId,
    receivingLocationName: record.displaySampleReceivingLocationName,
    lines: buildDesignRevisionProcessEntries({ record, tasks: record.professionalTasks, sampleRequirements }),
  })
  try {
    const committedRefs = transaction.commit()
    record.professionalTasks.forEach((item) => { item.processWorkOrderRefs = [] })
    committedRefs.forEach(({ professionalTaskId, ...ref }) => {
      const ownerTask = record.professionalTasks.find((item) => item.taskId === professionalTaskId)
      if (!ownerTask) throw new Error(`加工单对应的专业任务 ${professionalTaskId} 不存在。`)
      ownerTask.processWorkOrderRefs.push(ref)
    })
    const at = input.repairedAt || nowText()
    addLog(record, '修复加工单关联', input.actor, `已按当前物料与加工要求重新核对并建立 ${committedRefs.length} 张印染加工单关联。`, at)
    writeRecords(records)
    return cloneRecord(record)
  } catch (error) {
    try { transaction.rollback() } catch { /* 保留原始失败 */ }
    throw error
  }
}

export function confirmEngineeringIndependentSamplingScheme(input: {
  samplingTaskId: string
  actor: { role: string; userId: string; userName: string }
  selectedTaskTypes: EngineeringIndependentProfessionalTaskType[]
  displaySampleAssignment: EngineeringIndependentDisplaySampleAssignment
  sampleRequirements?: Array<Pick<EngineeringSampleRequirementLine, 'targetColor' | 'targetSize' | 'requiredQuantity' | 'requirementNote'> & { requirementLineId?: string }>
  confirmedAt?: string
}): EngineeringIndependentSamplingRecord {
  const samplingSnapshot = captureEngineeringIndependentSamplingRepositoryState()
  const bomSnapshot = captureEngineeringBomRepositoryState()
  try {
    completeEngineeringIndependentBuyerPreparation({ samplingTaskId: input.samplingTaskId, actor: input.actor, completedAt: input.confirmedAt })
    return confirmEngineeringIndependentSamplingPlan(input)
  } catch (error) {
    restoreEngineeringIndependentSamplingRepositoryState(samplingSnapshot)
    restoreEngineeringBomRepositoryState(bomSnapshot)
    throw error
  }
}

function findTask(records: EngineeringIndependentSamplingRecord[], taskId: string): { record: EngineeringIndependentSamplingRecord; task: EngineeringIndependentProfessionalTask } {
  for (const record of records) { const task = record.professionalTasks.find((item) => item.taskId === taskId); if (task) return { record, task } }
  throw new Error('设计改款专业任务不存在。')
}

function unlockDependents(record: EngineeringIndependentSamplingRecord, completedTaskId: string): void {
  record.professionalTasks.filter((task) => task.dependsOnTaskIds.includes(completedTaskId)).forEach((task) => {
    if (task.status === 'WAIT_DEPENDENCY' && task.dependsOnTaskIds.every((id) => record.professionalTasks.find((item) => item.taskId === id)?.status === 'COMPLETED')) task.status = 'WAIT_START'
  })
}

function refreshParentStatus(record: EngineeringIndependentSamplingRecord): void {
  if (record.status === 'COMPLETED' || record.status === 'DRAFT') return
  record.status = record.professionalTasks.length > 0 && record.professionalTasks.every((task) => task.status === 'COMPLETED') ? 'WAIT_CONFIRMATION' : 'IN_PROGRESS'
}

function requiredExecutionRole(task: EngineeringIndependentProfessionalTask): string {
  if (task.taskType === 'BASE_PATTERN') return '版师'
  if (task.taskType === 'DISPLAY_SAMPLE') return '制作团队'
  if (task.taskType === 'PATTERN_ARTWORK') return '花型团队'
  return '染厂'
}

function requireTaskExecutor(task: EngineeringIndependentProfessionalTask, actor: { role?: string; userId: string; userName: string }): void {
  if ((actor.role !== '管理员' && actor.role !== requiredExecutionRole(task)) || !actor.userId.trim() || !actor.userName.trim()) {
    throw new Error(`当前应由${requiredExecutionRole(task)}处理${task.taskName}。`)
  }
}

export function startEngineeringIndependentProfessionalTask(input: { taskId: string; actor: { role?: string; userId: string; userName: string }; startedAt?: string }): EngineeringIndependentSamplingRecord {
  const records = readRecords(); const { record, task } = findTask(records, input.taskId)
  if ((task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && !task.colorRequirementConfirmedAt) {
    throw new Error('请先由买手填写并确认潘通色号和颜色名称，再开始跟进调色。')
  }
  requireTaskExecutor(task, input.actor)
  if (task.status !== 'WAIT_START') throw new Error('当前专业任务尚不能开始。')
  if (task.taskType === 'DISPLAY_SAMPLE') {
    const processRefs = record.professionalTasks.flatMap((candidate) => candidate.processWorkOrderRefs)
    const pending = readDesignRevisionProcessWorkOrderStatuses(processRefs).filter((status) => status.status !== 'COMPLETED')
    if (pending.length) {
      const reasons = [...new Set(pending.map((status) => status.blockReason || status.statusLabel).filter(Boolean))]
      throw new Error(`印花／染色物料尚未全部交到制作团队：${reasons.join('；')}`)
    }
  }
  task.status = 'IN_PROGRESS'; task.startedAt = input.startedAt || nowText(); addLog(record, '开始专业任务', input.actor, `${task.taskName}开始执行。`, task.startedAt)
  writeRecords(records); return cloneRecord(record)
}

export function confirmEngineeringIndependentColorRequirement(input: { taskId: string; actor: { role: string; userId: string; userName: string }; pantoneColorCode: string; colorName: string; confirmedAt?: string }): EngineeringIndependentSamplingRecord {
  requireBuyer(input.actor)
  const records = readRecords(); const { record, task } = findTask(records, input.taskId)
  if (!['COLOR_YARN', 'COLOR_FABRIC'].includes(task.taskType)) throw new Error('当前任务不是调色任务。')
  if (!['WAIT_START', 'IN_PROGRESS', 'REWORK'].includes(task.status)) throw new Error('当前调色任务不能维护颜色要求。')
  if (!input.pantoneColorCode.trim() || !input.colorName.trim()) throw new Error('请完整填写潘通色号和颜色名称。')
  task.pantoneColorCode = input.pantoneColorCode.trim()
  task.colorName = input.colorName.trim()
  task.colorRequirementConfirmedBy = input.actor.userName
  task.colorRequirementConfirmedAt = input.confirmedAt || nowText()
  addLog(record, '买手确认颜色要求', input.actor, `${task.taskName}颜色要求：${task.pantoneColorCode} / ${task.colorName}。`, task.colorRequirementConfirmedAt)
  writeRecords(records); return cloneRecord(record)
}

function validateIndependentProfessionalResultFiles(
  task: EngineeringIndependentProfessionalTask,
  files: EngineeringUploadedFile[],
): void {
  assertEngineeringUploadedFilesReady(files)
  const imageFiles = files.filter((file) => ['jpg', 'jpeg', 'png', 'webp'].includes(file.extension))
  if (task.taskType === 'BASE_PATTERN' && !files.some((file) => file.extension === 'prj')) {
    throw new Error('基码纸样必须上传并保存实际 .prj 纸样文件。')
  }
  if (task.taskType === 'DISPLAY_SAMPLE' && imageFiles.length === 0) {
    throw new Error('销售展示样衣必须上传与 B 款实际对应的样衣图片。')
  }
  if (task.taskType === 'PATTERN_ARTWORK') {
    if (imageFiles.length === 0) throw new Error('花型成果必须上传可视预览图。')
    if (!files.some((file) => ['ai', 'psd', 'pdf'].includes(file.extension))) throw new Error('花型成果还必须上传实际花型源文件。')
  }
  if ((task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && imageFiles.length === 0) {
    throw new Error('调色成果必须上传实际色样或调色成果图片。')
  }
}

export function listEngineeringIndependentAvailablePatternVersions(
  recordOrId: EngineeringIndependentSamplingRecord | string,
): Array<{ value: string; label: string }> {
  const record = typeof recordOrId === 'string' ? getEngineeringIndependentSamplingRecord(recordOrId) : recordOrId
  if (!record) return []
  const reused = record.patternHandling === 'REUSE'
    ? record.reusedPatternFiles
        .filter((file) => file.purpose === 'PATTERN_SOURCE' && file.extension === 'prj')
        .map((file) => ({ value: `REUSE:${file.fileId}`, label: `复用纸样 · ${file.fileName}` }))
    : []
  const remade = record.professionalTasks
    .filter((task) => task.taskType === 'BASE_PATTERN' && task.status === 'COMPLETED')
    .flatMap((task) => task.results
      .filter((result) => result.status === 'APPROVED' && result.version.trim())
      .map((result) => ({ value: result.version.trim(), label: `${result.version.trim()} · 本次新制` })))
  return [...reused, ...remade]
}

export function submitEngineeringIndependentProfessionalTask(input: {
  taskId: string
  actor: { role?: string; userId: string; userName: string }
  results: Array<{
    title: string
    version?: string
    description?: string
    applicablePartOrSize?: string
    requirementLineId?: string
    sampleQuantity?: number
    sampleColor?: string
    sampleSize?: string
    sourcePatternVersion?: string
    differenceNote?: string
    files: EngineeringUploadedFile[]
  }>
  dyeColorCode?: string
  submittedAt?: string
}): EngineeringIndependentSamplingRecord {
  const records = readRecords(); const { record, task } = findTask(records, input.taskId)
  requireTaskExecutor(task, input.actor)
  if (!['IN_PROGRESS', 'REWORK'].includes(task.status)) throw new Error('请先开始专业任务。')
  if (!input.results.length || input.results.some((item) => !item.title.trim())) throw new Error('请逐项填写成果名称。')
  input.results.forEach((result) => validateIndependentProfessionalResultFiles(task, result.files))
  if (task.taskType === 'BASE_PATTERN' && input.results.some((result) => !result.version?.trim() || !result.description?.trim() || !result.applicablePartOrSize?.trim())) {
    throw new Error('请完整填写纸样版本、纸样说明和适用部位／尺码。')
  }
  if (task.taskType === 'DISPLAY_SAMPLE' && input.results.some((result) => !Number.isFinite(result.sampleQuantity) || Number(result.sampleQuantity) <= 0 || !result.sampleColor?.trim() || !result.sampleSize?.trim() || !result.sourcePatternVersion?.trim() || !result.description?.trim())) {
    throw new Error('请完整填写样衣数量、颜色、尺码、使用的纸样版本和制作说明。')
  }
  if (task.taskType === 'DISPLAY_SAMPLE') {
    const requirements = task.sampleRequirements || []
    if (!requirements.length) throw new Error('销售展示样衣尚未下达制作要求，不能提交成果。')
    const availablePatternVersions = new Set(listEngineeringIndependentAvailablePatternVersions(record).map((item) => item.value))
    if (!availablePatternVersions.size) throw new Error('尚无可用的已完成基码纸样版本，不能提交销售展示样衣成果。')
    if (input.results.some((result) => !availablePatternVersions.has(result.sourcePatternVersion?.trim() || ''))) {
      throw new Error('销售展示样衣只能选择已完成的基码纸样版本。')
    }
    const requirementMap = new Map(requirements.map((line) => [line.requirementLineId, line]))
    const resultsByRequirement = new Map<string, typeof input.results>()
    input.results.forEach((result) => {
      const requirementLineId = result.requirementLineId?.trim() || ''
      if (!requirementMap.has(requirementLineId)) throw new Error('每行实际样衣必须对应一行已下达的制作要求。')
      if (!Number.isInteger(Number(result.sampleQuantity))) throw new Error('销售展示样衣实际数量必须为大于 0 的整数。')
      const rows = resultsByRequirement.get(requirementLineId) || []
      rows.push(result)
      resultsByRequirement.set(requirementLineId, rows)
    })
    requirements.forEach((requirement) => {
      const rows = resultsByRequirement.get(requirement.requirementLineId) || []
      if (!rows.length) throw new Error(`请提交“${requirement.targetColor} / ${requirement.targetSize}”的实际样衣成果。`)
      const actualQuantity = rows.reduce((sum, result) => sum + Number(result.sampleQuantity || 0), 0)
      const actualMismatch = rows.some((result) =>
        result.sampleColor?.trim() !== requirement.targetColor
        || result.sampleSize?.trim() !== requirement.targetSize,
      )
      if ((actualQuantity !== requirement.requiredQuantity || actualMismatch) && !rows.some((result) => result.differenceNote?.trim())) {
        throw new Error(`“${requirement.targetColor} / ${requirement.targetSize}”的实际交付与制作要求不一致，请填写差异说明。`)
      }
    })
  }
  if (task.taskType === 'PATTERN_ARTWORK' && input.results.some((result) => !result.version?.trim() || !result.description?.trim())) {
    throw new Error('请完整填写花型版本和花型说明。')
  }
  if ((task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && (!input.dyeColorCode?.trim() || input.results.some((result) => !result.description?.trim()))) {
    throw new Error('请完整填写染厂色号和调色说明。')
  }
  if ((task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && (!task.colorRequirementConfirmedAt || !task.pantoneColorCode || !task.colorName)) throw new Error('请先由买手确认潘通色号和颜色名称。')
  const at = input.submittedAt || nowText(); task.submittedAt = at
  task.dyeColorCode = input.dyeColorCode?.trim() || task.dyeColorCode
  const submittedResults = input.results.map((result, index) => ({
    resultId: `${task.taskId}-R${index + 1}`,
    title: result.title.trim(),
    version: result.version?.trim() || '',
    description: result.description?.trim() || '',
    applicablePartOrSize: result.applicablePartOrSize?.trim() || '',
    requirementLineId: result.requirementLineId?.trim() || '',
    sampleQuantity: Number(result.sampleQuantity) || 0,
    sampleColor: result.sampleColor?.trim() || '',
    sampleSize: result.sampleSize?.trim() || '',
    sourcePatternVersion: result.sourcePatternVersion?.trim() || '',
    differenceNote: result.differenceNote?.trim() || '',
    imageUrl: result.files.find((file) => ['jpg', 'jpeg', 'png', 'webp'].includes(file.extension))?.dataUrl || '',
    files: result.files.map((file) => ({ ...file, roundNo: task.status === 'REWORK' ? Math.max(2, file.roundNo) : file.roundNo })),
    status: task.taskType === 'BASE_PATTERN' || task.taskType === 'DISPLAY_SAMPLE' ? 'APPROVED' as const : 'WAIT_REVIEW' as const,
    rejectReason: '',
  }))
  if (task.status === 'REWORK') {
    const approved = task.results.filter((result) => result.status === 'APPROVED')
    const rejected = task.results.filter((result) => result.status === 'REJECTED')
    if (submittedResults.length !== rejected.length) throw new Error(`本轮只需重新提交 ${rejected.length} 个未通过成果。`)
    task.results = [...approved, ...submittedResults.map((result, index) => ({ ...result, resultId: rejected[index]?.resultId || result.resultId }))]
  } else {
    task.results = submittedResults
  }
  if (task.taskType === 'BASE_PATTERN' || task.taskType === 'DISPLAY_SAMPLE') { task.status = 'COMPLETED'; task.completedAt = at; unlockDependents(record, task.taskId) } else task.status = 'WAIT_REVIEW'
  addLog(record, '提交专业成果', input.actor, `${task.taskName}已提交 ${task.results.length} 项成果。`, at); refreshParentStatus(record); writeRecords(records); return cloneRecord(record)
}

export function reviewEngineeringIndependentProfessionalTask(input: { taskId: string; actor: { role: string; userId: string; userName: string }; decisions: Array<{ resultId: string; approved: boolean; reason?: string }>; reviewedAt?: string }): EngineeringIndependentSamplingRecord {
  if (input.actor.role !== '买手' && input.actor.role !== '管理员') throw new Error('只有当前登录买手或管理员可以审核花型或调色成果。')
  const records = readRecords(); const { record, task } = findTask(records, input.taskId)
  if (task.status !== 'WAIT_REVIEW') throw new Error('当前任务没有待审核成果。')
  const at = input.reviewedAt || nowText()
  const reviewedResults = task.results.map(cloneResult)
  reviewedResults.forEach((result) => { const decision = input.decisions.find((item) => item.resultId === result.resultId); if (!decision) throw new Error(`请审核成果：${result.title}`); if (!decision.approved && !decision.reason?.trim()) throw new Error(`请填写未通过原因：${result.title}`); result.status = decision.approved ? 'APPROVED' : 'REJECTED'; result.rejectReason = decision.approved ? '' : decision.reason!.trim() })
  const allApproved = reviewedResults.every((result) => result.status === 'APPROVED')
  if (allApproved && task.processWorkOrderRefs.length) {
    const approvedResult = reviewedResults[0]
    if (!approvedResult) throw new Error('专业成果不存在，不能开放加工单。')
    const version = approvedResult.version.trim() || task.dyeColorCode.trim() || approvedResult.resultId
    bindDesignRevisionApprovedProfessionalResult({
      designRevisionTaskId: record.samplingTaskId,
      professionalTaskId: task.taskId,
      professionalResultId: approvedResult.resultId,
      professionalResultVersion: version,
      approvedAt: at,
      approvedBy: input.actor.userName,
      attachments: reviewedResults.flatMap((result) => result.files.map((file) => {
        const stored = getEngineeringTaskUploadedFile(file.fileId) || file
        return { fileId: stored.fileId, fileName: stored.fileName, mimeType: stored.mimeType, sizeBytes: stored.sizeBytes, dataUrl: stored.dataUrl }
      })),
      processWorkOrderRefs: task.processWorkOrderRefs,
    })
  }
  task.results = reviewedResults
  task.status = allApproved ? 'COMPLETED' : 'REWORK'; if (allApproved) { task.completedAt = at; unlockDependents(record, task.taskId) }
  addLog(record, allApproved ? '买手审核通过' : '买手退回返工', input.actor, allApproved ? `${task.taskName}全部成果通过。` : `${task.taskName}未通过项需要返工。`, at); refreshParentStatus(record); writeRecords(records); return cloneRecord(record)
}

export function confirmEngineeringIndependentSamplingResult(input: { samplingTaskId: string; actor: { role: string; userId: string; userName: string }; resultVersion: string; resultSummary: string; confirmedAt: string }): EngineeringIndependentSamplingRecord {
  requireBuyer(input.actor); const records = readRecords(); const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record) throw new Error('设计改款任务不存在。')
  if (!isTaskBuyerOrAdministrator(record, input.actor)) throw new Error('只有任务买手本人或管理员可以确认整张任务成果。')
  if (record.status !== 'WAIT_CONFIRMATION') throw new Error('全部专业任务完成后才能确认整张成果。')
  if (!input.resultVersion.trim() || !input.resultSummary.trim()) throw new Error('请完整填写成果版本和成果摘要。')
  record.status = 'COMPLETED'; record.resultVersion = input.resultVersion.trim(); record.resultSummary = input.resultSummary.trim(); record.confirmedBy = input.actor.userName; record.confirmedAt = input.confirmedAt
  addLog(record, '确认整张成果', input.actor, `成果版本 ${record.resultVersion} 已确认。`, input.confirmedAt); writeRecords(records); syncDesignRevisionProjectRelation(record); return cloneRecord(record)
}

export function listCompletedTemporarySpuDesignRevisions(): EngineeringIndependentSamplingRecord[] {
  return readRecords()
    .filter((record) => record.targetMode === 'TEMPORARY_SPU' && record.status === 'COMPLETED' && !record.linkedFormalStyleId)
    .sort((left, right) => right.confirmedAt.localeCompare(left.confirmedAt))
    .map(cloneRecord)
}

export function linkCompletedTemporarySpuToStyleArchive(input: {
  samplingTaskId: string
  styleId: string
  actor: { userId: string; userName: string }
  linkedAt?: string
}): EngineeringIndependentSamplingRecord {
  if (!input.actor.userId.trim() || !input.actor.userName.trim()) throw new Error('缺少商品建档操作人。')
  const records = readRecords()
  const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record) throw new Error('设计改款任务不存在。')
  if (record.targetMode !== 'TEMPORARY_SPU') throw new Error('只有线下临时 SPU 任务需要关联正式商品档案。')
  if (record.status !== 'COMPLETED') throw new Error('设计改款任务完成后才能承接到正式商品档案。')
  if (record.linkedFormalStyleId) throw new Error(`该任务已关联 ${record.linkedFormalStyleCode}，不能重复关联。`)
  const style = getStyleArchiveById(input.styleId)
  if (!style) throw new Error('需要关联的正式商品档案不存在。')
  const linkedAt = input.linkedAt || nowText()
  const recordSnapshot = cloneRecord(record)
  const bomSnapshot = captureEngineeringBomRepositoryState()
  const styleSnapshot = captureStyleArchiveRepositoryState()
  try {
    rebindEngineeringBomOwnerStyle({
      ownerStage: 'INDEPENDENT_SAMPLING',
      ownerId: record.samplingTaskId,
      styleId: style.styleId,
      updatedBy: input.actor.userName,
      updatedAt: linkedAt,
    })
    const updatedStyle = updateStyleArchive(style.styleId, {
      temporarySpuName: record.temporarySpuName,
      linkedDesignRevisionTaskIds: [...new Set([...(style.linkedDesignRevisionTaskIds || []), record.samplingTaskId])],
      inheritedDesignFileIds: [...new Set([...(style.inheritedDesignFileIds || []), ...record.designFiles.map((file) => file.fileId)])],
      inheritedPatternFileIds: [...new Set([
        ...(style.inheritedPatternFileIds || []),
        ...record.reusedPatternFiles.map((file) => file.fileId),
        ...record.professionalTasks.filter((task) => task.taskType === 'BASE_PATTERN').flatMap((task) => task.results.flatMap((result) => result.files.map((file) => file.fileId))),
      ])],
      inheritedBomVersionIds: [...new Set([...(style.inheritedBomVersionIds || []), ...record.bomVersionIds])],
      mainImageUrl: style.mainImageUrl || record.designFiles.at(-1)?.dataUrl || '',
      imageSource: style.imageSource || `承接自设计改款 ${record.samplingTaskCode}`,
      updatedAt: linkedAt,
      updatedBy: input.actor.userName,
    })
    if (!updatedStyle) throw new Error('商品档案承接设计改款资料失败。')
    record.linkedFormalStyleId = updatedStyle.styleId
    record.linkedFormalStyleCode = updatedStyle.styleCode
    record.linkedFormalStyleName = updatedStyle.styleName
    record.linkedAt = linkedAt
    record.linkedBy = input.actor.userName
    record.targetStyleId = updatedStyle.styleId
    record.targetStyleCode = updatedStyle.styleCode
    record.targetStyleName = updatedStyle.styleName
    addLog(record, '关联正式商品档案', input.actor, `线下临时 SPU“${record.temporarySpuName}”已关联 ${updatedStyle.styleCode}，设计稿、纸样和 BOM 资料已承接。`, linkedAt)
    writeRecords(records)
    syncDesignRevisionProjectRelation(record)
    return cloneRecord(record)
  } catch (error) {
    restoreEngineeringBomRepositoryState(bomSnapshot)
    restoreStyleArchiveRepositoryState(styleSnapshot)
    const recordIndex = records.findIndex((item) => item.samplingTaskId === record.samplingTaskId)
    if (recordIndex >= 0) records[recordIndex] = recordSnapshot
    writeRecords(records)
    throw error
  }
}

export function listReusableEngineeringIndependentSamplingResults(targetStyleCode: string): EngineeringIndependentSamplingRecord[] {
  return readRecords().filter((record) =>
    record.targetStyleCode === targetStyleCode
    && record.status === 'COMPLETED'
    && Boolean(record.confirmedBy && record.confirmedAt && record.resultVersion)
    && record.professionalTasks.length > 0
    && record.professionalTasks.every((task) => task.status === 'COMPLETED'),
  ).sort((left, right) => right.confirmedAt.localeCompare(left.confirmedAt)).map(cloneRecord)
}

// 生产准备单只能选择整单已确认、且专业任务自身已完成的成果。返回顺序即推荐顺序：最近确认优先。
export function listReusableEngineeringIndependentProfessionalResults(
  targetStyleCode: string,
): EngineeringIndependentReusableProfessionalResult[] {
  return listReusableEngineeringIndependentSamplingResults(targetStyleCode).flatMap((record) => {
    const reusedBasePattern: EngineeringIndependentReusableProfessionalResult[] = record.patternHandling === 'REUSE'
      && record.reusedPatternFiles.some((file) => file.purpose === 'PATTERN_SOURCE' && file.status === '已保存' && file.extension === 'prj' && Boolean(file.dataUrl))
      ? [{
          samplingTaskId: record.samplingTaskId,
          samplingTaskCode: record.samplingTaskCode,
          samplingType: record.samplingType,
          targetStyleId: record.targetStyleId,
          targetStyleCode: record.targetStyleCode,
          professionalTaskId: `${record.samplingTaskId}-REUSED-BASE_PATTERN`,
          professionalTaskType: 'BASE_PATTERN',
          professionalTaskName: '基码纸样（直接复用）',
          resultVersion: record.resultVersion,
          resultSummary: record.resultSummary,
          bomDraftVersionId: record.bomDraftVersionId,
          confirmedBy: record.confirmedBy,
          confirmedAt: record.confirmedAt,
          completedAt: record.confirmedAt,
          resultImageUrls: [],
        }]
      : []
    const completedTaskResults = record.professionalTasks
      .filter((task) =>
        task.status === 'COMPLETED'
        && Boolean(task.completedAt)
        && task.results.length > 0
        && task.results.every((result) => result.status === 'APPROVED'),
      )
      .map((task) => ({
        samplingTaskId: record.samplingTaskId,
        samplingTaskCode: record.samplingTaskCode,
        samplingType: record.samplingType,
        targetStyleId: record.targetStyleId,
        targetStyleCode: record.targetStyleCode,
        professionalTaskId: task.taskId,
        professionalTaskType: task.taskType,
        professionalTaskName: task.taskName,
        resultVersion: record.resultVersion,
        resultSummary: record.resultSummary,
        bomDraftVersionId: record.bomDraftVersionId,
        confirmedBy: record.confirmedBy,
        confirmedAt: record.confirmedAt,
        completedAt: task.completedAt,
        resultImageUrls: task.results.filter((result) => result.status === 'APPROVED').map((result) => result.imageUrl),
      }))
    return [...reusedBasePattern, ...completedTaskResults]
  })
}

export function setEngineeringIndependentSamplingReuseDecision(input: { samplingTaskId: string; decision: 'REUSE' | 'REDO' | 'IGNORE'; actor: { role: string; userId: string; userName: string }; decidedAt?: string }): EngineeringIndependentSamplingRecord {
  requireMerchandiser(input.actor); const records = readRecords(); const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record || record.status !== 'COMPLETED') throw new Error('只能选择已完成且已确认的前期成果。')
  record.reuseDecision = input.decision; addLog(record, '生产准备单成果选择', input.actor, `本次选择：${input.decision === 'REUSE' ? '复用' : input.decision === 'REDO' ? '重做' : '不采用'}。`, input.decidedAt || nowText()); writeRecords(records); return cloneRecord(record)
}

export function resolveEngineeringIndependentSamplingBomLines(record: EngineeringIndependentSamplingRecord) {
  return record.bomVersionIds
    .map(getEngineeringBomVersionById)
    .flatMap((version) => version?.materialLines || [])
    .map((line) => resolveEngineeringBomMaterialLine(line))
}

export function calculateIndependentSamplingMaterialRequirement(input: { unitUsage: number; sampleQuantity: number; lossRate: number }): number {
  return calculateEngineeringBomTotalRequirement({ usage: input.unitUsage, sampleQuantity: input.sampleQuantity, lossRate: input.lossRate })
}

export function captureEngineeringIndependentSamplingRepositoryState(): EngineeringIndependentSamplingRepositoryState {
  return { records: readRecords().map(cloneRecord) }
}

export function restoreEngineeringIndependentSamplingRepositoryState(state: EngineeringIndependentSamplingRepositoryState): void {
  writeRecords(state.records.map(cloneRecord))
}

export function resetEngineeringIndependentSamplingRepository(seed = true): void {
  writeRecords(seed ? seedRecords() : [])
}
