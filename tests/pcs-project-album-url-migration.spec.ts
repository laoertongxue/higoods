import assert from 'node:assert/strict'

import {
  getProjectStoreSnapshot,
  listProjects,
  replaceProjectStore,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { listProjectReferenceImages, resetProjectImageAssets } from '../src/data/pcs-project-image-repository.ts'

resetProjectRepository()
resetProjectImageAssets()

const snapshot = getProjectStoreSnapshot()
const seedProject = listProjects()[0]

assert.ok(seedProject, '应存在演示项目')

replaceProjectStore({
  ...snapshot,
  projects: snapshot.projects.map((project) =>
    project.projectId === seedProject!.projectId
      ? {
          ...project,
          projectAlbumUrls: ['https://example.com/reference-a.png', 'https://example.com/reference-b.png'],
        }
      : project,
  ),
})

const migratedImages = listProjectReferenceImages(seedProject!.projectId)

assert.equal(migratedImages.length, 2, '旧 projectAlbumUrls 应迁移为项目图片资产')
assert.equal(migratedImages[0]?.imageName, '参考图片 1', '迁移后应生成顺序图片名称')
assert.equal(migratedImages[0]?.sourceType, '商品项目立项', '迁移来源类型应为商品项目立项')
assert.equal(migratedImages[0]?.imageStatus, '待确认', '迁移后图片状态应为待确认')

replaceProjectStore(getProjectStoreSnapshot())

const migratedImagesAgain = listProjectReferenceImages(seedProject!.projectId)
assert.equal(migratedImagesAgain.length, 2, '迁移应幂等，重复执行不应生成重复图片资产')

console.log('pcs-project-album-url-migration.spec.ts PASS')
