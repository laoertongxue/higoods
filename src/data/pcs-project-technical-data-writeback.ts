import {
  generateTechPackVersionFromPatternTask,
  generateTechPackVersionFromPlateTask,
  generateTechPackVersionFromRevisionTask,
  syncProjectFromTechPackVersion,
  syncProjectTransferPrepNodeFromTechPackVersion,
  syncStyleArchiveFromTechPackVersion,
  writeProjectRelationFromTechPackVersion,
} from './pcs-tech-pack-task-generation.ts'
import { syncExistingProjectArchiveByProjectId } from './pcs-project-archive-sync.ts'
import {
  getTechnicalDataVersionById,
  updateTechnicalDataVersionContent,
  updateTechnicalDataVersionRecord,
  publishTechnicalDataVersionRecord,
} from './pcs-technical-data-version-repository.ts'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
} from './pcs-technical-data-version-types.ts'

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

export {
  generateTechPackVersionFromRevisionTask,
  generateTechPackVersionFromPlateTask,
  generateTechPackVersionFromPatternTask,
}

export function saveTechnicalDataVersionContent(
  technicalVersionId: string,
  contentPatch: Partial<TechnicalDataVersionContent>,
  operatorName = '当前用户',
): TechnicalDataVersionRecord {
  const record = getTechnicalDataVersionById(technicalVersionId)
  if (!record) throw new Error('未找到技术包版本。')

  updateTechnicalDataVersionContent(technicalVersionId, contentPatch)
  const nextRecord = updateTechnicalDataVersionRecord(technicalVersionId, {
    updatedAt: nowText(),
    updatedBy: operatorName,
  })
  if (!nextRecord) throw new Error('保存技术包版本失败。')

  writeProjectRelationFromTechPackVersion(nextRecord, operatorName)
  syncStyleArchiveFromTechPackVersion(nextRecord)
  syncProjectFromTechPackVersion(nextRecord)
  syncProjectTransferPrepNodeFromTechPackVersion(nextRecord, operatorName, 'WRITE')
  syncExistingProjectArchiveByProjectId(nextRecord.sourceProjectId, operatorName)
  return nextRecord
}

export function publishTechnicalDataVersion(
  technicalVersionId: string,
  operatorName = '当前用户',
): TechnicalDataVersionRecord {
  const record = getTechnicalDataVersionById(technicalVersionId)
  if (!record) throw new Error('未找到技术包版本。')
  if (record.missingItemCodes.length > 0) {
    throw new Error(`核心域未补全，暂不能发布：${record.missingItemNames.join('、')}`)
  }

  const publishedAt = nowText()
  const nextRecord = publishTechnicalDataVersionRecord(technicalVersionId, publishedAt, operatorName)
  if (!nextRecord) throw new Error('发布技术包版本失败。')

  syncStyleArchiveFromTechPackVersion(nextRecord)
  return nextRecord
}
