import {
  getProjectById,
  getProjectNodeRecordById,
  listProjectNodes,
  updateProjectNodeRecord,
} from './pcs-project-repository.ts'
import {
  listProjectRelationsByProjectNode,
  listProjectRelationsBySourceObject,
  upsertProjectRelation,
} from './pcs-project-relation-repository.ts'
import {
  getFirstOrderSampleTaskById,
  getLatestFirstOrderSampleTaskByProjectNode,
  listFirstOrderSampleTasks,
  updateFirstOrderSampleTask,
  upsertFirstOrderSampleTask,
} from './pcs-first-order-sample-repository.ts'
import {
  getFirstSampleTaskById,
  listFirstSampleTasksByProject,
} from './pcs-first-sample-repository.ts'
import {
  getTechnicalDataVersionById,
  listTechnicalDataVersionsByProjectId,
} from './pcs-technical-data-version-repository.ts'
import { syncProjectNodeInstanceRuntime } from './pcs-project-node-instance-registry.ts'
import {
  getFirstOrderSampleCompletionMissingFields,
  getFirstOrderSampleNodeEntryMissingFields,
  isFirstOrderSamplePassedStatus,
} from './pcs-first-order-sample-field-policy.ts'
import {
  normalizeSamplePlanLines,
} from './pcs-sample-chain-service.ts'
import { nowTaskText } from './pcs-task-source-normalizer.ts'
import type {
  FirstOrderSampleProjectNodeMeta,
  FirstOrderSampleTaskRecord,
} from './pcs-first-order-sample-types.ts'
import type {
  SampleChainMode,
  SamplePlanLine,
  SampleSpecialSceneReasonCode,
} from './pcs-sample-chain-types.ts'
import type { PcsProjectNodeRecord, PcsProjectViewRecord } from './pcs-project-types.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'

export const FIRST_ORDER_SAMPLE_FACTORY_OPTIONS = [
  { factoryId: 'factory-shenzhen-01', factoryName: '深圳工厂01' },
  { factoryId: 'factory-shenzhen-02', factoryName: '深圳工厂02' },
  { factoryId: 'factory-jakarta-01', factoryName: '雅加达工厂01' },
  { factoryId: 'factory-jakarta-02', factoryName: '雅加达工厂02' },
] as const

export const FIRST_ORDER_SAMPLE_CHAIN_MODE_OPTIONS: SampleChainMode[] = [
  '复用首版结论',
  '新增首单样衣确认',
  '替代布与正确布双确认',
]

export const FIRST_ORDER_SAMPLE_SPECIAL_REASON_OPTIONS: SampleSpecialSceneReasonCode[] = [
  '定位印',
  '大货量大',
  '工厂参照样',
  '正确布确认',
  '其它',
]

export interface FirstOrderSourceFirstSampleOption {
  taskId: string
  taskCode: string
  firstSampleTaskId: string
  firstSampleTaskCode: string
  sampleCode: string
  label: string
}

export interface FirstOrderTechPackVersionOption {
  versionId: string
  versionCode: string
  versionLabel: string
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  sourceTechPackVersionLabel: string
  label: string
}

export interface FirstOrderSampleProjectNodeEntryInput {
  projectId: string
  projectNodeId: string
  sourceFirstSampleTaskId: string
  sourceTechPackVersionId: string
  factoryId: string
  factoryName?: string
  targetSite: string
  sampleChainMode: SampleChainMode | ''
  specialSceneReasonCodes: SampleSpecialSceneReasonCode[]
  specialSceneReasonText?: string
  productionReferenceRequiredFlag?: boolean
  chinaReviewRequiredFlag?: boolean
  correctFabricRequiredFlag?: boolean
  ownerName?: string
  note?: string
  operatorName: string
}

export interface FirstOrderSampleProjectWritebackResult {
  ok: boolean
  message: string
  task: FirstOrderSampleTaskRecord | null
  projectNode: PcsProjectNodeRecord | null
}

function normalizeTargetSite(value: string | null | undefined): string {
  if (value === '深圳' || value === '雅加达') return value
  return ''
}

function normalizeSampleChainMode(value: string | null | undefined): SampleChainMode | '' {
  return FIRST_ORDER_SAMPLE_CHAIN_MODE_OPTIONS.includes(value as SampleChainMode)
    ? (value as SampleChainMode)
    : ''
}

