import assert from 'node:assert/strict'

import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  createProjectImageAssetRecords,
  getProjectImageAssetById,
  resetProjectImageAssets,
  upsertProjectImageAssets,
} from '../src/data/pcs-project-image-repository.ts'
import { applyStyleArchiveImageSelection } from '../src/data/pcs-project-style-archive-generation.ts'
import {
  findStyleArchiveByProjectId,
  resetStyleArchiveRepository,
} from '../src/data/pcs-style-archive-repository.ts'

resetProjectRepository()
resetStyleArchiveRepository()
resetProjectImageAssets()

const catalog = getProjectCreateCatalog()
const category = catalog.categories[0]
const brand = catalog.brands[0]
const styleCode = catalog.styleCodes[0] || catalog.styles[0]
const owner = catalog.owners[0]
const team = catalog.teams[0]
const channel = catalog.channelOptions[0]
assert.ok(category && brand && styleCode && owner && team && channel)

const { project } = createProject({
  ...createEmptyProjectDraft(),
  projectName: '项目关联档案参考图回写验证',
  projectType: '商品开发',
  projectSourceType: '企划提案',
  categoryId: category.id,
  categoryName: category.name,
  brandId: brand.id,
  brandName: brand.name,
  styleCodeId: styleCode.id,
  styleCodeName: styleCode.name,
  styleType: '基础款',
  priceRangeLabel: '¥199-399',
  targetChannelCodes: [channel.code],
  ownerId: owner.id,
  ownerName: owner.name,
  teamId: team.id,
  teamName: team.name,
}, '测试用户')

const style = findStyleArchiveByProjectId(project.projectId)
assert.ok(style, '项目必须已有同步建立的关联档案')

const [referenceImage] = createProjectImageAssetRecords(project, [{
  imageUrl: 'mock://confirmed-reference',
  imageName: '待确认项目参考图',
  imageType: '项目参考图',
  sourceNodeCode: 'PROJECT_INIT',
  sourceRecordId: 'project-init',
  sourceType: '商品项目立项',
  usageScopes: ['立项参考', '项目资料归档'],
  imageStatus: '待确认',
  mainFlag: false,
  sortNo: 1,
}], '测试用户')
upsertProjectImageAssets([referenceImage])

const applied = applyStyleArchiveImageSelection(style.styleId, {
  projectId: project.projectId,
  styleMainImageId: referenceImage.imageId,
  styleGalleryImageIds: [],
  operatorName: '买手甲',
})
assert.equal(applied.ok, true, applied.message)

const updatedImage = getProjectImageAssetById(referenceImage.imageId)
assert.equal(updatedImage?.imageStatus, '可用于款式档案', '确认选择后必须回写图片状态')
assert.ok(updatedImage?.usageScopes.includes('款式档案'), '确认选择后必须回写款式档案用途')
assert.equal(applied.style?.mainImageId, referenceImage.imageId, '参考图应写入关联档案主图')
assert.deepEqual(applied.style?.galleryImageIds, [referenceImage.imageId], '主图必须同时进入档案图册')
assert.deepEqual(applied.style?.galleryImageUrls, [referenceImage.imageUrl], '档案图册必须继承图片来源 URL')
assert.equal(applied.style?.imageSource, '项目参考图', '档案必须保留图片来源')

console.log('pcs-style-archive-linked-image-writeback.spec.ts PASS')
