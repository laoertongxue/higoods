import assert from 'node:assert/strict'
import fs from 'node:fs'

import { getProjectStepDefinition } from '../src/data/pcs-project-domain-contract.ts'
import {
  createProjectChannelProductFromListingNode,
  launchProjectChannelProductListing,
  listProjectChannelProductsByProjectId,
  markProjectChannelProductListingCompleted,
  resetProjectChannelProductRepository,
  submitProjectTestingSummary,
} from '../src/data/pcs-channel-product-project-repository.ts'
import {
  getLatestProjectInlineNodeRecord,
  resetProjectInlineNodeRecordRepository,
  upsertProjectInlineNodeRecord,
} from '../src/data/pcs-project-inline-node-record-repository.ts'
import {
  getProjectNodeRecordByStepCode,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
} from '../src/data/pcs-project-repository.ts'
import { upsertProjectRelation } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { getLiveProductLineById } from '../src/data/pcs-live-testing-repository.ts'
import { getVideoTestRecordById } from '../src/data/pcs-video-testing-repository.ts'
import {
  createProjectImageAssetRecords,
  upsertProjectImageAssets,
} from '../src/data/pcs-project-image-repository.ts'
import { renderPcsProjectStepDetailPage } from '../src/pages/pcs-projects.ts'

resetProjectRepository()
resetProjectRelationRepository()
resetProjectInlineNodeRecordRepository()
resetProjectChannelProductRepository()

const channelProductRepoSource = fs.readFileSync(
  new URL('../src/data/pcs-channel-product-project-repository.ts', import.meta.url),
  'utf8',
)
assert.ok(
  !channelProductRepoSource.includes('parseRelationNoteMeta('),
  '测款汇总仓储不应再通过 ProjectRelationRecord.note 承载结构化实例字段',
)

const contract = getProjectStepDefinition('TEST_DATA_SUMMARY')
const summaryFieldKeys = contract.fieldDefinitions.map((field) => field.fieldKey)

assert.ok(summaryFieldKeys.includes('channelBreakdownLines'), '测款汇总应定义渠道拆分字段')
assert.ok(summaryFieldKeys.includes('storeBreakdownLines'), '测款汇总应定义店铺拆分字段')
assert.ok(summaryFieldKeys.includes('channelProductBreakdownLines'), '测款汇总应定义渠道商品拆分字段')
assert.ok(summaryFieldKeys.includes('testingSourceBreakdownLines'), '测款汇总应定义测款来源拆分字段')
assert.ok(summaryFieldKeys.includes('currencyBreakdownLines'), '测款汇总应定义币种拆分字段')

const project = listProjects().find((item) => item.projectCode === 'PRJ-202603-005')
assert.ok(project, '应存在 PRJ-202603-005 演示项目')

const existingTiktokRecord = listProjectChannelProductsByProjectId(project!.projectId).find(
  (item) => item.channelCode === 'tiktok' && item.channelProductStatus !== '已作废' && item.upstreamChannelProductCode,
)
assert.ok(existingTiktokRecord, '演示项目应存在已完成上架的 TikTok 印尼主店渠道商品')

