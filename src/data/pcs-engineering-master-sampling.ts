import {
  calculateEngineeringBomTotalRequirement,
  resolveEngineeringBomMaterialLine,
} from './pcs-engineering-bom-material-resolver.ts'
import { listMaterialArchives, listMaterialSkuRecordsByMaterialId } from './pcs-material-archive-repository.ts'
import type { EngineeringBomMaterialLineDraft } from './pcs-engineering-bom-types.ts'
import type {
  EngineeringIndependentColorMapping,
  EngineeringIndependentMaterialConversionLine,
  EngineeringIndependentMaterialDecision,
  EngineeringIndependentProfessionalResult,
  EngineeringIndependentProfessionalTask,
  EngineeringIndependentProfessionalTaskType,
  EngineeringIndependentReusableProfessionalResult,
  EngineeringIndependentSamplingRecord,
  EngineeringIndependentSamplingStep,
  EngineeringIndependentSamplingType,
  EngineeringSampleRequirementLine,
} from './pcs-engineering-master-types.ts'
import { getStyleArchiveById, listStyleArchives } from './pcs-style-archive-repository.ts'
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
  regenerateEngineeringBomVersionFromSource,
  resolveEngineeringBomPricingPlan,
  restoreEngineeringBomRepositoryState,
  saveEngineeringBomVersion,
  setEngineeringBomVersionsEditingLock,
} from './pcs-engineering-bom-repository.ts'
import type { EngineeringUploadedFile } from './pcs-engineering-file-upload.ts'
import { assertEngineeringUploadedFilesReady } from './pcs-engineering-file-upload.ts'
import { upsertProjectRelation } from './pcs-project-relation-repository.ts'

const STORAGE_KEY = 'higood-pcs-design-revision-v1'
const TASK_META: Record<EngineeringIndependentProfessionalTaskType, { name: string; team: string }> = {
  BASE_PATTERN: { name: '基码纸样', team: '版师' },
  DISPLAY_SAMPLE: { name: '销售展示样衣任务', team: '制作团队' },
  PATTERN_ARTWORK: { name: '花型任务', team: '花型团队' },
  COLOR_YARN: { name: '调色任务（纱线）', team: '染厂' },
  COLOR_FABRIC: { name: '调色任务（面料）', team: '染厂' },
}

let memoryRecords: EngineeringIndependentSamplingRecord[] | null = null

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
    results: task.results.map(cloneResult),
  }
}

function cloneRecord(record: EngineeringIndependentSamplingRecord): EngineeringIndependentSamplingRecord {
  return {
    ...record,
    designFiles: (record.designFiles || []).map((file) => ({ ...file })),
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
  return {
    ...record,
    samplingType: 'DESIGN_REVISION',
    designFiles: Array.isArray(record.designFiles) ? record.designFiles.map((file) => ({ ...file })) : [],
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
    ? { id: 'U-MERCH-LINXIAO', name: '跟单-林晓', team: '跟单' }
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
    fileName: `${taskId.toLowerCase()}-${index}.jpg`,
    extension: 'jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 286_720 + index * 1024,
    dataUrl: imageUrl,
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
  const styles = listStyleArchives().filter((style) => style.mainImageUrl)
  if (styles.length < 2) return []
  const actor = { role: '跟单' as const, userId: 'U-MERCH-LINXIAO', userName: '跟单-林晓' }
  const buyer = { userId: 'U-BUYER-DEMO', userName: '买手-阿乐' }
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
      merchandiser: actor,
      createdAt,
    }, code)
    const targetSizes = [...new Set(listSkuArchivesByStyleId(target.styleId).filter((sku) => sku.archiveStatus === 'ACTIVE').map((sku) => sku.sizeName))].slice(0, 2)
    const sourceColors = source
      ? [...new Set(listSkuArchivesByStyleId(source.styleId).filter((sku) => sku.archiveStatus === 'ACTIVE').map((sku) => sku.colorName))]
      : []
    const scenario = index % 6
    const targetColorInputs = scenario === 0
        ? [{ targetColor: '改款深蓝', sourceColor: sourceColors[0] || '', targetSizeNames: targetSizes }]
        : scenario === 2
          ? [
              { targetColor: '经典黑', sourceColor: sourceColors[0] || '', targetSizeNames: targetSizes },
              { targetColor: '雾霾蓝', sourceColor: sourceColors[0] || '', targetSizeNames: targetSizes },
              { targetColor: '新杏色', sourceColor: '', targetSizeNames: targetSizes },
            ]
          : [
              { targetColor: '目标黑', sourceColor: sourceColors[0] || '', targetSizeNames: targetSizes },
              { targetColor: '目标白', sourceColor: sourceColors[1] || '', targetSizeNames: targetSizes },
            ]

    const existingBomVersions = listEngineeringBomVersionsByOwner('INDEPENDENT_SAMPLING', taskId)
    if (existingBomVersions.length) {
      record.bomVersionIds = existingBomVersions.map((version) => version.bomDraftVersionId)
      record.bomDraftVersionId = record.bomVersionIds[0] || ''
      record.colorMappings = existingBomVersions.map((version, mappingIndex) => ({
        mappingId: `${record.samplingTaskId}-COLOR-${mappingIndex + 1}`,
        sourceColor: '',
        targetColor: version.productColor,
        targetSkuIds: [...version.applicableSkuIds],
        targetSizeNames: [...new Set(version.applicableSkuIds.map((skuId) => listSkuArchives().find((sku) => sku.skuId === skuId)?.sizeName || '').filter(Boolean))],
        mappingType: '无参考颜色',
        confirmedBy: buyer.userName,
        confirmedAt: createdAt,
      }))
      record.bomConversionStatus = 'WAIT_MATERIAL_DECISION'
    } else {
      applyEngineeringIndependentColorMappings({ record, actor: buyer, mappings: targetColorInputs, confirmedAt: createdAt })
    }
    const defaultLines = createDefaultBomLines(target.styleCode).map((line) => ({
      ...line,
      printRequirement: index % 3 === 0 ? '是' as const : '否' as const,
      printRequirementText: index % 3 === 0 ? '满印花型' : '无',
      dyeRequirement: index % 4 === 0 ? '是' as const : '否' as const,
      purchaseRequirement: index % 5 === 0 ? '是' as const : '否' as const,
    }))
    record.bomVersionIds.forEach((versionId, versionIndex) => {
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
        customCosts: versionIndex === 0 ? [{ title: '车位费', amountIdr: 15_000, note: '演示费用' }] : [],
        updatedAt: createdAt,
      })
    })
    record.materialConversionLines.forEach((line) => {
      line.decision = index % 4 === 0 ? '重新染色' : '沿用'
      line.dyeRequirement = index % 4 === 0 ? '是' : line.dyeRequirement
      line.note = index % 4 === 0 ? '按目标颜色重新染色' : '沿用参考物料'
      line.confirmedBy = buyer.userName
      line.confirmedAt = createdAt
    })
    record.bomConversionConfirmedBy = buyer.userName
    record.bomConversionConfirmedAt = createdAt
    // STYLE-PRJ-202603-011 同时提供一条已完成且已确认的前期成果，供工程主单
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
      record.taskPlanConfirmedBy = actor.userName
      record.taskPlanConfirmedAt = createdAt
      const seededSampleRequirements = selected.includes('DISPLAY_SAMPLE')
        ? normalizeIndependentSampleRequirements(record, undefined, actor.userName, createdAt)
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
                description: '已按跟单下达的颜色、尺码和数量完成销售展示样衣。',
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
        record.resultVersion = 'v1.0'; record.resultSummary = '前期样衣与专业成果已完成并确认。'; record.confirmedBy = actor.userName; record.confirmedAt = createdAt
      }
    }
    return record
  })
}

