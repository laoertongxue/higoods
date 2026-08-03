import { getProjectById } from './pcs-project-repository.ts'
import { getStyleArchiveById } from './pcs-style-archive-repository.ts'
import type { PcsProjectRecord } from './pcs-project-types.ts'
import type { StyleArchiveShellRecord } from './pcs-style-archive-types.ts'
import type { TechnicalDataVersionRecord } from './pcs-technical-data-version-types.ts'

export interface TechnicalVersionProductProjectSource {
  style: StyleArchiveShellRecord
  project: PcsProjectRecord
}

// 技术版本的 sourceProjectId 是工程主单／工程变更任务 ID。
// 商品项目必须统一经由 技术版本 -> 款式档案 -> 款式来源项目 解析。
export function resolveTechnicalVersionProductProject(
  record: Pick<TechnicalDataVersionRecord, 'styleId'>,
): TechnicalVersionProductProjectSource | null {
  const style = getStyleArchiveById(record.styleId)
  if (!style?.sourceProjectId) return null
  const project = getProjectById(style.sourceProjectId)
  return project ? { style, project } : null
}
