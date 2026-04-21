import assert from 'node:assert/strict'

import {
  createEmptyProjectDraft,
  createProject,
  getProjectById,
  getProjectCreateCatalog,
  getProjectNodeRecordByWorkItemTypeCode,
  getProjectStoreSnapshot,
  listProjectNodes,
  listActiveProjectTemplates,
  replaceProjectStore,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import {
  listProjectRelationsByProject,
  resetProjectRelationRepository,
} from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import {
  createProjectImageAssetRecords,
  resetProjectImageAssets,
  upsertProjectImageAssets,
} from '../src/data/pcs-project-image-repository.ts'
import {
  generateStyleArchiveFromProjectNode,
  getStyleArchiveGenerationStatus,
} from '../src/data/pcs-project-style-archive-generation.ts'
import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { renderPcsProjectWorkItemDetailPage } from '../src/pages/pcs-projects.ts'

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
    projectName: '款式档案节点生成验证项目',
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
    if (item.projectNodeId === conclusionNode!.projectNodeId) {
      return {
        ...item,
        currentStatus: '已完成',
        latestResultType: '测款通过',
        latestResultText: '测款通过，可进入款式档案开发阶段。',
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

const beforeStatus = getStyleArchiveGenerationStatus(projectId)
assert.equal(beforeStatus.allowed, true, '当前项目应允许从节点生成款式档案')

const beforeHtml = await renderPcsProjectWorkItemDetailPage(projectId, styleNode!.projectNodeId)
assert.match(beforeHtml, /生成款式档案/, '节点详情应展示生成款式档案入口')

const [styleImage] = createProjectImageAssetRecords(
  created.project,
  [
    {
      imageUrl: 'mock://style-archive-main-image',
      imageName: '上架主图候选',
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

const beforeCount = listStyleArchives().length
const result = generateStyleArchiveFromProjectNode(projectId, '测试用户', {
  styleMainImageId: styleImage.imageId,
  styleGalleryImageIds: [styleImage.imageId],
})

assert.equal(result.ok, true, '应能从商品项目 STYLE_ARCHIVE_CREATE 节点生成款式档案')
assert.equal(result.existed, false, '首次生成不应命中已有档案')
assert.ok(result.style, '应返回已生成的款式档案')
assert.equal(result.style?.archiveStatus, 'DRAFT', '新生成的款式档案应为草稿')
assert.equal(result.style?.sourceProjectId, projectId, '款式档案应回写正式来源项目')
assert.equal(result.style?.mainImageId, styleImage.imageId, '应写入所选档案主图资产')
assert.deepEqual(result.style?.galleryImageIds, [styleImage.imageId], '应写入所选档案图册资产')

const updatedProject = getProjectById(projectId)
assert.equal(updatedProject?.linkedStyleId, result.style?.styleId, '项目主记录应回写款式档案主关联')

const updatedStyleNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'STYLE_ARCHIVE_CREATE')
assert.equal(updatedStyleNode?.latestResultType, '已生成款式档案草稿', '款式档案节点应回写最新结果')
assert.equal(updatedStyleNode?.pendingActionType, '补齐款式资料', '款式档案节点应回写下一步动作')

const styleRelations = listProjectRelationsByProject(projectId).filter(
  (item) =>
    item.sourceModule === '款式档案' &&
    item.sourceObjectType === '款式档案' &&
    item.sourceObjectId === result.style?.styleId,
)
assert.equal(styleRelations.length, 1, '项目关系仓储中应只写入一条款式档案关系')

const afterHtml = await renderPcsProjectWorkItemDetailPage(projectId, styleNode!.projectNodeId)
assert.match(afterHtml, /查看款式档案/, '生成后节点详情应改为查看款式档案')

const repeat = generateStyleArchiveFromProjectNode(projectId, '测试用户')
assert.equal(repeat.ok, true, '重复点击时应命中已有款式档案')
assert.equal(repeat.existed, true, '重复点击不应创建第二个档案')
assert.equal(listStyleArchives().length, beforeCount + 1, '同一项目不应重复生成第二个款式档案')

console.log('pcs-style-archive-project-node-generation.spec.ts PASS')
