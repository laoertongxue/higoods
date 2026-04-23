import { getProjectArchiveByProjectId } from './pcs-project-archive-repository.ts'
import { PROJECT_ARCHIVE_STATUS_LABELS } from './pcs-project-archive-collector.ts'
import { getProjectById } from './pcs-project-repository.ts'
import { getStyleArchiveById } from './pcs-style-archive-repository.ts'
import { getCurrentTechPackVersionByStyleId } from './pcs-technical-data-version-repository.ts'
import { listPatternAssetsByProjectId } from './pcs-pattern-library-archive-linkage.ts'
import { listTechPackVersionLogsForArchive } from './pcs-tech-pack-archive-linkage.ts'

export interface ProjectClosureViewModel {
  projectId: string
  styleText: string
  currentTechnicalVersionText: string
  currentPatternAssetText: string
  techPackLogText: string
  archiveStatusText: string
}

export function buildProjectClosureViewModel(projectId: string): ProjectClosureViewModel | null {
  const project = getProjectById(projectId)
  if (!project) return null
  const style = project.linkedStyleId ? getStyleArchiveById(project.linkedStyleId) : null
  const currentTechnicalVersion = style ? getCurrentTechPackVersionByStyleId(style.styleId) : null
  const patternAssets = listPatternAssetsByProjectId(project.projectId)
  const techPackLogs =
    style && currentTechnicalVersion
      ? listTechPackVersionLogsForArchive({
          projectId: project.projectId,
          styleId: style.styleId,
          versions: [currentTechnicalVersion],
        })
      : []
  const archive = getProjectArchiveByProjectId(project.projectId)
  return {
    projectId,
    styleText: style ? `${style.styleCode} / ${style.styleName}` : '未生成款式档案',
    currentTechnicalVersionText: currentTechnicalVersion
      ? `${currentTechnicalVersion.technicalVersionCode} / ${currentTechnicalVersion.versionLabel}`
      : '未启用技术包版本',
    currentPatternAssetText: `当前花型资产 ${patternAssets.length} 个`,
    techPackLogText: `技术包版本日志 ${techPackLogs.length} 条`,
    archiveStatusText: archive ? `项目资料归档：${PROJECT_ARCHIVE_STATUS_LABELS[archive.archiveStatus]}` : '项目资料归档：未建立',
  }
}
