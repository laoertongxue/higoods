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
  getEffectiveTechnicalDataVersionByStyleId,
  getNextStyleVersionMeta,
  getNextTechnicalVersionIdentity,
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  listTechnicalDataVersionsByStyleId,
  publishTechnicalDataVersionRecord,
  pushTechnicalDataVersionPendingItem,
  updateTechnicalDataVersionContent,
  updateTechnicalDataVersionRecord,
} from './pcs-technical-data-version-repository.ts'
import { getTechnicalVersionStatusLabel } from './pcs-technical-data-version-view-model.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionCreateResult,
  TechnicalDataVersionRecord,
} from './pcs-technical-data-version-types.ts'

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function buildPendingItem(styleField: string, projectField: string, versionLabel: string, reason: string) {
  return {
    pendingId: `tech_version_writeback_${styleField || 'unknown'}_${projectField || 'none'}_${versionLabel || 'draft'}`,
    rawTechnicalCode: '',
    rawStyleField: styleField,
    rawProjectField: projectField,
    rawVersionLabel: versionLabel,
    reason,
    discoveredAt: nowText(),
  }
}

function getTransferPrepNode(projectId: string) {
  return getProjectNodeRecordByWorkItemTypeCode(projectId, 'PROJECT_TRANSFER_PREP')
}

