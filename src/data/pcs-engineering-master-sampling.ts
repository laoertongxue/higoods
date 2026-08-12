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
  EngineeringIndependentSamplingType,
} from './pcs-engineering-master-types.ts'
import { getStyleArchiveById, listStyleArchives } from './pcs-style-archive-repository.ts'
import { listSkuArchivesByStyleId } from './pcs-sku-archive-repository.ts'
import {
  captureEngineeringBomRepositoryState,
  confirmEngineeringBomVersion,
  createEngineeringBomVersionsForOwner,
  getEngineeringBomVersionById,
  listEngineeringBomHistory,
  restoreEngineeringBomRepositoryState,
  saveEngineeringBomVersion,
} from './pcs-engineering-bom-repository.ts'
import type { EngineeringUploadedFile } from './pcs-engineering-file-upload.ts'
import { assertEngineeringUploadedFilesReady } from './pcs-engineering-file-upload.ts'

const STORAGE_KEY = 'higood-pcs-independent-sampling-v6'
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
    files: (result.files || []).map((file) => ({ ...file })),
  }
}

function cloneTask(task: EngineeringIndependentProfessionalTask): EngineeringIndependentProfessionalTask {
  return {
    ...task,
    colorRequirementConfirmedBy: task.colorRequirementConfirmedBy || '',
    colorRequirementConfirmedAt: task.colorRequirementConfirmedAt || '',
    dependsOnTaskIds: [...task.dependsOnTaskIds],
    results: task.results.map(cloneResult),
  }
}

function cloneRecord(record: EngineeringIndependentSamplingRecord): EngineeringIndependentSamplingRecord {
  return {
    ...record,
    relatedProfessionalTaskIds: [...record.relatedProfessionalTaskIds],
    professionalTasks: record.professionalTasks.map(cloneTask),
    selectedTaskTypes: [...record.selectedTaskTypes],
    suggestedTaskTypes: [...record.suggestedTaskTypes],
    colorMappings: record.colorMappings.map((item) => ({ ...item, targetSkuIds: [...item.targetSkuIds] })),
    materialConversionLines: record.materialConversionLines.map((item) => ({ ...item })),
    bomVersionIds: [...(record.bomVersionIds || (record.bomDraftVersionId ? [record.bomDraftVersionId] : []))],
    operationLogs: record.operationLogs.map((log) => ({ ...log })),
  }
}

