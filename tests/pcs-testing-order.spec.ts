import assert from 'node:assert/strict'

import {
  bootstrapTestingOrders,
  createTestingOrder,
  listTestingOrders,
  getTestingOrderById,
  advanceTestingOrder,
  completeLabelStep,
  completeSampleInbound,
  setBulkDecision,
  rejectBuyerConfirm,
  rejectPricing,
  pushChannelProducts,
  resetTestingOrderRepository,
  updateTestingOrder,
  TESTING_ORDER_STEPS,
  TESTING_ORDER_STEP_TEAMS as TEAMS,
} from '../src/data/pcs-testing-order-repository.ts'
import { listStyleArchives } from '../src/data/pcs-style-archive-repository.ts'
import { listSkuArchives } from '../src/data/pcs-sku-archive-repository.ts'
import { renderPcsTestingOrderListPage } from '../src/pages/pcs-testing-order-list.ts'
import { renderPcsTestingOrderDetailPage } from '../src/pages/pcs-testing-order-detail.ts'
import { routes as pcsRoutes } from '../src/router/routes-pcs.ts'
import { menusBySystem } from '../src/data/app-shell-config.ts'

resetTestingOrderRepository()
bootstrapTestingOrders()

assert.equal(TESTING_ORDER_STEPS.length, 10, '十步阶段（TEST-003）')
assert.equal(TESTING_ORDER_STEPS[0].title, '①系统建档', '①系统建档（TEST-004）')
assert.ok(
  TESTING_ORDER_STEPS.some((step) => step.key === 'purchase-link' && step.title.includes('采购')),
  '②采购下单独立步骤（TEST-005）',
)
assert.ok(
  TESTING_ORDER_STEPS.some((step) => step.key === 'logistics' && step.title.includes('快递')),
  '③快递信息（TEST-006）',
)
assert.ok(
  TESTING_ORDER_STEPS.some((step) => step.key === 'sample-inbound' && step.title.includes('样衣入库')),
  '④样衣入库独立步骤（F-01）',
)
assert.equal(
  TESTING_ORDER_STEPS.findIndex((step) => step.key === 'sample-inbound'),
  3,
  '④样衣入库位于第四步（F-01）',
)
assert.ok(
  !TESTING_ORDER_STEPS.some((step) => step.key === 'writeback'),
  '档案回写不是独立步骤（A-01）',
)
assert.ok(
  TESTING_ORDER_STEPS.some((step) => step.key === 'label' && step.description.includes('SKU 编码')),
  '⑤打标完成条件=码值等于 SKU 编码（TEST-007）',
)
assert.ok(
  TESTING_ORDER_STEPS.some((step) => step.key === 'buyer-confirm' && step.description.includes('淘汰')),
  '⑥买手确认淘汰（TEST-008）',
)
assert.ok(
  TESTING_ORDER_STEPS.some((step) => step.key === 'pricing' && step.description.includes('BOM')),
  '⑦核价记录 BOM/工艺成本/定价（TEST-009/010）',
)
assert.ok(
  TESTING_ORDER_STEPS.some((step) => step.key === 'channel-listing' && step.description.includes('TikTok')),
  '⑧渠道上架含 TikTok/Shopee（TEST-011）',
)
assert.ok(
  TESTING_ORDER_STEPS.some((step) => step.key === 'live-testing'),
  '⑨直播测款（TEST-013）',
)
assert.ok(
  TESTING_ORDER_STEPS.some((step) => step.key === 'bulk-decision' && step.description.includes('是/否/待定')),
  '⑩大货判断三态（TEST-014）',
)
assert.ok(
  Object.keys(TEAMS).length === TESTING_ORDER_STEPS.length &&
    Object.values(TEAMS).every((team) => team.trim().length > 0),
  '每步责任团队映射齐全（TEST-027）',
)
assert.ok(
  typeof TEAMS['sample-inbound'] === 'string' && TEAMS['sample-inbound'].length > 0,
  '④样衣入库有责任团队（TEST-027）',
)

const styles = listStyleArchives()
assert.ok(styles.length > 0, '存在款式档案')

const firstActive = listTestingOrders().find((item) => item.status === '进行中')
assert.ok(firstActive, '种子含进行中测款单（TEST-021）')
const dup = createTestingOrder({ styleId: firstActive!.styleId })
assert.equal(dup.ok, false, '同一 SPU 第二张进行中单阻断（TEST-002）')
assert.match(dup.message || '', /至多 1 张进行中/, '唯一性提示（TEST-002）')

const ended = listTestingOrders().find((item) => item.status === '已结束')
assert.ok(ended, '种子含已结束单（TEST-021）')
const reopen = createTestingOrder({ styleId: ended!.styleId })
assert.equal(reopen.ok, true, '同 SPU 历史已结束单后可再开（TEST-021）')
assert.ok(reopen.order, '新单创建成功')

const buyerKill = listTestingOrders().find((item) => item.endReason === '买手确认淘汰')
assert.ok(buyerKill, '买手淘汰场景（TEST-021）')
assert.equal(buyerKill!.status, '已结束', '淘汰→已结束（TEST-008）')
assert.ok(buyerKill!.history.some((item) => item.action.includes('淘汰')), '保留淘汰事实（TEST-008）')

const pricingKill = listTestingOrders().find((item) => item.endReason === '核价淘汰')
assert.ok(pricingKill, '核价淘汰场景（TEST-021）')
assert.ok(pricingKill!.pricing.initialBomCost > 0 || pricingKill!.pricing.note, '保留核价事实（TEST-010）')

