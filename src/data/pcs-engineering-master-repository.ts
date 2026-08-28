// 工程主单 LocalStorage 仓库：主单及任务骨架的唯一事实源。
// 任务骨架在发布时一次性生成，依赖只从固定策略复制，不提供任何更新依赖的接口。

import {
  buildEngineeringTaskPlan,
  buildDependencyClosure,
  buildPreparationDependencyClosure,
  getEngineeringTaskDependencies,
  getEngineeringTaskDefinition,
  getEngineeringTaskApplicability,
  isEngineeringPreparationType,
  resolveEngineeringTaskSubmitStatus,
  type EngineeringBomTaskConditions,
} from './pcs-engineering-dependency-policy.ts'
import type { EngineeringBomTaskLinkageRow } from './pcs-engineering-bom-types.ts'
import {
  buildEngineeringBomTaskRows,
  captureEngineeringBomRepositoryState,
  confirmEngineeringBomPricingPlan,
  confirmEngineeringBomVersion,
  copyEngineeringBomPricingPlan,
  createEngineeringBomVersionsForOwner,
  getEngineeringBomVersionById,
  listEngineeringBomVersionsByOwner,
  restoreEngineeringBomRepositoryState,
  saveEngineeringBomVersion,
} from './pcs-engineering-bom-repository.ts'
import type { EngineeringBomCustomCostDraft, EngineeringBomMaterialLineDraft, EngineeringBomOperatorRole } from './pcs-engineering-bom-types.ts'
import { assertEngineeringBomPricingSnapshotValid } from './pcs-engineering-bom-snapshot-validation.ts'
import { assertFirstProductionQualification } from './pcs-engineering-first-production-policy.ts'
import {
  listReusableEngineeringIndependentProfessionalResults,
  listReusableEngineeringIndependentSamplingResults,
} from './pcs-engineering-master-sampling.ts'
import {
  getStyleArchiveById,
  findStyleArchiveByCode,
} from './pcs-style-archive-repository.ts'
import { listSkuArchivesByStyleId } from './pcs-sku-archive-repository.ts'
import type {
  EngineeringMasterOrderRecord,
  EngineeringMasterOrderSnapshot,
  EngineeringTaskRecord,
  EngineeringTaskType,
  EngineeringBulkProductionQualification,
  EngineeringFirstProductionQualificationFact,
  EngineeringPreparationType,
  EngineeringIndependentProfessionalTaskType,
  EngineeringIndependentReusableProfessionalResult,
  EngineeringSampleActualLine,
  EngineeringSampleRequirementLine,
} from './pcs-engineering-master-types.ts'
import {
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
} from './pcs-technical-data-version-repository.ts'

const ENGINEERING_MASTER_STORAGE_KEY = 'higood-pcs-engineering-master-store-v1'
const ENGINEERING_MASTER_STORE_VERSION = 1

let memorySnapshot: EngineeringMasterOrderSnapshot | null = null
let repositoryTransactionDepth = 0

function canUseStorage(): boolean {
  return (
    typeof localStorage !== 'undefined' &&
    typeof localStorage.getItem === 'function' &&
    typeof localStorage.setItem === 'function' &&
    typeof localStorage.removeItem === 'function'
  )
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate())
    + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds())
}

function cloneTask(task: EngineeringTaskRecord): EngineeringTaskRecord {
  return {
    ...task,
    dependsOnTaskIds: [...task.dependsOnTaskIds],
    dependencySatisfaction: (task.dependencySatisfaction || []).map((item) => ({ ...item })),
    events: { ...task.events },
    operationLogs: (task.operationLogs || []).map((item) => ({ ...item })),
    materialLines: task.materialLines.map((line) => ({
      ...line,
      resultFileIds: [...(line.resultFileIds || [])],
      effectImageIds: [...(line.effectImageIds || [])],
    })),
    reworkRounds: task.reworkRounds.map((round) => ({ ...round })),
    materialReviewRounds: (task.materialReviewRounds || []).map((round) => ({
      ...round,
      decisions: round.decisions.map((decision) => ({ ...decision })),
    })),
    resultImageIds: [...(task.resultImageIds || [])],
    sampleRequirements: (task.sampleRequirements || []).map((line) => ({ ...line })),
    sampleActuals: (task.sampleActuals || []).map((line) => ({ ...line, imageFileIds: [...line.imageFileIds] })),
    boundPurchaseOrderNos: [...(task.boundPurchaseOrderNos || [])],
  }
}

function cloneRecord(record: EngineeringMasterOrderRecord): EngineeringMasterOrderRecord {
  return {
    ...record,
    bomVersionIds: [...(record.bomVersionIds || [])],
    tasks: record.tasks.map(cloneTask),
    priorResultReuseLines: record.priorResultReuseLines.map((line) => ({ ...line })),
    qualificationFact: { ...record.qualificationFact },
    bulkProductionQualification: { ...record.bulkProductionQualification },
    confirmedTaskTypes: [...(record.confirmedTaskTypes || [])],
  }
}

function cloneSnapshot(snapshot: EngineeringMasterOrderSnapshot): EngineeringMasterOrderSnapshot {
  return {
    version: snapshot.version,
    records: snapshot.records.map(cloneRecord),
  }
}

function seedSnapshot(): EngineeringMasterOrderSnapshot {
  return { version: ENGINEERING_MASTER_STORE_VERSION, records: [] }
}

function readSnapshot(): EngineeringMasterOrderSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)
  if (!canUseStorage()) {
    memorySnapshot = seedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }
  try {
    const raw = localStorage.getItem(ENGINEERING_MASTER_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as EngineeringMasterOrderSnapshot
      if (parsed && Array.isArray(parsed.records)) {
        memorySnapshot = {
          version: ENGINEERING_MASTER_STORE_VERSION,
          records: parsed.records.map(normalizeRecord),
        }
        return cloneSnapshot(memorySnapshot)
      }
    }
  } catch {
    // 存储损坏时回退到空种子
  }
  memorySnapshot = seedSnapshot()
  return cloneSnapshot(memorySnapshot)
}

