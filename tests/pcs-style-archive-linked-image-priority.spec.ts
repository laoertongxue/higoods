import assert from 'node:assert/strict'

import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  createProjectImageAssetRecords,
  resetProjectImageAssets,
  upsertProjectImageAssets,
} from '../src/data/pcs-project-image-repository.ts'
import { listStyleArchiveImageCandidates } from '../src/data/pcs-style-archive-image-selection.ts'
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
const subCategory = category?.children[0]
const brand = catalog.brands[0]
const styleCode = catalog.styleCodes[0] || catalog.styles[0]
const owner = catalog.owners[0]
const team = catalog.teams[0]
const channel = catalog.channelOptions[0]
assert.ok(category && brand && styleCode && owner && team && channel)

const { project } = createProject({
  ...createEmptyProjectDraft(),
  projectName: '项目关联档案图片优先级验证',
  projectType: '商品开发',
  projectSourceType: '企划提案',
  categoryId: category.id,
  categoryName: category.name,
  subCategoryId: subCategory?.id || '',
  subCategoryName: subCategory?.name || '',
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
assert.ok(style, '创建商品项目时必须同步建立关联商品／款式档案')

const [listingImage, sampleImage, referenceImage] = createProjectImageAssetRecords(project, [
  {
    imageUrl: 'mock://listing-main',
    imageName: '商品上架主图',
    imageType: '上架图',
    sourceNodeCode: 'CHANNEL_PRODUCT_LISTING',
    sourceRecordId: 'listing-record',
    sourceType: '商品上架',
    usageScopes: ['商品上架', '项目资料归档'],
    imageStatus: '可用于上架',
    mainFlag: true,
    sortNo: 1,
  },
  {
    imageUrl: 'mock://sample-fit',
    imageName: '样衣拍摄图',
    imageType: '试穿图',
    sourceNodeCode: 'SAMPLE_SHOOT_FIT',
    sourceRecordId: 'sample-record',
    sourceType: '样衣拍摄与试穿',
    usageScopes: ['样衣评估', '款式档案'],
    imageStatus: '可用于款式档案',
    mainFlag: false,
    sortNo: 2,
  },
  {
    imageUrl: 'mock://project-reference',
    imageName: '项目参考图',
    imageType: '项目参考图',
    sourceNodeCode: 'PROJECT_INIT',
    sourceRecordId: 'project-init',
    sourceType: '商品项目立项',
    usageScopes: ['立项参考', '项目资料归档'],
    imageStatus: '待确认',
    mainFlag: false,
    sortNo: 3,
  },
], '测试用户')
upsertProjectImageAssets([listingImage, sampleImage, referenceImage])

const candidates = listStyleArchiveImageCandidates(project.projectId)
assert.deepEqual(
  candidates.slice(0, 3).map((item) => item.imageId),
  [listingImage.imageId, sampleImage.imageId, referenceImage.imageId],
  '候选图片必须按上架图、样衣拍摄图、项目参考图排序',
)
assert.equal(candidates[2]?.requiresConfirmation, true, '项目参考图必须明确提示确认后才可使用')

const applied = applyStyleArchiveImageSelection(style.styleId, {
  projectId: project.projectId,
  styleMainImageId: listingImage.imageId,
  styleGalleryImageIds: [sampleImage.imageId],
  operatorName: '测试用户',
})
assert.equal(applied.ok, true, applied.message)
assert.equal(applied.style?.mainImageId, listingImage.imageId, '上架主图应成为关联档案主图')
assert.deepEqual(
  applied.style?.galleryImageIds,
  [listingImage.imageId, sampleImage.imageId],
  '档案图册必须包含主图，并保留所选样衣拍摄图',
)

console.log('pcs-style-archive-linked-image-priority.spec.ts PASS')
