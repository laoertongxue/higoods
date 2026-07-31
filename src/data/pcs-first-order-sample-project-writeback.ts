import { getProjectById, type PcsProjectViewRecord } from './pcs-project-repository.ts'
import {
  getFirstOrderSampleTaskById,
  listFirstOrderSampleTasksByProject,
  updateFirstOrderSampleTask,
} from './pcs-first-order-sample-repository.ts'
import { listFirstSampleTasksByProject } from './pcs-first-sample-repository.ts'
import {
  listProjectRelationsBySourceObject,
  upsertProjectRelation,
} from './pcs-project-relation-repository.ts'
import { syncExistingProjectArchiveByProjectId } from './pcs-project-archive-sync.ts'
import {
  getTechnicalDataVersionById,
  listTechnicalDataVersionsByProjectId,
} from './pcs-technical-data-version-repository.ts'
import { nowTaskText } from './pcs-task-source-normalizer.ts'
import type {
  FirstOrderSampleProjectNodeMeta,
  FirstOrderSampleTaskRecord,
} from './pcs-first-order-sample-types.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'
import type { SampleChainMode, SampleSpecialSceneReasonCode } from './pcs-sample-chain-types.ts'

export const FIRST_ORDER_SAMPLE_FACTORY_OPTIONS = [
  { factoryId: 'factory-shenzhen-01', factoryName: '深圳工厂01' },
  { factoryId: 'factory-shenzhen-02', factoryName: '深圳工厂02' },
  { factoryId: 'factory-jakarta-01', factoryName: '雅加达工厂01' },
  { factoryId: 'factory-jakarta-02', factoryName: '雅加达工厂02' },
] as const

export const FIRST_ORDER_SAMPLE_CHAIN_MODE_OPTIONS: Array<{ value: SampleChainMode; label: string }> = [
  { value: '复用首版结论', label: '复用首版结论' },
  { value: '追加独立首单', label: '追加独立首单' },
]

export const FIRST_ORDER_SAMPLE_SPECIAL_REASON_OPTIONS: Array<{
  value: SampleSpecialSceneReasonCode
  label: string
}> = [
  { value: '首版非正确布', label: '首版非正确布' },
  { value: '生产工厂变更', label: '生产工厂变更' },
  { value: '关键工艺变更', label: '关键工艺变更' },
  { value: '买手要求补首单', label: '买手要求补首单' },
  { value: '其他', label: '其他' },
]

export interface FirstOrderSourceFirstSampleOption {
  taskId: string
  taskCode: string
  sampleCode: string
  label: string
}

export interface FirstOrderTechPackVersionOption {
  versionId: string
  versionCode: string
  versionLabel: string
  label: string
}

export interface FirstOrderSampleProjectDefaults {
  sourceFirstSampleTaskId: string
  sourceFirstSampleTaskCode: string
  sourceFirstSampleCode: string
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  sourceTechPackVersionLabel: string
  ownerName: string
}

export interface FirstOrderSampleProjectWritebackResult {
  ok: boolean
  message: string
  task: FirstOrderSampleTaskRecord | null
}

function sortByUpdatedAtDesc<T extends { updatedAt?: string; createdAt?: string }>(items: T[]): T[] {
  return [...items].sort((left, right) =>
    (right.updatedAt || right.createdAt || '').localeCompare(left.updatedAt || left.createdAt || ''),
  )
}

export function listFirstOrderSourceFirstSampleOptions(projectId: string): FirstOrderSourceFirstSampleOption[] {
  return sortByUpdatedAtDesc(listFirstSampleTasksByProject(projectId))
    .filter((task) => task.status === '已通过')
    .map((task) => ({
      taskId: task.firstSampleTaskId,
      taskCode: task.firstSampleTaskCode,
      sampleCode: task.sampleCode,
      label: `${task.firstSampleTaskCode}${task.sampleCode ? ` / ${task.sampleCode}` : ''}`,
    }))
}