function normalizeRecord(record: EngineeringMasterOrderRecord): EngineeringMasterOrderRecord {
  const emptyQualification: EngineeringFirstProductionQualificationFact = {
    styleCode: record.styleCode || '',
    formalSaleStatus: 'UNAVAILABLE',
    formalProductionStatus: 'UNAVAILABLE',
    formalSaleSource: '',
    formalProductionSource: '',
    checkedAt: '',
  }
  const emptyBulkQualification: EngineeringBulkProductionQualification = {
    basisType: 'OTHER_CONFIRMED',
    triggerBusinessObjectType: '',
    triggerBusinessObjectId: '',
    thresholdQuantity: null,
    reachedQuantity: null,
    reachedAt: '',
    reason: '',
    uniqueTriggerKey: '',
  }
  return cloneRecord({
    ...record,
    preparationType: isEngineeringPreparationType(record.preparationType) ? record.preparationType : '',
    creationMode: record.creationMode === 'SYSTEM' ? 'SYSTEM' : 'MANUAL',
    creationReason: record.creationReason || '',
    qualificationFact: record.qualificationFact || emptyQualification,
    bulkProductionQualification: record.bulkProductionQualification || emptyBulkQualification,
    merchandiserId: record.merchandiserId || '',
    bomVersionIds: Array.isArray(record.bomVersionIds) ? record.bomVersionIds : [],
    createdById: record.createdById || '',
    qualificationReachedAt: record.qualificationReachedAt || '',
    publishedBy: record.publishedBy || '',
    closedBy: record.closedBy || '',
    tasks: Array.isArray(record.tasks)
      ? record.tasks.map((task) => {
          const impossibleNoReviewAudit = task.status === '待审核'
            && !getEngineeringTaskDefinition(task.taskType).reviewRequired
          const storedEvents = task.events || {
            generatedAt: record.taskPlanConfirmedAt || record.createdAt || '',
            unlockedAt: '',
            startedAt: task.startedAt || '',
            submittedAt: task.submittedAt || '',
            reviewedAt: '',
            firstCompletedAt: task.firstCompletedAt || '',
            effectiveCompletedAt: task.effectiveCompletedAt || '',
          }
          return ({
          ...task,
          sourceType: task.sourceType || 'ENGINEERING_MASTER',
          status: impossibleNoReviewAudit ? '进行中' : task.status,
          sourceId: task.sourceId || record.masterOrderId,
          targetStyleId: task.targetStyleId || record.styleId,
          targetStyleCode: task.targetStyleCode || record.styleCode,
          targetStyleName: task.targetStyleName || record.styleName,
          dependencySatisfaction: Array.isArray(task.dependencySatisfaction) ? task.dependencySatisfaction : [],
          assigneeId: task.assigneeId || '',
          assigneeName: task.assigneeName || '',
          assignedById: task.assignedById || '',
          assignedByName: task.assignedByName || '',
          assignedAt: task.assignedAt || '',
          currentRoundNo: Number(task.currentRoundNo || 1),
          plannedStartAt: task.plannedStartAt || '',
          plannedCompleteAt: task.plannedCompleteAt || '',
          resultSummary: task.resultSummary || '',
          submittedById: task.submittedById || '',
          submittedByName: task.submittedByName || task.resultSubmittedBy || '',
          reviewedById: task.reviewedById || '',
          reviewedByName: task.reviewedByName || '',
          submittedAt: impossibleNoReviewAudit ? '' : task.submittedAt,
          firstCompletedAt: impossibleNoReviewAudit ? '' : task.firstCompletedAt,
          effectiveCompletedAt: impossibleNoReviewAudit ? '' : task.effectiveCompletedAt,
          events: {
            ...storedEvents,
            submittedAt: impossibleNoReviewAudit ? '' : storedEvents.submittedAt,
            reviewedAt: impossibleNoReviewAudit ? '' : storedEvents.reviewedAt,
            firstCompletedAt: impossibleNoReviewAudit ? '' : storedEvents.firstCompletedAt,
            effectiveCompletedAt: impossibleNoReviewAudit ? '' : storedEvents.effectiveCompletedAt,
          },
          operationLogs: Array.isArray(task.operationLogs) ? task.operationLogs : [],
          resultImageIds: Array.isArray(task.resultImageIds) ? [...task.resultImageIds] : [],
          resultQuantity: Number(task.resultQuantity || 0),
          resultSubmittedBy: task.resultSubmittedBy || '',
          colorRequirementConfirmedBy: task.colorRequirementConfirmedBy || '',
          colorRequirementConfirmedAt: task.colorRequirementConfirmedAt || '',
          colorResultCompletedAt: task.colorResultCompletedAt || '',
          completedAt: impossibleNoReviewAudit ? '' : (task.completedAt || task.effectiveCompletedAt || ''),
          boundPurchaseOrderNos: Array.isArray(task.boundPurchaseOrderNos) ? task.boundPurchaseOrderNos : [],
          materialReviewRounds: Array.isArray(task.materialReviewRounds) ? task.materialReviewRounds : [],
          materialLines: Array.isArray(task.materialLines)
            ? task.materialLines.map((line) => ({
                ...line,
                resultFileIds: Array.isArray(line.resultFileIds) ? line.resultFileIds : [],
                effectImageIds: Array.isArray(line.effectImageIds) ? line.effectImageIds : [],
                resultSubmittedBy: line.resultSubmittedBy || '',
                resultSubmittedAt: line.resultSubmittedAt || '',
                reviewStatus: line.reviewStatus || '待提交',
                reviewReason: line.reviewReason || '',
                reviewedBy: line.reviewedBy || '',
                reviewedAt: line.reviewedAt || '',
              }))
            : [],
          })
        })
      : [],
    priorResultReuseLines: Array.isArray(record.priorResultReuseLines) ? record.priorResultReuseLines : [],
  })
}

function writeSnapshot(snapshot: EngineeringMasterOrderSnapshot): void {
  memorySnapshot = cloneSnapshot(snapshot)
  if (!canUseStorage()) return
  try {
    localStorage.setItem(ENGINEERING_MASTER_STORAGE_KEY, JSON.stringify(memorySnapshot))
  } catch (error) {
    if (repositoryTransactionDepth > 0) throw error
    // 原型环境存储不可用时仅保留内存态
  }
}

function nextMasterOrderCode(records: EngineeringMasterOrderRecord[]): string {
  let maxSeq = 0
  for (const record of records) {
    const match = /^EM-(\d+)$/.exec(record.masterOrderCode)
    if (match) maxSeq = Math.max(maxSeq, Number(match[1]))
  }
  return `EM-${String(maxSeq + 1).padStart(3, '0')}`
}

function resolveStyleArchive(styleId: string, styleCode: string) {
  const byId = getStyleArchiveById(styleId)
  if (byId) return byId
  const byCode = findStyleArchiveByCode(styleCode)
  if (byCode) return byCode
  return null
}

export interface CreateEngineeringMasterOrderInput {
  styleId: string
  styleCode: string
  merchandiserName: string
  merchandiserId: string
  createdBy: string
  createdById: string
  createdByRole: string
  preparationType?: EngineeringPreparationType
  qualificationFact: EngineeringFirstProductionQualificationFact
  bulkProductionQualification: EngineeringBulkProductionQualification
  creationReason: string
  creationMode?: 'MANUAL' | 'SYSTEM'
}

export function createEngineeringMasterOrder(input: CreateEngineeringMasterOrderInput): EngineeringMasterOrderRecord {
  const snapshot = readSnapshot()

  // 无商品／款式档案：禁止创建工程主单。
  const style = resolveStyleArchive(input.styleId, input.styleCode)
  if (!style) {
    throw new Error('无商品／款式档案，禁止创建工程主单。请先创建商品／款式档案。')
  }

  assertFirstProductionQualification(style.styleCode, input.qualificationFact)
  if (!input.merchandiserId.trim() || !input.merchandiserName.trim()) {
    throw new Error('工程主单必须选择跟单负责人。')
  }
  if (!input.createdById.trim() || !input.createdBy.trim()) throw new Error('工程主单缺少创建身份。')
  const creationMode = input.creationMode === 'SYSTEM' ? 'SYSTEM' : 'MANUAL'
  if (creationMode === 'MANUAL' && input.createdByRole !== '跟单') throw new Error('只有当前登录的跟单可以人工创建工程主单。')
  if (creationMode === 'SYSTEM' && input.createdByRole !== '系统') throw new Error('自动创建工程主单必须使用系统身份。')
  if (!input.creationReason.trim() || !input.bulkProductionQualification.reason.trim()) {
    throw new Error('请填写做大货依据和创建原因。')
  }
  if (!input.bulkProductionQualification.uniqueTriggerKey.trim()) {
    throw new Error('做大货资格缺少唯一触发标识。')
  }
  const duplicateTrigger = snapshot.records.find(
    (record) => record.bulkProductionQualification.uniqueTriggerKey === input.bulkProductionQualification.uniqueTriggerKey.trim(),
  )
  if (duplicateTrigger && creationMode === 'SYSTEM') return cloneRecord(duplicateTrigger)

  // 同一款式只允许存在一张未关闭的工程主单。
  const hasOpenMaster = snapshot.records.some(
    (record) =>
      record.styleId === style.styleId && record.status !== '已关闭' && record.status !== '已终止',
  )
  if (hasOpenMaster) {
    throw new Error('该款式已存在未关闭的工程主单，禁止重复创建。')
  }
  if (duplicateTrigger) {
    throw new Error('该做大货资格已经创建过工程主单，禁止重复使用。')
  }

  const masterOrderId = `EM-${Date.now().toString(36)}-${String(snapshot.records.length + 1).padStart(3, '0')}`
  const masterOrderCode = nextMasterOrderCode(snapshot.records)
  const bomRepositoryState = captureEngineeringBomRepositoryState()
  let bomVersions: ReturnType<typeof listEngineeringBomVersionsByOwner>
  try {
    createEngineeringBomVersionsForOwner({
      ownerStage: 'ENGINEERING_MASTER',
      ownerId: masterOrderId,
      ownerCode: masterOrderCode,
      styleId: style.styleId,
      createdBy: input.createdBy,
    })
    const reusableSampling = listReusableEngineeringIndependentSamplingResults(style.styleCode)[0]
    if (reusableSampling) {
      copyEngineeringBomPricingPlan({
        sourceOwnerStage: 'INDEPENDENT_SAMPLING',
        sourceOwnerId: reusableSampling.samplingTaskId,
        targetOwnerStage: 'ENGINEERING_MASTER',
        targetOwnerId: masterOrderId,
        copiedBy: input.createdBy,
        allowHandedOffSource: true,
      })
    }
    bomVersions = listEngineeringBomVersionsByOwner('ENGINEERING_MASTER', masterOrderId)
  } catch (error) {
    restoreEngineeringBomRepositoryState(bomRepositoryState)
    throw error
  }

  const record: EngineeringMasterOrderRecord = {
    masterOrderId,
    masterOrderCode,
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    status: '草稿',
    preparationType: input.preparationType || '',
    creationMode,
    creationReason: input.creationReason.trim(),
    qualificationFact: { ...input.qualificationFact },
    bulkProductionQualification: { ...input.bulkProductionQualification },
    merchandiserName: input.merchandiserName,
    merchandiserId: input.merchandiserId,
    bomVersionIds: bomVersions.map((item) => item.bomDraftVersionId),
    tasks: [],
    priorResultReuseLines: [],
    taskPlanConfirmedAt: '',
    taskPlanConfirmedBy: '',
    confirmedTaskTypes: [],
    createdAt: nowText(),
    createdBy: input.createdBy,
    createdById: input.createdById,
    qualificationReachedAt: input.bulkProductionQualification.reachedAt,
    publishedAt: '',
    publishedBy: '',
    closedAt: '',
    closedBy: '',
    terminatedAt: '',
    terminateReason: '',
  }

  snapshot.records.push(record)
  try {
    writeSnapshot(snapshot)
  } catch (error) {
    restoreEngineeringBomRepositoryState(bomRepositoryState)
    throw error
  }
  return cloneRecord(record)
}