function normalizeReasonCodes(values: unknown): SampleSpecialSceneReasonCode[] {
  if (!Array.isArray(values)) return []
  return values.filter((item): item is SampleSpecialSceneReasonCode =>
    FIRST_ORDER_SAMPLE_SPECIAL_REASON_OPTIONS.includes(item as SampleSpecialSceneReasonCode),
  )
}

function resolveFactoryName(factoryId: string, factoryName?: string): string {
  return factoryName || FIRST_ORDER_SAMPLE_FACTORY_OPTIONS.find((item) => item.factoryId === factoryId)?.factoryName || factoryId
}

function dateKey(timestamp: string): string {
  return timestamp.slice(0, 10).replace(/-/g, '')
}

function nextFirstOrderSampleTaskIdentity(timestamp: string): { taskId: string; taskCode: string } {
  const key = dateKey(timestamp)
  const count = listFirstOrderSampleTasks().filter((task) => task.firstOrderSampleTaskCode.includes(key)).length + 1
  const sequence = String(count).padStart(3, '0')
  return {
    taskId: `first_order_sample_${key}_${sequence}`,
    taskCode: `FOS-${key}-${sequence}`,
  }
}

export function listFirstOrderSourceFirstSampleOptions(projectId: string): FirstOrderSourceFirstSampleOption[] {
  return listFirstSampleTasksByProject(projectId)
    .filter((task) => task.firstSampleTaskId)
    .sort((left, right) => (right.updatedAt || right.createdAt).localeCompare(left.updatedAt || left.createdAt))
    .map((task) => ({
      taskId: task.firstSampleTaskId,
      taskCode: task.firstSampleTaskCode,
      firstSampleTaskId: task.firstSampleTaskId,
      firstSampleTaskCode: task.firstSampleTaskCode,
      sampleCode: task.sampleCode || '',
      label: `${task.firstSampleTaskCode}${task.sampleCode ? ` / ${task.sampleCode}` : ''}`,
    }))
}

export function listFirstOrderTechPackVersionOptions(project: PcsProjectViewRecord): FirstOrderTechPackVersionOption[] {
  const options = listTechnicalDataVersionsByProjectId(project.projectId).map((record) => ({
    versionId: record.technicalVersionId,
    versionCode: record.technicalVersionCode,
    versionLabel: record.versionLabel,
    sourceTechPackVersionId: record.technicalVersionId,
    sourceTechPackVersionCode: record.technicalVersionCode,
    sourceTechPackVersionLabel: record.versionLabel,
    label: `${record.technicalVersionCode} / ${record.versionLabel}`,
  }))
  if (project.linkedTechPackVersionId && !options.some((item) => item.versionId === project.linkedTechPackVersionId)) {
    options.unshift({
      versionId: project.linkedTechPackVersionId,
      versionCode: project.linkedTechPackVersionCode || '',
      versionLabel: project.linkedTechPackVersionLabel || '',
      sourceTechPackVersionId: project.linkedTechPackVersionId,
      sourceTechPackVersionCode: project.linkedTechPackVersionCode || '',
      sourceTechPackVersionLabel: project.linkedTechPackVersionLabel || '',
      label: [project.linkedTechPackVersionCode, project.linkedTechPackVersionLabel].filter(Boolean).join(' / ') || project.linkedTechPackVersionId,
    })
  }
  return options
}

export function resolveFirstOrderSampleProjectNodeDefaults(projectId: string): {
  sourceFirstSampleTaskId: string
  sourceFirstSampleTaskCode: string
  sourceFirstSampleCode: string
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  sourceTechPackVersionLabel: string
  ownerName: string
} | null {
  const project = getProjectById(projectId)
  if (!project) return null
  const sourceFirstSample = listFirstOrderSourceFirstSampleOptions(project.projectId)[0]
  const techPack = listFirstOrderTechPackVersionOptions(project)[0]
  return {
    sourceFirstSampleTaskId: sourceFirstSample?.taskId || '',
    sourceFirstSampleTaskCode: sourceFirstSample?.taskCode || '',
    sourceFirstSampleCode: sourceFirstSample?.sampleCode || '',
    sourceTechPackVersionId: techPack?.versionId || '',
    sourceTechPackVersionCode: techPack?.versionCode || '',
    sourceTechPackVersionLabel: techPack?.versionLabel || '',
    ownerName: project.ownerName,
  }
}