function normalizeRecord(record: EngineeringIndependentSamplingRecord): EngineeringIndependentSamplingRecord {
  return {
    ...record,
    relatedProfessionalTaskIds: Array.isArray(record.relatedProfessionalTaskIds) ? record.relatedProfessionalTaskIds : [],
    professionalTasks: Array.isArray(record.professionalTasks) ? record.professionalTasks.map(cloneTask) : [],
    selectedTaskTypes: Array.isArray(record.selectedTaskTypes) ? record.selectedTaskTypes : [],
    suggestedTaskTypes: Array.isArray(record.suggestedTaskTypes) ? record.suggestedTaskTypes : [],
    taskPlanConfirmedBy: record.taskPlanConfirmedBy || '',
    taskPlanConfirmedAt: record.taskPlanConfirmedAt || '',
    creationReason: record.creationReason || '',
    colorMappings: Array.isArray(record.colorMappings) ? record.colorMappings.map((item) => ({ ...item, targetSkuIds: [...(item.targetSkuIds || [])] })) : [],
    materialConversionLines: Array.isArray(record.materialConversionLines) ? record.materialConversionLines.map((item) => ({ ...item })) : [],
    bomConversionStatus: record.bomConversionStatus || (record.samplingType === 'REVISION' ? 'WAIT_COLOR_MAPPING' : 'NOT_REQUIRED'),
    bomConversionConfirmedBy: record.bomConversionConfirmedBy || '',
    bomConversionConfirmedAt: record.bomConversionConfirmedAt || '',
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
    shrinkRequirementText: '无',
    washRequirementText: '无',
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
  const operator = purpose === 'PATTERN_SOURCE'
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
  const statuses = ['DRAFT', 'IN_PROGRESS', 'WAIT_CONFIRMATION', 'COMPLETED', 'IN_PROGRESS', 'COMPLETED'] as const
  return Array.from({ length: 24 }, (_, index) => {
    const target = styles[index % styles.length]
    const type: EngineeringIndependentSamplingType = index % 2 === 0 ? 'REVISION' : 'DESIGN'
    const source = type === 'REVISION' ? styles[(index + 1) % styles.length] : undefined
    const createdAt = `2026-07-${String(index + 1).padStart(2, '0')} 09:00:00`
    const selected: EngineeringIndependentProfessionalTaskType[] = index % 3 === 0
      ? ['BASE_PATTERN', 'DISPLAY_SAMPLE', 'PATTERN_ARTWORK']
      : ['PATTERN_ARTWORK', index % 2 ? 'COLOR_FABRIC' : 'COLOR_YARN']
    const record = buildRecord({
      samplingType: type,
      sourceStyleId: source?.styleId,
      targetStyleId: target.styleId,
      creationReason: type === 'REVISION' ? '基于现有款式调整版型和颜色后制作销售展示样衣。' : '根据设计资料制作销售展示样衣。',
      merchandiser: actor,
      createdAt,
    }, `ES-${type === 'REVISION' ? 'R' : 'D'}-${String(index + 1).padStart(3, '0')}`)
    const defaultLines = createDefaultBomLines(target.styleCode).map((line) => ({
      ...line,
      printRequirement: index % 3 === 0 ? '是' as const : '否' as const,
      printRequirementText: index % 3 === 0 ? '满印花型' : '无',
      dyeRequirement: index % 4 === 0 ? '是' as const : '否' as const,
      purchaseRequirement: index % 5 === 0 ? '是' as const : '否' as const,
    }))
    record.bomVersionIds.forEach((versionId, versionIndex) => {
      const version = getEngineeringBomVersionById(versionId)
      if (!version || !defaultLines.length) return
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
    if (type === 'REVISION') {
      const sourceColors = source ? [...new Set(listSkuArchivesByStyleId(source.styleId).map((sku) => sku.colorName || '待确认颜色'))] : []
      const targetGroups = new Map<string, string[]>()
      listSkuArchivesByStyleId(target.styleId).forEach((sku) => targetGroups.set(sku.colorName || '待确认颜色', [...(targetGroups.get(sku.colorName || '待确认颜色') || []), sku.skuId]))
      record.colorMappings = [...targetGroups.entries()].map(([targetColor, skuIds], mappingIndex) => {
        // 演示数据必须同时覆盖两种真实改款场景：一个 A 款颜色对应多个 B 款颜色，
        // 以及 B 款新增一个没有 A 款来源的颜色。两种场景分开放在不同改款单中。
        const sourceColor = index === 0
          ? sourceColors[0] || ''
          : index === 2 && mappingIndex === 1
            ? ''
            : sourceColors[mappingIndex % Math.max(1, sourceColors.length)] || ''
        return {
          mappingId: `${record.samplingTaskId}-COLOR-${mappingIndex + 1}`,
          sourceColor,
          targetColor,
          targetSkuIds: skuIds,
          mappingType: sourceColor ? (mappingIndex === 1 ? '改为新颜色' : '沿用颜色') : 'B 款新增颜色',
          confirmedBy: '买手-阿乐',
          confirmedAt: createdAt,
        }
      })
      record.materialConversionLines = defaultLines.map((line, lineIndex) => ({
        conversionLineId: `${record.samplingTaskId}-CONVERT-${lineIndex + 1}`,
        sourceBomVersionId: '',
        sourceBomItemId: line.bomItemId || `${record.samplingTaskId}-SOURCE-${lineIndex + 1}`,
        sourceProductColor: record.colorMappings[0]?.sourceColor || '',
        sourceMaterialSkuId: line.materialSkuId,
        sourceMaterialName: resolveEngineeringBomMaterialLine(line).materialName,
        sourceMaterialImageUrl: line.materialImageUrl || '',
        targetProductColor: record.colorMappings[0]?.targetColor || '',
        decision: index % 4 === 0 ? '重新染色' : '沿用',
        targetMaterialSkuId: line.materialSkuId,
        targetMaterialName: resolveEngineeringBomMaterialLine(line).materialName,
        targetMaterialImageUrl: line.materialImageUrl || '',
        dyeRequirement: index % 4 === 0 ? '是' : '否',
        printRequirement: index % 3 === 0 ? '是' : '否',
        note: index % 4 === 0 ? '按 B 款颜色重新染色' : '沿用来源物料',
        confirmedBy: '买手-阿乐',
        confirmedAt: createdAt,
      }))
      record.bomConversionStatus = 'CONFIRMED'
      record.bomConversionConfirmedBy = '买手-阿乐'
      record.bomConversionConfirmedAt = createdAt
    }
    // STYLE-PRJ-202603-011 同时提供一条已完成且已确认的前期成果，供工程主单
    // 草稿 EM-002 在命名页面演示“复用／重做／不采用”。其余场景仍保留进行中与返工。
    const seedStatus = index === 1 ? 'COMPLETED' : statuses[index % statuses.length]
    if (seedStatus !== 'DRAFT') {
      record.professionalTasks = createProfessionalTasks(record, selected, createdAt)
      record.relatedProfessionalTaskIds = record.professionalTasks.map((task) => task.taskId)
      record.status = seedStatus
      if (record.status === 'WAIT_CONFIRMATION' || record.status === 'COMPLETED') {
        record.professionalTasks.forEach((task) => {
          task.status = 'COMPLETED'; task.startedAt = createdAt; task.submittedAt = createdAt; task.completedAt = createdAt
          task.results = [{
            resultId: `${task.taskId}-R1`,
            title: `${task.taskName}成果`,
            version: 'v1.0',
            description: task.taskType === 'DISPLAY_SAMPLE' ? '已按目标款式完成销售展示样衣。' : '本轮成果已完成。',
            applicablePartOrSize: task.taskType === 'BASE_PATTERN' ? '基码 / M 码' : '',
            sampleQuantity: task.taskType === 'DISPLAY_SAMPLE' ? 1 : 0,
            sampleColor: task.taskType === 'DISPLAY_SAMPLE' ? '目标款主色' : '',
            sampleSize: task.taskType === 'DISPLAY_SAMPLE' ? 'M' : '',
            sourcePatternVersion: task.taskType === 'DISPLAY_SAMPLE' ? '基码纸样 v1.0' : '',
            imageUrl: target.mainImageUrl,
            files: [createSeedUploadedFile(task.taskId, task.taskType === 'BASE_PATTERN' ? 'PATTERN_SOURCE' : task.taskType === 'DISPLAY_SAMPLE' ? 'SAMPLE_RESULT' : task.taskType === 'PATTERN_ARTWORK' ? 'PATTERN_ARTWORK' : 'COLOR_RESULT', target.mainImageUrl, createdAt)],
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
        record.bomVersionIds.forEach((versionId) => {
          const version = getEngineeringBomVersionById(versionId)
          if (version?.versionStatus === 'DRAFT' && version.materialLines.length) {
            confirmEngineeringBomVersion({ versionId, role: '买手', userId: 'U-BUYER-DEMO', userName: '买手-阿乐', confirmedAt: createdAt })
          }
        })
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
  if (actor.role !== '跟单' || !actor.userId.trim() || !actor.userName.trim()) throw new Error('只有当前登录的跟单可以操作独立改款或设计打样任务。')
}

function addLog(record: EngineeringIndependentSamplingRecord, action: string, actor: { userId: string; userName: string }, detail: string, occurredAt = nowText()): void {
  record.operationLogs.unshift({ logId: `${record.samplingTaskId}-LOG-${record.operationLogs.length + 1}`, action, operatorId: actor.userId, operatorName: actor.userName, occurredAt, detail })
  record.updatedAt = occurredAt
}

export interface CreateEngineeringIndependentSamplingInput {
  samplingType: EngineeringIndependentSamplingType
  sourceStyleId?: string
  targetStyleId: string
  creationReason: string
  merchandiser: { role: string; userId: string; userName: string }
  createdAt: string
}

function buildRecord(input: CreateEngineeringIndependentSamplingInput, code: string): EngineeringIndependentSamplingRecord {
  requireMerchandiser(input.merchandiser)
  const target = getStyleArchiveById(input.targetStyleId)
  if (!target) throw new Error('目标商品／款式档案不存在。')
  const source = input.sourceStyleId ? getStyleArchiveById(input.sourceStyleId) : null
  if (input.samplingType === 'REVISION') {
    if (!source) throw new Error('改款打样的来源商品／款式档案不存在。')
    if (source.styleId === target.styleId || source.styleCode === target.styleCode) throw new Error('改款打样的来源 SPU 与目标 SPU 不能相同。')
  }
  if (input.samplingType === 'DESIGN' && input.sourceStyleId) throw new Error('设计打样不应填写来源 SPU，请改用改款打样。')
  const creationReason = input.creationReason?.trim() || ''
  if (!creationReason) throw new Error('请填写本次打样原因。')
  const taskId = code.replace(/^ES-/, 'ES-ID-')
  const bomVersions = createEngineeringBomVersionsForOwner({
    ownerStage: 'INDEPENDENT_SAMPLING',
    ownerId: taskId,
    ownerCode: code,
    styleId: target.styleId,
    createdBy: input.merchandiser.userName,
    createdAt: input.createdAt,
  })
  const record: EngineeringIndependentSamplingRecord = {
    samplingTaskId: taskId, samplingTaskCode: code, samplingType: input.samplingType,
    sourceStyleId: source?.styleId || '', sourceStyleCode: source?.styleCode || '',
    targetStyleId: target.styleId, targetStyleCode: target.styleCode, targetStyleName: target.styleName,
    status: 'DRAFT', creationReason, merchandiserId: input.merchandiser.userId, merchandiserName: input.merchandiser.userName,
    relatedProfessionalTaskIds: [], professionalTasks: [],
    bomDraftVersionId: bomVersions[0]?.bomDraftVersionId || '',
    bomVersionIds: bomVersions.map((version) => version.bomDraftVersionId),
    resultVersion: '', resultSummary: '', confirmedBy: '', confirmedAt: '',
    selectedTaskTypes: [], suggestedTaskTypes: [], taskPlanConfirmedBy: '', taskPlanConfirmedAt: '',
    colorMappings: [], materialConversionLines: [],
    bomConversionStatus: input.samplingType === 'REVISION' ? 'WAIT_COLOR_MAPPING' : 'NOT_REQUIRED',
    bomConversionConfirmedBy: '', bomConversionConfirmedAt: '', sourceResultVersionId: '', reuseDecision: 'PENDING',
    operationLogs: [], createdBy: input.merchandiser.userName, createdAt: input.createdAt, updatedAt: input.createdAt,
  }
  addLog(record, '创建任务', input.merchandiser, `${input.samplingType === 'REVISION' ? '改款' : '设计'}打样任务已创建：${record.creationReason}`, input.createdAt)
  return record
}

export function createEngineeringIndependentSampling(input: CreateEngineeringIndependentSamplingInput): EngineeringIndependentSamplingRecord {
  const records = readRecords()
  const code = `ES-${input.samplingType === 'REVISION' ? 'R' : 'D'}-${String(records.length + 1).padStart(3, '0')}`
  const bomSnapshot = captureEngineeringBomRepositoryState()
  try {
    const record = buildRecord(input, code)
    writeRecords([...records, record])
    return cloneRecord(record)
  } catch (error) {
    restoreEngineeringBomRepositoryState(bomSnapshot)
    throw error
  }
}

export function listEngineeringIndependentSamplingRecords(type?: EngineeringIndependentSamplingType): EngineeringIndependentSamplingRecord[] {
  return readRecords().filter((record) => !type || record.samplingType === type).map(cloneRecord)
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
  if (!record || record.samplingType !== 'REVISION') return []
  return listEngineeringBomHistory(record.sourceStyleCode)
}

export function getEngineeringIndependentTargetColorGroups(samplingTaskId: string): Array<{ productColor: string; skuIds: string[] }> {
  const record = getEngineeringIndependentSamplingRecord(samplingTaskId)
  if (!record) return []
  const groups = new Map<string, string[]>()
  listSkuArchivesByStyleId(record.targetStyleId).forEach((sku) => {
    const productColor = sku.colorName.trim() || '待确认颜色'
    groups.set(productColor, [...(groups.get(productColor) || []), sku.skuId])
  })
  return [...groups.entries()].map(([productColor, skuIds]) => ({ productColor, skuIds }))
}

export function confirmEngineeringIndependentColorMappings(input: {
  samplingTaskId: string
  actor: { role: string; userId: string; userName: string }
  mappings: Array<{ targetColor: string; sourceColor: string; mappingType: EngineeringIndependentColorMapping['mappingType'] }>
  confirmedAt?: string
}): EngineeringIndependentSamplingRecord {
  requireBuyer(input.actor)
  const records = readRecords()
  const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record || record.samplingType !== 'REVISION') throw new Error('仅改款打样需要维护 A 款到 B 款的颜色对应。')
  if (record.status !== 'DRAFT' || record.taskPlanConfirmedAt) throw new Error('本次工作安排确认后不能再修改颜色对应。')
  const targetGroups = getEngineeringIndependentTargetColorGroups(record.samplingTaskId)
  if (input.mappings.length !== targetGroups.length) throw new Error('请逐个确认 B 款所有颜色的来源。')
  const sourceColors = new Set(listSkuArchivesByStyleId(record.sourceStyleId).map((sku) => sku.colorName.trim() || '待确认颜色'))
  const at = input.confirmedAt || nowText()
  record.colorMappings = targetGroups.map((group, index) => {
    const mapping = input.mappings.find((item) => item.targetColor === group.productColor)
    if (!mapping) throw new Error(`请确认 B 款颜色“${group.productColor}”对应的 A 款颜色。`)
    if (mapping.mappingType !== 'B 款新增颜色' && (!mapping.sourceColor || !sourceColors.has(mapping.sourceColor))) {
      throw new Error(`B 款颜色“${group.productColor}”尚未选择有效的 A 款来源颜色。`)
    }
    return {
      mappingId: `${record.samplingTaskId}-COLOR-${index + 1}`,
      sourceColor: mapping.mappingType === 'B 款新增颜色' ? '' : mapping.sourceColor,
      targetColor: group.productColor,
      targetSkuIds: [...group.skuIds],
      mappingType: mapping.mappingType,
      confirmedBy: input.actor.userName,
      confirmedAt: at,
    }
  })
  record.materialConversionLines = record.colorMappings.flatMap((mapping) => {
    if (!mapping.sourceColor) return []
    const sourceVersion = listEngineeringBomHistory(record.sourceStyleCode, mapping.sourceColor)[0]
    if (!sourceVersion) return []
    return sourceVersion.materialLines.map((line, index) => {
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
    })
  })
  record.bomConversionStatus = 'WAIT_MATERIAL_DECISION'
  record.bomConversionConfirmedBy = ''
  record.bomConversionConfirmedAt = ''
  addLog(record, '确认颜色对应', input.actor, `已确认 ${record.colorMappings.length} 个 B 款颜色的来源。`, at)
  writeRecords(records)
  return cloneRecord(record)
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
  if (!record || record.samplingType !== 'REVISION') throw new Error('仅改款打样需要确认 A 款物料如何转成 B 款物料。')
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
      if (!targetVersion) throw new Error('B 款 BOM 与价格草稿不存在，请重新创建打样任务。')
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
        .filter((line): line is EngineeringBomMaterialLineDraft => Boolean(line.materialSkuId))
      const manuallyAdded = targetVersion.materialLines.filter((line) => !String(line.bomItemId || '').startsWith(`${record.samplingTaskId}-B-`))
      const materialLines = [...manuallyAdded, ...converted]
      if (materialLines.length === 0) throw new Error(`B 款颜色“${targetVersion.productColor}”尚无物料，请先在 BOM 与价格中新增物料。`)
      return { targetVersion, materialLines }
    })

    targetVersions.forEach(({ targetVersion, materialLines }) => saveEngineeringBomVersion({
      versionId: targetVersion.bomDraftVersionId,
      role: '买手',
      userId: input.actor.userId,
      userName: input.actor.userName,
      materialLines,
      customCosts: targetVersion.customCosts,
      updatedAt: at,
    }))

    record.bomConversionStatus = 'CONFIRMED'
    record.bomConversionConfirmedBy = input.actor.userName
    record.bomConversionConfirmedAt = at
    record.suggestedTaskTypes = suggestEngineeringIndependentTaskTypes(record)
    addLog(record, '确认 B 款用料', input.actor, `A 款物料已逐行转换并归入 ${record.targetStyleCode} 的 BOM。`, at)
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
    if (record.samplingType === 'REVISION' && record.bomConversionStatus !== 'CONFIRMED') return ['买手']
    const hasEmptyBom = record.bomVersionIds.some((versionId) => (getEngineeringBomVersionById(versionId)?.materialLines.length || 0) === 0)
    return [hasEmptyBom ? '买手' : '跟单']
  }
  if (record.status === 'WAIT_CONFIRMATION') return ['跟单']
  const teams = record.professionalTasks
    .filter((task) => ['WAIT_START', 'IN_PROGRESS', 'WAIT_REVIEW', 'REWORK'].includes(task.status))
    .map(getEngineeringIndependentProfessionalTaskCurrentTeam)
    .filter(Boolean)
  return [...new Set(teams.length ? teams : ['跟单'])]
}

function createProfessionalTasks(record: EngineeringIndependentSamplingRecord, selected: EngineeringIndependentProfessionalTaskType[], createdAt: string): EngineeringIndependentProfessionalTask[] {
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
    }
  })
}

export function confirmEngineeringIndependentSamplingPlan(input: { samplingTaskId: string; actor: { role: string; userId: string; userName: string }; selectedTaskTypes: EngineeringIndependentProfessionalTaskType[]; confirmedAt?: string }): EngineeringIndependentSamplingRecord {
  requireMerchandiser(input.actor)
  const records = readRecords(); const record = records.find((item) => item.samplingTaskId === input.samplingTaskId)
  if (!record) throw new Error('独立打样任务不存在。')
  if (record.merchandiserId !== input.actor.userId) throw new Error('只有任务跟单本人可以确认任务方案。')
  if (record.status !== 'DRAFT') throw new Error('只有草稿任务可以确认任务方案。')
  if (record.samplingType === 'REVISION' && record.bomConversionStatus !== 'CONFIRMED') throw new Error('请先由买手完成 A 款颜色和物料到 B 款 BOM 的转换。')
  const incompleteBom = record.bomVersionIds.map(getEngineeringBomVersionById).find((version) => version && version.materialLines.length === 0)
  if (incompleteBom) throw new Error(`B 款颜色“${incompleteBom.productColor}”尚未维护物料，不能确认本次工作安排。`)
  if (!input.selectedTaskTypes.length) throw new Error('请至少选择一个专业任务。')
  if (!input.selectedTaskTypes.includes('DISPLAY_SAMPLE')) throw new Error('独立打样必须包含销售展示样衣任务。')
  const at = input.confirmedAt || nowText()
  record.suggestedTaskTypes = suggestEngineeringIndependentTaskTypes(record)
  record.selectedTaskTypes = [...new Set(input.selectedTaskTypes)]
  record.professionalTasks = createProfessionalTasks(record, record.selectedTaskTypes, at)
  record.relatedProfessionalTaskIds = record.professionalTasks.map((task) => task.taskId)
  record.taskPlanConfirmedBy = input.actor.userName
  record.taskPlanConfirmedAt = at
  record.status = 'IN_PROGRESS'
  addLog(record, '确认本次工作安排', input.actor, `已一次生成 ${record.professionalTasks.length} 个专业任务。`, at)
  writeRecords(records); return cloneRecord(record)
}

function findTask(records: EngineeringIndependentSamplingRecord[], taskId: string): { record: EngineeringIndependentSamplingRecord; task: EngineeringIndependentProfessionalTask } {
  for (const record of records) { const task = record.professionalTasks.find((item) => item.taskId === taskId); if (task) return { record, task } }
  throw new Error('独立打样专业任务不存在。')
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
    sampleQuantity?: number
    sampleColor?: string
    sampleSize?: string
    sourcePatternVersion?: string
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
    sampleQuantity: Number(result.sampleQuantity) || 0,
    sampleColor: result.sampleColor?.trim() || '',
    sampleSize: result.sampleSize?.trim() || '',
    sourcePatternVersion: result.sourcePatternVersion?.trim() || '',
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
  if (!record) throw new Error('独立打样任务不存在。')
  if (record.merchandiserId !== input.actor.userId) throw new Error('只有任务跟单本人可以确认整张任务成果。')
  if (record.status !== 'WAIT_CONFIRMATION') throw new Error('全部专业任务完成后才能确认整张成果。')
  const unfinishedBom = record.bomVersionIds.map(getEngineeringBomVersionById).find((version) => version?.versionStatus !== 'COMPLETED_CONFIRMED')
  if (unfinishedBom) throw new Error(`BOM 与价格 ${unfinishedBom.versionCode} 尚未由买手确认。`)
  if (!input.resultVersion.trim() || !input.resultSummary.trim()) throw new Error('请完整填写成果版本和成果摘要。')
  record.status = 'COMPLETED'; record.resultVersion = input.resultVersion.trim(); record.resultSummary = input.resultSummary.trim(); record.confirmedBy = input.actor.userName; record.confirmedAt = input.confirmedAt
  addLog(record, '确认整张成果', input.actor, `成果版本 ${record.resultVersion} 已确认。`, input.confirmedAt); writeRecords(records); return cloneRecord(record)
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