export function createSystemEngineeringMasterOrder(
  input: Omit<CreateEngineeringMasterOrderInput, 'createdBy' | 'createdById' | 'createdByRole' | 'creationMode'>,
): EngineeringMasterOrderRecord {
  return createEngineeringMasterOrder({
    ...input,
    createdBy: '系统',
    createdById: 'SYSTEM',
    createdByRole: '系统',
    creationMode: 'SYSTEM',
  })
}

const ENGINEERING_MASTER_TASK_TYPES: EngineeringTaskType[] = [
  'BASE_PATTERN_WOVEN',
  'BASE_PATTERN_KNIT',
  'PRE_PRODUCTION_SAMPLE',
  'SIZE_PATTERN_WOVEN',
  'SIZE_PATTERN_KNIT',
  'PATTERN_ARTWORK',
  'COLOR_YARN',
  'COLOR_FABRIC',
  'ACCESSORY_PURCHASE',
  'TECH_PACK_CONFIRMATION',
]

function createConfirmedTaskSkeletons(
  master: EngineeringMasterOrderRecord,
  plan: ReturnType<typeof buildEngineeringTaskPlan>,
): EngineeringTaskRecord[] {
  const generatedAt = nowText()
  return ENGINEERING_MASTER_TASK_TYPES.map((taskType) => {
    const definition = getEngineeringTaskDefinition(taskType)
    const planLine = plan.find((item) => item.taskType === taskType)
    if (!planLine) throw new Error(`缺少工程任务方案：${taskType}`)
    const selectedStatus = planLine.dependsOn.length > 0 ? '待前置' : '待开始'
    return {
      taskId: `${master.masterOrderId}-${taskType}`,
      masterOrderId: master.masterOrderId,
      taskType,
      taskName: definition.taskName,
      sourceType: 'ENGINEERING_MASTER',
      sourceId: master.masterOrderId,
      targetStyleId: master.styleId,
      targetStyleCode: master.styleCode,
      targetStyleName: master.styleName,
      status: planLine.enabled ? selectedStatus : '未启用',
      dependsOnTaskIds: planLine.dependsOn.map((dependency) => `${master.masterOrderId}-${dependency}`),
      dependencySatisfaction: [],
      ownerTeamName: definition.ownerTeamName,
      assigneeId: '',
      assigneeName: '',
      assignedById: '',
      assignedByName: '',
      assignedAt: '',
      currentRoundNo: 1,
      plannedStartAt: '',
      plannedCompleteAt: '',
      resultSummary: '',
      submittedById: '',
      submittedByName: '',
      reviewedById: '',
      reviewedByName: '',
      events: {
        generatedAt,
        unlockedAt: planLine.enabled && planLine.dependsOn.length === 0 ? generatedAt : '',
        startedAt: '',
        submittedAt: '',
        reviewedAt: '',
        firstCompletedAt: '',
        effectiveCompletedAt: '',
      },
      operationLogs: [],
      materialLines: [],
      reworkRounds: [],
      startedAt: '',
      submittedAt: '',
      firstCompletedAt: '',
      effectiveCompletedAt: '',
      completedAt: '',
      boundPurchaseOrderNos: [],
      resultImageIds: [],
      resultQuantity: 0,
      resultSubmittedBy: '',
      sampleRequirements: [],
      sampleActuals: [],
      materialReviewRounds: [],
      colorRequirementConfirmedBy: '',
      colorRequirementConfirmedAt: '',
      colorResultCompletedAt: '',
    }
  })
}

export interface ConfirmEngineeringMasterTaskPlanInput {
  confirmedBy: string
  confirmedById: string
  confirmedByRole: string
  preparationType?: EngineeringPreparationType
  bomConditions?: EngineeringBomTaskConditions
  selectedConditionalTaskTypes: EngineeringTaskType[]
  priorResultDecisions?: EngineeringMasterPriorResultDecisionInput[]
  preProductionSampleRequirements?: Array<Pick<EngineeringSampleRequirementLine, 'targetColor' | 'targetSize' | 'requiredQuantity' | 'requirementNote'> & { requirementLineId?: string }>
}

export interface EngineeringMasterPriorResultDecisionInput {
  engineeringTaskType: EngineeringTaskType
  sourceSamplingTaskId: string
  sourceProfessionalTaskId: string
  sourceResultVersion: string
  decision: '复用' | '重新执行' | '不采用'
}

const INDEPENDENT_TO_ENGINEERING_TASK: Partial<Record<
  Exclude<EngineeringIndependentProfessionalTaskType, 'BASE_PATTERN'>,
  EngineeringTaskType
>> = {
  PATTERN_ARTWORK: 'PATTERN_ARTWORK',
  COLOR_YARN: 'COLOR_YARN',
  COLOR_FABRIC: 'COLOR_FABRIC',
}

function candidateEngineeringTaskTypes(
  candidate: EngineeringIndependentReusableProfessionalResult,
  preparationType: EngineeringPreparationType,
): EngineeringTaskType[] {
  if (candidate.professionalTaskType !== 'BASE_PATTERN') {
    const engineeringTaskType = INDEPENDENT_TO_ENGINEERING_TASK[candidate.professionalTaskType]
    return engineeringTaskType ? [engineeringTaskType] : []
  }
  if (preparationType === 'PURE_WOVEN') return ['BASE_PATTERN_WOVEN']
  if (preparationType === 'KNIT') return ['BASE_PATTERN_KNIT']
  if (preparationType === 'KNIT_WOVEN') return ['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT']
  return []
}

export interface EngineeringMasterPriorResultCandidate {
  engineeringTaskType: EngineeringTaskType
  source: EngineeringIndependentReusableProfessionalResult
  recommended: boolean
}

export function listEngineeringMasterPriorResultCandidates(
  targetStyleCode: string,
  preparationType: EngineeringPreparationType,
): EngineeringMasterPriorResultCandidate[] {
  const seenRecommended = new Set<EngineeringTaskType>()
  return listReusableEngineeringIndependentProfessionalResults(targetStyleCode).flatMap((source) =>
    candidateEngineeringTaskTypes(source, preparationType)
      .filter((engineeringTaskType) => getEngineeringTaskApplicability(preparationType, engineeringTaskType) !== 'NOT_APPLICABLE')
      .map((engineeringTaskType) => {
      const recommended = !seenRecommended.has(engineeringTaskType)
      seenRecommended.add(engineeringTaskType)
      return { engineeringTaskType, source: { ...source, resultImageUrls: [...source.resultImageUrls] }, recommended }
      }),
  )
}

function resolvePriorResultDecisions(
  record: EngineeringMasterOrderRecord,
  preparationType: EngineeringPreparationType,
  input: ConfirmEngineeringMasterTaskPlanInput,
): Array<{ input: EngineeringMasterPriorResultDecisionInput; source: EngineeringIndependentReusableProfessionalResult }> {
  if (!input.priorResultDecisions) return []
  const candidates = listEngineeringMasterPriorResultCandidates(record.styleCode, preparationType)
  const relevantTaskTypes = [...new Set(candidates.map((candidate) => candidate.engineeringTaskType))]
  const decisions = input.priorResultDecisions
  if (new Set(decisions.map((decision) => decision.engineeringTaskType)).size !== decisions.length) {
    throw new Error('同一工程任务只能选择一项前期成果。')
  }
  const missingDecision = relevantTaskTypes.find((taskType) =>
    !decisions.some((decision) => decision.engineeringTaskType === taskType),
  )
  if (missingDecision) throw new Error(`请逐项选择${getEngineeringTaskDefinition(missingDecision).taskName}成果的复用方式。`)
  return decisions.map((decision) => {
    const matched = candidates.find((candidate) =>
      candidate.engineeringTaskType === decision.engineeringTaskType
      && candidate.source.samplingTaskId === decision.sourceSamplingTaskId
      && candidate.source.professionalTaskId === decision.sourceProfessionalTaskId
      && candidate.source.resultVersion === decision.sourceResultVersion,
    )
    if (!matched) throw new Error('所选前期成果未完成整单确认、专业任务未完成，或版本已失效，不能采用。')
    return { input: decision, source: matched.source }
  })
}

