import { listTechPackVersionLogsByStyleId, listTechPackVersionLogsByVersionId } from './pcs-tech-pack-version-log-repository.ts'
import { listTechnicalDataVersionsByProjectId } from './pcs-technical-data-version-repository.ts'
import type { TechPackVersionLogRecord } from './pcs-tech-pack-version-log-types.ts'
import type { TechnicalDataVersionRecord } from './pcs-technical-data-version-types.ts'

export function listTechPackVersionLogsByProjectId(projectId: string): TechPackVersionLogRecord[] {
  const versionIds = new Set(listTechnicalDataVersionsByProjectId(projectId).map((item) => item.technicalVersionId))
  return Array.from(versionIds).flatMap((technicalVersionId) => listTechPackVersionLogsByVersionId(technicalVersionId))
}

export function listTechPackVersionLogsForArchive(input: {
  projectId: string
  styleId: string
  versions: TechnicalDataVersionRecord[]
}): TechPackVersionLogRecord[] {
  const versionIds = new Set(input.versions.map((item) => item.technicalVersionId))
  const byVersion = Array.from(versionIds).flatMap((technicalVersionId) => listTechPackVersionLogsByVersionId(technicalVersionId))
  const byStyle = input.styleId ? listTechPackVersionLogsByStyleId(input.styleId) : []
  const byProject = input.projectId ? listTechPackVersionLogsByProjectId(input.projectId) : []
  const map = new Map<string, TechPackVersionLogRecord>()
  ;[...byVersion, ...byStyle, ...byProject].forEach((log) => {
    if (versionIds.size > 0 && log.technicalVersionId && !versionIds.has(log.technicalVersionId)) return
    map.set(log.logId, log)
  })
  return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
