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
import { localizeProductFixtureImageUrl } from '../src/data/pcs-product-archive-fixtures.ts'
import { listSkuArchives } from '../src/data/pcs-sku-archive-repository.ts'
import { listMaterialArchives, listMaterialSkuRecordsByMaterialId } from '../src/data/pcs-material-archive-repository.ts'
import { createTestingOrderChannelProducts, listProjectChannelProducts } from '../src/data/pcs-channel-product-project-repository.ts'
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
assert.equal(
  localizeProductFixtureImageUrl('https://file.higood.id/higood_live/proudcts/2026/04/16/c74d884c23376156c8dc13a5ff39d3fa.jpg'),
  '/materials/archive/c74d884c23376156c8dc13a5ff39d3fa.jpg',
  '已有同文件名实拍图使用仓库内稳定资源',
)
assert.equal(localizeProductFixtureImageUrl('https://example.com/custom-style.jpg'), 'https://example.com/custom-style.jpg',
  '用户自有图片地址不被替换')

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
assert.equal(reopen.order!.archiveMode, 'linked', '关联既有 SPU/SKU 不应伪称新建档')
const material = listMaterialArchives().flatMap((item) => listMaterialSkuRecordsByMaterialId(item.materialId))[0]
assert.ok(material, '应有预计用料 Mock 物料 SKU')
const styleBefore = listStyleArchives().length
const skuBefore = listSkuArchives().length
const createdArchiveOrder = createTestingOrder({ newArchive: {
  styleName: '白色长袖女式上衣', styleImageUrl: '/materials/archive/c74d884c23376156c8dc13a5ff39d3fa.jpg',
  colorName: '黑色', sizeName: 'M', materialSkuId: material.materialSkuId, expectedQuantity: 1.25,
} })
assert.equal(createdArchiveOrder.ok, true, '新款建档应可同时创建测款单（TEST-004）')
assert.equal(listStyleArchives().length, styleBefore + 1, '新建 SPU 已写入档案（TEST-004）')
assert.equal(listSkuArchives().length, skuBefore + 1, '新建 SKU 已写入档案（TEST-004）')
assert.equal(createdArchiveOrder.order!.archiveMode, 'created')
assert.equal(listSkuArchives().find((item) => item.skuCode === createdArchiveOrder.order!.skuCodes[0])?.expectedMaterials?.[0]?.quantity, 1.25, '预计用料写入新 SKU（TEST-004）')

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

const listing = createdArchiveOrder.order!
listing.currentStepKey = 'channel-listing'
listing.sampleInboundAt = '2026-09-23 12:00'
listing.channelCodes = []
listing.pricing.targetPrice = 100000
listing.channelPrices = { tiktok: 100000, shopee: 19.99 }
assert.equal(pushChannelProducts(listing.testingOrderId).ok, false, '未选渠道不得沿用默认渠道推送（TEST-011）')
listing.channelCodes = ['tiktok', 'shopee']
const channelBefore = listProjectChannelProducts().length
const pushed = pushChannelProducts(listing.testingOrderId)
assert.equal(pushed.ok, true, `推送本单渠道商品（TEST-011）：${pushed.message}`)
assert.equal(pushed.pushed?.length, new Set(listing.channelCodes).size, '每个选定渠道恰好一条本单商品（TEST-011）')
assert.equal(listing.currentStepKey, 'live-testing', '推送成功后进入⑨直播测款（TEST-011/013）')
const channelAfter = listProjectChannelProducts()
assert.equal(channelAfter.length, channelBefore + pushed.pushed!.length, '渠道商品确实新增（TEST-011）')
assert.ok(channelAfter.filter((item) => pushed.pushed!.includes(item.channelProductId)).every((item) =>
  item.styleId === listing.styleId && item.sourceTestingOrderId === listing.testingOrderId
  && item.specLines.every((line) => listing.skuCodes.includes(line.sellerSku)),
), '所有推送记录均属于本单 SPU/SKU（TEST-011）')
assert.deepEqual(channelAfter.filter((item) => pushed.pushed!.includes(item.channelProductId)).map((item) => [item.channelCode, item.currencyCode, item.listingPrice]).sort(),
  [['shopee', 'USD', 19.99], ['tiktok', 'IDR', 100000]], '每个渠道使用所属店铺币种和独立售价（TEST-011）')
assert.equal(pushChannelProducts(listing.testingOrderId).ok, false, '离开⑧后不可重复推送（TEST-011）')
assert.equal(listProjectChannelProducts().length, channelAfter.length, '重复推送不增记录（TEST-011）')
assert.throws(() => createTestingOrderChannelProducts({
  testingOrderId: listing.testingOrderId, styleId: listing.styleId, skuCodes: listing.skuCodes,
  channelCodes: ['tiktok'], channelPrices: {}, actor: '测试',
}), /IDR 渠道售价/, '已有渠道记录也不能绕过缺价门禁（TEST-011）')
const laterChannel = createTestingOrderChannelProducts({
  testingOrderId: 'to_later_same_style', styleId: listing.styleId, skuCodes: listing.skuCodes,
  channelCodes: ['tiktok'], channelPrices: { tiktok: 110000 }, actor: '测试',
})[0]
assert.notEqual(laterChannel.channelProductCode, channelAfter.find((item) => item.channelProductId === pushed.pushed![0])?.channelProductCode,
  '同款后续测款单的渠道商品编码保持唯一（TEST-011）')

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