function applyPriorResultDecisions(
  record: EngineeringMasterOrderRecord,
  decisions: ReturnType<typeof resolvePriorResultDecisions>,
  confirmedBy: string,
  confirmedById: string,
  confirmedAt: string,
): void {
  record.priorResultReuseLines = decisions.map(({ input, source }) => ({
    resultType: input.engineeringTaskType,
    resultLabel: getEngineeringTaskDefinition(input.engineeringTaskType).taskName,
    decision: input.decision,
    sourceSamplingTaskId: source.samplingTaskId,
    sourceSamplingTaskCode: source.samplingTaskCode,
    sourceTaskId: source.professionalTaskId,
    sourceTaskLabel: source.professionalTaskName,
    sourceResultVersion: source.resultVersion,
    sourceBomDraftVersionId: source.bomDraftVersionId,
    confirmedById,
    confirmedBy,
    confirmedAt,
  }))

  const reusedTaskTypes = new Set<EngineeringTaskType>()
  decisions.forEach(({ input, source }) => {
    const task = record.tasks.find((item) => item.taskType === input.engineeringTaskType)
    if (!task) throw new Error(`工程任务不存在：${input.engineeringTaskType}`)
    if (input.decision === '不采用') {
      if (task.status !== '未启用') throw new Error(`${task.taskName}属于本次工程任务，不能选择不采用；请选择复用或重新执行。`)
      return
    }
    if (input.decision === '重新执行') {
      task.resultSummary = `参考前期成果 ${source.samplingTaskCode} / ${source.resultVersion}，本次重新执行。`
      return
    }
    reusedTaskTypes.add(task.taskType)
    task.status = '已完成'
    task.currentRoundNo = 0
    task.resultSummary = `复用前期成果 ${source.samplingTaskCode} / ${source.resultVersion}`
    task.resultImageIds = [...source.resultImageUrls]
    task.operationLogs.push({
      operationType: '复用前期成果',
      operatorId: confirmedById,
      operatorName: confirmedBy,
      operatedAt: confirmedAt,
      note: `${source.professionalTaskName} ${source.resultVersion}`,
      roundNo: 0,
    })
  })

  record.tasks.forEach((task) => {
    if (task.status === '未启用' || reusedTaskTypes.has(task.taskType)) return
    const reusedDependencies = task.dependsOnTaskIds
      .map((dependencyTaskId) => record.tasks.find((candidate) => candidate.taskId === dependencyTaskId))
      .filter((dependency): dependency is EngineeringTaskRecord => Boolean(dependency && reusedTaskTypes.has(dependency.taskType)))
    task.dependencySatisfaction = reusedDependencies.map((dependency) => ({
      dependencyTaskType: dependency.taskType,
      satisfactionType: 'PRIOR_RESULT_REUSED',
      sourceId: record.priorResultReuseLines.find((line) => line.resultType === dependency.taskType)?.sourceTaskId || '',
    }))
    const dependenciesSatisfied = task.dependsOnTaskIds.every((dependencyTaskId) =>
      record.tasks.find((candidate) => candidate.taskId === dependencyTaskId)?.status === '已完成',
    )
    task.status = task.dependsOnTaskIds.length === 0 || dependenciesSatisfied ? '待开始' : '待前置'
    task.events.unlockedAt = task.status === '待开始' ? confirmedAt : ''
  })
}

function normalizePreProductionSampleRequirements(
  record: EngineeringMasterOrderRecord,
  input: ConfirmEngineeringMasterTaskPlanInput['preProductionSampleRequirements'],
  issuedBy: string,
  issuedAt: string,
): EngineeringSampleRequirementLine[] {
  const drafts = input === undefined
    ? listSkuArchivesByStyleId(record.styleId)
      .filter((sku) => sku.archiveStatus === 'ACTIVE')
      .map((sku) => ({
        targetColor: sku.colorName,
        targetSize: sku.sizeName,
        requiredQuantity: 1,
        requirementNote: '',
      }))
    : input
  if (!drafts.length) throw new Error('请跟单下达产前版样衣的颜色、尺码和要求数量。')
  const seen = new Set<string>()
  return drafts.map((draft, index) => {
    const targetColor = draft.targetColor.trim()
    const targetSize = draft.targetSize.trim()
    const requiredQuantity = Number(draft.requiredQuantity)
    const key = `${targetColor}\u0000${targetSize}`
    if (!targetColor || !targetSize) throw new Error('请完整填写产前版样衣的颜色和尺码。')
    if (!Number.isInteger(requiredQuantity) || requiredQuantity <= 0) throw new Error('产前版样衣要求数量必须为大于 0 的整数。')
    if (seen.has(key)) throw new Error(`产前版样衣制作要求重复：${targetColor} / ${targetSize}。`)
    seen.add(key)
    return {
      requirementLineId: draft.requirementLineId?.trim() || `${record.masterOrderId}-PRE-SAMPLE-REQ-${index + 1}`,
      targetColor,
      targetSize,
      requiredQuantity,
      requirementNote: draft.requirementNote.trim(),
      issuedBy,
      issuedAt,
    }
  })
}

// 跟单确认系统建议后，一次性生成完整任务骨架；固定依赖不可调整。
export function confirmEngineeringMasterTaskPlan(
  masterOrderId: string,
  input: ConfirmEngineeringMasterTaskPlanInput,
): EngineeringMasterOrderRecord {
  const snapshot = readSnapshot()
  const record = snapshot.records.find((item) => item.masterOrderId === masterOrderId)
  if (!record) throw new Error(`工程主单不存在：${masterOrderId}`)
  if (record.status !== '草稿' || record.tasks.length > 0) {
    throw new Error('仅未生成任务的草稿工程主单可以确认任务方案。')
  }
  const confirmedBy = input.confirmedBy.trim()
  if (
    input.confirmedByRole !== '跟单'
    || !confirmedBy
    || confirmedBy !== record.merchandiserName
    || input.confirmedById.trim() !== record.merchandiserId
  ) {
    throw new Error('只有工程主单跟单本人可以确认任务方案。')
  }
  const preparationType = input.preparationType || record.preparationType
  if (!isEngineeringPreparationType(preparationType)) {
    throw new Error('请跟单选择已确认的生产准备类型。')
  }
  const priorResultDecisions = resolvePriorResultDecisions(record, preparationType, input)
  const decisionEnabledTaskTypes = priorResultDecisions
    .filter(({ input: decision }) => decision.decision !== '不采用')
    .map(({ input: decision }) => decision.engineeringTaskType)
  const selectedConditionalTaskTypes = [...input.selectedConditionalTaskTypes, ...decisionEnabledTaskTypes].filter((taskType) =>
    getEngineeringTaskApplicability(preparationType, taskType) === 'CONDITIONAL')
  const selectedWithPrerequisites = buildPreparationDependencyClosure(preparationType, selectedConditionalTaskTypes)
  const plan = buildEngineeringTaskPlan(
    preparationType,
    input.bomConditions,
    selectedWithPrerequisites,
  )
  const confirmedTaskTypes = plan.filter((item) => item.enabled).map((item) => item.taskType)

  record.preparationType = preparationType
  record.tasks = createConfirmedTaskSkeletons(record, plan)
  record.confirmedTaskTypes = confirmedTaskTypes
  record.taskPlanConfirmedBy = confirmedBy
  record.taskPlanConfirmedAt = nowText()
  const preProductionSampleTask = record.tasks.find((task) => task.taskType === 'PRE_PRODUCTION_SAMPLE')
  if (!preProductionSampleTask) throw new Error('工程任务方案缺少产前版样衣任务。')
  preProductionSampleTask.sampleRequirements = normalizePreProductionSampleRequirements(
    record,
    input.preProductionSampleRequirements,
    confirmedBy,
    record.taskPlanConfirmedAt,
  )
  applyPriorResultDecisions(
    record,
    priorResultDecisions,
    confirmedBy,
    input.confirmedById.trim(),
    record.taskPlanConfirmedAt,
  )
  record.status = '已发布'
  record.publishedAt = record.taskPlanConfirmedAt
  record.publishedBy = confirmedBy
  writeSnapshot(snapshot)
  return cloneRecord(record)
}

// 兼容既有领域调用与演示种子；真实页面必须走“跟单确认任务方案”入口。
export function publishEngineeringMasterOrder(masterOrderId: string): EngineeringMasterOrderRecord {
  const record = getEngineeringMasterOrderById(masterOrderId)
  if (!record) throw new Error(`工程主单不存在：${masterOrderId}`)
  return confirmEngineeringMasterTaskPlan(masterOrderId, {
    confirmedBy: record.merchandiserName,
    confirmedById: record.merchandiserId,
    confirmedByRole: '跟单',
    selectedConditionalTaskTypes: [],
  })
}

