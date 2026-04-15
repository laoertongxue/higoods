import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  updateProjectNodeRecord,
  updateProjectRecord,
} from './pcs-project-repository.ts'
import { upsertProjectRelation } from './pcs-project-relation-repository.ts'
import { syncExistingProjectArchiveByProjectId } from './pcs-project-archive-sync.ts'
import { getStyleArchiveById, updateStyleArchive } from './pcs-style-archive-repository.ts'
import {
  createTechnicalDataVersionDraft,
  getCurrentTechPackVersionByStyleId,
  getNextStyleVersionMeta,
  getNextTechnicalVersionIdentity,
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  listTechnicalDataVersionsByStyleId,
  updateTechnicalDataVersionRecord,
} from './pcs-technical-data-version-repository.ts'
import { getPatternTaskById, updatePatternTask } from './pcs-pattern-task-repository.ts'
import { getPlateMakingTaskById, updatePlateMakingTask } from './pcs-plate-making-repository.ts'
import { getRevisionTaskById, updateRevisionTask } from './pcs-revision-task-repository.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'
import { syncProjectNodeInstanceRuntime } from './pcs-project-node-instance-registry.ts'
import type {
  TechPackSourceTaskType,
  TechnicalDataVersionContent,
  TechnicalDataVersionCreateResult,
  TechnicalDataVersionRecord,
} from './pcs-technical-data-version-types.ts'

const ALLOWED_TASK_STATUSES = new Set(['已确认', '已完成'])

export interface TechPackGenerationResult extends TechnicalDataVersionCreateResult {
  action: 'CREATED' | 'WRITTEN'
}

export interface TechPackVersionSourceTaskItem {
  taskType: TechPackSourceTaskType
  taskTypeLabel: string
  taskId: string
  taskCode: string
  title: string
  status: string
}

export interface TechPackVersionSourceTaskSummary {
  createdFromTaskText: string
  taskChainText: string
  items: TechPackVersionSourceTaskItem[]
}

