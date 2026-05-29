import {
  appendTechPackVersionLog,
} from './pcs-tech-pack-version-log-repository.ts'
import { canPublishTechnicalVersionByReview } from './pcs-tech-pack-review.ts'
import {
  formatTechPackDesignRequirementBlockMessage,
  validateTechPackDesignRequirement,
} from './pcs-tech-pack-design-requirement.ts'
import {
  activateTechPackVersionForStyle,
} from './pcs-tech-pack-version-activation.ts'
import {
  generateTechPackVersionFromPatternTask,
  generateTechPackVersionFromPlateTask,
  generateTechPackVersionFromRevisionTask,
  syncProjectFromTechPackVersion,
  syncProjectSourceNodeFromTechPackVersion,
  syncStyleArchiveFromTechPackVersion,
  writeProjectRelationFromTechPackVersion,
} from './pcs-tech-pack-task-generation.ts'
import { syncExistingProjectArchiveByProjectId } from './pcs-project-archive-sync.ts'
import {
  createTechnicalDataVersionDraft,
  getCurrentTechPackVersionByStyleId,
  getNextStyleVersionMeta,
  getNextTechnicalVersionIdentity,
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  updateTechnicalDataVersionContent,
  updateTechnicalDataVersionRecord,
  publishTechnicalDataVersionRecord,
} from './pcs-technical-data-version-repository.ts'
import { getStyleArchiveById } from './pcs-style-archive-repository.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from './pcs-technical-data-version-types.ts'

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function rebaseTechnicalVersionContent(
  content: TechnicalDataVersionContent,
  baseTechnicalVersionId: string,
  nextTechnicalVersionId: string,
): TechnicalDataVersionContent {
  const serialized = JSON.stringify(content)
  const rebased = baseTechnicalVersionId
    ? JSON.parse(serialized.split(baseTechnicalVersionId).join(nextTechnicalVersionId))
    : JSON.parse(serialized)
  return {
    ...rebased,
    technicalVersionId: nextTechnicalVersionId,
  }
}

export {
  generateTechPackVersionFromRevisionTask,
  generateTechPackVersionFromPlateTask,
  generateTechPackVersionFromPatternTask,
  activateTechPackVersionForStyle,
}

export function saveTechnicalDataVersionContent(
  technicalVersionId: string,
  contentPatch: Partial<TechnicalDataVersionContent>,
  operatorName = '当前用户',
): TechnicalDataVersionRecord {
  const record = getTechnicalDataVersionById(technicalVersionId)
  if (!record) throw new Error('未找到技术包版本。')
  if (record.versionStatus !== 'DRAFT') throw new Error('已发布的正式版本技术包不能编辑。')

  updateTechnicalDataVersionContent(technicalVersionId, contentPatch)
  const nextRecord = updateTechnicalDataVersionRecord(technicalVersionId, {
    updatedAt: nowText(),
    updatedBy: operatorName,
  })
  if (!nextRecord) throw new Error('保存技术包版本失败。')

  writeProjectRelationFromTechPackVersion(nextRecord, operatorName)
  syncStyleArchiveFromTechPackVersion(nextRecord)
  syncProjectFromTechPackVersion(nextRecord)
  syncProjectSourceNodeFromTechPackVersion(nextRecord, operatorName, 'WRITTEN')
  syncExistingProjectArchiveByProjectId(nextRecord.sourceProjectId, operatorName)
  return nextRecord
}

export function saveTechnicalDataVersionRecordMeta(
  technicalVersionId: string,
  patch: Pick<Partial<TechnicalDataVersionRecord>, 'garmentDifficultyGrade'>,
  operatorName = '当前用户',
): TechnicalDataVersionRecord {
  const record = getTechnicalDataVersionById(technicalVersionId)
  if (!record) throw new Error('未找到技术包版本。')
  if (record.versionStatus !== 'DRAFT') throw new Error('已发布的正式版本技术包不能编辑。')

  const nextRecord = updateTechnicalDataVersionRecord(technicalVersionId, {
    ...patch,
    updatedAt: nowText(),
    updatedBy: operatorName,
  })
  if (!nextRecord) throw new Error('保存技术包版本失败。')

  writeProjectRelationFromTechPackVersion(nextRecord, operatorName)
  syncStyleArchiveFromTechPackVersion(nextRecord)
  syncProjectFromTechPackVersion(nextRecord)
  syncProjectSourceNodeFromTechPackVersion(nextRecord, operatorName, 'WRITTEN')
  syncExistingProjectArchiveByProjectId(nextRecord.sourceProjectId, operatorName)
  return nextRecord
}