function readRecords(): EngineeringIndependentSamplingRecord[] {
  if (memoryRecords) return memoryRecords
  if (canUseStorage()) {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as EngineeringIndependentSamplingRecord[]
      if (Array.isArray(parsed) && parsed.length) return (memoryRecords = parsed.map(normalizeRecord))
    } catch { /* 使用演示种子 */ }
  }
  memoryRecords = seedRecords()
  writeRecords(memoryRecords)
  return memoryRecords
}

function writeRecords(records: EngineeringIndependentSamplingRecord[]): void {
  memoryRecords = records.map(cloneRecord)
  if (canUseStorage()) localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryRecords))
}

function requireMerchandiser(actor: { role: string; userId: string; userName: string }): void {
  if (actor.role !== '跟单' || !actor.userId.trim() || !actor.userName.trim()) throw new Error('只有当前登录的跟单可以操作设计改款任务。')
}

function addLog(record: EngineeringIndependentSamplingRecord, action: string, actor: { userId: string; userName: string }, detail: string, occurredAt = nowText()): void {
  record.operationLogs.unshift({ logId: `${record.samplingTaskId}-LOG-${record.operationLogs.length + 1}`, action, operatorId: actor.userId, operatorName: actor.userName, occurredAt, detail })
  record.updatedAt = occurredAt
}

function syncDesignRevisionProjectRelation(record: EngineeringIndependentSamplingRecord): void {
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
    ownerName: record.merchandiserName,
    createdAt: record.createdAt,
    createdBy: record.createdBy,
    updatedAt: record.updatedAt,
    updatedBy: record.confirmedBy || record.merchandiserName,
    note: `参照款式 ${record.sourceStyleCode}，目标款式 ${record.targetStyleCode}。`,
  })
}

export interface CreateEngineeringIndependentSamplingInput {
  samplingType?: EngineeringIndependentSamplingType
  sourceStyleId: string
  targetStyleId: string
  creationReason: string
  designFiles: EngineeringUploadedFile[]
  merchandiser: { role: string; userId: string; userName: string }
  createdAt: string
}

