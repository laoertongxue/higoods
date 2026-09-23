import assert from 'node:assert/strict'

import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  listProjectNodes,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectImageAssets } from '../src/data/pcs-project-image-repository.ts'

function buildProjectDraft() {
  const draft = createEmptyProjectDraft()
  const catalog = getProjectCreateCatalog()
  const category = catalog.categories[0]
  const subCategory = category.children[0]
  const brand = catalog.brands[0]
  const styleCode = catalog.styleCodes[0]
  const owner = catalog.owners[0]
  const team = catalog.teams[0]

  draft.projectName = '参考图片展示项目'
  draft.projectSourceType = catalog.projectSourceTypes[0]
  draft.categoryId = category.id
  draft.categoryName = category.name
  draft.subCategoryId = subCategory?.id || ''
  draft.subCategoryName = subCategory?.name || ''
  draft.brandId = brand.id
  draft.brandName = brand.name
  draft.styleCodeId = styleCode.id
  draft.styleCodeName = styleCode.name
  draft.styleNumber = styleCode.name
  draft.styleType = '基础款'
  draft.yearTag = catalog.yearTags[0]
  draft.priceRangeLabel = catalog.priceRanges[0]
  draft.targetChannelCodes = ['tiktok']
  draft.ownerId = owner.id
  draft.ownerName = owner.name
  draft.teamId = team.id
  draft.teamName = team.name
  return draft
}

resetProjectRepository()
resetProjectImageAssets()

const draft = buildProjectDraft()
draft.projectAlbumUrls = ['data:image/png;base64,ccc']
const created = createProject(draft, '测试用户')
const projectInitNode = listProjectNodes(created.project.projectId).find((item) => item.stepCode === 'PROJECT_INIT')

assert.ok(projectInitNode, '应存在商品项目立项节点')
assert.equal(created.project.projectAlbumUrls?.length, 1, '立项参考图片应随项目保存')
assert.match(
  String(created.project.projectAlbumUrls?.[0] || ''),
  /^project-image-asset:/,
  '立项参考图片应写入项目图片资产引用',
)

console.log('pcs-project-init-reference-image-upload.spec.ts PASS')
