import assert from 'node:assert/strict'

import {
  createProjectChannelProductFromListingNode,
  generateProjectTestingSummaryFromRelations,
  launchProjectChannelProductListing,
  listProjectChannelProductsByProjectId,
} from '../src/data/pcs-channel-product-project-repository.ts'
import {
  getProjectNodeRecordByWorkItemTypeCode,
  updateProjectNodeRecord,
} from '../src/data/pcs-project-repository.ts'
import { generateStyleArchiveShellFromProject } from '../src/data/pcs-project-style-archive-writeback.ts'
import {
  handlePcsProjectWorkItemDetailEvent,
  renderPcsProjectWorkItemDetailPage,
} from '../src/pages/pcs-project-work-item-detail.ts'
import { PROJECT_CHANNEL_PRODUCT_CREATE_BRIDGE_KEY } from '../src/pages/pcs-project-detail-header-actions.ts'
import { appStore } from '../src/state/store.ts'
import {
  attachFormalLiveTesting,
  createProjectForBusinessChain,
  createAndLaunchChannelProductForProject,
  prepareProjectWithPassedTesting,
  resetProjectBusinessChainRepositories,
} from './pcs-project-formal-chain-helper.ts'

function getActionKeys(html: string): string[] {
  return [...html.matchAll(/data-pcs-node-action-key="([^"]+)"/g)].map((item) => item[1])
}

function createMemoryStorage() {
  const store = new Map<string, string>()
  return {
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null
    },
    setItem(key: string, value: string) {
      store.set(key, String(value))
    },
    removeItem(key: string) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
  }
}

resetProjectBusinessChainRepositories()

const terminatedNode = getProjectNodeRecordByWorkItemTypeCode('prj_20251216_025', 'TEST_CONCLUSION')
assert.ok(terminatedNode, '应存在已淘汰项目的测款结论节点')

const terminatedHtml = renderPcsProjectWorkItemDetailPage('prj_20251216_025', terminatedNode.projectNodeId)
const terminatedActionKeys = getActionKeys(terminatedHtml)

assert.ok(!terminatedHtml.includes('节点业务定义'), '默认业务视图不应展示节点领域契约')
assert.ok(!terminatedHtml.includes('正式关联'), '默认业务视图不应展示正式关联文案')
assert.ok(!terminatedHtml.includes('模块关联'), '默认业务视图不应展示模块关联文案')
assert.ok(!terminatedHtml.includes('正式直播测款关系'), '默认业务视图不应展示正式直播测款关系文案')
assert.ok(!terminatedHtml.includes('正式短视频测款关系'), '默认业务视图不应展示正式短视频测款关系文案')
assert.ok(!terminatedActionKeys.includes('generate-style-archive'), '已取消的测款结论节点不应显示生成款式档案')
assert.ok(terminatedActionKeys.includes('view-channel-product'), '已取消的测款结论节点应保留查看渠道商品入口')

resetProjectBusinessChainRepositories()

const pendingProject = createProjectForBusinessChain('待确认测款结论节点测试项目')
createAndLaunchChannelProductForProject(pendingProject.projectId)
attachFormalLiveTesting(pendingProject.projectId)
const summaryResult = generateProjectTestingSummaryFromRelations(pendingProject.projectId, '测试用户')
assert.equal(summaryResult.ok, true, summaryResult.message)

const pendingConclusionNode = getProjectNodeRecordByWorkItemTypeCode(pendingProject.projectId, 'TEST_CONCLUSION')
assert.ok(pendingConclusionNode, '应存在待确认测款结论节点')
updateProjectNodeRecord(
  pendingProject.projectId,
  pendingConclusionNode.projectNodeId,
  {
    currentStatus: '待确认',
    latestResultType: '待确认',
    latestResultText: '正式测款汇总已完成，等待确认最终结论。',
    pendingActionType: '提交测款结论',
    pendingActionText: '请提交测款结论。',
  },
  '测试用户',
)

const pendingConclusionHtml = renderPcsProjectWorkItemDetailPage(pendingProject.projectId, pendingConclusionNode.projectNodeId)
const pendingConclusionActionKeys = getActionKeys(pendingConclusionHtml)
assert.ok(pendingConclusionHtml.includes('提交测款结论'), '待确认的测款结论节点应展示提交测款结论提示')
assert.ok(pendingConclusionActionKeys.includes('submit-conclusion-pass'), '待确认的测款结论节点应展示结论提交动作')

resetProjectBusinessChainRepositories()

const listingProject = createProjectForBusinessChain('商品上架节点动作测试项目')
const listingNode = getProjectNodeRecordByWorkItemTypeCode(listingProject.projectId, 'CHANNEL_PRODUCT_LISTING')
assert.ok(listingNode, '应存在商品上架节点')

const noProductHtml = renderPcsProjectWorkItemDetailPage(listingProject.projectId, listingNode.projectNodeId)
assert.ok(getActionKeys(noProductHtml).includes('create-channel-product'), '未创建渠道商品时应显示创建动作')

const windowMock = {
  sessionStorage: createMemoryStorage(),
  localStorage: createMemoryStorage(),
  location: { pathname: '/pcs/projects/demo/work-items/demo', search: '' },
  history: {
    pushState() {},
    replaceState() {},
  },
}