interface TechPackTaskContext {
  taskType: TechPackSourceTaskType
  taskTypeLabel: string
  taskId: string
  taskCode: string
  title: string
  status: string
  projectId: string
  writeTaskLink: (
    record: TechnicalDataVersionRecord,
    operatorName: string,
    updatedAt: string,
  ) => void
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function appendUnique(items: string[], value: string): string[] {
  return items.includes(value) ? [...items] : [...items, value]
}

function getTechPackVersionStatusText(status: TechnicalDataVersionRecord['versionStatus']): string {
  if (status === 'PUBLISHED') return '已发布'
  if (status === 'ARCHIVED') return '已归档'
  return '草稿中'
}

function getStyleTechPackStatus(
  versions: TechnicalDataVersionRecord[],
  currentVersionId: string,
): string {
  if (versions.length === 0) return '未建立'
  if (versions.some((item) => item.versionStatus === 'DRAFT')) return '草稿中'
  if (currentVersionId) return '已启用'
  if (versions.some((item) => item.versionStatus === 'PUBLISHED')) return '已发布'
  return '已归档'
}

export function isTechPackGenerationAllowedStatus(status: string): boolean {
  return ALLOWED_TASK_STATUSES.has(status)
}

export function getTechPackGenerationBlockedReason(status: string): string | null {
  if (isTechPackGenerationAllowedStatus(status)) return null
  return '当前任务尚未确认产出，不能生成技术包版本'
}

export function getCurrentDraftTechPackVersionByStyleId(styleId: string): TechnicalDataVersionRecord | null {
  const drafts = listTechnicalDataVersionsByStyleId(styleId).filter((item) => item.versionStatus === 'DRAFT')
  if (drafts.length > 1) {
    throw new Error('当前款式存在多个草稿技术包版本，不能继续写入。')
  }
  return drafts[0] ?? null
}

export function getCurrentDraftTechPackVersionByProjectId(projectId: string): TechnicalDataVersionRecord | null {
  const project = getProjectById(projectId)
  if (!project?.linkedStyleId) return null
  return getCurrentDraftTechPackVersionByStyleId(project.linkedStyleId)
}

export function getTechPackGenerationActionLabel(projectId: string): string {
  const currentDraft = getCurrentDraftTechPackVersionByProjectId(projectId)
  return currentDraft ? '写入当前草稿技术包' : '生成技术包版本'
}

export function buildTechPackVersionSourceTaskSummary(
  record: Pick<
    TechnicalDataVersionRecord,
    | 'createdFromTaskType'
    | 'createdFromTaskId'
    | 'createdFromTaskCode'
    | 'linkedRevisionTaskIds'
    | 'linkedPatternTaskIds'
    | 'linkedArtworkTaskIds'
  >,
): TechPackVersionSourceTaskSummary {
  const items: TechPackVersionSourceTaskItem[] = []

  record.linkedRevisionTaskIds.forEach((taskId) => {
    const task = getRevisionTaskById(taskId)
    if (!task) return
    items.push({
      taskType: 'REVISION',
      taskTypeLabel: '改版任务',
      taskId: task.revisionTaskId,
      taskCode: task.revisionTaskCode,
      title: task.title,
      status: task.status,
    })
  })

  record.linkedPatternTaskIds.forEach((taskId) => {
    const task = getPlateMakingTaskById(taskId)
    if (!task) return
    items.push({
      taskType: 'PLATE',
      taskTypeLabel: '制版任务',
      taskId: task.plateTaskId,
      taskCode: task.plateTaskCode,
      title: task.title,
      status: task.status,
    })
  })

  record.linkedArtworkTaskIds.forEach((taskId) => {
    const task = getPatternTaskById(taskId)
    if (!task) return
    items.push({
      taskType: 'ARTWORK',
      taskTypeLabel: '花型任务',
      taskId: task.patternTaskId,
      taskCode: task.patternTaskCode,
      title: task.title,
      status: task.status,
    })
  })

  const createdFromTaskLabel =
    record.createdFromTaskType === 'REVISION'
      ? '改版任务'
      : record.createdFromTaskType === 'PLATE'
        ? '制版任务'
        : '花型任务'
  const createdFromTaskText =
    record.createdFromTaskCode && record.createdFromTaskId
      ? `${createdFromTaskLabel} ${record.createdFromTaskCode}`
      : '暂无来源任务'

  const taskChainText =
    items.length > 0
      ? items.map((item) => `${item.taskTypeLabel} ${item.taskCode}`).join('、')
      : '暂无来源任务'

  return {
    createdFromTaskText,
    taskChainText,
    items,
  }
}

function buildRelation(
  projectId: string,
  projectCode: string,
  record: TechnicalDataVersionRecord,
  operatorName: string,
): ProjectRelationRecord {
  return {
    projectRelationId: `rel_tech_pack_${record.technicalVersionId}`,
    projectId,
    projectCode,
    projectNodeId: record.sourceProjectNodeId,
    workItemTypeCode: 'PROJECT_TRANSFER_PREP',
    workItemTypeName: '项目转档准备',
    relationRole: '产出对象',
    sourceModule: '技术包',
    sourceObjectType: '技术包版本',
    sourceObjectId: record.technicalVersionId,
    sourceObjectCode: record.technicalVersionCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: `${record.styleName} ${record.versionLabel}`,
    sourceStatus: record.versionStatus,
    businessDate: record.updatedAt || record.createdAt,
    ownerName: operatorName,
    createdAt: record.createdAt,
    createdBy: record.createdBy,
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
    note: '',
    legacyRefType: '',
    legacyRefValue: '',
  }
}

export function writeProjectRelationFromTechPackVersion(
  record: TechnicalDataVersionRecord,
  operatorName: string,
): ProjectRelationRecord {
  return upsertProjectRelation(buildRelation(record.sourceProjectId, record.sourceProjectCode, record, operatorName))
}

export function syncStyleArchiveFromTechPackVersion(record: TechnicalDataVersionRecord): void {
  const versions = listTechnicalDataVersionsByStyleId(record.styleId)
  const style = getStyleArchiveById(record.styleId)
  updateStyleArchive(record.styleId, {
    techPackVersionCount: versions.length,
    techPackStatus: getStyleTechPackStatus(versions, style?.currentTechPackVersionId || ''),
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
  })
}

export function syncProjectFromTechPackVersion(record: TechnicalDataVersionRecord): void {
  if (!record.sourceProjectId) return
  updateProjectRecord(
    record.sourceProjectId,
    {
      linkedTechPackVersionId: record.technicalVersionId,
      linkedTechPackVersionCode: record.technicalVersionCode,
      linkedTechPackVersionLabel: record.versionLabel,
      linkedTechPackVersionStatus: record.versionStatus,
      linkedTechPackVersionPublishedAt: record.publishedAt || '',
      updatedAt: record.publishedAt || record.updatedAt,
    },
    record.updatedBy,
  )
}

export function syncProjectTransferPrepNodeFromTechPackVersion(
  record: TechnicalDataVersionRecord,
  operatorName: string,
  action: 'CREATE' | 'WRITE',
): void {
  if (!record.sourceProjectId || !record.sourceProjectNodeId) return
  const currentNode = getProjectNodeRecordByWorkItemTypeCode(record.sourceProjectId, 'PROJECT_TRANSFER_PREP')
  if (!currentNode || currentNode.projectNodeId !== record.sourceProjectNodeId) return

  updateProjectNodeRecord(
    record.sourceProjectId,
    record.sourceProjectNodeId,
    {
      currentStatus: '进行中',
      latestInstanceId: record.technicalVersionId,
      latestInstanceCode: record.technicalVersionCode,
      validInstanceCount:
        action === 'CREATE' ? (currentNode.validInstanceCount || 0) + 1 : undefined,
      latestResultType: '技术包版本已建立',
      latestResultText: '已由任务产出技术包版本草稿',
      pendingActionType: '完善技术包内容',
      pendingActionText: '请继续补齐技术包内容并准备发布',
      updatedAt: record.updatedAt,
    },
    operatorName,
  )
  syncProjectNodeInstanceRuntime(record.sourceProjectId, record.sourceProjectNodeId, operatorName, record.updatedAt)
}

function resolveTaskProjectContext(projectId: string) {
  const project = getProjectById(projectId)
  if (!project) {
    throw new Error('未找到正式项目，不能生成技术包版本。')
  }
  if (!project.linkedStyleId) {
    throw new Error('当前任务未绑定正式款式档案，不能生成技术包版本。')
  }
  const style = getStyleArchiveById(project.linkedStyleId)
  if (!style) {
    throw new Error('未找到正式款式档案，不能生成技术包版本。')
  }
  const transferNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'PROJECT_TRANSFER_PREP')
  if (!transferNode) {
    throw new Error('当前项目未配置项目转档准备节点，不能生成技术包版本。')
  }
  return { project, style, transferNode }
}