function assertFirstOrderSampleProjectNode(projectId: string, projectNodeId: string): {
  project: PcsProjectViewRecord | null
  node: PcsProjectNodeRecord | null
  error: string
} {
  const project = getProjectById(projectId)
  if (!project) return { project: null, node: null, error: '未找到商品项目，不能创建首单样衣打样任务。' }
  const node = getProjectNodeRecordById(projectId, projectNodeId)
  if (!node) return { project, node: null, error: '未找到首单样衣打样节点，不能创建任务。' }
  if (node.workItemTypeCode !== 'FIRST_ORDER_SAMPLE') {
    return { project, node, error: '当前节点不是首单样衣打样，不能创建首单样衣任务。' }
  }
  return { project, node, error: '' }
}

function buildRelationId(task: FirstOrderSampleTaskRecord): string {
  return `${task.projectId}__${task.projectNodeId}__first_order_sample__${task.firstOrderSampleTaskId}`
}

export function buildFirstOrderProjectMeta(task: FirstOrderSampleTaskRecord): FirstOrderSampleProjectNodeMeta {
  return {
    sourceFirstSampleTaskId: task.sourceFirstSampleTaskId || '',
    sourceFirstSampleTaskCode: task.sourceFirstSampleTaskCode || '',
    sourceFirstSampleCode: task.sourceFirstSampleCode || '',
    sourceTechPackVersionId: task.sourceTechPackVersionId || '',
    sourceTechPackVersionCode: task.sourceTechPackVersionCode || '',
    sourceTechPackVersionLabel: task.sourceTechPackVersionLabel || '',
    factoryId: task.factoryId || '',
    factoryName: task.factoryName || '',
    targetSite: task.targetSite || '',
    sampleChainMode: task.sampleChainMode || '',
    specialSceneReasonCodes: [...(task.specialSceneReasonCodes || [])],
    specialSceneReasonText: task.specialSceneReasonText || '',
    productionReferenceRequiredFlag: Boolean(task.productionReferenceRequiredFlag),
    chinaReviewRequiredFlag: Boolean(task.chinaReviewRequiredFlag),
    correctFabricRequiredFlag: Boolean(task.correctFabricRequiredFlag),
    samplePlanLines: (task.samplePlanLines || []).map((line) => ({ ...line })),
    finalReferenceNote: task.finalReferenceNote || '',
    patternVersion: task.patternVersion || '',
    artworkVersion: task.artworkVersion || '',
    sampleCode: task.sampleCode || '',
    conclusionResult: task.conclusionResult || '',
    conclusionNote: task.conclusionNote || '',
    confirmedAt: task.confirmedAt || '',
    confirmedBy: task.confirmedBy || '',
    sourceType: task.sourceType || '',
    upstreamModule: task.upstreamModule || '',
    upstreamObjectType: task.upstreamObjectType || '',
    upstreamObjectId: task.upstreamObjectId || '',
    upstreamObjectCode: task.upstreamObjectCode || '',
    status: task.status || '',
  }
}

function buildFirstOrderSampleRelation(
  task: FirstOrderSampleTaskRecord,
  operatorName: string,
  timestamp: string,
): ProjectRelationRecord {
  return {
    projectRelationId: buildRelationId(task),
    projectId: task.projectId,
    projectCode: task.projectCode,
    projectNodeId: task.projectNodeId,
    workItemTypeCode: 'FIRST_ORDER_SAMPLE',
    workItemTypeName: '首单样衣打样',
    relationRole: '执行记录',
    sourceModule: '首单样衣打样',
    sourceObjectType: '首单样衣打样任务',
    sourceObjectId: task.firstOrderSampleTaskId,
    sourceObjectCode: task.firstOrderSampleTaskCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: task.title,
    sourceStatus: task.status,
    businessDate: timestamp,
    ownerName: task.ownerName,
    createdAt: task.createdAt || timestamp,
    createdBy: task.createdBy || operatorName,
    updatedAt: timestamp,
    updatedBy: operatorName,
    note: JSON.stringify(buildFirstOrderProjectMeta(task)),
    legacyRefType: 'FIRST_ORDER_SAMPLE',
    legacyRefValue: task.firstOrderSampleTaskCode,
  }
}

