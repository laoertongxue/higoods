import assert from 'node:assert/strict'

import {
  createEmptyProjectDraft,
  createProject,
  getProjectCreateCatalog,
  getProjectNodeRecordByWorkItemTypeCode,
  getProjectStoreSnapshot,
  listActiveProjectTemplates,
  listProjectNodes,
  replaceProjectStore,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import {
  createProjectImageAssetRecords,
  resetProjectImageAssets,
  upsertProjectImageAssets,
} from '../src/data/pcs-project-image-repository.ts'
import {
  formalizeStyleArchive,
  generateStyleArchiveFromProjectNode,
  getStyleArchiveFormalizationCheck,
} from '../src/data/pcs-project-style-archive-generation.ts'
import { resetStyleArchiveRepository, updateStyleArchive } from '../src/data/pcs-style-archive-repository.ts'
import {
  handlePcsProductArchiveEvent,
  renderPcsStyleArchiveDetailPage,
  resetPcsProductArchiveState,
} from '../src/pages/pcs-product-archives.ts'

resetProjectRepository()
resetStyleArchiveRepository()
resetProjectRelationRepository()
resetProjectChannelProductRepository()
resetProjectImageAssets()

const catalog = getProjectCreateCatalog()
const template = listActiveProjectTemplates()[0]
const category = catalog.categories[0]
const subCategory = category?.children[0]
const brand = catalog.brands[0]
const styleCode = catalog.styleCodes[0] || catalog.styles[0]
const owner = catalog.owners[0]
const team = catalog.teams[0]
const channel = catalog.channelOptions[0]

assert.ok(template, '应存在可用项目模板')
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
    templateId: template!.id,
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
const styleNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'STYLE_ARCHIVE_CREATE')
const conclusionNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'TEST_CONCLUSION')
const orderedNodes = listProjectNodes(projectId)
const styleNodeIndex = orderedNodes.findIndex((item) => item.projectNodeId === styleNode?.projectNodeId)

assert.ok(styleNode, '应存在生成款式档案节点')
assert.ok(conclusionNode, '应存在测款结论节点')
assert.ok(styleNodeIndex >= 0, '应能定位生成款式档案节点顺序')

const snapshot = getProjectStoreSnapshot()
replaceProjectStore({
  ...snapshot,
  nodes: snapshot.nodes.map((item) => {
    if (item.projectId !== projectId) return item
    const nodeOrder = orderedNodes.findIndex((candidate) => candidate.projectNodeId === item.projectNodeId)
    if (nodeOrder >= 0 && nodeOrder < styleNodeIndex) {
      return {
        ...item,
        currentStatus: '已完成',
        latestResultType: item.projectNodeId === conclusionNode!.projectNodeId ? '测款通过' : '已完成',
        latestResultText:
          item.projectNodeId === conclusionNode!.projectNodeId
            ? '测款通过，可进入款式档案开发阶段。'
            : `${item.workItemTypeName}已完成。`,
        pendingActionType: '',
        pendingActionText: '',
        updatedAt: '2026-04-17 10:00',
      }
    }
    if (item.projectNodeId === styleNode!.projectNodeId) {
      return {
        ...item,
        currentStatus: '进行中',
        latestResultType: '等待生成款式档案',
        latestResultText: '测款通过，待生成款式档案。',
        pendingActionType: '生成款式档案',
        pendingActionText: '请从当前节点生成款式档案。',
        updatedAt: '2026-04-17 10:05',
      }
    }
    return item
  }),
})

const [styleImage] = createProjectImageAssetRecords(
  created.project,
  [
    {
      imageUrl: 'mock://style-formalization-main-image',
      imageName: '档案主图候选',
      imageType: '上架图',
      sourceNodeCode: 'CHANNEL_PRODUCT_LISTING',
      sourceRecordId: 'listing_batch_demo',
      sourceType: '商品上架',
      usageScopes: ['商品上架', '项目资料归档'],
      imageStatus: '可用于上架',
      mainFlag: true,
      sortNo: 1,
    },
  ],
  '测试用户',
)
upsertProjectImageAssets([styleImage])

const generated = generateStyleArchiveFromProjectNode(projectId, '测试用户', {
  styleMainImageId: styleImage.imageId,
  styleGalleryImageIds: [styleImage.imageId],
})
assert.equal(generated.ok, true, '应先能生成款式档案草稿')
assert.ok(generated.style, '应返回已生成的草稿款式档案')

updateStyleArchive(generated.style!.styleId, {
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

const beforeCheck = getStyleArchiveFormalizationCheck(generated.style!.styleId)
assert.equal(beforeCheck.ready, false, '缺少必填字段时不应允许正式建档')
assert.ok(beforeCheck.missingFields.some((item) => item.label === '款式名称'), '应识别缺少款式名称')
assert.ok(beforeCheck.missingFields.some((item) => item.label === '目标渠道'), '应识别缺少目标渠道')

const failed = formalizeStyleArchive(generated.style!.styleId, '测试用户')
assert.equal(failed.ok, false, '缺字段时正式建档应失败')

updateStyleArchive(generated.style!.styleId, {
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
  targetChannelCodes: ['抖音商城', '虾皮'],
  priceRangeLabel: '¥199-399',
  mainImageUrl: '/placeholder.svg',
  sellingPointText: '轻薄垂感，适合夏季快反上新。',
  detailDescription: '已补齐基础资料，可从草稿进入正式建档。',
})

const success = formalizeStyleArchive(generated.style!.styleId, '测试用户')
assert.equal(success.ok, true, '补齐字段后应允许正式建档')
assert.equal(success.style?.baseInfoStatus, '已建档', '正式建档后应回写款式基础资料状态')
assert.equal(success.style?.archiveStatus, 'DRAFT', '正式建档不应直接改成启用')

resetPcsProductArchiveState()
const detailHtml = renderPcsStyleArchiveDetailPage(generated.style!.styleId)
assert.match(detailHtml, /已建档待技术包/, '正式建档后详情页状态应明确为已建档待技术包')
handlePcsProductArchiveEvent({
  dataset: { pcsProductArchiveAction: 'open-style-completion', styleId: generated.style!.styleId },
  closest() {
    return this
  },
} as unknown as HTMLElement)
const detailWithDrawerHtml = renderPcsStyleArchiveDetailPage(generated.style!.styleId)
assert.match(detailWithDrawerHtml, /正式建档后只读/, '正式建档后应提示核心字段只读')
assert.match(detailWithDrawerHtml, /仅允许补充包装信息与备注/, '正式建档后应只允许受控补充字段')

const updatedStyleNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'STYLE_ARCHIVE_CREATE')
assert.equal(updatedStyleNode?.currentStatus, '已完成', '款式档案节点应回写为已完成')
assert.equal(updatedStyleNode?.latestResultType, '已完成正式建档', '款式档案节点应回写正式建档结果')

const nextTemplateNode = orderedNodes[styleNodeIndex + 1]
assert.ok(nextTemplateNode, '正式建档后应存在模板顺序上的下一个节点')
const updatedNextNode = getProjectNodeRecordByWorkItemTypeCode(projectId, nextTemplateNode!.workItemTypeCode)
assert.equal(updatedNextNode?.currentStatus, '进行中', '正式建档后应按模板顺序推进到下一个节点')

console.log('pcs-style-archive-formalization.spec.ts PASS')
