import assert from 'node:assert/strict'
import { buildProjectChannelProductChainSummary } from '../src/data/pcs-channel-product-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectRepository } from '../src/data/pcs-project-repository.ts'
import {
  buildProjectDetailViewModel,
  type ProjectNodeCardViewModel,
} from '../src/data/pcs-project-view-model.ts'
import {
  resolveProjectDetailHeaderActions,
} from '../src/pages/pcs-project-detail-header-actions.ts'
import {
  handlePcsProjectDetailEvent,
  renderPcsProjectDetailPage,
} from '../src/pages/pcs-project-detail.ts'

function getHeaderActionKeys(html: string): string[] {
  return [...html.matchAll(/data-pcs-project-header-action="([^"]+)"/g)].map((item) => item[1])
}

resetProjectRepository()
resetProjectRelationRepository()

const terminatedDetail = buildProjectDetailViewModel('prj_20251216_025')
assert.ok(terminatedDetail, '应存在已终止项目用于验证头部动作')

const terminatedHtml = renderPcsProjectDetailPage(terminatedDetail!.projectId)
const terminatedActionKeys = getHeaderActionKeys(terminatedHtml)

assert.ok(!terminatedActionKeys.includes('generate-style-archive'), '已终止项目不应再显示生成款式档案')
assert.ok(!terminatedActionKeys.includes('create-project-archive'), '已终止项目不应再显示创建项目资料归档')
assert.ok(terminatedActionKeys.includes('view-channel-product'), '已终止项目应允许查看当前渠道商品')

const liveDetail = buildProjectDetailViewModel('prj_20251216_005')
const liveChain = buildProjectChannelProductChainSummary('prj_20251216_005')
assert.ok(liveDetail && liveChain, '应存在直播测款中的项目用于验证头部动作')

const liveFocusNode = liveDetail!.phases
  .flatMap((phase) => phase.nodes)
  .find((node) => node.projectNodeId === liveDetail!.currentFocusNodeId)
assert.ok(liveFocusNode, '直播测款项目应存在真实当前节点')

const liveActionKeys = resolveProjectDetailHeaderActions(liveDetail!, liveFocusNode!, liveChain!).map((item) => item.key)
assert.deepEqual(
  liveActionKeys,
  ['view-channel-product', 'go-live-testing', 'go-video-testing', 'go-list'],
  '直播测款当前节点的头部动作应聚焦当前渠道商品和测款入口',
)

const listingFocusNode: ProjectNodeCardViewModel = {
  ...liveFocusNode!,
  workItemTypeCode: 'CHANNEL_PRODUCT_LISTING',
  workItemTypeName: '商品上架',
  currentStatus: '进行中',
}

const noChannelProductKeys = resolveProjectDetailHeaderActions(
  liveDetail!,
  listingFocusNode,
  {
    ...liveChain!,
    currentChannelProductId: '',
    currentChannelProductCode: '',
    currentChannelProductStatus: '',
    currentUpstreamChannelProductCode: '',
  },
).map((item) => item.key)
assert.ok(noChannelProductKeys.includes('create-channel-product'), '商品上架节点无渠道商品时应显示去创建渠道商品')

const pendingListingKeys = resolveProjectDetailHeaderActions(
  liveDetail!,
  listingFocusNode,
  {
    ...liveChain!,
    currentChannelProductId: 'channel-product-demo-001',
    currentChannelProductCode: 'CP-DEMO-001',
    currentChannelProductStatus: '待上架',
    currentUpstreamChannelProductCode: '',
  },
).map((item) => item.key)
assert.ok(pendingListingKeys.includes('view-channel-product'), '商品上架节点已建渠道商品时应允许查看渠道商品')
assert.ok(pendingListingKeys.includes('launch-channel-product'), '商品上架节点待上架时应显示去发起上架')

const launchedListingKeys = resolveProjectDetailHeaderActions(
  liveDetail!,
  listingFocusNode,
  {
    ...liveChain!,
    currentChannelProductId: 'channel-product-demo-002',
    currentChannelProductCode: 'CP-DEMO-002',
    currentChannelProductStatus: '已上架待测款',
    currentUpstreamChannelProductCode: 'UP-DEMO-002',
  },
).map((item) => item.key)
assert.ok(launchedListingKeys.includes('go-live-testing'), '商品上架节点已上架待测款时应允许去直播测款')
assert.ok(launchedListingKeys.includes('go-video-testing'), '商品上架节点已上架待测款时应允许去短视频测款')

renderPcsProjectDetailPage(liveDetail!.projectId)
const historyNode = liveDetail!.phases
  .flatMap((phase) => phase.nodes)
  .find((node) => node.workItemTypeCode === 'PROJECT_INIT')
assert.ok(historyNode, '直播测款项目应存在历史节点用于切换')

handlePcsProjectDetailEvent({
  closest: () =>
    ({
      dataset: {
        pcsProjectDetailAction: 'select-work-item',
        workItemId: historyNode!.projectNodeId,
      },
    }) as HTMLElement,
} as HTMLElement)

const switchedHtml = renderPcsProjectDetailPage(liveDetail!.projectId)
const switchedActionKeys = getHeaderActionKeys(switchedHtml)
assert.deepEqual(
  switchedActionKeys,
  liveActionKeys,
  '用户切换历史节点后，头部动作仍应基于真实当前节点而不是历史节点',
)

console.log('pcs-project-detail-header-actions.spec.ts PASS')
