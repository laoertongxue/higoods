import {
  calculateEngineeringBomTotalRequirement,
  resolveEngineeringBomMaterialLine,
} from './pcs-engineering-bom-material-resolver.ts'
import { listMaterialArchives, listMaterialSkuRecordsByMaterialId } from './pcs-material-archive-repository.ts'
import type { EngineeringBomMaterialLineDraft } from './pcs-engineering-bom-types.ts'
import type {
  EngineeringIndependentProfessionalResult,
  EngineeringIndependentProfessionalTask,
  EngineeringIndependentProfessionalTaskType,
  EngineeringIndependentReusableProfessionalResult,
  EngineeringIndependentSamplingRecord,
  EngineeringIndependentSamplingType,
} from './pcs-engineering-master-types.ts'
import { getStyleArchiveById, listStyleArchives } from './pcs-style-archive-repository.ts'
import {
  captureEngineeringBomRepositoryState,
  confirmEngineeringBomVersion,
  createEngineeringBomVersionsForOwner,
  getEngineeringBomVersionById,
  restoreEngineeringBomRepositoryState,
  saveEngineeringBomVersion,
} from './pcs-engineering-bom-repository.ts'

const STORAGE_KEY = 'higood-pcs-independent-sampling-v5'
const TASK_META: Record<EngineeringIndependentProfessionalTaskType, { name: string; team: string }> = {
  BASE_PATTERN: { name: '基码纸样', team: '版师' },
  DISPLAY_SAMPLE: { name: '版衣／销售展示样衣', team: '制作团队' },
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
  return { ...result }
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
      merchandiser: actor,
      selectedTaskTypes: selected,
      createdAt,
    }, `ES-${type === 'REVISION' ? 'R' : 'D'}-${String(index + 1).padStart(3, '0')}`)
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
          task.results = [{ resultId: `${task.taskId}-R1`, title: `${task.taskName}成果`, imageUrl: target.mainImageUrl, status: 'APPROVED', rejectReason: '' }]
        })
      } else if (record.professionalTasks[0]) {
        record.professionalTasks[0].status = index === 7 ? 'REWORK' : 'IN_PROGRESS'
        record.professionalTasks[0].startedAt = createdAt
        if (index === 7) {
          record.professionalTasks[0].results = [{
            resultId: `${record.professionalTasks[0].taskId}-R1`,
            title: `${record.professionalTasks[0].taskName}成果（待返工）`,
            imageUrl: target.mainImageUrl,
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
            imageUrl: target.mainImageUrl,
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
  merchandiser: { role: string; userId: string; userName: string }
  selectedTaskTypes?: EngineeringIndependentProfessionalTaskType[]
  relatedProfessionalTaskIds?: string[]
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
  if (!input.selectedTaskTypes?.length) throw new Error('创建独立打样时请至少选择一个专业任务。')
  const taskId = code.replace(/^ES-/, 'ES-ID-')
  const bomVersions = createEngineeringBomVersionsForOwner({
    ownerStage: 'INDEPENDENT_SAMPLING',
    ownerId: taskId,
    ownerCode: code,
    styleId: target.styleId,
    createdBy: input.merchandiser.userName,
    createdAt: input.createdAt,
  })
  const defaultLines = createDefaultBomLines(target.styleCode)
  if (defaultLines.length && bomVersions[0]) {
    saveEngineeringBomVersion({
      versionId: bomVersions[0].bomDraftVersionId,
      role: '买手',
      userId: 'U-BUYER-DEMO',
      userName: '买手-阿乐',
      materialLines: defaultLines,
      customCosts: [],
      updatedAt: input.createdAt,
    })
  }
  const record: EngineeringIndependentSamplingRecord = {
    samplingTaskId: taskId, samplingTaskCode: code, samplingType: input.samplingType,
    sourceStyleId: source?.styleId || '', sourceStyleCode: source?.styleCode || '',
    targetStyleId: target.styleId, targetStyleCode: target.styleCode, targetStyleName: target.styleName,
    status: 'DRAFT', merchandiserId: input.merchandiser.userId, merchandiserName: input.merchandiser.userName,
    relatedProfessionalTaskIds: [], professionalTasks: [],
    bomDraftVersionId: bomVersions[0]?.bomDraftVersionId || '',
    bomVersionIds: bomVersions.map((version) => version.bomDraftVersionId),
    resultVersion: '', resultSummary: '', confirmedBy: '', confirmedAt: '',
    selectedTaskTypes: [...new Set(input.selectedTaskTypes || [])], sourceResultVersionId: '', reuseDecision: 'PENDING',
    operationLogs: [], createdBy: input.merchandiser.userName, createdAt: input.createdAt, updatedAt: input.createdAt,
  }
  addLog(record, '创建任务', input.merchandiser, `${input.samplingType === 'REVISION' ? '改款' : '设计'}打样任务已创建。`, input.createdAt)
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
  if (!input.selectedTaskTypes.length) throw new Error('请至少选择一个专业任务。')
  const at = input.confirmedAt || nowText()
  record.selectedTaskTypes = [...new Set(input.selectedTaskTypes)]
  record.professionalTasks = createProfessionalTasks(record, record.selectedTaskTypes, at)
  record.relatedProfessionalTaskIds = record.professionalTasks.map((task) => task.taskId)
  record.status = 'IN_PROGRESS'
  addLog(record, '确认任务方案', input.actor, `已生成 ${record.professionalTasks.length} 个专业任务。`, at)
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
    throw new Error(`只有${requiredExecutionRole(task)}负责人可以推进${task.taskName}。`)
  }
}

export function startEngineeringIndependentProfessionalTask(input: { taskId: string; actor: { role?: string; userId: string; userName: string }; startedAt?: string }): EngineeringIndependentSamplingRecord {
  const records = readRecords(); const { record, task } = findTask(records, input.taskId)
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

export function submitEngineeringIndependentProfessionalTask(input: { taskId: string; actor: { role?: string; userId: string; userName: string }; resultTitles: string[]; resultImageUrls: string[]; dyeColorCode?: string; submittedAt?: string }): EngineeringIndependentSamplingRecord {
  const records = readRecords(); const { record, task } = findTask(records, input.taskId)
  requireTaskExecutor(task, input.actor)
  if (!['IN_PROGRESS', 'REWORK'].includes(task.status)) throw new Error('请先开始专业任务。')
  if (!input.resultTitles.length || input.resultTitles.length !== input.resultImageUrls.length || input.resultTitles.some((item) => !item.trim()) || input.resultImageUrls.some((item) => !item.trim())) throw new Error('请逐项完整填写成果名称和成果图片。')
  if ((task.taskType === 'COLOR_YARN' || task.taskType === 'COLOR_FABRIC') && (!task.colorRequirementConfirmedAt || !task.pantoneColorCode || !task.colorName)) throw new Error('请先由跟单确认潘通色号和颜色名称。')
  const at = input.submittedAt || nowText(); task.submittedAt = at
  task.dyeColorCode = input.dyeColorCode?.trim() || task.dyeColorCode
  const submittedResults = input.resultTitles.map((title, index) => ({ resultId: `${task.taskId}-R${index + 1}`, title, imageUrl: input.resultImageUrls[index] || input.resultImageUrls[0], status: task.taskType === 'BASE_PATTERN' || task.taskType === 'DISPLAY_SAMPLE' ? 'APPROVED' as const : 'WAIT_REVIEW' as const, rejectReason: '' }))
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
