import assert from 'node:assert/strict'

import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  listActiveProjectTemplates,
  listProjectNodes,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectImageAssets } from '../src/data/pcs-project-image-repository.ts'
import {
  renderPcsProjectCreatePage,
  renderPcsProjectWorkItemDetailPage,
} from '../src/pages/pcs-projects.ts'

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

  draft.projectName = '参考图片展示项目'
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

const createHtml = await renderPcsProjectCreatePage()
assert.match(createHtml, /上传参考图片/, '创建页应提供上传参考图片入口')
assert.match(createHtml, /暂未上传参考图片/, '创建页应显示空状态')

const draft = buildProjectDraft()
draft.projectAlbumUrls = ['data:image/png;base64,ccc']
const created = createProject(draft, '测试用户')
const projectInitNode = listProjectNodes(created.project.projectId).find((item) => item.workItemTypeCode === 'PROJECT_INIT')

assert.ok(projectInitNode, '应存在商品项目立项节点')

const detailHtml = await renderPcsProjectWorkItemDetailPage(created.project.projectId, projectInitNode!.projectNodeId)
assert.match(detailHtml, /参考图片/, '项目立项详情应显示参考图片区域')
assert.match(detailHtml, /open-image-preview/, '项目立项详情应支持图片预览')

console.log('pcs-project-init-reference-image-upload.spec.ts PASS')
