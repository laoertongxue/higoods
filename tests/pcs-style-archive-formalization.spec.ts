import assert from 'node:assert/strict'

import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  formalizeStyleArchive,
  getStyleArchiveFormalizationCheck,
} from '../src/data/pcs-project-style-archive-generation.ts'
import {
  findStyleArchiveByProjectId,
  resetStyleArchiveRepository,
  updateStyleArchive,
} from '../src/data/pcs-style-archive-repository.ts'
import {
  handlePcsProductArchiveEvent,
  renderPcsStyleArchiveDetailPage,
  resetPcsProductArchiveState,
} from '../src/pages/pcs-product-archives.ts'

resetProjectRepository()
resetStyleArchiveRepository()

const catalog = getProjectCreateCatalog()
const category = catalog.categories[0]
const subCategory = category?.children[0]
const brand = catalog.brands[0]
const styleCode = catalog.styleCodes[0] || catalog.styles[0]
const owner = catalog.owners[0]
const team = catalog.teams[0]
const channel = catalog.channelOptions[0]

assert.ok(category, '应存在一级分类')
assert.ok(brand, '应存在品牌')
assert.ok(styleCode, '应存在风格编号')
assert.ok(owner, '应存在负责人')
assert.ok(team, '应存在执行团队')
assert.ok(channel, '应存在目标渠道')

const created = createProject(
  {
    ...createEmptyProjectDraft(),
    projectName: '款式档案正式建档验证项目',
    projectType: '商品开发',
    projectSourceType: '企划提案',
    categoryId: category!.id,
    categoryName: category!.name,
    subCategoryId: subCategory?.id || '',
    subCategoryName: subCategory?.name || '',
    brandId: brand!.id,
    brandName: brand!.name,
    styleCodeId: styleCode!.id,
    styleCodeName: styleCode!.name,
    styleType: '基础款',
    priceRangeLabel: '¥199-399',
    targetChannelCodes: [channel!.code],
    ownerId: owner!.id,
    ownerName: owner!.name,
    teamId: team!.id,
    teamName: team!.name,
  },
  '测试用户',
)

const projectId = created.project.projectId
const generatedStyle = findStyleArchiveByProjectId(projectId)
assert.ok(generatedStyle, '创建商品项目时应同步建立商品／款式档案')

updateStyleArchive(generatedStyle!.styleId, {
  styleName: '',
  styleNumber: '',
  categoryName: '',
  subCategoryName: '',
  brandName: '',
  yearTag: '',
  seasonTags: [],
  styleTags: [],
  targetAudienceTags: [],
  targetChannelCodes: [],
  priceRangeLabel: '待补齐',
  mainImageUrl: '',
  sellingPointText: '',
  detailDescription: '',
})

const beforeCheck = getStyleArchiveFormalizationCheck(generatedStyle!.styleId)
assert.equal(beforeCheck.ready, false, '缺少必填字段时不应允许正式建档')
assert.ok(beforeCheck.missingFields.some((item) => item.label === '款式名称'), '应识别缺少款式名称')
assert.ok(beforeCheck.missingFields.some((item) => item.label === '目标渠道'), '应识别缺少目标渠道')

const failed = formalizeStyleArchive(generatedStyle!.styleId, '测试用户')
assert.equal(failed.ok, false, '缺字段时正式建档应失败')

updateStyleArchive(generatedStyle!.styleId, {
  styleName: '正式建档款式',
  styleNumber: 'STYLE-20260417-001',
  styleType: '基础款',
  categoryName: '女装',
  subCategoryName: '连衣裙',
  brandName: 'ChicMore',
  yearTag: '2026',
  seasonTags: ['夏季'],
  styleTags: ['基础', '轻通勤'],
  targetAudienceTags: ['18-30岁女性'],
  targetChannelCodes: ['tiktok', 'shopee'],
  priceRangeLabel: '¥199-399',
  mainImageUrl: '/placeholder.svg',
  sellingPointText: '轻薄垂感，适合夏季快反上新。',
  detailDescription: '已补齐基础资料，可从草稿进入正式建档。',
})

const success = formalizeStyleArchive(generatedStyle!.styleId, '测试用户')
assert.equal(success.ok, true, `补齐字段后应允许正式建档：${success.message}`)
assert.equal(success.style?.baseInfoStatus, '已建档', '正式建档后应回写款式基础资料状态')
assert.equal(success.style?.archiveStatus, 'DRAFT', '正式建档不应直接改成启用')

resetPcsProductArchiveState()
const detailHtml = renderPcsStyleArchiveDetailPage(generatedStyle!.styleId)
assert.match(detailHtml, /已建档待技术包/, '正式建档后详情页状态应明确为已建档待技术包')
handlePcsProductArchiveEvent({
  dataset: { pcsProductArchiveAction: 'open-style-completion', styleId: generatedStyle!.styleId },
  closest() {
    return this
  },
} as unknown as HTMLElement)
const detailWithDrawerHtml = renderPcsStyleArchiveDetailPage(generatedStyle!.styleId)
assert.match(detailWithDrawerHtml, /正式建档后只读/, '正式建档后应提示核心字段只读')
assert.match(detailWithDrawerHtml, /仅允许补充包装信息与备注/, '正式建档后应只允许受控补充字段')

console.log('pcs-style-archive-formalization.spec.ts PASS')