for (const prerequisiteCode of ['SAMPLE_CONFIRM', 'SAMPLE_COST_REVIEW']) {
  const prerequisiteNode = getProjectNodeRecordByStepCode(project!.projectId, prerequisiteCode)
  assert.ok(prerequisiteNode, `应存在 ${prerequisiteCode} 前置节点`)
  updateProjectNodeRecord(
    project!.projectId,
    prerequisiteNode!.projectNodeId,
    { currentStatus: '已完成', updatedAt: '2026-04-10 08:00' },
    '测试用户',
  )
}
const costReviewNode = getProjectNodeRecordByStepCode(project!.projectId, 'SAMPLE_COST_REVIEW')
upsertProjectInlineNodeRecord({
  recordId: `inline_${project!.projectId}_summary_test_cost`,
  recordCode: `INR-${project!.projectCode}-COST`,
  projectId: project!.projectId,
  projectCode: project!.projectCode,
  projectName: project!.projectName,
  projectNodeId: costReviewNode!.projectNodeId,
  stepCode: 'SAMPLE_COST_REVIEW',
  stepName: '样衣核价',
  businessDate: '2026-04-10',
  recordStatus: '已完成',
  ownerId: project!.ownerId,
  ownerName: '测试用户',
  payload: { salesPrice: 299, salesCurrency: 'CNY' },
  detailSnapshot: {},
  sourceModule: '成本核价',
  sourceDocType: '样衣核价单',
  sourceDocId: `cost_${project!.projectId}`,
  sourceDocCode: `COST-${project!.projectCode}`,
  upstreamRefs: [],
  downstreamRefs: [],
  createdAt: '2026-04-10 08:00',
  createdBy: '测试用户',
  updatedAt: '2026-04-10 08:00',
  updatedBy: '测试用户',
  legacyProjectRef: null,
})
const [listingImage] = createProjectImageAssetRecords(
  project!,
  [{
    imageUrl: 'mock://listing-image/summary-second-store',
    imageName: '第二店铺测款主图',
    imageType: '上架图',
    sourceNodeCode: 'CHANNEL_PRODUCT_LISTING',
    sourceRecordId: 'summary-second-store',
    sourceType: '商品上架',
    usageScopes: ['商品上架'],
    imageStatus: '可用于上架',
    mainFlag: true,
    sortNo: 1,
  }],
  '测试用户',
)
upsertProjectImageAssets([listingImage])

const tiktokResult = createProjectChannelProductFromListingNode(
  project!.projectId,
  {
    targetChannelCode: 'tiktok',
    targetStoreId: 'ST-002',
    listingTitle: '设计款中式结饰上衣 TikTok 第二店铺正式测款款',
    defaultPriceAmount: 319,
    currencyCode: 'VND',
    listingMainImageId: listingImage.imageId,
    listingImageIds: [listingImage.imageId],
    specLines: [
      { colorName: '米白', sizeName: 'M', priceAmount: 319, currencyCode: 'VND', stockQty: 9, productImageId: listingImage.imageId, productImageUrl: listingImage.imageUrl },
      { colorName: '米白', sizeName: 'L', priceAmount: 319, currencyCode: 'VND', stockQty: 7, productImageId: listingImage.imageId, productImageUrl: listingImage.imageUrl },
    ],
  },
  '测试用户',
)
assert.equal(tiktokResult.ok, true, tiktokResult.message || '应允许补充第二渠道第二店铺上架实例')
assert.ok(tiktokResult.record, '应返回新建的 TikTok 渠道商品实例')

const launchResult = launchProjectChannelProductListing(tiktokResult.record!.channelProductId, '测试用户')
assert.equal(launchResult.ok, true, '新建实例后应允许上传款式')
assert.ok(launchResult.record?.upstreamProductId, '上传成功后应回填上游款式商品编号')

const completeResult = markProjectChannelProductListingCompleted(tiktokResult.record!.channelProductId, '测试用户')
assert.equal(completeResult.ok, true, '上传成功后应允许标记商品上架完成')

const videoNode = getProjectNodeRecordByStepCode(project!.projectId, 'VIDEO_TEST')
const liveNode = getProjectNodeRecordByStepCode(project!.projectId, 'LIVE_TEST')
const summaryNode = getProjectNodeRecordByStepCode(project!.projectId, 'TEST_DATA_SUMMARY')
const initialConclusionNode = getProjectNodeRecordByStepCode(project!.projectId, 'TEST_CONCLUSION')
assert.ok(videoNode, '应存在短视频测款节点')
assert.ok(liveNode, '应存在直播测款节点')
assert.ok(summaryNode, '应存在测款汇总节点')
assert.ok(initialConclusionNode, '应存在测款结论节点')

updateProjectNodeRecord(
  project!.projectId,
  initialConclusionNode!.projectNodeId,
  {
    currentStatus: '未开始',
    latestResultType: '',
    latestResultText: '',
    pendingActionType: '',
    pendingActionText: '',
    updatedAt: '2026-04-10 09:00',
  },
  '测试用户',
)