export function getFirstOrderSampleTaskForProjectNode(
  projectId: string,
  projectNodeId: string,
): FirstOrderSampleTaskRecord | null {
  const task = getLatestFirstOrderSampleTaskByProjectNode(projectId, projectNodeId)
  if (task) return task
  const relation = listProjectRelationsByProjectNode(projectId, projectNodeId).find(
    (item) => item.sourceModule === '首单样衣打样' && item.sourceObjectType === '首单样衣打样任务',
  )
  return relation?.sourceObjectId ? getFirstOrderSampleTaskById(relation.sourceObjectId) : null
}

function unlockNextProjectNode(projectId: string, currentNode: PcsProjectNodeRecord, operatorName: string, timestamp: string): void {
  const nextNode = listProjectNodes(projectId)
    .filter((node) => node.sequenceNo > currentNode.sequenceNo && node.currentStatus === '未开始')
    .sort((left, right) => left.sequenceNo - right.sequenceNo)[0]
  if (!nextNode) return
  updateProjectNodeRecord(projectId, nextNode.projectNodeId, {
    currentStatus: '进行中',
    pendingActionType: '待执行',
    pendingActionText: `当前请处理：${nextNode.workItemTypeName}`,
    updatedAt: timestamp,
  }, operatorName)
}

function buildNodeLatestPatch(task: FirstOrderSampleTaskRecord, timestamp: string): Partial<PcsProjectNodeRecord> {
  const completionMissing = getFirstOrderSampleCompletionMissingFields(task)
  if (isFirstOrderSamplePassedStatus(task.status) && completionMissing.length === 0) {
    return {
      currentStatus: '已完成',
      validInstanceCount: 1,
      latestInstanceId: task.firstOrderSampleTaskId,
      latestInstanceCode: task.firstOrderSampleTaskCode,
      latestResultType: '首单样衣打样已完成',
      latestResultText: '首单样衣打样已完成，商品项目节点同步完成。',
      pendingActionType: '',
      pendingActionText: '',
      currentIssueType: '',
      currentIssueText: '',
      updatedAt: timestamp,
      lastEventType: '首单样衣打样已完成',
      lastEventTime: timestamp,
    }
  }
  if (task.status === '待确认') {
    return {
      currentStatus: '待确认',
      validInstanceCount: 1,
      latestInstanceId: task.firstOrderSampleTaskId,
      latestInstanceCode: task.firstOrderSampleTaskCode,
      latestResultType: '首单样衣打样待确认',
      latestResultText: '首单样衣打样结果已提交，待在详情中完成确认。',
      pendingActionType: '完成首单样衣确认',
      pendingActionText: '请在首单样衣打样详情中填写确认结果。',
      updatedAt: timestamp,
      lastEventType: '首单样衣打样待确认',
      lastEventTime: timestamp,
    }
  }
  return {
    currentStatus: '进行中',
    validInstanceCount: 1,
    latestInstanceId: task.firstOrderSampleTaskId,
    latestInstanceCode: task.firstOrderSampleTaskCode,
    latestResultType: '已创建首单样衣打样任务',
    latestResultText: '已创建首单样衣打样任务，待补齐详细信息。',
    pendingActionType: '补齐首单样衣详情',
    pendingActionText: '请在首单样衣打样详情中补齐样衣计划和确认结果。',
    updatedAt: timestamp,
    lastEventType: '创建首单样衣打样任务',
    lastEventTime: timestamp,
  }
}