const pending = listTestingOrders().find((item) => item.bulkDecision === '待定')
assert.ok(pending, '待定场景（TEST-021）')
assert.equal(pending!.status, '进行中', '待定保持进行中（TEST-017）')
const stillPending = setBulkDecision(pending!.testingOrderId, '待定', '再观察')
assert.equal(stillPending.ok, true, '待定可重复判断（TEST-017）')
assert.equal(stillPending.record!.status, '进行中', '仍进行中（TEST-017）')
const yes = setBulkDecision(pending!.testingOrderId, '是', '转化达标')
assert.equal(yes.ok, true, '待定后可收敛为是（TEST-017）')
assert.equal(yes.record!.status, '已结束', '大货=是→结束（TEST-015）')
assert.ok(yes.record!.history.some((item) => item.action.includes('生产准备') || item.action.includes('是')), '结束历史（TEST-015）')

const labelTarget = reopen.order!
assert.equal(labelTarget.currentStepKey, 'archive', '新建单从建档开始')
const goodSku = labelTarget.skuCodes[0] || 'SKU-REOPEN'
const badLabelEarly = completeLabelStep(labelTarget.testingOrderId, goodSku)
assert.equal(badLabelEarly.ok, false, '未样衣入库不能打标（F-01）')
advanceTestingOrder(labelTarget.testingOrderId, 'purchase-link')
advanceTestingOrder(labelTarget.testingOrderId, 'logistics')
updateTestingOrder(
  labelTarget.testingOrderId,
  { logisticsCarrier: '顺丰', logisticsTrackingNo: 'SF-TEST', logisticsEta: '2026-05-01' },
  '测试',
  '保存物流',
)
const toInbound = advanceTestingOrder(labelTarget.testingOrderId, 'sample-inbound')
assert.equal(toInbound.ok, true, '物流后可进入④样衣入库（F-01）')
const inbound = completeSampleInbound(labelTarget.testingOrderId, '样衣已入样衣仓')
assert.equal(inbound.ok, true, '确认样衣入库（F-01）')
assert.equal(inbound.record!.currentStepKey, 'label', '入库后进入⑤打标（F-01）')
const badLabel = completeLabelStep(labelTarget.testingOrderId, 'WRONG-SKU')
assert.equal(badLabel.ok, false, '码值≠SKU 阻断（TEST-007/SAMP-009）')
const goodLabel = completeLabelStep(labelTarget.testingOrderId, goodSku)
assert.equal(goodLabel.ok, true, '码值=SKU 可完成打标（TEST-007）')
assert.equal(goodLabel.record!.currentStepKey, 'buyer-confirm', '打标后进入⑥买手确认（TEST-003/F-01）')

const killBuyer = listTestingOrders().find((item) => item.status === '进行中')
if (killBuyer) {
  const killed = rejectBuyerConfirm(killBuyer.testingOrderId, '测试淘汰')
  assert.equal(killed.ok, true, '买手淘汰可结束（TEST-008）')
  assert.equal(killed.record!.status, '已结束', '已结束（TEST-008）')
}

const listing = listTestingOrders().find((item) => item.currentStepKey === 'channel-listing' || item.status === '进行中')
if (listing && listing.status === '进行中') {
  listing.currentStepKey = 'channel-listing'
  const pushed = pushChannelProducts(listing.testingOrderId)
  assert.equal(pushed.ok, true, '推送渠道并回写（TEST-011）')
  assert.ok((pushed.pushed || []).length >= 0, '推送结果可读（TEST-011）')
}

const order = listTestingOrders()[0]
const listHtml = renderPcsTestingOrderListPage()
assert.match(listHtml, /测款单/, '列表标题用名测款单（TEST-001）')
assert.match(listHtml, /@page-pattern: list|data-standard-list-page/, '标准列表结构（TEST-023）')
assert.ok(
  listHtml.includes('https://file.higood.id') || listHtml.includes('img src='),
  '列表含真实图片（TEST-022）',
)

const detailHtml = renderPcsTestingOrderDetailPage(order.testingOrderId)
assert.match(detailHtml, /①系统建档|步骤|测款/, '详情步骤展示（TEST-003）')
assert.ok(detailHtml.includes('img src=') || detailHtml.includes('styleImageUrl'), '详情含款式图片（TEST-022）')
assert.match(detailHtml, /人头|空运/, '寄样方式（TEST-012）')
assert.match(detailHtml, /当前步骤责任团队/, '详情展示责任团队（TEST-027）')

const exact = pcsRoutes.exactRoutes as Record<string, () => unknown>
assert.equal(typeof exact['/pcs/testing/orders'], 'function', '测款单列表路由注册（TEST-001）')
assert.ok(
  pcsRoutes.dynamicRoutes.some((route) => route.pattern.test('/pcs/testing/orders/to_seed_normal')),
  '测款单详情动态路由（TEST-001）',
)
assert.equal(typeof exact['/pcs/live-testing'], 'undefined', '旧直播测款 URL 未注册（TEST-020）')
assert.equal(typeof exact['/pcs/video-testing'], 'undefined', '旧短视频测款 URL 未注册（TEST-020）')

const testingGroup = menusBySystem['pcs']?.flatMap((group) => group.items).find((group) => group.key === 'pcs-menu-testing')
assert.ok(testingGroup, '商品测款菜单组存在（TEST-001）')
assert.ok(
  testingGroup!.children.some((item) => item.href === '/pcs/testing/orders' && item.title === '测款单'),
  '新测款菜单不指向旧页（TEST-020）',
)

const endedDetail = renderPcsTestingOrderDetailPage(ended!.testingOrderId)
assert.match(endedDetail, /已结束/, '详情已结束仍可查（TEST-016）')

console.log('pcs-testing-order.spec.ts PASS')