function createDraftFromTask(
  task: TechPackTaskContext,
  operatorName: string,
): TechnicalDataVersionCreateResult {
  const { project, style, transferNode } = resolveTaskProjectContext(task.projectId)
  const identity = getNextTechnicalVersionIdentity()
  const versionMeta = getNextStyleVersionMeta(style.styleId)
  const baseVersion = getCurrentTechPackVersionByStyleId(style.styleId)
  const baseContent = baseVersion ? getTechnicalDataVersionContent(baseVersion.technicalVersionId) : null

  const record = createTechnicalDataVersionDraft(
    {
      technicalVersionId: identity.technicalVersionId,
      technicalVersionCode: identity.technicalVersionCode,
      versionLabel: versionMeta.versionLabel,
      versionNo: versionMeta.versionNo,
      styleId: style.styleId,
      styleCode: style.styleCode,
      styleName: style.styleName,
      sourceProjectId: project.projectId,
      sourceProjectCode: project.projectCode,
      sourceProjectName: project.projectName,
      sourceProjectNodeId: transferNode.projectNodeId,
      linkedRevisionTaskIds: task.taskType === 'REVISION' ? [task.taskId] : [],
      linkedPatternTaskIds: task.taskType === 'PLATE' ? [task.taskId] : [],
      linkedArtworkTaskIds: task.taskType === 'ARTWORK' ? [task.taskId] : [],
      createdFromTaskType: task.taskType,
      createdFromTaskId: task.taskId,
      createdFromTaskCode: task.taskCode,
      baseTechnicalVersionId: baseVersion?.technicalVersionId || '',
      baseTechnicalVersionCode: baseVersion?.technicalVersionCode || '',
      linkedPartTemplateIds: [],
      linkedPatternLibraryVersionIds: [],
      versionStatus: 'DRAFT',
      bomStatus: 'EMPTY',
      patternStatus: 'EMPTY',
      processStatus: 'EMPTY',
      gradingStatus: 'EMPTY',
      qualityStatus: 'EMPTY',
      colorMaterialStatus: 'EMPTY',
      designStatus: 'EMPTY',
      attachmentStatus: 'EMPTY',
      bomItemCount: 0,
      patternFileCount: 0,
      processEntryCount: 0,
      gradingRuleCount: 0,
      qualityRuleCount: 0,
      colorMaterialMappingCount: 0,
      designAssetCount: 0,
      attachmentCount: 0,
      completenessScore: 0,
      missingItemCodes: [],
      missingItemNames: [],
      publishedAt: '',
      publishedBy: '',
      createdAt: identity.timestamp,
      createdBy: operatorName,
      updatedAt: identity.timestamp,
      updatedBy: operatorName,
      note: '',
      legacySpuCode: style.styleCode,
      legacyVersionLabel: '',
    },
    baseContent
      ? {
          ...baseContent,
          technicalVersionId: identity.technicalVersionId,
        }
      : undefined,
  )

  const content =
    getTechnicalDataVersionContent(record.technicalVersionId) ??
    ({
      technicalVersionId: record.technicalVersionId,
      patternFiles: [],
      patternDesc: '',
      processEntries: [],
      sizeTable: [],
      bomItems: [],
      qualityRules: [],
      colorMaterialMappings: [],
      patternDesigns: [],
      attachments: [],
      legacyCompatibleCostPayload: {},
    } satisfies TechnicalDataVersionContent)

  return { record, content }
}