export function listEngineeringMasterOrders(): EngineeringMasterOrderRecord[] {
  return readSnapshot().records.map(cloneRecord)
}

export function getEngineeringMasterOrderById(masterOrderId: string): EngineeringMasterOrderRecord | null {
  const record = readSnapshot().records.find((item) => item.masterOrderId === masterOrderId)
  return record ? cloneRecord(record) : null
}

export function getEngineeringMasterOrderStoreSnapshot(): EngineeringMasterOrderSnapshot {
  return readSnapshot()
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  if ((typeof value !== 'object' || value === null) && typeof value !== 'function') return false
  return typeof (value as { then?: unknown }).then === 'function'
}

const ASYNC_FUNCTION_PROTOTYPE = Object.getPrototypeOf(async function () {})

function isAsyncFunction(operation: () => unknown): boolean {
  return Object.getPrototypeOf(operation) === ASYNC_FUNCTION_PROTOTYPE
}

export function runEngineeringMasterRepositoryTransaction<Operation extends () => unknown>(
  operation: Operation & (ReturnType<Operation> extends PromiseLike<unknown> ? never : unknown),
): ReturnType<Operation> {
  if (isAsyncFunction(operation)) {
    throw new Error('工程主单仓储事务仅支持同步操作，禁止传入 AsyncFunction。')
  }
  const snapshotBeforeOperation = readSnapshot()
  repositoryTransactionDepth += 1
  try {
    const result = operation()
    if (isThenable(result)) {
      throw new Error('工程主单仓储事务仅支持同步操作，禁止返回 Promise 或 thenable。')
    }
    return result as ReturnType<Operation>
  } catch (error) {
    memorySnapshot = cloneSnapshot(snapshotBeforeOperation)
    if (canUseStorage()) {
      try {
        localStorage.setItem(ENGINEERING_MASTER_STORAGE_KEY, JSON.stringify(memorySnapshot))
      } catch {
        // 回滚时优先恢复内存事实；持久化仍不可用时不得覆盖原始事务异常。
      }
    }
    throw error
  } finally {
    repositoryTransactionDepth -= 1
  }
}

export function resetEngineeringMasterRepository(): void {
  memorySnapshot = seedSnapshot()
  if (!canUseStorage()) return
  try {
    localStorage.removeItem(ENGINEERING_MASTER_STORAGE_KEY)
  } catch {
    // 忽略存储不可用
  }
}

// 主单状态变更的单一仓储入口。页面不可直接改写快照；后续关闭流程复用此入口。
export function setEngineeringMasterStatus(
  masterOrderId: string,
  status: EngineeringMasterOrderRecord['status'],
): EngineeringMasterOrderRecord {
  if (status === '已关闭') {
    throw new Error('工程主单不能直接设为已关闭，请使用关闭工程主单领域入口。')
  }
  const snapshot = readSnapshot()
  const record = snapshot.records.find((item) => item.masterOrderId === masterOrderId)
  if (!record) throw new Error(`工程主单不存在：${masterOrderId}`)
  record.status = status
  writeSnapshot(snapshot)
  return cloneRecord(record)
}

// 仅供本地高保真原型种子构造“待关闭／已关闭”完整场景；真实业务仍必须走关闭领域入口。
export function seedEngineeringMasterDemoLifecycleStatus(
  masterOrderId: string,
  status: '待关闭' | '已关闭',
): EngineeringMasterOrderRecord {
  const snapshot = readSnapshot()
  const record = snapshot.records.find((item) => item.masterOrderId === masterOrderId)
  if (!record) throw new Error(`工程主单不存在：${masterOrderId}`)
  if (!record.bulkProductionQualification.uniqueTriggerKey.startsWith('BULK-DEMO-')) {
    throw new Error('只能设置本地演示工程主单。')
  }
  const at = nowText()
  for (const task of record.tasks) {
    if (task.status === '未启用') continue
    task.status = '已完成'
    task.startedAt ||= at
    task.submittedAt ||= at
    task.firstCompletedAt ||= at
    task.effectiveCompletedAt ||= at
    task.completedAt ||= at
    task.events.startedAt ||= task.startedAt
    task.events.submittedAt ||= task.submittedAt
    task.events.firstCompletedAt ||= task.firstCompletedAt
    task.events.effectiveCompletedAt ||= task.effectiveCompletedAt
  }
  record.status = status
  record.updatedAt = at
  record.closedAt = status === '已关闭' ? at : ''
  record.closedBy = status === '已关闭' ? record.merchandiserName : ''
  writeSnapshot(snapshot)
  return cloneRecord(record)
}

export interface EngineeringMasterOrderCloseValidation {
  canClose: true
  masterOrderId: string
  technicalVersionId: string
}

export function assertFixedTaskDependenciesSatisfied(master: EngineeringMasterOrderRecord, task: EngineeringTaskRecord): void {
  const expected = canonicalDependencyIds(master, task.taskType)
  const actual = [...task.dependsOnTaskIds]
  if (
    expected.length !== actual.length
    || [...expected].sort().some((dependencyId, index) => dependencyId !== [...actual].sort()[index])
  ) {
    throw new Error(`${task.taskName}缺少固定前置依赖或依赖已被改写。`)
  }
  for (const dependencyId of expected) {
    const dependency = master.tasks.find((candidate) => candidate.taskId === dependencyId)
    if (!dependency) throw new Error(`${task.taskName}的固定依赖不存在：${dependencyId}`)
    if (dependency.status !== '已完成' && dependency.status !== '因需求变更结束') {
      throw new Error(`${task.taskName}的前置任务「${dependency.taskName}」未完成。`)
    }
  }
}

export function assertEngineeringTaskCanComplete(
  master: EngineeringMasterOrderRecord,
  task: EngineeringTaskRecord,
): void {
  if (task.masterOrderId !== master.masterOrderId || !master.tasks.some((candidate) => candidate.taskId === task.taskId)) {
    throw new Error('工程任务不属于当前工程主单，不能完成。')
  }
  if (!['待前置', '待开始', '进行中'].includes(task.status)) {
    throw new Error(`工程任务当前为${task.status}，不处于可完成状态。`)
  }
  assertFixedTaskDependenciesSatisfied(master, task)
}

export function validateEngineeringMasterOrderClose(
  masterOrderId: string,
): EngineeringMasterOrderCloseValidation {
  const master = getEngineeringMasterOrderById(masterOrderId)
  if (!master) throw new Error(`工程主单不存在：${masterOrderId}`)
  if (master.status === '已关闭') throw new Error('工程主单已关闭，不能重复关闭。')
  if (master.status === '草稿' || master.status === '已终止') {
    throw new Error(`工程主单当前为${master.status}，不能关闭。`)
  }

  const effectiveTasks = master.tasks.filter(
    (task) => task.status !== '未启用' && task.status !== '因需求变更结束',
  )
  for (const task of effectiveTasks) {
    if (task.status !== '已完成') throw new Error(`有效任务「${task.taskName}」未完成，不能关闭工程主单。`)
    assertFixedTaskDependenciesSatisfied(master, task)
  }

  const style = getStyleArchiveById(master.styleId)
  if (!style?.currentTechPackVersionId) throw new Error('主单款式尚未启用正式技术包，不能关闭工程主单。')
  const version = getTechnicalDataVersionById(style.currentTechPackVersionId)
  if (
    !version
    || version.styleId !== master.styleId
    || version.sourceProjectId !== master.masterOrderId
    || version.createdFromTaskType !== 'ENGINEERING_MASTER'
    || version.createdFromTaskId !== `${master.masterOrderId}-TECH_PACK_CONFIRMATION`
    || version.versionStatus !== 'PUBLISHED'
    || version.reviewStage !== '已发布'
  ) {
    throw new Error('主单来源技术包未完成审核发布并启用，不能关闭工程主单。')
  }
  const content = getTechnicalDataVersionContent(version.technicalVersionId)
  if (!content?.bomPricingSnapshot) throw new Error('正式技术包缺少 BOM 与价格正式快照，不能关闭工程主单。')
  assertEngineeringBomPricingSnapshotValid(content.bomPricingSnapshot)
  return {
    canClose: true,
    masterOrderId: master.masterOrderId,
    technicalVersionId: version.technicalVersionId,
  }
}

export function closeEngineeringMasterOrder(
  masterOrderId: string,
  operatorName: string,
): EngineeringMasterOrderRecord {
  return runEngineeringMasterRepositoryTransaction(() => {
    const validation = validateEngineeringMasterOrderClose(masterOrderId)
    const snapshot = readSnapshot()
    const master = snapshot.records.find((record) => record.masterOrderId === validation.masterOrderId)
    if (!master) throw new Error(`工程主单不存在：${masterOrderId}`)
    if (!operatorName.trim() || operatorName.trim() !== master.merchandiserName) {
      throw new Error('只有主单跟单本人可以关闭工程主单。')
    }
    master.status = '已关闭'
    master.closedAt = nowText()
    writeSnapshot(snapshot)
    return cloneRecord(master)
  })
}

