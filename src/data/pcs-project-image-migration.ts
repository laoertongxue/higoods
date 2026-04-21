import type { PcsProjectRecord } from './pcs-project-types.ts'
import { buildProjectImageCompatRef, replaceProjectInitReferenceImages } from './pcs-project-image-repository.ts'

export function migrateProjectAlbumUrlsToProjectImages(
  projects: PcsProjectRecord[],
  operatorName = '系统迁移',
): void {
  projects.forEach((project) => {
    if (!Array.isArray(project.projectAlbumUrls) || project.projectAlbumUrls.length === 0) {
      return
    }
    const records = replaceProjectInitReferenceImages(
      project,
      project.projectAlbumUrls,
      operatorName,
      project.updatedAt || project.createdAt,
    )
    project.projectAlbumUrls = records.map((record) => buildProjectImageCompatRef(record))
  })
}