function writeTaskIntoDraft(
  task: TechPackTaskContext,
  operatorName: string,
  currentDraft: TechnicalDataVersionRecord,
): TechnicalDataVersionRecord {
  const updatedAt = nowText()
  const nextRecord = updateTechnicalDataVersionRecord(currentDraft.technicalVersionId, {
    sourceProjectId: currentDraft.sourceProjectId || getProjectById(task.projectId)?.projectId || '',
    sourceProjectCode: currentDraft.sourceProjectCode || getProjectById(task.projectId)?.projectCode || '',
    sourceProjectName: currentDraft.sourceProjectName || getProjectById(task.projectId)?.projectName || '',
    sourceProjectNodeId:
      currentDraft.sourceProjectNodeId ||
      getProjectNodeRecordByWorkItemTypeCode(task.projectId, 'PROJECT_TRANSFER_PREP')?.projectNodeId ||
      '',
    linkedRevisionTaskIds:
      task.taskType === 'REVISION'
        ? appendUnique(currentDraft.linkedRevisionTaskIds, task.taskId)
        : currentDraft.linkedRevisionTaskIds,
    linkedPatternTaskIds:
      task.taskType === 'PLATE'
        ? appendUnique(currentDraft.linkedPatternTaskIds, task.taskId)
        : currentDraft.linkedPatternTaskIds,
    linkedArtworkTaskIds:
      task.taskType === 'ARTWORK'
        ? appendUnique(currentDraft.linkedArtworkTaskIds, task.taskId)
        : currentDraft.linkedArtworkTaskIds,
    createdFromTaskType: currentDraft.createdFromTaskId ? currentDraft.createdFromTaskType : task.taskType,
    createdFromTaskId: currentDraft.createdFromTaskId || task.taskId,
    createdFromTaskCode: currentDraft.createdFromTaskCode || task.taskCode,
    updatedAt,
    updatedBy: operatorName,
  })
  if (!nextRecord) {
    throw new Error('写入当前草稿技术包失败。')
  }
  return nextRecord
}

function finalizeGeneration(
  task: TechPackTaskContext,
  operatorName: string,
  record: TechnicalDataVersionRecord,
  action: 'CREATED' | 'WRITTEN',
): TechPackGenerationResult {
  const content = getTechnicalDataVersionContent(record.technicalVersionId)
  if (!content) {
    throw new Error('技术包版本内容创建失败。')
  }

  writeProjectRelationFromTechPackVersion(record, operatorName)
  syncStyleArchiveFromTechPackVersion(record)
  syncProjectFromTechPackVersion(record)
  syncProjectTransferPrepNodeFromTechPackVersion(
    record,
    operatorName,
    action === 'CREATED' ? 'CREATE' : 'WRITE',
  )
  task.writeTaskLink(record, operatorName, record.updatedAt)
  syncExistingProjectArchiveByProjectId(record.sourceProjectId, operatorName)

  return {
    action,
    record,
    content,
  }
}