export function listFirstOrderTechPackVersionOptions(project: PcsProjectViewRecord): FirstOrderTechPackVersionOption[] {
  const versions = listTechnicalDataVersionsByProjectId(project.projectId)
    .filter((item) => !['草稿', '已作废', '已停用'].includes(item.versionStatus))
    .map((item) => ({
      versionId: item.technicalVersionId,
      versionCode: item.technicalVersionCode,
      versionLabel: item.versionLabel,
      label: `${item.technicalVersionCode} / ${item.versionLabel}`,
    }))
  if (project.linkedTechPackVersionId && !versions.some((item) => item.versionId === project.linkedTechPackVersionId)) {
    const linked = getTechnicalDataVersionById(project.linkedTechPackVersionId)
    versions.unshift({
      versionId: project.linkedTechPackVersionId,
      versionCode: linked?.technicalVersionCode || project.linkedTechPackVersionCode || '',
      versionLabel: linked?.versionLabel || project.linkedTechPackVersionLabel || '',
      label: `${linked?.technicalVersionCode || project.linkedTechPackVersionCode || ''} / ${linked?.versionLabel || project.linkedTechPackVersionLabel || ''}`,
    })
  }
  return versions
}

export function resolveFirstOrderSampleProjectDefaults(projectId: string): FirstOrderSampleProjectDefaults | null {
  const project = getProjectById(projectId)
  if (!project) return null
  const sourceFirstSample = listFirstOrderSourceFirstSampleOptions(projectId)[0]
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

export function getLatestFirstOrderSampleTaskForProject(projectId: string): FirstOrderSampleTaskRecord | null {
  return sortByUpdatedAtDesc(listFirstOrderSampleTasksByProject(projectId))[0] || null
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

function writeProjectRelation(task: FirstOrderSampleTaskRecord, operatorName: string): ProjectRelationRecord {
  const timestamp = nowTaskText()
  return upsertProjectRelation({
    projectRelationId: `rel_${task.projectId}_first_order_sample_${task.firstOrderSampleTaskId}`,
    projectId: task.projectId,
    projectCode: task.projectCode,
    projectNodeId: null,
    stepCode: '',
    stepName: '',
    relationRole: '执行记录',
    sourceModule: '首单样衣打样',
    sourceObjectType: '首单样衣打样任务',
    sourceObjectId: task.firstOrderSampleTaskId,
    sourceObjectCode: task.firstOrderSampleTaskCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: task.title,
    sourceStatus: task.status === '已通过' ? '已完成' : task.status,
    businessDate: timestamp,
    ownerName: task.ownerName,
    createdAt: task.createdAt || timestamp,
    createdBy: task.createdBy || operatorName,
    updatedAt: timestamp,
    updatedBy: operatorName,
    note: JSON.stringify(buildFirstOrderProjectMeta(task)),
    legacyRefType: '',
    legacyRefValue: '',
  })
}

export function updateFirstOrderSampleTaskDetailAndSync(
  firstOrderSampleTaskId: string,
  patch: Partial<FirstOrderSampleTaskRecord>,
  operatorName = '当前用户',
): FirstOrderSampleProjectWritebackResult {
  const current = getFirstOrderSampleTaskById(firstOrderSampleTaskId)
  if (!current) return { ok: false, message: '未找到首单样衣打样任务，不能保存详情。', task: null }
  const updated = updateFirstOrderSampleTask(firstOrderSampleTaskId, {
    ...patch,
    samplePlanLines: Array.isArray(patch.samplePlanLines)
      ? patch.samplePlanLines.map((line) => ({ ...line }))
      : patch.samplePlanLines,
    updatedAt: nowTaskText(),
    updatedBy: operatorName,
  })
  if (!updated) return { ok: false, message: '首单样衣打样任务保存失败。', task: null }
  if (updated.projectId) {
    writeProjectRelation(updated, operatorName)
    syncExistingProjectArchiveByProjectId(updated.projectId, operatorName)
  }
  return { ok: true, message: '已保存首单样衣打样详情，并同步商品项目关系。', task: updated }
}

export function findFirstOrderSampleTaskRelations(firstOrderSampleTaskId: string): ProjectRelationRecord[] {
  return listProjectRelationsBySourceObject({
    sourceModule: '首单样衣打样',
    sourceObjectType: '首单样衣打样任务',
    sourceObjectId: firstOrderSampleTaskId,
  })
}
