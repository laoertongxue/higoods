import assert from 'node:assert/strict'

import { listLiveProductLines, resetLiveTestingRepository } from '../src/data/pcs-live-testing-repository.ts'
import {
  clearProjectRelationStore,
  listProjectRelationsByProject,
  replaceLiveProductLineProjectRelations,
  replaceVideoRecordProjectRelations,
  resetProjectRelationRepository,
} from '../src/data/pcs-project-relation-repository.ts'
import {
  createProject,
  createEmptyProjectDraft,
  getProjectById,
  getProjectCreateCatalog,
  getProjectNodeRecordByWorkItemTypeCode,
  listActiveProjectTemplates,
  resetProjectRepository,
  updateProjectNodeRecord,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { listVideoTestRecords, resetVideoTestingRepository } from '../src/data/pcs-video-testing-repository.ts'
import {
  createProjectChannelProductFromListingNode,
  launchProjectChannelProductListing,
  resetProjectChannelProductRepository,
  submitProjectTestingConclusion,
  submitProjectTestingSummary,
} from '../src/data/pcs-channel-product-project-repository.ts'

const DEFAULT_TEMPLATE_ID = 'TPL-004'
const DEFAULT_OPERATOR_NAME = '测试用户'

function pickFirst<T>(records: T[], label: string): T {
  const record = records[0]
  assert.ok(record, `缺少可用的${label}测试数据`)
  return record
}

function markNodeCompleted(projectId: string, workItemTypeCode: string, latestResultType: string, latestResultText: string) {
  const node = getProjectNodeRecordByWorkItemTypeCode(projectId, workItemTypeCode)
  if (!node) return
  updateProjectNodeRecord(
    projectId,
    node.projectNodeId,
    {
      currentStatus: '已完成',
      latestResultType,
      latestResultText,
      pendingActionType: '',
      pendingActionText: '',
    },
    DEFAULT_OPERATOR_NAME,
  )
}

function ensureListingPrerequisitesCompleted(projectId: string) {
  markNodeCompleted(projectId, 'SAMPLE_CONFIRM', '样衣确认通过', '样衣确认通过，允许进入商品上架。')
  markNodeCompleted(projectId, 'SAMPLE_COST_REVIEW', '样衣核价完成', '样衣核价已完成。')
  markNodeCompleted(projectId, 'SAMPLE_PRICING', '样衣定价完成', '样衣定价已完成。')
  updateProjectRecord(
    projectId,
    {
      currentPhaseCode: 'PHASE_03',
      currentPhaseName: '商品上架与市场测款',
    },
    DEFAULT_OPERATOR_NAME,
  )
}

export function resetProjectBusinessChainRepositories() {
  resetProjectRepository()
  resetProjectRelationRepository()
  clearProjectRelationStore()
  resetProjectChannelProductRepository()
  resetLiveTestingRepository()
  resetVideoTestingRepository()
  resetStyleArchiveRepository()
}

export function createProjectForBusinessChain(projectName = '正式项目链路测试项目') {
  const catalog = getProjectCreateCatalog()
  const template = listActiveProjectTemplates().find((item) => item.id === DEFAULT_TEMPLATE_ID) ?? listActiveProjectTemplates()[0]
  assert.ok(template, '缺少正式项目模板')

  const category = pickFirst(catalog.categories, '品类')
  const brand = pickFirst(catalog.brands, '品牌')
  const styleCode = pickFirst(catalog.styleCodes, '风格编号')
  const style = pickFirst(catalog.styles, '风格标签')
  const crowdPositioning = pickFirst(catalog.crowdPositioning, '人群定位')
  const age = pickFirst(catalog.ages, '年龄带')
  const crowd = pickFirst(catalog.crowds, '人群')
  const productPositioning = pickFirst(catalog.productPositioning, '商品定位')
  const channel = pickFirst(catalog.channelOptions, '渠道')
  const supplier = pickFirst(catalog.sampleSuppliers, '样衣供应商')
  const owner = pickFirst(catalog.owners, '负责人')
  const team = pickFirst(catalog.teams, '执行团队')
  const collaborator = pickFirst(catalog.collaborators, '协同人')

  const creation = createProject(
    {
      ...createEmptyProjectDraft(),
      projectName,
      templateId: template.id,
      styleType: template.styleType[0] ?? '设计款',
      projectType: '设计研发',
      projectSourceType: '企划提案',
      categoryId: category.id,
      categoryName: category.name,
      subCategoryId: '',
      subCategoryName: '',
      brandId: brand.id,
      brandName: brand.name,
      styleNumber: styleCode.name,
      styleCodeId: styleCode.id,
      styleCodeName: styleCode.name,
      styleTags: [style.name],
      styleTagIds: [style.id],
      styleTagNames: [style.name],
      crowdPositioningIds: [crowdPositioning.id],
      crowdPositioningNames: [crowdPositioning.name],
      ageIds: [age.id],
      ageNames: [age.name],
      crowdIds: [crowd.id],
      crowdNames: [crowd.name],
      productPositioningIds: [productPositioning.id],
      productPositioningNames: [productPositioning.name],
      targetAudienceTags: [crowd.name],
      targetChannelCodes: [channel.code],
      sampleSourceType: '外采',
      sampleSupplierId: supplier.id,
      sampleSupplierName: supplier.name,
      sampleLink: 'https://example.com/sample-link',
      sampleUnitPrice: '168',
      ownerId: owner.id,
      ownerName: owner.name,
      teamId: team.id,
      teamName: team.name,
      collaboratorIds: [collaborator.id],
      collaboratorNames: [collaborator.name],
      priorityLevel: '高',
      remark: '用于正式商品项目业务链路测试',
    },
    DEFAULT_OPERATOR_NAME,
  )

  ensureListingPrerequisitesCompleted(creation.project.projectId)

  return creation.project
}

export function prepareProjectWithLaunchedChannelProduct(projectName = '已完成商品上架测试项目') {
  resetProjectBusinessChainRepositories()
  const project = createProjectForBusinessChain(projectName)

  const chain = createAndLaunchChannelProductForProject(project.projectId)

  return {
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    channelProductId: chain.channelProductId,
    channelProductCode: chain.channelProductCode,
    upstreamChannelProductCode: chain.upstreamChannelProductCode,
  }
}

export function createAndLaunchChannelProductForProject(projectId: string) {
  const project = getProjectById(projectId)
  assert.ok(project, '项目不存在，无法创建渠道商品')

  const createResult = createProjectChannelProductFromListingNode(
    project.projectId,
    {
      listingTitle: `${project.projectName} 测款商品`,
      listingPrice: 199,
    },
    DEFAULT_OPERATOR_NAME,
  )
  assert.equal(createResult.ok, true, createResult.message)

  const launchResult = launchProjectChannelProductListing(createResult.record!.channelProductId, DEFAULT_OPERATOR_NAME)
  assert.equal(launchResult.ok, true, launchResult.message)

  return {
    channelProductId: createResult.record!.channelProductId,
    channelProductCode: createResult.record!.channelProductCode,
    upstreamChannelProductCode: launchResult.record!.upstreamChannelProductCode,
  }
}

export function attachFormalLiveTesting(projectId: string) {
  const liveLine = pickFirst(listLiveProductLines(), '直播测款')
  const result = replaceLiveProductLineProjectRelations(liveLine.liveLineId, [projectId], DEFAULT_OPERATOR_NAME)
  assert.deepEqual(result.errors, [], `直播测款正式关联失败：${result.errors.join('；')}`)
  assert.ok(
    listProjectRelationsByProject(projectId).some(
      (relation) => relation.sourceModule === '直播' && relation.sourceLineId === liveLine.liveLineId,
    ),
    '项目未写入正式直播测款关系',
  )
  return liveLine
}

export function attachFormalVideoTesting(projectId: string) {
  const videoRecord = pickFirst(listVideoTestRecords(), '短视频测款')
  const result = replaceVideoRecordProjectRelations(videoRecord.videoRecordId, [projectId], DEFAULT_OPERATOR_NAME)
  assert.deepEqual(result.errors, [], `短视频测款正式关联失败：${result.errors.join('；')}`)
  assert.ok(
    listProjectRelationsByProject(projectId).some(
      (relation) => relation.sourceModule === '短视频' && relation.sourceObjectId === videoRecord.videoRecordId,
    ),
    '项目未写入正式短视频测款关系',
  )
  return videoRecord
}

export function completeFormalTestingPassForProject(projectId: string) {
  const project = getProjectById(projectId)
  assert.ok(project, '项目不存在，无法补齐正式测款链路')
  ensureListingPrerequisitesCompleted(projectId)

  const createResult = createProjectChannelProductFromListingNode(
    projectId,
    {
      listingTitle: `${project.projectName} 测款商品`,
      listingPrice: 219,
    },
    DEFAULT_OPERATOR_NAME,
  )
  assert.equal(createResult.ok, true, createResult.message)

  const launchResult = launchProjectChannelProductListing(createResult.record!.channelProductId, DEFAULT_OPERATOR_NAME)
  assert.equal(launchResult.ok, true, launchResult.message)

  const liveLine = attachFormalLiveTesting(projectId)
  const summaryResult = submitProjectTestingSummary(
    projectId,
    { summaryText: '已汇总正式直播测款记录，等待确认最终结论。' },
    DEFAULT_OPERATOR_NAME,
  )
  assert.equal(summaryResult.ok, true, summaryResult.message)

  const conclusionResult = submitProjectTestingConclusion(
    projectId,
    {
      conclusion: '通过',
      note: '正式测款通过，允许显式生成款式档案。',
    },
    DEFAULT_OPERATOR_NAME,
  )
  assert.equal(conclusionResult.ok, true, conclusionResult.message)

  return {
    channelProductId: createResult.record!.channelProductId,
    channelProductCode: createResult.record!.channelProductCode,
    upstreamChannelProductCode: launchResult.record!.upstreamChannelProductCode,
    liveLineId: liveLine.liveLineId,
  }
}

export function prepareProjectWithPassedTesting(projectName = '测款通过测试项目') {
  resetProjectBusinessChainRepositories()
  const project = createProjectForBusinessChain(projectName)
  const chain = completeFormalTestingPassForProject(project.projectId)

  return {
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    channelProductId: chain.channelProductId,
    channelProductCode: chain.channelProductCode,
    upstreamChannelProductCode: chain.upstreamChannelProductCode,
    liveLineId: chain.liveLineId,
  }
}
