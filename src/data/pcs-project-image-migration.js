import { buildProjectImageCompatRef, replaceProjectInitReferenceImages } from './pcs-project-image-repository.ts';
export function migrateProjectAlbumUrlsToProjectImages(projects, operatorName = '系统迁移') {
    projects.forEach((project) => {
        if (!Array.isArray(project.projectAlbumUrls) || project.projectAlbumUrls.length === 0) {
            return;
        }
        const records = replaceProjectInitReferenceImages(project, project.projectAlbumUrls, operatorName, project.updatedAt || project.createdAt);
        project.projectAlbumUrls = records.map((record) => buildProjectImageCompatRef(record));
    });
}