function buildRecord(input: CreateEngineeringIndependentSamplingInput, code: string): EngineeringIndependentSamplingRecord {
  requireMerchandiser(input.merchandiser)
  const target = getStyleArchiveById(input.targetStyleId)
  if (!target) throw new Error('目标商品／款式档案不存在。')
  const source = getStyleArchiveById(input.sourceStyleId)
  if (!source) throw new Error('参照商品／款式档案不存在。')
  if (source.styleId === target.styleId || source.styleCode === target.styleCode) throw new Error('参照 SPU 与目标 SPU 不能相同。')
  assertEngineeringUploadedFilesReady(input.designFiles, '设计稿')
  if (input.designFiles.some((file) => file.purpose !== 'DESIGN_IMAGE')) throw new Error('设计稿文件类型不正确。')
  if (input.designFiles.some((file) => file.uploadedById !== input.merchandiser.userId || file.uploadedByTeam !== '跟单')) throw new Error('设计稿必须由当前跟单上传。')
  const creationReason = input.creationReason?.trim() || ''
  if (!creationReason) throw new Error('请填写本次设计改款要求。')
  const taskId = code.replace(/^ES-/, 'ES-ID-')
  const record: EngineeringIndependentSamplingRecord = {
    samplingTaskId: taskId, samplingTaskCode: code, samplingType: 'DESIGN_REVISION',
    sourceStyleId: source.styleId, sourceStyleCode: source.styleCode,
    targetStyleId: target.styleId, targetStyleCode: target.styleCode, targetStyleName: target.styleName,
    status: 'DRAFT', creationReason, designFiles: input.designFiles.map((file) => ({ ...file })), merchandiserId: input.merchandiser.userId, merchandiserName: input.merchandiser.userName,
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
    operationLogs: [], createdBy: input.merchandiser.userName, createdAt: input.createdAt, updatedAt: input.createdAt,
  }
  addLog(record, '创建任务', input.merchandiser, `设计改款任务已创建，并上传设计稿：${record.designFiles.map((file) => file.fileName).join('、')}。${record.creationReason}`, input.createdAt)
  return record
}

