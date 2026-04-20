import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  updateProjectNodeRecord,
  updateProjectRecord,
} from './pcs-project-repository.ts'
import { syncExistingProjectArchiveByProjectId } from './pcs-project-archive-sync.ts'
import { upsertProjectRelation } from './pcs-project-relation-repository.ts'
import { syncProjectNodeInstanceRuntime } from './pcs-project-node-instance-registry.ts'
import { appendTechPackVersionLog } from './pcs-tech-pack-version-log-repository.ts'
import { getStyleArchiveById, updateStyleArchive } from './pcs-style-archive-repository.ts'
import { getTechnicalDataVersionById } from './pcs-technical-data-version-repository.ts'
import type { TechPackSourceTaskType } from './pcs-technical-data-version-types.ts'

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function getProjectNodeBindingByTaskType(projectId: string, taskType: TechPackSourceTaskType) {
  if (taskType === 'PLATE') {
    const node = getProjectNodeRecordByWorkItemTypeCode(projectId, 'PATTERN_TASK')
    return {
      projectNodeId: node?.projectNodeId || null,
      workItemTypeCode: 'PATTERN_TASK',
      workItemTypeName: node?.workItemTypeName || '制版任务',
    }
  }

  if (taskType === 'ARTWORK') {
    const node = getProjectNodeRecordByWorkItemTypeCode(projectId, 'PATTERN_ARTWORK_TASK')
    return {
      projectNodeId: node?.projectNodeId || null,
      workItemTypeCode: 'PATTERN_ARTWORK_TASK',
      workItemTypeName: node?.workItemTypeName || '花型任务',
    }
  }

  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, 'REVISION_TASK')
  return {
    projectNodeId: node?.projectNodeId || null,
    workItemTypeCode: 'REVISION_TASK',
    workItemTypeName: node?.workItemTypeName || '改版任务',
  }
}

export function activateTechPackVersionForStyle(
  styleId: string,
  technicalVersionId: string,
  operatorName = '当前用户',
) {
  const style = getStyleArchiveById(styleId)
  if (!style) {
    throw new Error('未找到正式款式档案，不能启用技术包版本。')
  }

  const record = getTechnicalDataVersionById(technicalVersionId)
  if (!record || record.styleId !== styleId) {
    throw new Error('未找到对应技术包版本，不能启用为当前生效版本。')
  }
  if (record.versionStatus !== 'PUBLISHED') {
    throw new Error('只有已发布技术包版本才能启用为当前生效版本。')
  }

  const activatedAt = nowText()
  updateStyleArchive(styleId, {
    archiveStatus: 'ACTIVE',
    techPackStatus: '已启用',
    currentTechPackVersionId: record.technicalVersionId,
    currentTechPackVersionCode: record.technicalVersionCode,
    currentTechPackVersionLabel: record.versionLabel,
    currentTechPackVersionStatus: '已启用',
    currentTechPackVersionActivatedAt: activatedAt,
    currentTechPackVersionActivatedBy: operatorName,
    updatedAt: activatedAt,
    updatedBy: operatorName,
  })

  if (record.sourceProjectId) {
    const project = getProjectById(record.sourceProjectId)
    updateProjectRecord(
      record.sourceProjectId,
      {
        linkedTechPackVersionId: record.technicalVersionId,
        linkedTechPackVersionCode: record.technicalVersionCode,
        linkedTechPackVersionLabel: record.versionLabel,
        linkedTechPackVersionStatus: record.versionStatus,
        linkedTechPackVersionPublishedAt: record.publishedAt || activatedAt,
        updatedAt: activatedAt,
      },
      operatorName,
    )

    const sourceNode = getProjectNodeBindingByTaskType(record.sourceProjectId, record.createdFromTaskType)
    if (sourceNode.projectNodeId) {
      updateProjectNodeRecord(
        record.sourceProjectId,
        sourceNode.projectNodeId,
        {
          currentStatus: '进行中',
          latestInstanceId: record.technicalVersionId,
          latestInstanceCode: record.technicalVersionCode,
          latestResultType: '已启用当前生效版本',
          latestResultText: '已启用当前生效技术包版本，可供下游正式消费。',
          pendingActionType: '等待生产消费',
          pendingActionText: '后续生产需求转生产单时将消费当前生效技术包版本。',
          updatedAt: activatedAt,
        },
        operatorName,
      )
      syncProjectNodeInstanceRuntime(record.sourceProjectId, sourceNode.projectNodeId, operatorName, activatedAt)
    }

    upsertProjectRelation({
      projectRelationId: `rel_tech_pack_${record.technicalVersionId}`,
      projectId: record.sourceProjectId,
      projectCode: record.sourceProjectCode,
      projectNodeId: sourceNode.projectNodeId ?? (record.sourceProjectNodeId || null),
      workItemTypeCode: sourceNode.workItemTypeCode,
      workItemTypeName: sourceNode.workItemTypeName,
      relationRole: '产出对象',
      sourceModule: '技术包',
      sourceObjectType: '技术包版本',
      sourceObjectId: record.technicalVersionId,
      sourceObjectCode: record.technicalVersionCode,
      sourceLineId: null,
      sourceLineCode: null,
      sourceTitle: `${record.styleName} ${record.versionLabel}`,
      sourceStatus: record.versionStatus,
      businessDate: activatedAt,
      ownerName: operatorName,
      createdAt: record.createdAt,
      createdBy: record.createdBy,
      updatedAt: activatedAt,
      updatedBy: operatorName,
      note: '',
      legacyRefType: '',
      legacyRefValue: '',
    })

    if (project) {
      syncExistingProjectArchiveByProjectId(project.projectId, operatorName)
    }
  }

  appendTechPackVersionLog({
    logId: `tech_pack_log_activate_${record.technicalVersionId}_${activatedAt.replace(/[^0-9]/g, '')}`,
    technicalVersionId: record.technicalVersionId,
    technicalVersionCode: record.technicalVersionCode,
    versionLabel: record.versionLabel,
    styleId: record.styleId,
    styleCode: record.styleCode,
    logType: '启用当前生效版本',
    sourceTaskType: '',
    sourceTaskId: '',
    sourceTaskCode: '',
    sourceTaskName: '',
    changeScope: '',
    changeText: `已将 ${record.versionLabel} 启用为当前生效技术包版本。`,
    beforeVersionId: style.currentTechPackVersionId || '',
    beforeVersionCode: style.currentTechPackVersionCode || '',
    afterVersionId: record.technicalVersionId,
    afterVersionCode: record.technicalVersionCode,
    createdAt: activatedAt,
    createdBy: operatorName,
  })

  return getTechnicalDataVersionById(technicalVersionId) ?? record
}