function generateTechPackVersionFromTask(
  task: TechPackTaskContext,
  operatorName = '当前用户',
): TechPackGenerationResult {
  if (!isTechPackGenerationAllowedStatus(task.status)) {
    throw new Error('当前任务尚未确认产出，不能生成技术包版本')
  }

  const { style } = resolveTaskProjectContext(task.projectId)
  const currentDraft = getCurrentDraftTechPackVersionByStyleId(style.styleId)
  if (!currentDraft) {
    const created = createDraftFromTask(task, operatorName)
    return finalizeGeneration(task, operatorName, created.record, 'CREATED')
  }

  const written = writeTaskIntoDraft(task, operatorName, currentDraft)
  return finalizeGeneration(task, operatorName, written, 'WRITTEN')
}

export function generateTechPackVersionFromRevisionTask(
  revisionTaskId: string,
  operatorName = '当前用户',
): TechPackGenerationResult {
  const task = getRevisionTaskById(revisionTaskId)
  if (!task) {
    throw new Error('未找到改版任务，不能生成技术包版本。')
  }
  return generateTechPackVersionFromTask(
    {
      taskType: 'REVISION',
      taskTypeLabel: '改版任务',
      taskId: task.revisionTaskId,
      taskCode: task.revisionTaskCode,
      title: task.title,
      status: task.status,
      projectId: task.projectId,
      writeTaskLink(record, currentOperatorName, updatedAt) {
        updateRevisionTask(task.revisionTaskId, {
          linkedTechPackVersionId: record.technicalVersionId,
          linkedTechPackVersionCode: record.technicalVersionCode,
          linkedTechPackVersionLabel: record.versionLabel,
          linkedTechPackVersionStatus: getTechPackVersionStatusText(record.versionStatus),
          linkedTechPackUpdatedAt: updatedAt,
          updatedAt,
          updatedBy: currentOperatorName,
        })
      },
    },
    operatorName,
  )
}

export function generateTechPackVersionFromPlateTask(
  plateTaskId: string,
  operatorName = '当前用户',
): TechPackGenerationResult {
  const task = getPlateMakingTaskById(plateTaskId)
  if (!task) {
    throw new Error('未找到制版任务，不能生成技术包版本。')
  }
  return generateTechPackVersionFromTask(
    {
      taskType: 'PLATE',
      taskTypeLabel: '制版任务',
      taskId: task.plateTaskId,
      taskCode: task.plateTaskCode,
      title: task.title,
      status: task.status,
      projectId: task.projectId,
      writeTaskLink(record, currentOperatorName, updatedAt) {
        updatePlateMakingTask(task.plateTaskId, {
          linkedTechPackVersionId: record.technicalVersionId,
          linkedTechPackVersionCode: record.technicalVersionCode,
          linkedTechPackVersionLabel: record.versionLabel,
          linkedTechPackVersionStatus: getTechPackVersionStatusText(record.versionStatus),
          linkedTechPackUpdatedAt: updatedAt,
          updatedAt,
          updatedBy: currentOperatorName,
        })
      },
    },
    operatorName,
  )
}

export function generateTechPackVersionFromPatternTask(
  patternTaskId: string,
  operatorName = '当前用户',
): TechPackGenerationResult {
  const task = getPatternTaskById(patternTaskId)
  if (!task) {
    throw new Error('未找到花型任务，不能生成技术包版本。')
  }
  return generateTechPackVersionFromTask(
    {
      taskType: 'ARTWORK',
      taskTypeLabel: '花型任务',
      taskId: task.patternTaskId,
      taskCode: task.patternTaskCode,
      title: task.title,
      status: task.status,
      projectId: task.projectId,
      writeTaskLink(record, currentOperatorName, updatedAt) {
        updatePatternTask(task.patternTaskId, {
          linkedTechPackVersionId: record.technicalVersionId,
          linkedTechPackVersionCode: record.technicalVersionCode,
          linkedTechPackVersionLabel: record.versionLabel,
          linkedTechPackVersionStatus: getTechPackVersionStatusText(record.versionStatus),
          linkedTechPackUpdatedAt: updatedAt,
          updatedAt,
          updatedBy: currentOperatorName,
        })
      },
    },
    operatorName,
  )
}

export function getTechPackVersionById(technicalVersionId: string): TechnicalDataVersionRecord | null {
  return getTechnicalDataVersionById(technicalVersionId)
}