Object.assign(globalThis, { window: windowMock })

const beforeChannelProductCount = listProjectChannelProductsByProjectId(listingProject.projectId).length
renderPcsProjectWorkItemDetailPage(listingProject.projectId, listingNode.projectNodeId)
const bridgeHandled = handlePcsProjectWorkItemDetailEvent({
  closest: () =>
    ({
      dataset: {
        pcsWorkItemAction: 'create-channel-product',
      },
    }) as HTMLElement,
} as HTMLElement)
assert.equal(bridgeHandled, true, '创建渠道商品动作应被节点详情页接管')
const afterChannelProductCount = listProjectChannelProductsByProjectId(listingProject.projectId).length
assert.equal(afterChannelProductCount, beforeChannelProductCount, '节点详情页点击创建渠道商品时不应直接落正式渠道商品记录')
assert.equal(appStore.getState().pathname, '/pcs/products/channel-products', '节点详情页点击创建渠道商品应跳转到正式渠道商品创建入口')

const bridgePayload = windowMock.sessionStorage.getItem(PROJECT_CHANNEL_PRODUCT_CREATE_BRIDGE_KEY)
assert.ok(bridgePayload, '节点详情页点击创建渠道商品后应写入来源项目 bridge')
assert.match(bridgePayload || '', new RegExp(listingProject.projectId), 'bridge 中应携带当前项目 ID')

windowMock.sessionStorage.setItem('pcs_project_flash_notice', '已为当前项目建立渠道商品创建草稿，请回到项目继续处理。')
const flashHtml = renderPcsProjectWorkItemDetailPage(listingProject.projectId, listingNode.projectNodeId)
assert.ok(flashHtml.includes('已为当前项目建立渠道商品创建草稿，请回到项目继续处理。'), '节点详情页返回后应能显示项目 flash 提示')

const createdResult = createProjectChannelProductFromListingNode(listingProject.projectId, {}, '测试用户')
assert.equal(createdResult.ok, true, createdResult.message)
const pendingListingHtml = renderPcsProjectWorkItemDetailPage(listingProject.projectId, listingNode.projectNodeId)
const pendingListingActionKeys = getActionKeys(pendingListingHtml)
assert.ok(pendingListingActionKeys.includes('view-channel-product'), '待上架时应允许查看渠道商品')
assert.ok(pendingListingActionKeys.includes('launch-channel-product'), '待上架时应显示发起上架动作')

const launchedResult = launchProjectChannelProductListing(createdResult.record!.channelProductId, '测试用户')
assert.equal(launchedResult.ok, true, launchedResult.message)
const launchedListingHtml = renderPcsProjectWorkItemDetailPage(listingProject.projectId, listingNode.projectNodeId)
const launchedListingActionKeys = getActionKeys(launchedListingHtml)
assert.ok(launchedListingActionKeys.includes('go-live-testing'), '已上架待测款时应显示去直播测款')
assert.ok(launchedListingActionKeys.includes('go-video-testing'), '已上架待测款时应显示去短视频测款')

delete (globalThis as { window?: typeof window }).window

resetProjectBusinessChainRepositories()

const cancelledListingProject = createProjectForBusinessChain('已取消商品上架节点测试项目')
const cancelledListingNode = getProjectNodeRecordByWorkItemTypeCode(cancelledListingProject.projectId, 'CHANNEL_PRODUCT_LISTING')
assert.ok(cancelledListingNode, '应存在已取消商品上架节点测试项目')
updateProjectNodeRecord(
  cancelledListingProject.projectId,
  cancelledListingNode.projectNodeId,
  {
    currentStatus: '已取消',
    latestResultType: '节点已取消',
    latestResultText: '当前节点已取消。',
  },
  '测试用户',
)
const cancelledListingHtml = renderPcsProjectWorkItemDetailPage(cancelledListingProject.projectId, cancelledListingNode.projectNodeId)
assert.ok(!getActionKeys(cancelledListingHtml).includes('create-channel-product'), '已取消的商品上架节点不应显示创建渠道商品')

resetProjectBusinessChainRepositories()

const styleProject = prepareProjectWithPassedTesting('款式档案节点动作测试项目')
const styleNode = getProjectNodeRecordByWorkItemTypeCode(styleProject.projectId, 'STYLE_ARCHIVE_CREATE')
assert.ok(styleNode, '应存在生成款式档案节点')

const beforeStyleHtml = renderPcsProjectWorkItemDetailPage(styleProject.projectId, styleNode.projectNodeId)
assert.ok(getActionKeys(beforeStyleHtml).includes('generate-style-archive'), '未生成款式档案时应显示生成动作')

const styleResult = generateStyleArchiveShellFromProject(styleProject.projectId, '测试用户')
assert.equal(styleResult.ok, true, styleResult.message)
const afterStyleHtml = renderPcsProjectWorkItemDetailPage(styleProject.projectId, styleNode.projectNodeId)
assert.ok(getActionKeys(afterStyleHtml).includes('view-style-archive'), '已生成款式档案后应显示查看动作')

console.log('pcs-project-node-detail-actions.spec.ts PASS')
