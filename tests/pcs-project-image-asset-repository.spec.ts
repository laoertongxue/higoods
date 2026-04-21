import assert from 'node:assert/strict'

import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  listActiveProjectTemplates,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { listProjectReferenceImages, resetProjectImageAssets } from '../src/data/pcs-project-image-repository.ts'

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

  draft.projectName = '图片资产测试项目'
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

const draft = buildProjectDraft()
draft.projectAlbumUrls = ['data:image/png;base64,aaa', 'data:image/png;base64,bbb']

const created = createProject(draft, '测试用户')
const imageAssets = listProjectReferenceImages(created.project.projectId)

assert.equal(imageAssets.length, 2, '立项参考图片应写入项目图片资产池')
assert.ok(
  created.project.projectAlbumUrls.every((item) => item.startsWith('project-image-asset:')),
  '项目主记录只应保留轻量图片引用，不应保留原始大图内容',
)
assert.deepEqual(
  imageAssets.map((item) => item.imageType),
  ['项目参考图', '项目参考图'],
  '立项图片类型应为项目参考图',
)
assert.deepEqual(
  imageAssets.map((item) => item.sourceNodeCode),
  ['PROJECT_INIT', 'PROJECT_INIT'],
  '立项图片来源节点应为商品项目立项',
)
assert.deepEqual(
  imageAssets.map((item) => item.usageScopes.join('|')),
  ['立项参考|项目资料归档', '立项参考|项目资料归档'],
  '立项图片用途应包含立项参考和项目资料归档',
)
assert.deepEqual(
  imageAssets.map((item) => item.imageStatus),
  ['待确认', '待确认'],
  '立项图片默认状态应为待确认',
)

console.log('pcs-project-image-asset-repository.spec.ts PASS')