export function createOrUpdateFirstOrderSampleTaskFromProjectNode(
  input: FirstOrderSampleProjectNodeEntryInput,
): FirstOrderSampleProjectWritebackResult {
  const { project, node, error } = assertFirstOrderSampleProjectNode(input.projectId, input.projectNodeId)
  if (!project || !node) return { ok: false, message: error, task: null, projectNode: node }

  const normalizedInput = {
    sourceFirstSampleTaskId: input.sourceFirstSampleTaskId.trim(),
    sourceTechPackVersionId: input.sourceTechPackVersionId.trim(),
    factoryId: input.factoryId.trim(),
    targetSite: normalizeTargetSite(input.targetSite),
    sampleChainMode: normalizeSampleChainMode(input.sampleChainMode),
    specialSceneReasonCodes: normalizeReasonCodes(input.specialSceneReasonCodes),
  }
  const missing = getFirstOrderSampleNodeEntryMissingFields(normalizedInput)
  if (missing.length > 0) {
    return { ok: false, message: `请先填写首单样衣必要信息：${missing.join('、')}。`, task: null, projectNode: node }
  }

  const sourceFirstSample = getFirstSampleTaskById(normalizedInput.sourceFirstSampleTaskId)
  if (!sourceFirstSample || sourceFirstSample.projectId !== project.projectId) {
    return { ok: false, message: '请选择当前商品项目下的正式首版样衣任务。', task: null, projectNode: node }
  }

  const techPackOptions = listFirstOrderTechPackVersionOptions(project)
  const selectedTechPack = techPackOptions.find((item) => item.versionId === normalizedInput.sourceTechPackVersionId)
  const techPackRecord = getTechnicalDataVersionById(normalizedInput.sourceTechPackVersionId)
  if (!selectedTechPack && !techPackRecord) {
    return { ok: false, message: '请选择当前商品项目可用的正式技术包版本。', task: null, projectNode: node }
  }

  const timestamp = nowTaskText()
  const existing = getFirstOrderSampleTaskForProjectNode(project.projectId, node.projectNodeId)
  const identity = existing
    ? { taskId: existing.firstOrderSampleTaskId, taskCode: existing.firstOrderSampleTaskCode }
    : nextFirstOrderSampleTaskIdentity(timestamp)
  const sampleChainMode = normalizedInput.sampleChainMode as SampleChainMode
  const factoryName = resolveFactoryName(normalizedInput.factoryId, input.factoryName)
  const ownerName = input.ownerName?.trim() || node.currentOwnerName || project.ownerName
  const sourceFirstSampleCode = sourceFirstSample.sampleCode || ''
  const samplePlanLines = existing?.samplePlanLines?.length
    ? normalizeSamplePlanLines(sampleChainMode, existing.samplePlanLines, sourceFirstSampleCode)
    : []

  const task: FirstOrderSampleTaskRecord = {
    ...(existing || {
      firstOrderSampleTaskId: identity.taskId,
      firstOrderSampleTaskCode: identity.taskCode,
      title: `${project.projectName}首单样衣打样`,
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectNodeId: node.projectNodeId,
      workItemTypeCode: 'FIRST_ORDER_SAMPLE',
      workItemTypeName: '首单样衣打样',
      patternVersion: '',
      artworkVersion: '',
      sampleCode: '',
      finalReferenceNote: '',
      conclusionResult: '',
      conclusionNote: '',
      confirmedAt: '',
      confirmedBy: '',
      status: '待处理',
      ownerId: node.currentOwnerId || project.ownerId,
      ownerName,
      priorityLevel: project.priorityLevel || '中',
      createdAt: timestamp,
      createdBy: input.operatorName,
      updatedAt: timestamp,
      updatedBy: input.operatorName,
      note: '',
      legacyProjectRef: project.projectCode,
      legacyUpstreamRef: sourceFirstSample.firstSampleTaskCode,
    }),
    firstOrderSampleTaskId: identity.taskId,
    firstOrderSampleTaskCode: identity.taskCode,
    title: existing?.title || `${project.projectName}首单样衣打样`,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: node.projectNodeId,
    workItemTypeCode: 'FIRST_ORDER_SAMPLE',
    workItemTypeName: '首单样衣打样',
    sourceType: '首版样衣打样',
    upstreamModule: '首版样衣打样',
    upstreamObjectType: '首版样衣打样任务',
    upstreamObjectId: sourceFirstSample.firstSampleTaskId,
    upstreamObjectCode: sourceFirstSample.firstSampleTaskCode,
    sourceFirstSampleTaskId: sourceFirstSample.firstSampleTaskId,
    sourceFirstSampleTaskCode: sourceFirstSample.firstSampleTaskCode,
    sourceFirstSampleCode,
    sourceTechPackVersionId: normalizedInput.sourceTechPackVersionId,
    sourceTechPackVersionCode: techPackRecord?.technicalVersionCode || selectedTechPack?.versionCode || '',
    sourceTechPackVersionLabel: techPackRecord?.versionLabel || selectedTechPack?.versionLabel || '',
    factoryId: normalizedInput.factoryId,
    factoryName,
    targetSite: normalizedInput.targetSite,
    sampleChainMode,
    specialSceneReasonCodes: normalizedInput.specialSceneReasonCodes,
    specialSceneReasonText: input.specialSceneReasonText?.trim() || existing?.specialSceneReasonText || '',
    productionReferenceRequiredFlag: Boolean(input.productionReferenceRequiredFlag),
    chinaReviewRequiredFlag: Boolean(input.chinaReviewRequiredFlag),
    correctFabricRequiredFlag: Boolean(input.correctFabricRequiredFlag),
    samplePlanLines,
    ownerName,
    note: input.note?.trim() || existing?.note || '',
    legacyProjectRef: project.projectCode,
    legacyUpstreamRef: sourceFirstSample.firstSampleTaskCode,
    updatedAt: timestamp,
    updatedBy: input.operatorName,
  }

  const savedTask = upsertFirstOrderSampleTask(task)
  upsertProjectRelation(buildFirstOrderSampleRelation(savedTask, input.operatorName, timestamp))
  const projectNode = updateProjectNodeRecord(project.projectId, node.projectNodeId, buildNodeLatestPatch(savedTask, timestamp), input.operatorName)
  syncProjectNodeInstanceRuntime(project.projectId, node.projectNodeId, input.operatorName, timestamp)
  return {
    ok: true,
    message: existing
      ? '已更新首单样衣必要信息，并同步商品项目节点。'
      : '已创建首单样衣打样任务，并同步商品项目节点。',
    task: savedTask,
    projectNode,
  }
}

