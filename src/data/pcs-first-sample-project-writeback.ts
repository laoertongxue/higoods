import { getProjectById } from './pcs-project-repository.ts'
import {
  getFirstSampleTaskById,
  listFirstSampleTasksByProject,
  updateFirstSampleTask,
} from './pcs-first-sample-repository.ts'
import {
  listProjectRelationsBySourceObject,
  upsertProjectRelation,
} from './pcs-project-relation-repository.ts'
import { syncExistingProjectArchiveByProjectId } from './pcs-project-archive-sync.ts'
import { listPlateMakingTasksByProject } from './pcs-plate-making-repository.ts'
import { listPatternTasksByProject } from './pcs-pattern-task-repository.ts'
import { listRevisionTasksByProject } from './pcs-revision-task-repository.ts'
import { nowTaskText } from './pcs-task-source-normalizer.ts'
import type { FirstSampleProjectRelationMeta, FirstSampleTaskRecord } from './pcs-first-sample-types.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'

export const FIRST_SAMPLE_FACTORY_OPTIONS = [
  { factoryId: 'factory-shenzhen-01', factoryName: '深圳工厂01' },
  { factoryId: 'factory-shenzhen-02', factoryName: '深圳工厂02' },
  { factoryId: 'factory-jakarta-01', factoryName: '雅加达工厂01' },
  { factoryId: 'factory-jakarta-02', factoryName: '雅加达工厂02' },
] as const

export interface FirstSampleProjectDefaults {
  sourceTaskType: string
  sourceTaskId: string
  sourceTaskCode: string
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  sourceTechPackVersionLabel: string
  ownerName: string
}

export interface FirstSampleProjectWritebackResult {
  ok: boolean
  message: string
  task: FirstSampleTaskRecord | null
}

function sortByUpdatedAtDesc<T extends { updatedAt?: string; createdAt?: string }>(items: T[]): T[] {
  return [...items].sort((left, right) =>
    (right.updatedAt || right.createdAt || '').localeCompare(left.updatedAt || left.createdAt || ''),
  )
}

export function resolveFirstSampleProjectDefaults(projectId: string): FirstSampleProjectDefaults | null {
  const project = getProjectById(projectId)
  if (!project) return null
  const plateTask = sortByUpdatedAtDesc(listPlateMakingTasksByProject(projectId))[0]
  const revisionTask = sortByUpdatedAtDesc(listRevisionTasksByProject(projectId))[0]
  const patternTask = sortByUpdatedAtDesc(listPatternTasksByProject(projectId))[0]
  const source = plateTask
    ? {
        sourceTaskType: '制版任务',
        sourceTaskId: plateTask.plateTaskId,
        sourceTaskCode: plateTask.plateTaskCode,
        versionId: plateTask.linkedTechPackVersionId,
        versionCode: plateTask.linkedTechPackVersionCode,
        versionLabel: plateTask.linkedTechPackVersionLabel,
      }
    : revisionTask
      ? {
          sourceTaskType: '改版任务',
          sourceTaskId: revisionTask.revisionTaskId,
          sourceTaskCode: revisionTask.revisionTaskCode,
          versionId: revisionTask.linkedTechPackVersionId,
          versionCode: revisionTask.linkedTechPackVersionCode,
          versionLabel: revisionTask.linkedTechPackVersionLabel,
        }
      : patternTask
        ? {
            sourceTaskType: '花型任务',
            sourceTaskId: patternTask.patternTaskId,
            sourceTaskCode: patternTask.patternTaskCode,
            versionId: patternTask.linkedTechPackVersionId,
            versionCode: patternTask.linkedTechPackVersionCode,
            versionLabel: patternTask.linkedTechPackVersionLabel,
          }
        : null
  return {
    sourceTaskType: source?.sourceTaskType || '',
    sourceTaskId: source?.sourceTaskId || '',
    sourceTaskCode: source?.sourceTaskCode || '',
    sourceTechPackVersionId: source?.versionId || project.linkedTechPackVersionId || '',
    sourceTechPackVersionCode: source?.versionCode || project.linkedTechPackVersionCode || '',
    sourceTechPackVersionLabel: source?.versionLabel || project.linkedTechPackVersionLabel || '',
    ownerName: project.ownerName,
  }
}

export function getLatestFirstSampleTaskForProject(projectId: string): FirstSampleTaskRecord | null {
  return sortByUpdatedAtDesc(listFirstSampleTasksByProject(projectId))[0] || null
}