export function publishTechnicalDataVersion(
  technicalVersionId: string,
  operatorName = '当前用户',
): TechnicalDataVersionRecord {
  const record = getTechnicalDataVersionById(technicalVersionId)
  if (!record) throw new Error('未找到技术包版本。')
  if (record.versionStatus !== 'DRAFT') throw new Error('只有草稿技术包版本才能发布。')
  const content = getTechnicalDataVersionContent(technicalVersionId)
  if (!content) throw new Error('未找到技术包内容，无法发布。')
  const designRequirement = validateTechPackDesignRequirement({
    bomItems: content.bomItems,
    patternDesigns: content.patternDesigns,
  })
  const designMessage = formatTechPackDesignRequirementBlockMessage(
    designRequirement,
    '发布前请先补齐花型设计',
  )
  if (designMessage) throw new Error(designMessage)
  if (record.missingItemCodes.length > 0) {
    throw new Error(`核心域未补全，暂不能发布：${record.missingItemNames.join('、')}`)
  }
  if (!canPublishTechnicalVersionByReview(record)) {
    throw new Error('跟单审核通过后才能发布正式版本。')
  }

  const publishedAt = nowText()
  const nextRecord = publishTechnicalDataVersionRecord(technicalVersionId, publishedAt, operatorName)
  if (!nextRecord) throw new Error('发布技术包版本失败。')

  writeProjectRelationFromTechPackVersion(nextRecord, operatorName)
  syncStyleArchiveFromTechPackVersion(nextRecord)
  syncProjectFromTechPackVersion(nextRecord)
  syncProjectSourceNodeFromTechPackVersion(nextRecord, operatorName, 'WRITTEN')
  syncExistingProjectArchiveByProjectId(nextRecord.sourceProjectId, operatorName)
  appendTechPackVersionLog({
    logId: `tech_pack_log_publish_${nextRecord.technicalVersionId}_${publishedAt.replace(/[^0-9]/g, '')}`,
    technicalVersionId: nextRecord.technicalVersionId,
    technicalVersionCode: nextRecord.technicalVersionCode,
    versionLabel: nextRecord.versionLabel,
    styleId: nextRecord.styleId,
    styleCode: nextRecord.styleCode,
    logType: '发布技术包版本',
    sourceTaskType: '',
    sourceTaskId: '',
    sourceTaskCode: '',
    sourceTaskName: '',
    changeScope: '',
    changeText: `已发布技术包版本 ${nextRecord.versionLabel}。`,
    beforeVersionId: nextRecord.baseTechnicalVersionId || '',
    beforeVersionCode: nextRecord.baseTechnicalVersionCode || '',
    afterVersionId: nextRecord.technicalVersionId,
    afterVersionCode: nextRecord.technicalVersionCode,
    createdAt: publishedAt,
    createdBy: operatorName,
  })
  return nextRecord
}

export function createManualTechnicalDataVersionDraftFromCurrent(
  styleId: string,
  operatorName = '当前用户',
): { action: 'CREATED'; record: TechnicalDataVersionRecord; content: TechnicalDataVersionContent; logType: '手动新增技术包版本'; actionText: string } {
  const style = getStyleArchiveById(styleId)
  if (!style) throw new Error('未找到正式款式档案，不能手动新增技术包版本。')

  const baseRecord = getCurrentTechPackVersionByStyleId(styleId)
  if (!baseRecord) throw new Error('当前款式没有当前生效技术包，不能手动新增版本。')

  const baseContent = getTechnicalDataVersionContent(baseRecord.technicalVersionId)
  if (!baseContent) throw new Error('当前生效技术包缺少内容，不能作为新版本初始化来源。')

  const identity = getNextTechnicalVersionIdentity()
  const versionMeta = getNextStyleVersionMeta(styleId)
  const sourceProjectNodeId = style.sourceProjectNodeId || baseRecord.sourceProjectNodeId || ''
  const nextRecord: TechnicalDataVersionRecord = {
    ...baseRecord,
    technicalVersionId: identity.technicalVersionId,
    technicalVersionCode: identity.technicalVersionCode,
    versionLabel: versionMeta.versionLabel,
    versionNo: versionMeta.versionNo,
    sourceProjectNodeId,
    linkedRevisionTaskIds: [],
    linkedPatternTaskIds: [],
    linkedArtworkTaskIds: [],
    createdFromTaskType: 'MANUAL',
    createdFromTaskId: '',
    createdFromTaskCode: '',
    baseTechnicalVersionId: baseRecord.technicalVersionId,
    baseTechnicalVersionCode: baseRecord.technicalVersionCode,
    changeScope: '手动新增',
    changeSummary: `手动新增版本，初始化复制当前生效版本 ${baseRecord.versionLabel} 的技术包内容。`,
    archiveCollectedFlag: false,
    archiveCollectedAt: '',
    versionStatus: 'DRAFT',
    reviewStage: '未提交审核',
    buyerReview: undefined,
    patternMakerReview: undefined,
    merchandiserReview: undefined,
    reviewSubmittedAt: '',
    reviewSubmittedBy: '',
    returnedFromMerchandiserFlag: false,
    publishedAt: '',
    publishedBy: '',
    createdAt: identity.timestamp,
    createdBy: operatorName,
    updatedAt: identity.timestamp,
    updatedBy: operatorName,
    note: '',
  }
  const nextContent = rebaseTechnicalVersionContent(baseContent, baseRecord.technicalVersionId, nextRecord.technicalVersionId)
  const createdRecord = createTechnicalDataVersionDraft(nextRecord, nextContent)
  syncStyleArchiveFromTechPackVersion(createdRecord)
  appendTechPackVersionLog({
    logId: `tech_pack_log_manual_${createdRecord.technicalVersionId}_${identity.timestamp.replace(/[^0-9]/g, '')}`,
    technicalVersionId: createdRecord.technicalVersionId,
    technicalVersionCode: createdRecord.technicalVersionCode,
    versionLabel: createdRecord.versionLabel,
    styleId: createdRecord.styleId,
    styleCode: createdRecord.styleCode,
    logType: '手动新增技术包版本',
    sourceTaskType: '',
    sourceTaskId: '',
    sourceTaskCode: '',
    sourceTaskName: '',
    changeScope: '手动新增',
    changeText: `已基于当前生效版本 ${baseRecord.versionLabel} 复制生成草稿技术包版本 ${createdRecord.versionLabel}。`,
    beforeVersionId: baseRecord.technicalVersionId,
    beforeVersionCode: baseRecord.technicalVersionCode,
    afterVersionId: createdRecord.technicalVersionId,
    afterVersionCode: createdRecord.technicalVersionCode,
    createdAt: identity.timestamp,
    createdBy: operatorName,
  })
  return {
    action: 'CREATED',
    record: createdRecord,
    content: nextContent,
    logType: '手动新增技术包版本',
    actionText: '已手动新增草稿技术包版本',
  }
}
