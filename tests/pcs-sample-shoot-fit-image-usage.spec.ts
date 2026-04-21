import assert from 'node:assert/strict'

import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  listActiveProjectTemplates,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectImageAssets } from '../src/data/pcs-project-image-repository.ts'
import {
  appendSampleShootImages,
  listSampleShootCandidateImages,
  listSampleShootImageAssets,
  updateSampleShootImageUsage,
} from '../src/data/pcs-sample-shoot-image-service.ts'

function buildProjectDraft() {
  const draft = createEmptyProjectDraft()
  const catalog = getProjectCreateCatalog()
  const template = listActiveProjectTemplates()[0]
  const category = catalog.categories[0]
  const subCategory = category.children[0]
  const brand = catalog.brands[0]
  const styleCode = catalog.styleCodes[0]
  const owner = catalog.owners[0]
  const team = catalog.teams[0]

  draft.projectName = '样衣拍摄图片用途测试项目'
  draft.projectSourceType = catalog.projectSourceTypes[0]
  draft.templateId = template.id
  draft.categoryId = category.id
  draft.categoryName = category.name
  draft.subCategoryId = subCategory?.id || ''
  draft.subCategoryName = subCategory?.name || ''
  draft.brandId = brand.id
  draft.brandName = brand.name
  draft.styleCodeId = styleCode.id
  draft.styleCodeName = styleCode.name
  draft.styleNumber = styleCode.name
  draft.styleType = template.styleType[0]
  draft.yearTag = catalog.yearTags[0]
  draft.priceRangeLabel = catalog.priceRanges[0]
  draft.targetChannelCodes = ['tiktok-shop']
  draft.ownerId = owner.id
  draft.ownerName = owner.name
  draft.teamId = team.id
  draft.teamName = team.name
  return draft
}

resetProjectRepository()
resetProjectImageAssets()

const created = createProject(buildProjectDraft(), '测试用户')
const projectId = created.project.projectId

const [flatImage] = appendSampleShootImages(projectId, 'sampleFlatImageIds', ['data:image/png;base64,flat-usage'], '测试用户')
const [tryOnImage] = appendSampleShootImages(projectId, 'sampleTryOnImageIds', ['data:image/png;base64,try-usage'], '测试用户')
const [detailImage] = appendSampleShootImages(projectId, 'sampleDetailImageIds', ['data:image/png;base64,detail-usage'], '测试用户')

updateSampleShootImageUsage(projectId, flatImage.imageId, 'listing', '测试用户')
updateSampleShootImageUsage(projectId, tryOnImage.imageId, 'styleArchive', '测试用户')
updateSampleShootImageUsage(projectId, detailImage.imageId, 'retake', '测试用户')

const imageMap = new Map(listSampleShootImageAssets(projectId).map((item) => [item.imageId, item]))

assert.equal(imageMap.get(flatImage.imageId)?.imageStatus, '可用于上架', '可用于商品上架的图片状态应正确')
assert.ok(imageMap.get(flatImage.imageId)?.usageScopes.includes('商品上架'), '可用于商品上架的图片应带商品上架用途')

assert.equal(imageMap.get(tryOnImage.imageId)?.imageStatus, '可用于款式档案', '可用于款式档案的图片状态应正确')
assert.ok(imageMap.get(tryOnImage.imageId)?.usageScopes.includes('款式档案'), '可用于款式档案的图片应带款式档案用途')

assert.equal(imageMap.get(detailImage.imageId)?.imageStatus, '需重拍', '需重拍图片状态应正确')
assert.ok(!imageMap.get(detailImage.imageId)?.usageScopes.includes('商品上架'), '需重拍图片不应保留商品上架用途')

assert.deepEqual(
  listSampleShootCandidateImages(projectId, '商品上架').map((item) => item.imageId),
  [flatImage.imageId],
  '商品上架候选图应只返回可用于商品上架的图片',
)
assert.deepEqual(
  listSampleShootCandidateImages(projectId, '款式档案').map((item) => item.imageId),
  [tryOnImage.imageId],
  '款式档案候选图应只返回可用于款式档案的图片',
)

updateSampleShootImageUsage(projectId, flatImage.imageId, 'evaluateOnly', '测试用户')
assert.equal(
  listSampleShootCandidateImages(projectId, '商品上架').length,
  0,
  '调整为仅用于样衣评估后，不应继续作为商品上架候选图',
)

console.log('pcs-sample-shoot-fit-image-usage.spec.ts PASS')
