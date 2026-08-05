import {
  appendTechPackVersionLog,
} from './pcs-tech-pack-version-log-repository.ts'
import {
  canPublishTechnicalVersionByReview,
  getTechnicalProcessRouteGate,
} from './pcs-tech-pack-review.ts'
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
  syncStyleArchiveFromTechPackVersion,
  writeProjectRelationFromTechPackVersion,
} from './pcs-tech-pack-task-generation.ts'
import { syncExistingProjectArchiveByProjectId } from './pcs-project-archive-sync.ts'
import {
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  updateTechnicalDataVersionContent,
  updateTechnicalDataVersionRecord,
  publishTechnicalDataVersionRecord,
} from './pcs-technical-data-version-repository.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from './pcs-technical-data-version-types.ts'
import { resolveTechnicalVersionProductProject } from './pcs-technical-data-version-project-source.ts'

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function mergeLegacyPayloadWithRouteGate(
  current: TechnicalDataVersionContent | null,
  patch: Partial<TechnicalDataVersionContent>,
): Record<string, unknown> {
  const legacyPayload = {
    ...(current?.legacyCompatibleCostPayload ?? {}),
    ...(patch.legacyCompatibleCostPayload ?? {}),
  }
  const routeGateKeys = [
    'processRouteStatus',
    'processRouteConfirmedBy',
    'processRouteConfirmedAt',
    'processRouteUpdatedBy',
    'processRouteUpdatedAt',
    'processRouteChangeReason',
  ] as const
  routeGateKeys.forEach((key) => {
    if (patch[key] !== undefined) legacyPayload[key] = patch[key]
  })
  return legacyPayload
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
  const currentContent = getTechnicalDataVersionContent(technicalVersionId)

  updateTechnicalDataVersionContent(technicalVersionId, {
    ...contentPatch,
    legacyCompatibleCostPayload: mergeLegacyPayloadWithRouteGate(currentContent, contentPatch),
  })
  const nextRecord = updateTechnicalDataVersionRecord(technicalVersionId, {
    updatedAt: nowText(),
    updatedBy: operatorName,
  })
  if (!nextRecord) throw new Error('保存技术包版本失败。')

  writeProjectRelationFromTechPackVersion(nextRecord, operatorName)
  syncStyleArchiveFromTechPackVersion(nextRecord)
  syncProjectFromTechPackVersion(nextRecord)
  const source = resolveTechnicalVersionProductProject(nextRecord)
  if (source) syncExistingProjectArchiveByProjectId(source.project.projectId, operatorName)
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
  const source = resolveTechnicalVersionProductProject(nextRecord)
  if (source) syncExistingProjectArchiveByProjectId(source.project.projectId, operatorName)
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
  if (!getTechnicalProcessRouteGate(technicalVersionId, content).confirmed) {
    throw new Error('工艺路线未确认，不能发布正式技术包。')
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
  const source = resolveTechnicalVersionProductProject(nextRecord)
  if (source) syncExistingProjectArchiveByProjectId(source.project.projectId, operatorName)
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