export function buildFirstSampleProjectRelationMeta(task: FirstSampleTaskRecord): FirstSampleProjectRelationMeta {
  return {
    sourceTaskType: task.sourceTaskType || task.upstreamObjectType || task.upstreamModule || '',
    sourceTaskId: task.sourceTaskId || task.upstreamObjectId || '',
    sourceTaskCode: task.sourceTaskCode || task.upstreamObjectCode || '',
    sourceTechPackVersionId: task.sourceTechPackVersionId || '',
    sourceTechPackVersionCode: task.sourceTechPackVersionCode || '',
    sourceTechPackVersionLabel: task.sourceTechPackVersionLabel || '',
    factoryId: task.factoryId || '',
    factoryName: task.factoryName || '',
    targetSite: task.targetSite || '',
    sampleMaterialMode: task.sampleMaterialMode || '',
    samplePurpose: task.samplePurpose || '',
    sampleCode: task.sampleCode || '',
    sampleImageIds: [...(task.sampleImageIds || [])],
    fitConfirmationSummary: task.fitConfirmationSummary || '',
    artworkConfirmationSummary: task.artworkConfirmationSummary || '',
    productionReadinessNote: task.productionReadinessNote || '',
    reuseAsFirstOrderBasisFlag: Boolean(task.reuseAsFirstOrderBasisFlag),
    reuseAsFirstOrderBasisConfirmedAt: task.reuseAsFirstOrderBasisConfirmedAt || '',
    reuseAsFirstOrderBasisConfirmedBy: task.reuseAsFirstOrderBasisConfirmedBy || '',
    reuseAsFirstOrderBasisNote: task.reuseAsFirstOrderBasisNote || '',
    confirmedAt: task.confirmedAt || '',
    sourceType: task.sourceType || '',
    upstreamModule: task.upstreamModule || '',
    upstreamObjectType: task.upstreamObjectType || '',
    upstreamObjectId: task.upstreamObjectId || '',
    upstreamObjectCode: task.upstreamObjectCode || '',
    status: task.status || '',
  }
}

function writeProjectRelation(task: FirstSampleTaskRecord, operatorName: string): ProjectRelationRecord {
  const timestamp = nowTaskText()
  return upsertProjectRelation({
    projectRelationId: `rel_${task.projectId}_first_sample_${task.firstSampleTaskId}`,
    projectId: task.projectId,
    projectCode: task.projectCode,
    relationRole: '执行记录',
    sourceModule: '首版样衣打样',
    sourceObjectType: '首版样衣打样任务',
    sourceObjectId: task.firstSampleTaskId,
    sourceObjectCode: task.firstSampleTaskCode,
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
    note: JSON.stringify(buildFirstSampleProjectRelationMeta(task)),
  })
}

export function updateFirstSampleTaskDetailAndSync(
  firstSampleTaskId: string,
  patch: Partial<FirstSampleTaskRecord>,
  operatorName = '当前用户',
): FirstSampleProjectWritebackResult {
  const current = getFirstSampleTaskById(firstSampleTaskId)
  if (!current) return { ok: false, message: '未找到首版样衣打样任务，不能保存详情。', task: null }
  const normalizedPatch: Partial<FirstSampleTaskRecord> = {
    ...patch,
    updatedAt: nowTaskText(),
    updatedBy: operatorName,
  }
  if (Array.isArray(patch.sampleImageIds)) {
    normalizedPatch.sampleImageIds = [...patch.sampleImageIds]
  } else {
    delete normalizedPatch.sampleImageIds
  }
  const updated = updateFirstSampleTask(firstSampleTaskId, normalizedPatch)
  if (!updated) return { ok: false, message: '首版样衣打样任务保存失败。', task: null }
  if (updated.projectId) {
    writeProjectRelation(updated, operatorName)
    syncExistingProjectArchiveByProjectId(updated.projectId, operatorName)
  }
  return { ok: true, message: '已保存首版样衣打样详情，并同步商品项目关系。', task: updated }
}

export function findFirstSampleTaskRelations(firstSampleTaskId: string): ProjectRelationRecord[] {
  return listProjectRelationsBySourceObject({
    sourceModule: '首版样衣打样',
    sourceObjectType: '首版样衣打样任务',
    sourceObjectId: firstSampleTaskId,
  })
}