export function createEngineeringIndependentSampling(input: CreateEngineeringIndependentSamplingInput): EngineeringIndependentSamplingRecord {
  const records = readRecords()
  const code = `ES-DR-${String(records.length + 1).padStart(3, '0')}`
  const bomSnapshot = captureEngineeringBomRepositoryState()
  try {
    const record = buildRecord(input, code)
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
  requireMerchandiser(input.actor)
  assertEngineeringUploadedFilesReady(input.designFiles, '设计稿')
  if (input.designFiles.some((file) => file.purpose !== 'DESIGN_IMAGE')) throw new Error('设计稿文件类型不正确。')
  if (input.designFiles.some((file) => file.uploadedById !== input.actor.userId || file.uploadedByTeam !== '跟单')) throw new Error('设计稿必须由当前跟单上传。')
  const records = readRecords()
  const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record) throw new Error('设计改款任务不存在。')
  if (record.taskPlanConfirmedAt) throw new Error('工作安排确认后不能替换设计稿。')
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
  if (actor.role !== '买手' || !actor.userId.trim() || !actor.userName.trim()) throw new Error('只有当前登录的买手可以维护 A 款到 B 款的颜色和物料转换。')
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
  if (!record) return []
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
  const activeTargetSkus = listSkuArchivesByStyleId(input.record.targetStyleId).filter((sku) => sku.archiveStatus === 'ACTIVE')
  const availableSizeNames = [...new Set(activeTargetSkus.map((sku) => sku.sizeName.trim()).filter(Boolean))]
  if (!availableSizeNames.length) throw new Error('目标款式尚未维护尺码和 SKU，请先完成商品／款式档案。')
  const requestedSizeNames = [...new Set(input.targetSizeNames.map((size) => size.trim()).filter(Boolean))]
  if (!requestedSizeNames.length) throw new Error(`目标颜色“${input.targetColor}”必须至少选择一个尺码。`)
  const invalidSize = requestedSizeNames.find((size) => !availableSizeNames.some((item) => item.toLocaleLowerCase() === size.toLocaleLowerCase()))
  if (invalidSize) throw new Error(`目标尺码“${invalidSize}”不属于当前目标款式。`)
  const canonicalSizes = requestedSizeNames.map((size) => availableSizeNames.find((item) => item.toLocaleLowerCase() === size.toLocaleLowerCase())!)
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
  requireBuyer(input.actor)
  const records = readRecords()
  const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record) throw new Error('设计改款任务不存在。')
  if (record.status !== 'DRAFT' || record.taskPlanConfirmedAt) throw new Error('本次工作安排确认后不能再修改颜色对应。')
  if (record.buyerPreparationConfirmedAt) throw new Error('新款资料准备已完成。请先由跟单退回买手修改，再调整目标颜色。')
  const at = input.confirmedAt || nowText()
  const bomSnapshot = captureEngineeringBomRepositoryState()
  const skuSnapshot = { version: 1, records: listSkuArchives() }
  const recordSnapshot = cloneRecord(record)
  try {
    applyEngineeringIndependentColorMappings({ record, actor: input.actor, mappings: input.mappings, confirmedAt: at })
    addLog(record, '确认目标颜色', input.actor, `已确认 ${record.colorMappings.length} 个目标颜色，并生成同数量的颜色物料方案。`, at)
    writeRecords(records)
    return cloneRecord(record)
  } catch (error) {
    restoreEngineeringBomRepositoryState(bomSnapshot)
    replaceSkuArchiveStore(skuSnapshot)
    const recordIndex = records.findIndex((item) => item.samplingTaskId === record.samplingTaskId)
    if (recordIndex >= 0) records[recordIndex] = recordSnapshot
    writeRecords(records)
    throw error
  }
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
  requireBuyer(input.actor)
  const records = readRecords()
  const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record) throw new Error('设计改款任务不存在。')
  if (record.buyerPreparationConfirmedAt) throw new Error('新款资料准备已完成。请先由跟单退回买手修改，再调整参考物料。')
  if (record.bomConversionStatus !== 'WAIT_MATERIAL_DECISION') throw new Error('请先确认 A 款颜色到 B 款颜色的对应。')
  if (input.decisions.length !== record.materialConversionLines.length) throw new Error('请逐行确认全部来源物料的处理方式。')
  const at = input.confirmedAt || nowText()
  const bomSnapshot = captureEngineeringBomRepositoryState()
  const recordSnapshot = cloneRecord(record)
  record.materialConversionLines.forEach((line) => {
    const decision = input.decisions.find((item) => item.conversionLineId === line.conversionLineId)
    if (!decision) throw new Error(`请确认物料“${line.sourceMaterialName}”如何处理。`)
    const targetMaterialSkuId = (decision.targetMaterialSkuId || line.sourceMaterialSkuId).trim()
    if (decision.decision === '替换' && (!targetMaterialSkuId || targetMaterialSkuId === line.sourceMaterialSkuId)) {
      throw new Error(`物料“${line.sourceMaterialName}”选择替换时，必须选择另一种 B 款物料。`)
    }
    line.decision = decision.decision
    line.targetMaterialSkuId = decision.decision === '不使用' ? '' : targetMaterialSkuId
    if (line.targetMaterialSkuId) {
      const draft = resolveEngineeringBomMaterialLine({
        materialSkuId: line.targetMaterialSkuId,
        usage: 1,
        sampleQuantity: 1,
        usageUnit: 'PCS',
        lossRate: 0,
      })
      line.targetMaterialName = draft.materialName
      line.targetMaterialImageUrl = draft.materialImageUrl || ''
    }
    line.dyeRequirement = decision.decision === '重新染色' ? '是' : decision.dyeRequirement || line.dyeRequirement
    line.printRequirement = decision.decision === '重新印花' ? '是' : decision.printRequirement || line.printRequirement
    line.note = decision.note?.trim() || ''
    line.confirmedBy = input.actor.userName
    line.confirmedAt = at
  })

  try {
    const targetVersions = record.bomVersionIds.map((versionId) => {
      const targetVersion = getEngineeringBomVersionById(versionId)
      if (!targetVersion) throw new Error('B 款颜色物料方案不存在，请重新创建打样任务。')
      const converted = record.materialConversionLines
        .filter((line) => line.targetProductColor === targetVersion.productColor && line.decision !== '不使用')
        .map((line, index) => {
          const sourceVersion = getEngineeringBomVersionById(line.sourceBomVersionId)
          const sourceLine = sourceVersion?.materialLines.find((item) => item.bomItemId === line.sourceBomItemId)
          const fallbackLine = createDefaultBomLines(record.targetStyleCode)[0]
          if (!sourceLine && !fallbackLine) throw new Error(`物料“${line.sourceMaterialName}”缺少可转换的 BOM 行，请选择 B 款物料。`)
          return {
            ...(sourceLine || fallbackLine),
            bomItemId: `${record.samplingTaskId}-B-${targetVersion.productColor}-${index + 1}`,
            materialSkuId: line.targetMaterialSkuId,
            styleCode: record.targetStyleCode,
            productColor: targetVersion.productColor,
            applicableSkuIds: [...targetVersion.applicableSkuIds],
            dyeRequirement: line.dyeRequirement,
            printRequirement: line.printRequirement,
            remark: [sourceLine?.remark, line.note, `来源：${record.sourceStyleCode} ${line.sourceProductColor}`].filter(Boolean).join('；'),
          } satisfies EngineeringBomMaterialLineDraft
        })
        .filter((line) => Boolean(line.materialSkuId))
      const sourceVersion = targetVersion.sourceVersionId
        ? getEngineeringBomVersionById(targetVersion.sourceVersionId)
        : null
      const copiedSourceLineIds = new Set((sourceVersion?.materialLines || []).map((line) => line.bomItemId).filter(Boolean))
      const manuallyAdded = targetVersion.materialLines.filter((line) =>
        !String(line.bomItemId || '').startsWith(`${record.samplingTaskId}-B-`)
        && !copiedSourceLineIds.has(line.bomItemId),
      )
      const materialLines = [...manuallyAdded, ...converted]
      return { targetVersion, materialLines }
    })

    targetVersions.forEach(({ targetVersion, materialLines }) => saveEngineeringBomVersion({
      versionId: targetVersion.bomDraftVersionId,
      role: '买手',
      userId: input.actor.userId,
      userName: input.actor.userName,
      materialLines,
      updatedAt: at,
    }))

    record.bomConversionStatus = 'WAIT_MATERIAL_DECISION'
    record.bomConversionConfirmedBy = input.actor.userName
    record.bomConversionConfirmedAt = at
    record.suggestedTaskTypes = suggestEngineeringIndependentTaskTypes(record)
    addLog(record, '应用参考物料', input.actor, `已将确认后的参考物料处理结果应用到 ${record.targetStyleCode} 的颜色物料方案。`, at)
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
  if (record.status !== 'DRAFT' || record.taskPlanConfirmedAt) throw new Error('工作安排确认后不能再完成新款资料准备。')
  const issues: string[] = []
  if (!record.colorMappings.length) issues.push('尚未确认目标颜色。')
  if (record.bomVersionIds.length !== record.colorMappings.length) issues.push('目标颜色与颜色物料方案数量不一致，请重新确认目标颜色。')
  record.materialConversionLines
    .filter((line) => !line.confirmedAt || !line.decision)
    .forEach((line) => issues.push(`新款颜色“${line.targetProductColor}”的参考物料“${line.sourceMaterialName}”尚未确认处理方式。`))
  const pricingPlan = getEngineeringBomPricingPlan('INDEPENDENT_SAMPLING', record.samplingTaskId)
  if (!pricingPlan) {
    issues.push('整款 BOM 与价格方案不存在，请重新确认目标颜色。')
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
      issues.push(`颜色物料方案 ${versionId} 不存在，请重新确认目标颜色。`)
      return
    }
    if (version.versionStatus !== 'DRAFT') issues.push(`颜色“${version.productColor}”的物料方案已交接或确认，请刷新任务状态。`)
    if (version.editingLockedAt) issues.push(`颜色“${version.productColor}”的物料方案已经锁定，请刷新任务状态。`)
    if (!version.materialLines.length) issues.push(`目标颜色“${version.productColor}”尚未维护物料。`)
    version.materialLines.forEach((line, index) => {
      try {
        const resolved = resolveEngineeringBomMaterialLine(line)
        if (resolved.priceStatus === '标准单价失效') issues.push(`颜色“${version.productColor}”第 ${index + 1} 行物料 ${resolved.materialSkuCode} 标准单价失效。`)
      } catch (error) {
        issues.push(`颜色“${version.productColor}”第 ${index + 1} 行物料不完整：${error instanceof Error ? error.message : '请检查物料、用量、打样数量、损耗率和单位。'}`)
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
  if (issues.length) throw new Error(`新款资料尚未完整：\n${issues.map((issue, index) => `${index + 1}. ${issue}`).join('\n')}`)
  const at = input.completedAt || nowText()
  const bomSnapshot = captureEngineeringBomRepositoryState()
  const recordSnapshot = cloneRecord(record)
  try {
    setEngineeringBomVersionsEditingLock({
      versionIds: record.bomVersionIds,
      locked: true,
      actorName: input.actor.userName,
      changedAt: at,
      reason: '买手已完成新款资料准备',
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
    addLog(record, '完成新款资料准备', input.actor, `已一次确认 ${record.colorMappings.length} 个目标颜色、全部颜色物料及整款费用，资料已锁定并交给跟单。`, at)
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
  requireMerchandiser(input.actor)
  const records = readRecords()
  const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record) throw new Error('设计改款任务不存在。')
  if (record.merchandiserId !== input.actor.userId) throw new Error('只有任务跟单本人可以退回新款资料准备。')
  if (record.status !== 'DRAFT' || !record.buyerPreparationConfirmedAt || record.taskPlanConfirmedAt) {
    throw new Error('只有买手已完成、工作安排尚未确认时才能退回修改。')
  }
  const reason = input.reason.trim()
  if (!reason) throw new Error('请填写退回买手修改的原因。')
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
    addLog(record, '退回新款资料准备', input.actor, `退回买手修改：${reason}。目标颜色与 BOM 已重新开放维护。`, at)
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
  requireBuyer(input.actor)
  const records = readRecords()
  const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record) throw new Error('设计改款任务不存在。')
  if (record.status !== 'DRAFT' || record.taskPlanConfirmedAt || record.buyerPreparationConfirmedAt) {
    throw new Error('新款资料准备完成后不能重新生成 BOM。请先由跟单退回买手修改。')
  }
  const targetColor = input.targetColor.trim()
  const mapping = record.colorMappings.find((item) => normalizeColorKey(item.targetColor) === normalizeColorKey(targetColor))
  if (!mapping) throw new Error('未找到该新款颜色。')
  if (!mapping.sourceColor) throw new Error('该新款颜色没有选择旧款参考色，不能按参考色重新生成。')
  const sourceVersion = listEngineeringBomHistory(record.sourceStyleCode, mapping.sourceColor)[0]
  if (!sourceVersion) throw new Error('旧款参考色没有已完成确认或正式技术包 BOM，不能重新生成。')
  const targetVersion = record.bomVersionIds
    .map(getEngineeringBomVersionById)
    .find((version) => version && normalizeColorKey(version.productColor) === normalizeColorKey(mapping.targetColor))
  if (!targetVersion) throw new Error('新款颜色对应的物料方案不存在。')
  const at = input.regeneratedAt || nowText()
  const bomSnapshot = captureEngineeringBomRepositoryState()
  const recordSnapshot = cloneRecord(record)
  try {
    regenerateEngineeringBomVersionFromSource({
      targetVersionId: targetVersion.bomDraftVersionId,
      sourceVersionId: sourceVersion.bomDraftVersionId,
      role: '买手',
      userId: input.actor.userId,
      userName: input.actor.userName,
      regeneratedAt: at,
    })
    record.materialConversionLines = record.materialConversionLines.filter((line) => line.targetProductColor !== mapping.targetColor)
    record.materialConversionLines.push(...sourceVersion.materialLines.map((line, index) => {
      const resolved = resolveEngineeringBomMaterialLine(line)
      return {
        conversionLineId: `${record.samplingTaskId}-CONVERT-${mapping.mappingId}-${index + 1}`,
        sourceBomVersionId: sourceVersion.bomDraftVersionId,
        sourceBomItemId: line.bomItemId || `${sourceVersion.bomDraftVersionId}-LINE-${index + 1}`,
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
    addLog(record, '按参考色重新生成 BOM', input.actor, `${mapping.targetColor} 已重新采用 ${mapping.sourceColor} 的 ${sourceVersion.versionCode}，原有手工修改已被重置。`, at)
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

export function suggestEngineeringIndependentTaskTypes(recordOrId: EngineeringIndependentSamplingRecord | string): EngineeringIndependentProfessionalTaskType[] {
  const record = typeof recordOrId === 'string' ? getEngineeringIndependentSamplingRecord(recordOrId) : recordOrId
  if (!record) return []
  const suggestions = new Set<EngineeringIndependentProfessionalTaskType>(['BASE_PATTERN', 'DISPLAY_SAMPLE'])
  const bomLines = record.bomVersionIds.map(getEngineeringBomVersionById).flatMap((version) => version?.materialLines || [])
  if (bomLines.some((line) => line.printRequirement === '是')) suggestions.add('PATTERN_ARTWORK')
  bomLines.filter((line) => line.dyeRequirement === '是').forEach((line) => {
    if ((line.materialType || '').includes('纱') || (line.materialType || '').includes('毛')) suggestions.add('COLOR_YARN')
    else suggestions.add('COLOR_FABRIC')
  })
  return [...suggestions]
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
    return '跟单'
  }
  return task.ownerTeamName
}

export function getEngineeringIndependentCurrentTeams(
  recordOrId: EngineeringIndependentSamplingRecord | string,
): string[] {
  const record = typeof recordOrId === 'string' ? getEngineeringIndependentSamplingRecord(recordOrId) : recordOrId
  if (!record || record.status === 'COMPLETED') return []
  if (record.status === 'DRAFT') {
    return [record.buyerPreparationConfirmedAt ? '跟单' : '买手']
  }
  if (record.status === 'WAIT_CONFIRMATION') return ['跟单']
  const teams = record.professionalTasks
    .filter((task) => ['WAIT_START', 'IN_PROGRESS', 'WAIT_REVIEW', 'REWORK'].includes(task.status))
    .map(getEngineeringIndependentProfessionalTaskCurrentTeam)
    .filter(Boolean)
  return [...new Set(teams.length ? teams : ['跟单'])]
}

export function getEngineeringIndependentSamplingStep(
  recordOrId: EngineeringIndependentSamplingRecord | string,
): EngineeringIndependentSamplingStep {
  const record = typeof recordOrId === 'string' ? getEngineeringIndependentSamplingRecord(recordOrId) : recordOrId
  if (!record || record.status === 'COMPLETED') return 'COMPLETED'
  if (record.status === 'DRAFT' && !record.buyerPreparationConfirmedAt) return 'BUYER_PREPARATION'
  if (record.status === 'DRAFT') return 'WORK_PLAN'
  if (record.status === 'WAIT_CONFIRMATION') return 'RESULT_CONFIRMATION'
  return 'PROFESSIONAL_WORK'
}

function normalizeIndependentSampleRequirements(
  record: EngineeringIndependentSamplingRecord,
  requirements: Array<Pick<EngineeringSampleRequirementLine, 'targetColor' | 'targetSize' | 'requiredQuantity' | 'requirementNote'> & { requirementLineId?: string }> | undefined,
  issuedBy: string,
  issuedAt: string,
): EngineeringSampleRequirementLine[] {
  const source: Array<Pick<EngineeringSampleRequirementLine, 'targetColor' | 'targetSize' | 'requiredQuantity' | 'requirementNote'> & { requirementLineId?: string }> = requirements?.length
    ? requirements
    : record.colorMappings.flatMap((mapping) => mapping.targetSizeNames.map((targetSize) => ({
      targetColor: mapping.targetColor,
      targetSize,
      requiredQuantity: 1,
      requirementNote: '',
    })))
  if (!source.length) throw new Error('请先下达销售展示样衣的颜色、尺码和要求数量。')
  const allowed = new Set(record.colorMappings.flatMap((mapping) =>
    mapping.targetSizeNames.map((size) => `${mapping.targetColor}\u0000${size}`),
  ))
  const seen = new Set<string>()
  return source.map((line, index) => {
    const targetColor = line.targetColor.trim()
    const targetSize = line.targetSize.trim()
    const quantity = Number(line.requiredQuantity)
    const key = `${targetColor}\u0000${targetSize}`
    if (!targetColor || !targetSize) throw new Error('请完整填写销售展示样衣的颜色和尺码。')
    if (!allowed.has(key)) throw new Error(`“${targetColor} / ${targetSize}”不属于买手已确认的新款颜色与尺码。`)
    if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('销售展示样衣要求数量必须为大于 0 的整数。')
    if (seen.has(key)) throw new Error(`销售展示样衣制作要求重复：${targetColor} / ${targetSize}。`)
    seen.add(key)
    return {
      requirementLineId: line.requirementLineId?.trim() || `${record.samplingTaskId}-DISPLAY-REQ-${index + 1}`,
      targetColor,
      targetSize,
      requiredQuantity: quantity,
      requirementNote: line.requirementNote.trim(),
      issuedBy,
      issuedAt,
    }
  })
}

function createProfessionalTasks(
  record: EngineeringIndependentSamplingRecord,
  selected: EngineeringIndependentProfessionalTaskType[],
  createdAt: string,
  sampleRequirements: EngineeringSampleRequirementLine[] = [],
): EngineeringIndependentProfessionalTask[] {
  const selectedSet = new Set(selected)
  if (selectedSet.has('DISPLAY_SAMPLE')) selectedSet.add('BASE_PATTERN')
  return [...selectedSet].map((taskType) => {
    const meta = TASK_META[taskType]
    const dependency = taskType === 'DISPLAY_SAMPLE' ? `${record.samplingTaskId}-BASE_PATTERN` : ''
    return {
      taskId: `${record.samplingTaskId}-${taskType}`, taskType, taskName: meta.name, ownerTeamName: meta.team,
      status: dependency ? 'WAIT_DEPENDENCY' : 'WAIT_START', dependsOnTaskIds: dependency ? [dependency] : [],
      plannedCompleteAt: createdAt.slice(0, 10), startedAt: '', submittedAt: '', completedAt: '',
      pantoneColorCode: '', colorName: '', dyeColorCode: '', results: [],
      colorRequirementConfirmedBy: '', colorRequirementConfirmedAt: '',
      sampleRequirements: taskType === 'DISPLAY_SAMPLE' ? sampleRequirements.map(cloneSampleRequirement) : [],
    }
  })
}

export function confirmEngineeringIndependentSamplingPlan(input: {
  samplingTaskId: string
  actor: { role: string; userId: string; userName: string }
  selectedTaskTypes: EngineeringIndependentProfessionalTaskType[]
  sampleRequirements?: Array<Pick<EngineeringSampleRequirementLine, 'targetColor' | 'targetSize' | 'requiredQuantity' | 'requirementNote'> & { requirementLineId?: string }>
  confirmedAt?: string
}): EngineeringIndependentSamplingRecord {
  requireMerchandiser(input.actor)
  const records = readRecords(); const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record) throw new Error('设计改款任务不存在。')
  if (record.merchandiserId !== input.actor.userId) throw new Error('只有任务跟单本人可以确认任务方案。')
  if (record.status !== 'DRAFT') throw new Error('只有草稿任务可以确认任务方案。')
  if (!record.buyerPreparationConfirmedAt || record.bomConversionStatus !== 'CONFIRMED') throw new Error('请先由买手完成目标颜色及整款 BOM 与价格方案。')
  const incompleteBom = record.bomVersionIds.map(getEngineeringBomVersionById).find((version) => version && version.materialLines.length === 0)
  if (incompleteBom) throw new Error(`B 款颜色“${incompleteBom.productColor}”尚未维护物料，不能确认本次工作安排。`)
  if (!input.selectedTaskTypes.length) throw new Error('请至少选择一个专业任务。')
  if (!input.selectedTaskTypes.includes('DISPLAY_SAMPLE')) throw new Error('设计改款任务必须包含销售展示样衣任务。')
  const at = input.confirmedAt || nowText()
  const sampleRequirements = normalizeIndependentSampleRequirements(record, input.sampleRequirements, input.actor.userName, at)
  record.suggestedTaskTypes = suggestEngineeringIndependentTaskTypes(record)
  record.selectedTaskTypes = [...new Set(input.selectedTaskTypes)]
  record.professionalTasks = createProfessionalTasks(record, record.selectedTaskTypes, at, sampleRequirements)
  record.relatedProfessionalTaskIds = record.professionalTasks.map((task) => task.taskId)
  record.taskPlanConfirmedBy = input.actor.userName
  record.taskPlanConfirmedAt = at
  record.status = 'IN_PROGRESS'
  addLog(record, '确认本次工作安排', input.actor, `已一次生成 ${record.professionalTasks.length} 个专业任务，并下达 ${sampleRequirements.length} 行销售展示样衣制作要求。`, at)
  writeRecords(records); return cloneRecord(record)
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
  if (actor.role !== requiredExecutionRole(task) || !actor.userId.trim() || !actor.userName.trim()) {
    throw new Error(`当前应由${requiredExecutionRole(task)}处理${task.taskName}。`)
  }
}

export function startEngineeringIndependentProfessionalTask(input: { taskId: string; actor: { role?: string; userId: string; userName: string }; startedAt?: string }): EngineeringIndependentSamplingRecord {
  const records = readRecords(); const { record, task } = findTask(records, input.taskId)
  if ((task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && !task.colorRequirementConfirmedAt) {
    throw new Error('请先由跟单填写并确认潘通色号和颜色名称，再由染厂开始调色。')
  }
  requireTaskExecutor(task, input.actor)
  if (task.status !== 'WAIT_START') throw new Error('当前专业任务尚不能开始。')
  task.status = 'IN_PROGRESS'; task.startedAt = input.startedAt || nowText(); addLog(record, '开始专业任务', input.actor, `${task.taskName}开始执行。`, task.startedAt)
  writeRecords(records); return cloneRecord(record)
}

export function confirmEngineeringIndependentColorRequirement(input: { taskId: string; actor: { role: string; userId: string; userName: string }; pantoneColorCode: string; colorName: string; confirmedAt?: string }): EngineeringIndependentSamplingRecord {
  requireMerchandiser(input.actor)
  const records = readRecords(); const { record, task } = findTask(records, input.taskId)
  if (!['COLOR_YARN', 'COLOR_FABRIC'].includes(task.taskType)) throw new Error('当前任务不是调色任务。')
  if (!['WAIT_START', 'IN_PROGRESS', 'REWORK'].includes(task.status)) throw new Error('当前调色任务不能维护颜色要求。')
  if (!input.pantoneColorCode.trim() || !input.colorName.trim()) throw new Error('请完整填写潘通色号和颜色名称。')
  task.pantoneColorCode = input.pantoneColorCode.trim()
  task.colorName = input.colorName.trim()
  task.colorRequirementConfirmedBy = input.actor.userName
  task.colorRequirementConfirmedAt = input.confirmedAt || nowText()
  addLog(record, '跟单确认颜色要求', input.actor, `${task.taskName}颜色要求：${task.pantoneColorCode} / ${task.colorName}。`, task.colorRequirementConfirmedAt)
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
    const availablePatternVersions = new Set(record.professionalTasks
      .filter((item) => task.dependsOnTaskIds.includes(item.taskId) && item.taskType === 'BASE_PATTERN' && item.status === 'COMPLETED')
      .flatMap((item) => item.results.filter((result) => result.status === 'APPROVED').map((result) => result.version.trim()))
      .filter(Boolean))
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
  if ((task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && (!task.colorRequirementConfirmedAt || !task.pantoneColorCode || !task.colorName)) throw new Error('请先由跟单确认潘通色号和颜色名称。')
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
  if (input.actor.role !== '买手') throw new Error('只有当前登录买手可以审核花型或调色成果。')
  const records = readRecords(); const { record, task } = findTask(records, input.taskId)
  if (task.status !== 'WAIT_REVIEW') throw new Error('当前任务没有待审核成果。')
  const at = input.reviewedAt || nowText()
  task.results.forEach((result) => { const decision = input.decisions.find((item) => item.resultId === result.resultId); if (!decision) throw new Error(`请审核成果：${result.title}`); if (!decision.approved && !decision.reason?.trim()) throw new Error(`请填写未通过原因：${result.title}`); result.status = decision.approved ? 'APPROVED' : 'REJECTED'; result.rejectReason = decision.approved ? '' : decision.reason!.trim() })
  const allApproved = task.results.every((result) => result.status === 'APPROVED')
  task.status = allApproved ? 'COMPLETED' : 'REWORK'; if (allApproved) { task.completedAt = at; unlockDependents(record, task.taskId) }
  addLog(record, allApproved ? '买手审核通过' : '买手退回返工', input.actor, allApproved ? `${task.taskName}全部成果通过。` : `${task.taskName}未通过项需要返工。`, at); refreshParentStatus(record); writeRecords(records); return cloneRecord(record)
}

export function confirmEngineeringIndependentSamplingResult(input: { samplingTaskId: string; actor: { role: string; userId: string; userName: string }; resultVersion: string; resultSummary: string; confirmedAt: string }): EngineeringIndependentSamplingRecord {
  requireMerchandiser(input.actor); const records = readRecords(); const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record) throw new Error('设计改款任务不存在。')
  if (record.merchandiserId !== input.actor.userId) throw new Error('只有任务跟单本人可以确认整张任务成果。')
  if (record.status !== 'WAIT_CONFIRMATION') throw new Error('全部专业任务完成后才能确认整张成果。')
  if (!input.resultVersion.trim() || !input.resultSummary.trim()) throw new Error('请完整填写成果版本和成果摘要。')
  record.status = 'COMPLETED'; record.resultVersion = input.resultVersion.trim(); record.resultSummary = input.resultSummary.trim(); record.confirmedBy = input.actor.userName; record.confirmedAt = input.confirmedAt
  addLog(record, '确认整张成果', input.actor, `成果版本 ${record.resultVersion} 已确认。`, input.confirmedAt); writeRecords(records); syncDesignRevisionProjectRelation(record); return cloneRecord(record)
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

// 工程主单只能选择整单已确认、且专业任务自身已完成的成果。返回顺序即推荐顺序：最近确认优先。
export function listReusableEngineeringIndependentProfessionalResults(
  targetStyleCode: string,
): EngineeringIndependentReusableProfessionalResult[] {
  return listReusableEngineeringIndependentSamplingResults(targetStyleCode).flatMap((record) =>
    record.professionalTasks
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
      })),
  )
}

export function setEngineeringIndependentSamplingReuseDecision(input: { samplingTaskId: string; decision: 'REUSE' | 'REDO' | 'IGNORE'; actor: { role: string; userId: string; userName: string }; decidedAt?: string }): EngineeringIndependentSamplingRecord {
  requireMerchandiser(input.actor); const records = readRecords(); const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record || record.status !== 'COMPLETED') throw new Error('只能选择已完成且已确认的前期成果。')
  record.reuseDecision = input.decision; addLog(record, '工程主单成果选择', input.actor, `本次选择：${input.decision === 'REUSE' ? '复用' : input.decision === 'REDO' ? '重做' : '不采用'}。`, input.decidedAt || nowText()); writeRecords(records); return cloneRecord(record)
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

export function resetEngineeringIndependentSamplingRepository(seed = true): void {
  memoryRecords = seed ? seedRecords() : []
  if (canUseStorage()) localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryRecords))
}