// 工程任务事实只允许通过工程主单仓储改写；专业服务用此入口保持单一事实源。
export function updateEngineeringTaskRecord(
  masterOrderId: string,
  taskId: string,
  update: (task: EngineeringTaskRecord, master: EngineeringMasterOrderRecord) => void,
): { masterOrder: EngineeringMasterOrderRecord; task: EngineeringTaskRecord } {
  const snapshot = readSnapshot()
  const master = snapshot.records.find((item) => item.masterOrderId === masterOrderId)
  if (!master) throw new Error(`工程主单不存在：${masterOrderId}`)
  const task = master.tasks.find((item) => item.taskId === taskId)
  if (!task) throw new Error(`工程任务不存在：${taskId}`)
  update(task, master)
  refreshWaitingEngineeringTasks(master)
  writeSnapshot(snapshot)
  return { masterOrder: cloneRecord(master), task: cloneTask(task) }
}

function refreshWaitingEngineeringTasks(master: EngineeringMasterOrderRecord): void {
  const occurredAt = nowText()
  master.tasks.forEach((task) => {
    if (task.status !== '待前置') return
    const dependenciesSatisfied = task.dependsOnTaskIds.every((dependencyTaskId) => {
      const dependency = master.tasks.find((candidate) => candidate.taskId === dependencyTaskId)
      return dependency?.status === '已完成' || dependency?.status === '因需求变更结束'
    })
    if (!dependenciesSatisfied) return
    task.status = '待开始'
    task.events.unlockedAt = task.events.unlockedAt || occurredAt
    task.operationLogs.push({
      operationType: '前置完成自动解锁',
      operatorId: 'SYSTEM',
      operatorName: '系统',
      operatedAt: occurredAt,
      note: '固定前置任务均已完成。',
      roundNo: task.currentRoundNo,
    })
  })
}

export function startEngineeringTask(input: {
  masterOrderId: string
  taskId: string
  operatorId: string
  operatorName: string
}): { masterOrder: EngineeringMasterOrderRecord; task: EngineeringTaskRecord } {
  return updateEngineeringTaskRecord(input.masterOrderId, input.taskId, (task, master) => {
    if (!input.operatorId.trim() || !input.operatorName.trim()) throw new Error('缺少当前登录用户身份。')
    if (task.status !== '待开始') throw new Error(`工程任务当前为${task.status}，不能开始。`)
    assertFixedTaskDependenciesSatisfied(master, task)
    const occurredAt = nowText()
    task.status = '进行中'
    task.assigneeId = input.operatorId
    task.assigneeName = input.operatorName
    task.startedAt = task.startedAt || occurredAt
    task.events.startedAt = task.events.startedAt || occurredAt
    task.operationLogs.push({
      operationType: '开始任务',
      operatorId: input.operatorId,
      operatorName: input.operatorName,
      operatedAt: occurredAt,
      note: '',
      roundNo: task.currentRoundNo,
    })
    if (master.status === '已发布') master.status = '进行中'
  })
}

export type EngineeringTechPackOnlyProcess = '水溶'

export interface ApplyBomRequirementsToEngineeringTasksResult {
  masterOrder: EngineeringMasterOrderRecord
  tasks: EngineeringTaskRecord[]
  createdTaskCount: 0
  techPackOnlyProcesses: EngineeringTechPackOnlyProcess[]
}

export function validateBomRequirementsForEngineeringTasks(
  masterOrderId: string,
  rows: EngineeringBomTaskLinkageRow[],
): void {
  const snapshot = readSnapshot()
  const master = snapshot.records.find((item) => item.masterOrderId === masterOrderId)
  if (!master) throw new Error(`工程主单不存在：${masterOrderId}`)
  if (master.status !== '已发布' && master.status !== '进行中') {
    throw new Error('仅已发布或进行中的工程主单可以同步 BOM 工艺要求。')
  }
  const requiredTaskTypes: EngineeringTaskType[] = []
  if (rows.some((row) => hasBomRequirement(row.printRequirement))) requiredTaskTypes.push('PATTERN_ARTWORK')
  if (rows.some((row) => hasBomRequirement(row.dyeRequirement) && row.materialType === '纱线')) requiredTaskTypes.push('COLOR_YARN')
  if (rows.some((row) => hasBomRequirement(row.dyeRequirement) && row.materialType === '面料')) requiredTaskTypes.push('COLOR_FABRIC')
  if (rows.some((row) => hasBomRequirement(row.dyeRequirement) && !['纱线', '面料'].includes(row.materialType || ''))) {
    throw new Error('需要染色的 BOM 物料行必须通过结构化物料类型明确为纱线或面料。')
  }
  if (rows.some((row) => hasBomRequirement(row.purchaseRequirement))) requiredTaskTypes.push('ACCESSORY_PURCHASE')
  assertTaskSkeletonsExist(master, requiredTaskTypes)
}

function hasBomRequirement(value: unknown): boolean {
  return value === '是' || value === true
}

function listTechPackOnlyProcesses(rows: EngineeringBomTaskLinkageRow[]): EngineeringTechPackOnlyProcess[] {
  const processes: EngineeringTechPackOnlyProcess[] = []
  if (rows.some((row) => hasBomRequirement(row.waterSolubleRequirement))) processes.push('水溶')
  return processes
}

function resolveDependencyPreparationType(master: EngineeringMasterOrderRecord): EngineeringPreparationType {
  if (isEngineeringPreparationType(master.preparationType)) return master.preparationType

  // 兼容当前原型中已持久化、但早于“生产准备类型”字段生成的工程主单。
  // 这些主单已经保存了跟单确认后的任务结构，按已启用的基码任务还原原来的固定类型，
  // 避免任务明明已发布却无法点击开始；新建主单仍必须在发布前由跟单明确确认类型。
  const activeTaskTypes = new Set(master.tasks
    .filter((task) => task.status !== '未启用' && task.status !== '因需求变更结束')
    .map((task) => task.taskType))
  const hasWovenPattern = activeTaskTypes.has('BASE_PATTERN_WOVEN') || activeTaskTypes.has('SIZE_PATTERN_WOVEN')
  const hasKnitPattern = activeTaskTypes.has('BASE_PATTERN_KNIT') || activeTaskTypes.has('SIZE_PATTERN_KNIT')
  if (hasWovenPattern && hasKnitPattern) return 'KNIT_WOVEN'
  if (hasKnitPattern) return 'KNIT'
  return 'PURE_WOVEN'
}

function canonicalDependencyIds(master: EngineeringMasterOrderRecord, taskType: EngineeringTaskType): string[] {
  const preparationType = resolveDependencyPreparationType(master)
  const enabledTaskTypes = master.tasks
    .filter((task) => task.status !== '未启用' && task.status !== '因需求变更结束')
    .map((task) => task.taskType)
  return getEngineeringTaskDependencies(preparationType, taskType, enabledTaskTypes)
    .map((dependency) => `${master.masterOrderId}-${dependency}`)
}

function assertTaskSkeletonsExist(
  master: EngineeringMasterOrderRecord,
  taskTypes: EngineeringTaskType[],
): void {
  for (const taskType of buildDependencyClosure(taskTypes)) {
    if (master.tasks.some((task) => task.taskType === taskType)) continue
    const taskName = getEngineeringTaskDefinition(taskType).taskName
    throw new Error(`工程主单缺少${taskName}骨架，无法根据 BOM 启用。`)
  }
}

function enableTaskAndFixedPrerequisites(
  master: EngineeringMasterOrderRecord,
  taskType: EngineeringTaskType,
): EngineeringTaskRecord {
  const definition = getEngineeringTaskDefinition(taskType)
  for (const dependencyType of definition.dependsOn) {
    enableTaskAndFixedPrerequisites(master, dependencyType)
  }
  const task = master.tasks.find((item) => item.taskType === taskType)
  if (!task) {
    throw new Error(`工程主单缺少${definition.taskName}骨架，无法根据 BOM 启用。`)
  }
  task.dependsOnTaskIds = canonicalDependencyIds(master, taskType)
  if (task.status !== '未启用' && task.status !== '因需求变更结束') return task
  const hasPendingDependency = task.dependsOnTaskIds.some((dependencyId) => {
    const dependency = master.tasks.find((item) => item.taskId === dependencyId)
    return dependency?.status !== '已完成' && dependency?.status !== '因需求变更结束'
  })
  task.status = hasPendingDependency ? '待前置' : '待开始'
  return task
}