export function syncFirstOrderSampleTaskToProjectNode(input: {
  firstOrderSampleTaskId: string
  operatorName: string
}): FirstOrderSampleProjectWritebackResult {
  const task = getFirstOrderSampleTaskById(input.firstOrderSampleTaskId)
  if (!task) return { ok: false, message: '未找到首单样衣打样任务，不能同步商品项目节点。', task: null, projectNode: null }
  const { project, node, error } = assertFirstOrderSampleProjectNode(task.projectId, task.projectNodeId)
  if (!project || !node) return { ok: false, message: error, task, projectNode: node }

  const timestamp = nowTaskText()
  upsertProjectRelation(buildFirstOrderSampleRelation(task, input.operatorName, timestamp))
  const projectNode = updateProjectNodeRecord(project.projectId, node.projectNodeId, buildNodeLatestPatch(task, timestamp), input.operatorName)
  syncProjectNodeInstanceRuntime(project.projectId, node.projectNodeId, input.operatorName, timestamp)
  if (isFirstOrderSamplePassedStatus(task.status) && getFirstOrderSampleCompletionMissingFields(task).length === 0) {
    unlockNextProjectNode(project.projectId, node, input.operatorName, timestamp)
  }
  return { ok: true, message: '已同步首单样衣打样任务到商品项目节点。', task, projectNode }
}

export function updateFirstOrderSampleTaskDetailAndSync(
  firstOrderSampleTaskId: string,
  patch: Partial<FirstOrderSampleTaskRecord>,
  operatorName = '当前用户',
): FirstOrderSampleProjectWritebackResult {
  const current = getFirstOrderSampleTaskById(firstOrderSampleTaskId)
  if (!current) return { ok: false, message: '未找到首单样衣打样任务，不能保存详情。', task: null, projectNode: null }
  const updated = updateFirstOrderSampleTask(firstOrderSampleTaskId, {
    ...patch,
    samplePlanLines: Array.isArray(patch.samplePlanLines) ? patch.samplePlanLines.map((line) => ({ ...line })) : patch.samplePlanLines,
    updatedAt: nowTaskText(),
    updatedBy: operatorName,
  })
  if (!updated) return { ok: false, message: '首单样衣打样任务保存失败。', task: null, projectNode: null }
  return syncFirstOrderSampleTaskToProjectNode({ firstOrderSampleTaskId: updated.firstOrderSampleTaskId, operatorName })
}

export function findFirstOrderSampleTaskRelations(firstOrderSampleTaskId: string): ProjectRelationRecord[] {
  return listProjectRelationsBySourceObject({
    sourceModule: '首单样衣打样',
    sourceObjectType: '首单样衣打样任务',
    sourceObjectId: firstOrderSampleTaskId,
  })
}