const videoRecord = getVideoTestRecordById('SV-PJT-012')
const liveLine = getLiveProductLineById('LS-20260122-001__item-003')
assert.ok(videoRecord, '应存在可引用的短视频正式记录')
assert.ok(liveLine, '应存在可引用的直播正式记录')

upsertProjectRelation({
  projectRelationId: 'relation-test-summary-video-015',
  projectId: project!.projectId,
  projectCode: project!.projectCode,
  projectNodeId: videoNode!.projectNodeId,
  stepCode: 'VIDEO_TEST',
  stepName: '短视频测款',
  relationRole: '执行记录',
  sourceModule: '短视频',
  sourceObjectType: '短视频记录',
  sourceObjectId: videoRecord!.videoRecordId,
  sourceObjectCode: videoRecord!.videoRecordCode,
  sourceLineId: null,
  sourceLineCode: null,
  sourceTitle: videoRecord!.videoTitle,
  sourceStatus: videoRecord!.recordStatus,
  businessDate: videoRecord!.businessDate,
  ownerName: '测试用户',
  createdAt: `${videoRecord!.businessDate} 10:00`,
  createdBy: '测试用户',
  updatedAt: `${videoRecord!.businessDate} 10:00`,
  updatedBy: '测试用户',
  note: '该短视频记录没有显式绑定渠道店铺商品，不应进入汇总。',
  legacyRefType: '',
  legacyRefValue: '',
})

upsertProjectRelation({
  projectRelationId: 'relation-test-summary-live-015',
  projectId: project!.projectId,
  projectCode: project!.projectCode,
  projectNodeId: liveNode!.projectNodeId,
  stepCode: 'LIVE_TEST',
  stepName: '直播测款',
  relationRole: '执行记录',
  sourceModule: '直播',
  sourceObjectType: '直播商品明细',
  sourceObjectId: liveLine!.liveSessionId,
  sourceObjectCode: liveLine!.liveSessionCode,
  sourceLineId: liveLine!.liveLineId,
  sourceLineCode: liveLine!.liveLineCode,
  sourceTitle: liveLine!.productTitle,
  sourceStatus: liveLine!.sessionStatus,
  businessDate: liveLine!.businessDate,
  ownerName: '测试用户',
  createdAt: `${liveLine!.businessDate} 19:00`,
  createdBy: '测试用户',
  updatedAt: `${liveLine!.businessDate} 19:00`,
  updatedBy: '测试用户',
  note: '该直播记录已显式绑定 TikTok 印尼主店渠道商品。',
  legacyRefType: '',
  legacyRefValue: '',
})

const summaryResult = submitProjectTestingSummary(
  project!.projectId,
  { summaryText: '已形成多渠道、多店铺、多来源的正式测款结构化汇总。' },
  '测试用户',
)
assert.equal(summaryResult.ok, true, '应允许提交结构化测款汇总')

const conclusionNode = getProjectNodeRecordByStepCode(project!.projectId, 'TEST_CONCLUSION')
assert.ok(conclusionNode, '提交测款汇总后应仍可读取测款结论节点')
assert.equal(conclusionNode!.currentStatus, '待确认', '测款汇总提交后应由正式仓储解锁测款结论节点')

const summaryRecord = getLatestProjectInlineNodeRecord(summaryNode!.projectNodeId)
assert.ok(summaryRecord, '提交后应生成最新测款汇总记录')

const payload = (summaryRecord!.payload || {}) as Record<string, unknown>
assert.ok(Array.isArray(payload.channelBreakdownLines), 'payload 中应保存渠道拆分')
assert.ok(Array.isArray(payload.storeBreakdownLines), 'payload 中应保存店铺拆分')
assert.ok(Array.isArray(payload.channelProductBreakdownLines), 'payload 中应保存渠道商品拆分')
assert.ok(Array.isArray(payload.testingSourceBreakdownLines), 'payload 中应保存测款来源拆分')
assert.ok(Array.isArray(payload.currencyBreakdownLines), 'payload 中应保存币种拆分')