function createBomMaterialLine(
  task: EngineeringTaskRecord,
  row: EngineeringBomTaskLinkageRow,
  requirementType: '印花' | '染色' | '辅料',
) {
  const materialSkuId = row.materialSkuId || row.bomItemId
  return {
    materialLineId: `${task.taskId}-${row.bomItemId}`,
    bomItemId: row.bomItemId,
    materialSkuId,
    materialName: row.materialName || materialSkuId,
    materialType: row.materialType || '面料',
    requirementType,
    productColor: row.productColor,
    printProcess: requirementType === '印花' ? row.printProcess : undefined,
    pantoneColorCode: requirementType === '染色' ? row.pantoneColorCode : undefined,
    colorName: requirementType === '染色' ? row.colorName : undefined,
    dyeColorCode: requirementType === '染色' ? row.dyeColorCode : undefined,
    dyeFactoryName: requirementType === '染色' ? row.dyeFactoryName : undefined,
    status: '正常' as const,
    resultFileIds: [],
    effectImageIds: [],
    resultSubmittedBy: '',
    resultSubmittedAt: '',
    reviewStatus: '待提交' as const,
    reviewReason: '',
    reviewedBy: '',
    reviewedAt: '',
  }
}

function syncTaskMaterialLines(
  master: EngineeringMasterOrderRecord,
  taskType: 'PATTERN_ARTWORK' | 'COLOR_YARN' | 'COLOR_FABRIC' | 'ACCESSORY_PURCHASE',
  rows: EngineeringBomTaskLinkageRow[],
  requirementType: '印花' | '染色' | '辅料',
): void {
  const taskBeforeSync = master.tasks.find((item) => item.taskType === taskType)
  if (!taskBeforeSync) {
    const taskName = getEngineeringTaskDefinition(taskType).taskName
    throw new Error(`工程主单缺少${taskName}骨架，无法根据 BOM 启用。`)
  }
  const task = enableTaskAndFixedPrerequisites(master, taskType)
  const activeBomItemIds = new Set(rows.map((row) => row.bomItemId))
  const hadSubmittedResult = task.status === '已完成'
    || task.status === '待审核'
    || Boolean(task.submittedAt)
    || task.materialLines.some((line) => Boolean(line.resultSubmittedAt) || line.resultFileIds.length > 0)
  const hadStarted = hadSubmittedResult
    || task.status === '进行中'
    || task.status === '返工中'
    || Boolean(task.startedAt)
  let addedOrReactivated = false

  for (const line of task.materialLines) {
    if (line.requirementType !== requirementType || !line.bomItemId) continue
    if (!activeBomItemIds.has(line.bomItemId)) line.status = '因需求变更结束'
  }

  for (const row of rows) {
    const existing = task.materialLines.find(
      (line) => line.requirementType === requirementType && line.bomItemId === row.bomItemId,
    )
    if (!existing) {
      task.materialLines.push(createBomMaterialLine(task, row, requirementType))
      addedOrReactivated = true
      continue
    }
    if (existing.status === '因需求变更结束') addedOrReactivated = true
    existing.status = '正常'
    existing.materialSkuId = row.materialSkuId || row.bomItemId
    existing.materialName = row.materialName || existing.materialSkuId
    existing.materialType = row.materialType || '面料'
    existing.productColor = row.productColor
    if (requirementType === '印花') existing.printProcess = row.printProcess
    if (requirementType === '染色') {
      existing.pantoneColorCode = row.pantoneColorCode
      existing.colorName = row.colorName
      existing.dyeColorCode = row.dyeColorCode
      existing.dyeFactoryName = row.dyeFactoryName
    }
  }

  const activeLines = task.materialLines.filter(
    (line) => line.requirementType === requirementType && line.status === '正常',
  )
  if (activeLines.length === 0) {
    // 只有尚未开始的条件任务才随需求消失而结束；已开始或已提交的任务保留原状态与成果历史。
    if (hadStarted) return
    task.status = '因需求变更结束'
    task.operationLogs.push({
      operationType: '需求变更结束',
      operatorId: '',
      operatorName: '系统 BOM 联动',
      operatedAt: nowText(),
      note: '对应 BOM 条件已消失',
      roundNo: task.currentRoundNo,
    })
    return
  }
  if (hadSubmittedResult && addedOrReactivated) {
    if (taskType === 'ACCESSORY_PURCHASE') {
      task.status = '进行中'
      task.submittedAt = ''
      task.completedAt = ''
      task.effectiveCompletedAt = ''
      return
    }
    const roundNo = Math.max(0, ...task.reworkRounds.map((round) => round.roundNo)) + 1
    task.reworkRounds.push({
      roundNo,
      reason: 'BOM 新增或恢复物料工艺要求',
      startedAt: nowText(),
      submittedAt: '',
      passedAt: '',
    })
    task.status = '返工中'
  }
}

// BOM 只启用工程主单发布时已有的条件任务骨架，并按 BOM 行维护任务物料事实。
// 水溶留在技术包工艺，不生成工程任务或生产准备时效项。
export function applyBomRequirementsToEngineeringTasks(
  masterOrderId: string,
  rows: EngineeringBomTaskLinkageRow[],
): ApplyBomRequirementsToEngineeringTasksResult {
  validateBomRequirementsForEngineeringTasks(masterOrderId, rows)
  const snapshot = readSnapshot()
  const master = snapshot.records.find((item) => item.masterOrderId === masterOrderId)
  if (!master) throw new Error(`工程主单不存在：${masterOrderId}`)

  const printRows = rows.filter((row) => hasBomRequirement(row.printRequirement))
  const yarnDyeRows = rows.filter((row) => hasBomRequirement(row.dyeRequirement) && row.materialType === '纱线')
  const fabricDyeRows = rows.filter((row) => hasBomRequirement(row.dyeRequirement) && row.materialType === '面料')
  const accessoryRows = rows.filter((row) => hasBomRequirement(row.purchaseRequirement))
  const patternTask = master.tasks.find((task) => task.taskType === 'PATTERN_ARTWORK')
  if (patternTask && (printRows.length > 0 || patternTask.materialLines.some((line) => line.requirementType === '印花'))) {
    syncTaskMaterialLines(master, 'PATTERN_ARTWORK', printRows, '印花')
  }
  const yarnColorTask = master.tasks.find((task) => task.taskType === 'COLOR_YARN')
  if (yarnColorTask && (yarnDyeRows.length > 0 || yarnColorTask.materialLines.some((line) => line.requirementType === '染色'))) {
    syncTaskMaterialLines(master, 'COLOR_YARN', yarnDyeRows, '染色')
  }
  const fabricColorTask = master.tasks.find((task) => task.taskType === 'COLOR_FABRIC')
  if (fabricColorTask && (fabricDyeRows.length > 0 || fabricColorTask.materialLines.some((line) => line.requirementType === '染色'))) {
    syncTaskMaterialLines(master, 'COLOR_FABRIC', fabricDyeRows, '染色')
  }
  const purchaseTask = master.tasks.find((task) => task.taskType === 'ACCESSORY_PURCHASE')
  if (purchaseTask && (accessoryRows.length > 0 || purchaseTask.materialLines.some((line) => line.requirementType === '辅料'))) {
    syncTaskMaterialLines(master, 'ACCESSORY_PURCHASE', accessoryRows, '辅料')
  }

  writeSnapshot(snapshot)
  return {
    masterOrder: cloneRecord(master),
    tasks: master.tasks.map(cloneTask),
    createdTaskCount: 0,
    techPackOnlyProcesses: listTechPackOnlyProcesses(rows),
  }
}

export function saveEngineeringMasterBomVersion(input: {
  versionId: string
  role: EngineeringBomOperatorRole
  userId: string
  userName: string
  materialLines: EngineeringBomMaterialLineDraft[]
  /** @deprecated 自定义费用由整款 BOM 与价格方案统一维护。 */
  customCosts?: EngineeringBomCustomCostDraft[]
}): ReturnType<typeof saveEngineeringBomVersion> {
  return saveEngineeringBomVersion(input)
}

export function confirmEngineeringMasterBomPricingPlan(input: {
  masterOrderId: string
  role: EngineeringBomOperatorRole
  userId: string
  userName: string
}): ReturnType<typeof confirmEngineeringBomPricingPlan> {
  const master = getEngineeringMasterOrderById(input.masterOrderId)
  if (!master) throw new Error('工程主单不存在。')
  const beforeBom = captureEngineeringBomRepositoryState()
  const beforeMaster = readSnapshot()
  try {
    const confirmed = confirmEngineeringBomPricingPlan({
      ownerStage: 'ENGINEERING_MASTER',
      ownerId: master.masterOrderId,
      role: input.role,
      userId: input.userId,
      userName: input.userName,
    })
    const versions = listEngineeringBomVersionsByOwner('ENGINEERING_MASTER', master.masterOrderId)
    applyBomRequirementsToEngineeringTasks(master.masterOrderId, buildEngineeringBomTaskRows(versions))
    return confirmed
  } catch (error) {
    restoreEngineeringBomRepositoryState(beforeBom)
    writeSnapshot(beforeMaster)
    throw error
  }
}