function buildRelation(
  projectId: string,
  projectCode: string,
  record: TechnicalDataVersionRecord,
  operatorName: string,
): ProjectRelationRecord {
  return {
    projectRelationId: `rel_technical_${record.technicalVersionId}`,
    projectId,
    projectCode,
    projectNodeId: record.sourceProjectNodeId,
    workItemTypeCode: 'PROJECT_TRANSFER_PREP',
    workItemTypeName: '项目转档准备',
    relationRole: '产出对象',
    sourceModule: '技术资料',
    sourceObjectType: '技术资料版本',
    sourceObjectId: record.technicalVersionId,
    sourceObjectCode: record.technicalVersionCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: `${record.styleName} ${record.versionLabel}`,
    sourceStatus: getTechnicalVersionStatusLabel(record.versionStatus),
    businessDate: record.publishedAt || record.updatedAt || record.createdAt,
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

function syncStyleArchiveFromTechnicalVersion(record: TechnicalDataVersionRecord): void {
  const versions = listTechnicalDataVersionsByStyleId(record.styleId)
  const effective = getEffectiveTechnicalDataVersionByStyleId(record.styleId)
  updateStyleArchive(record.styleId, {
    technicalVersionCount: versions.length,
    effectiveTechnicalVersionId: effective?.technicalVersionId || '',
    effectiveTechnicalVersionCode: effective?.technicalVersionCode || '',
    effectiveTechnicalVersionLabel: effective?.versionLabel || '',
    technicalDataStatus:
      versions.length === 0
        ? '未建立'
        : effective
          ? '已发布'
          : '草稿中',
    updatedAt: record.publishedAt || record.updatedAt,
    updatedBy: record.updatedBy,
  })
}

function syncProjectFromTechnicalVersion(record: TechnicalDataVersionRecord): void {
  if (!record.sourceProjectId) return
  updateProjectRecord(
    record.sourceProjectId,
    {
      linkedTechnicalVersionId: record.technicalVersionId,
      linkedTechnicalVersionCode: record.technicalVersionCode,
      linkedTechnicalVersionLabel: record.versionLabel,
      linkedTechnicalVersionStatus: record.versionStatus,
      linkedTechnicalVersionPublishedAt: record.publishedAt || '',
      updatedAt: record.publishedAt || record.updatedAt,
    },
    record.updatedBy,
  )
}

function buildPendingActionText(record: TechnicalDataVersionRecord): string {
  if (record.missingItemNames.length === 0) {
    return '核心域已补全，可发布当前技术资料版本'
  }
  return `请继续补全：${record.missingItemNames.join('、')}`
}

function syncProjectNodeFromTechnicalVersion(
  record: TechnicalDataVersionRecord,
  action: 'create' | 'update' | 'publish',
): void {
  if (!record.sourceProjectId || !record.sourceProjectNodeId) return
  const currentNode = getTransferPrepNode(record.sourceProjectId)
  if (!currentNode || currentNode.projectNodeId !== record.sourceProjectNodeId) return

  if (action === 'create') {
    updateProjectNodeRecord(
      record.sourceProjectId,
      record.sourceProjectNodeId,
      {
        currentStatus: '进行中',
        latestInstanceId: record.technicalVersionId,
        latestInstanceCode: record.technicalVersionCode,
        validInstanceCount: (currentNode.validInstanceCount || 0) + 1,
        latestResultType: '已建立技术资料版本',
        latestResultText: '已为当前款式建立技术资料版本草稿',
        pendingActionType: '补全技术资料',
        pendingActionText:
          '请补全物料清单、纸样管理、工序工艺、放码规则、质检标准和款色用料对应',
        updatedAt: record.createdAt,
      },
      record.updatedBy,
    )
    return
  }

  if (action === 'update') {
    updateProjectNodeRecord(
      record.sourceProjectId,
      record.sourceProjectNodeId,
      {
        latestInstanceId: record.technicalVersionId,
        latestInstanceCode: record.technicalVersionCode,
        latestResultType: '技术资料已更新',
        latestResultText: '已更新技术资料版本内容',
        pendingActionType: record.missingItemNames.length === 0 ? '可以发布' : '继续补全',
        pendingActionText: buildPendingActionText(record),
        updatedAt: record.updatedAt,
      },
      record.updatedBy,
    )
    return
  }

  updateProjectNodeRecord(
    record.sourceProjectId,
    record.sourceProjectNodeId,
    {
      currentStatus: '进行中',
      latestInstanceId: record.technicalVersionId,
      latestInstanceCode: record.technicalVersionCode,
      latestResultType: '技术资料版本已发布',
      latestResultText: '已发布当前款式的正式技术资料版本',
      pendingActionType: '补全规格与成本资料',
      pendingActionText: '请继续补全规格清单和成本核价',
      updatedAt: record.publishedAt || record.updatedAt,
    },
    record.updatedBy,
  )
}

function validateCreateContext(styleId: string) {
  const style = getStyleArchiveById(styleId)
  if (!style) {
    const reason = '未找到正式款式档案，不能建立技术资料版本。'
    pushTechnicalDataVersionPendingItem(buildPendingItem(styleId, '', '', reason))
    throw new Error(reason)
  }

  if (!style.sourceProjectId) {
    const reason = '当前款式档案缺少来源商品项目，不能建立技术资料版本。'
    pushTechnicalDataVersionPendingItem(buildPendingItem(style.styleCode, '', '', reason))
    throw new Error(reason)
  }

  const project = getProjectById(style.sourceProjectId)
  if (!project) {
    const reason = '未找到来源商品项目，不能建立技术资料版本。'
    pushTechnicalDataVersionPendingItem(buildPendingItem(style.styleCode, style.sourceProjectCode, '', reason))
    throw new Error(reason)
  }

  if (!project.linkedStyleId || project.linkedStyleId !== style.styleId) {
    const reason = '当前项目尚未生成正式款式档案，不能建立技术资料版本。'
    pushTechnicalDataVersionPendingItem(buildPendingItem(style.styleCode, project.projectCode, '', reason))
    throw new Error(reason)
  }

  const transferNode = getTransferPrepNode(project.projectId)
  if (!transferNode) {
    const reason = '当前项目未配置“项目转档准备”节点，不能建立技术资料版本。'
    pushTechnicalDataVersionPendingItem(buildPendingItem(style.styleCode, project.projectCode, '', reason))
    throw new Error(reason)
  }

  if (transferNode.currentStatus === '已取消') {
    const reason = '当前项目节点已取消，不能建立技术资料版本。'
    pushTechnicalDataVersionPendingItem(buildPendingItem(style.styleCode, project.projectCode, '', reason))
    throw new Error(reason)
  }

  return { style, project, transferNode }
}

export function createTechnicalDataVersionFromStyle(
  styleId: string,
  operatorName = '当前用户',
  options?: { copyFromVersionId?: string | null },
): TechnicalDataVersionCreateResult {
  const { style, project, transferNode } = validateCreateContext(styleId)
  const identity = getNextTechnicalVersionIdentity()
  const versionMeta = getNextStyleVersionMeta(styleId)
  const copyFrom =
    options?.copyFromVersionId ? getTechnicalDataVersionContent(options.copyFromVersionId) : null

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
      linkedPatternTaskIds: [],
      linkedArtworkTaskIds: [],
      linkedPartTemplateIds: [],
      linkedPatternLibraryVersionIds: [],
      versionStatus: 'DRAFT',
      effectiveFlag: false,
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
    copyFrom
      ? {
          ...copyFrom,
          technicalVersionId: identity.technicalVersionId,
        }
      : undefined,
  )

  const content = getTechnicalDataVersionContent(record.technicalVersionId)
  if (!content) {
    throw new Error('技术资料版本内容创建失败。')
  }

  upsertProjectRelation(buildRelation(project.projectId, project.projectCode, record, operatorName))
  syncStyleArchiveFromTechnicalVersion(record)
  syncProjectFromTechnicalVersion(record)
  syncProjectNodeFromTechnicalVersion(record, 'create')
  syncExistingProjectArchiveByProjectId(project.projectId, operatorName)

  return { record, content }
}

export function createTechnicalDataVersionFromProject(
  projectId: string,
  operatorName = '当前用户',
  options?: { copyFromVersionId?: string | null },
): TechnicalDataVersionCreateResult {
  const project = getProjectById(projectId)
  if (!project?.linkedStyleId) {
    const reason = '当前项目尚未生成正式款式档案，不能建立技术资料版本。'
    pushTechnicalDataVersionPendingItem(buildPendingItem('', project?.projectCode || projectId, '', reason))
    throw new Error(reason)
  }
  return createTechnicalDataVersionFromStyle(project.linkedStyleId, operatorName, options)
}

export function saveTechnicalDataVersionContent(
  technicalVersionId: string,
  contentPatch: Partial<TechnicalDataVersionContent>,
  operatorName = '当前用户',
): TechnicalDataVersionRecord {
  const record = getTechnicalDataVersionById(technicalVersionId)
  if (!record) throw new Error('未找到技术资料版本。')

  updateTechnicalDataVersionContent(technicalVersionId, contentPatch)
  const nextRecord = updateTechnicalDataVersionRecord(technicalVersionId, {
    updatedAt: nowText(),
    updatedBy: operatorName,
  })
  if (!nextRecord) throw new Error('保存技术资料版本失败。')

  upsertProjectRelation(buildRelation(nextRecord.sourceProjectId, nextRecord.sourceProjectCode, nextRecord, operatorName))
  syncStyleArchiveFromTechnicalVersion(nextRecord)
  syncProjectFromTechnicalVersion(nextRecord)
  syncProjectNodeFromTechnicalVersion(nextRecord, 'update')
  syncExistingProjectArchiveByProjectId(nextRecord.sourceProjectId, operatorName)
  return nextRecord
}

export function publishTechnicalDataVersion(
  technicalVersionId: string,
  operatorName = '当前用户',
): TechnicalDataVersionRecord {
  const record = getTechnicalDataVersionById(technicalVersionId)
  if (!record) throw new Error('未找到技术资料版本。')
  if (record.missingItemCodes.length > 0) {
    throw new Error(`核心域未补全，暂不能发布：${record.missingItemNames.join('、')}`)
  }

  const publishedAt = nowText()
  const nextRecord = publishTechnicalDataVersionRecord(technicalVersionId, publishedAt, operatorName)
  if (!nextRecord) throw new Error('发布技术资料版本失败。')

  upsertProjectRelation(buildRelation(nextRecord.sourceProjectId, nextRecord.sourceProjectCode, nextRecord, operatorName))
  syncStyleArchiveFromTechnicalVersion(nextRecord)
  syncProjectFromTechnicalVersion(nextRecord)
  syncProjectNodeFromTechnicalVersion(nextRecord, 'publish')
  syncExistingProjectArchiveByProjectId(nextRecord.sourceProjectId, operatorName)
  return nextRecord
}