const channelBreakdownLines = payload.channelBreakdownLines as string[]
const storeBreakdownLines = payload.storeBreakdownLines as string[]
const channelProductBreakdownLines = payload.channelProductBreakdownLines as string[]
const testingSourceBreakdownLines = payload.testingSourceBreakdownLines as string[]
const currencyBreakdownLines = payload.currencyBreakdownLines as string[]

assert.ok(channelBreakdownLines.some((line) => line.includes('TikTok')), '渠道拆分应包含 TikTok')
assert.ok(storeBreakdownLines.some((line) => line.includes('TikTok 印尼主店')), '店铺拆分应包含显式绑定的 TikTok 印尼主店')
assert.ok(channelProductBreakdownLines.some((line) => line.includes(existingTiktokRecord!.channelProductCode)), '渠道商品拆分应包含显式绑定的 TikTok 印尼主店商品')
assert.ok(
  !channelProductBreakdownLines.some((line) => line.includes(tiktokResult.record!.channelProductCode)),
  '同渠道第二店铺商品未被显式绑定时不得串入汇总',
)
assert.ok(testingSourceBreakdownLines.some((line) => line.includes('直播')), '测款来源拆分应包含显式映射的直播')
assert.ok(testingSourceBreakdownLines.some((line) => line.includes('短视频')), '测款来源拆分应保留项目中已有显式映射的短视频')
assert.ok(currencyBreakdownLines.length > 0, '币种拆分应保留显式绑定主店的币种')
assert.ok(!currencyBreakdownLines.some((line) => line.includes('VND')), '未显式映射的店铺币种不得串入汇总')

const detailSnapshot = (summaryRecord!.detailSnapshot || {}) as Record<string, unknown>
assert.ok(Array.isArray(detailSnapshot.channelBreakdowns), 'detailSnapshot 中应保留渠道结构对象')
assert.ok(Array.isArray(detailSnapshot.storeBreakdowns), 'detailSnapshot 中应保留店铺结构对象')
assert.ok(Array.isArray(detailSnapshot.currencyBreakdowns), 'detailSnapshot 中应保留币种结构对象')
assert.ok(
  !(detailSnapshot.videoRelationIds as string[]).includes('relation-test-summary-video-015'),
  `没有显式渠道店铺商品映射的短视频关系不得进入汇总关系集合：${JSON.stringify({
    videoRelationIds: detailSnapshot.videoRelationIds,
    channelProducts: listProjectChannelProductsByProjectId(project!.projectId).map((item) => ({
      code: item.channelProductCode,
      linkedVideoRecordId: item.linkedVideoRecordId,
      linkedVideoRecordCode: item.linkedVideoRecordCode,
    })),
  })}`,
)

const stepDefinitionHtml = await renderPcsProjectStepDetailPage(project!.projectId, summaryNode!.projectNodeId)
assert.match(stepDefinitionHtml, /渠道拆分/, '项目步骤详情页应展示渠道拆分字段')
assert.match(stepDefinitionHtml, /店铺拆分/, '项目步骤详情页应展示店铺拆分字段')
assert.match(stepDefinitionHtml, /渠道店铺商品拆分/, '项目步骤详情页应展示渠道店铺商品拆分字段')
assert.match(stepDefinitionHtml, /测款来源拆分/, '项目步骤详情页应展示测款来源拆分字段')
assert.match(stepDefinitionHtml, /币种拆分/, '项目步骤详情页应展示币种拆分字段')
assert.doesNotMatch(stepDefinitionHtml, /TikTok \/ TikTok 越南店/, '项目步骤详情页不得展示未显式映射的 TikTok 越南店')
assert.match(stepDefinitionHtml, /TikTok \/ TikTok 印尼主店/, '项目步骤详情页应展示显式绑定的 TikTok 印尼主店拆分结果')

console.log('pcs-test-data-summary-structure.spec.ts PASS')