export function confirmEngineeringMasterBomVersion(input: {
  versionId: string
  role: EngineeringBomOperatorRole
  userId: string
  userName: string
}): ReturnType<typeof confirmEngineeringBomVersion> {
  const version = getEngineeringBomVersionById(input.versionId)
  if (!version || version.ownerStage !== 'ENGINEERING_MASTER') throw new Error('工程主单 BOM 与价格版本不存在。')
  confirmEngineeringMasterBomPricingPlan({
    masterOrderId: version.ownerId,
    role: input.role,
    userId: input.userId,
    userName: input.userName,
  })
  return getEngineeringBomVersionById(input.versionId)!
}

export interface SubmitEngineeringTaskResultInput {
  resultImageIds?: string[]
  resultQuantity?: number
  submittedBy?: string
  sampleActuals?: Array<Omit<EngineeringSampleActualLine, 'actualLineId' | 'submittedAt'> & { actualLineId?: string; submittedAt?: string }>
}

// 提交任务成果：制版与产前版样衣提交即完成；花型和调色进入待审核。
// 待前置任务要求全部前置已完成；条件任务未启用时禁止提交。
export function submitEngineeringTaskResult(
  masterOrderId: string,
  taskId: string,
  input: SubmitEngineeringTaskResultInput = {},
): { masterOrder: EngineeringMasterOrderRecord; task: EngineeringTaskRecord } {
  const snapshot = readSnapshot()
  const record = snapshot.records.find((item) => item.masterOrderId === masterOrderId)
  if (!record) throw new Error(`工程主单不存在：${masterOrderId}`)
  if (record.status !== '已发布' && record.status !== '进行中') {
    throw new Error('仅进行中的工程主单可以提交任务成果。')
  }

  const task = record.tasks.find((item) => item.taskId === taskId)
  if (!task) throw new Error(`工程任务不存在：${taskId}`)
  if (task.taskType === 'ACCESSORY_PURCHASE') {
    throw new Error('辅料下单任务只能通过绑定采购单自动完成，不能手动提交成果。')
  }
  if (task.status === '未启用') throw new Error('任务未启用，不能提交成果。')
  if (!task.startedAt || !task.events.startedAt) throw new Error('请先点击“开始任务”，再提交成果。')
  if (task.status === '待审核') throw new Error('任务已提交成果，等待审核。')
  if (task.status === '已完成') throw new Error('任务已完成，不能重复提交成果。')
  if (task.status === '因需求变更结束') throw new Error('任务已因需求变更结束，不能提交成果。')
  if (task.status === '待前置') {
    const pendingDependencies = task.dependsOnTaskIds.filter((dependencyId) => {
      const dependency = record.tasks.find((item) => item.taskId === dependencyId)
      return !dependency || (dependency.status !== '已完成' && dependency.status !== '因需求变更结束')
    })
    if (pendingDependencies.length > 0) {
      throw new Error('前置任务未完成，不能提交成果。')
    }
  }

  let normalizedSampleActuals: EngineeringSampleActualLine[] = []
  if (task.taskType === 'PRE_PRODUCTION_SAMPLE') {
    const requirements = task.sampleRequirements || []
    if (!requirements.length) throw new Error('产前版样衣尚未下达制作要求，不能提交成果。')
    if (!input.sampleActuals?.length) throw new Error('请按制作要求逐行填写产前版样衣实际交付。')
    const requirementMap = new Map(requirements.map((line) => [line.requirementLineId, line]))
    const actualsByRequirement = new Map<string, EngineeringSampleActualLine[]>()
    normalizedSampleActuals = input.sampleActuals.map((actual, index) => {
      const requirementLineId = actual.requirementLineId.trim()
      if (!requirementMap.has(requirementLineId)) throw new Error('每行实际样衣必须对应一行已下达的制作要求。')
      const actualQuantity = Number(actual.actualQuantity)
      if (!actual.actualColor.trim() || !actual.actualSize.trim()) throw new Error('请完整填写产前版样衣实际颜色和尺码。')
      if (!Number.isInteger(actualQuantity) || actualQuantity <= 0) throw new Error('产前版样衣实际数量必须为大于 0 的整数。')
      if (!actual.sourcePatternVersion.trim()) throw new Error('请填写产前版样衣使用的纸样版本。')
      if (!actual.productionNote.trim()) throw new Error('请填写产前版样衣制作说明。')
      if (!actual.submittedBy.trim()) throw new Error('请填写产前版样衣成果提交人。')
      const imageFileIds = actual.imageFileIds.map((item) => item.trim()).filter(Boolean)
      if (!imageFileIds.length) throw new Error('每行产前版样衣实际交付必须上传真实样衣图片。')
      const line: EngineeringSampleActualLine = {
        actualLineId: actual.actualLineId?.trim() || `${task.taskId}-ACTUAL-${index + 1}`,
        requirementLineId,
        actualColor: actual.actualColor.trim(),
        actualSize: actual.actualSize.trim(),
        actualQuantity,
        sourcePatternVersion: actual.sourcePatternVersion.trim(),
        productionNote: actual.productionNote.trim(),
        differenceNote: actual.differenceNote.trim(),
        imageFileIds,
        submittedBy: actual.submittedBy.trim(),
        submittedAt: actual.submittedAt?.trim() || '',
      }
      const rows = actualsByRequirement.get(requirementLineId) || []
      rows.push(line)
      actualsByRequirement.set(requirementLineId, rows)
      return line
    })
    requirements.forEach((requirement) => {
      const rows = actualsByRequirement.get(requirement.requirementLineId) || []
      if (!rows.length) throw new Error(`请提交“${requirement.targetColor} / ${requirement.targetSize}”的实际样衣成果。`)
      const actualQuantity = rows.reduce((sum, row) => sum + row.actualQuantity, 0)
      const actualMismatch = rows.some((row) => row.actualColor !== requirement.targetColor || row.actualSize !== requirement.targetSize)
      if ((actualQuantity !== requirement.requiredQuantity || actualMismatch) && !rows.some((row) => row.differenceNote)) {
        throw new Error(`“${requirement.targetColor} / ${requirement.targetSize}”的实际交付与制作要求不一致，请填写差异说明。`)
      }
    })
    const resultImageIds = normalizedSampleActuals.flatMap((line) => line.imageFileIds)
    const resultQuantity = normalizedSampleActuals.reduce((sum, line) => sum + line.actualQuantity, 0)
    const submittedBy = [...new Set(normalizedSampleActuals.map((line) => line.submittedBy))].join('、')
    input = {
      ...input,
      resultImageIds,
      resultQuantity,
      submittedBy,
    }
  }

  const submittedAt = nowText()
  const targetStatus = resolveEngineeringTaskSubmitStatus(task.taskType)
  task.status = targetStatus
  task.submittedAt = submittedAt
  task.events.submittedAt = submittedAt
  if (input.resultImageIds) task.resultImageIds = [...input.resultImageIds]
  if (input.resultQuantity !== undefined) task.resultQuantity = Math.max(0, Number(input.resultQuantity || 0))
  if (input.submittedBy !== undefined) task.resultSubmittedBy = input.submittedBy.trim()
  if (task.taskType === 'PRE_PRODUCTION_SAMPLE') {
    task.sampleActuals = normalizedSampleActuals.map((line) => ({ ...line, submittedAt }))
  }
  task.submittedByName = input.submittedBy?.trim() || task.assigneeName
  if (targetStatus === '已完成') {
    task.firstCompletedAt = task.firstCompletedAt || submittedAt
    task.effectiveCompletedAt = submittedAt
    task.events.firstCompletedAt = task.events.firstCompletedAt || submittedAt
    task.events.effectiveCompletedAt = submittedAt
    const activeReworkRound = task.reworkRounds.at(-1)
    if (activeReworkRound && !activeReworkRound.passedAt) {
      activeReworkRound.submittedAt = submittedAt
      activeReworkRound.passedAt = submittedAt
    }
  }
  task.operationLogs.push({
    operationType: '提交成果',
    operatorId: task.submittedById,
    operatorName: task.submittedByName,
    operatedAt: submittedAt,
    note: task.resultSummary,
    roundNo: task.currentRoundNo,
  })
  refreshWaitingEngineeringTasks(record)
  writeSnapshot(snapshot)
  return { masterOrder: cloneRecord(record), task: cloneTask(task) }
}
