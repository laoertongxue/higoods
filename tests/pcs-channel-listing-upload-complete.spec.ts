import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import * as catalog from '../src/data/pcs-channel-catalog.ts'
import * as sync from '../src/data/pcs-channel-sync.ts'
import { createProjectChannelProductFromListingNode, completeProjectChannelListingNode, getProjectChannelProductById } from '../src/data/pcs-channel-product-project-repository.ts'
import { getProjectById, getProjectNodeRecordByStepCode } from '../src/data/pcs-project-repository.ts'

// R1: 发布成功以同次平台回执为依据，不再人工完成项目节点。
const baseline = catalog.getPcsChannelCatalogSnapshot()
const styleId = 'style_r1_wms_tee', internalSkuId = 'sku_r1_wms_tee_black_s'
beforeEach(() => { pcsRecordStore.setItem(catalog.PCS_CHANNEL_CATALOG_KEY, JSON.stringify(baseline)); catalog.resetPcsChannelCatalogCache() })
function draft() { return catalog.createChannelListing({ storeId: 'ST-001', styleId, internalSkuIds: [internalSkuId, internalSkuId], initialPrice: 149000, content: { title: '回执驱动发布测试' } }) }
function approve(id: string) { catalog.reviewChannelListing(id, '提交审核', '同一维护审核人'); catalog.reviewChannelListing(id, '审核通过', '同一维护审核人') }

test('R1 upload completion requires a current approved version and an actual matching receipt', () => {
  const listing = draft()
  assert.throws(() => sync.submitChannelSync(listing.id, '发布'), /审核当前渠道内容版本/)
  approve(listing.id)
  const operation = sync.submitChannelSync(listing.id, '发布')
  assert.equal(operation.demo, true, '此测试只验证原型回执规则')
  assert.equal(operation.result, '提交中')
  assert.equal(catalog.getChannelListing(listing.id)!.platformProductId, '')
  assert.equal(catalog.getChannelListing(listing.id)!.platformStatus, '未发布')
  const rows = catalog.listChannelVariants(listing.id)
  assert.ok(rows.every(row => !row.platformVariantId))
  assert.equal(sync.submitChannelSync(listing.id, '发布').id, operation.id, '重复提交复用同次操作')
  const externalIds = new Map(rows.map((row, index) => [row.id, `099999999999999999990${index}`]))
  const receipt: sync.ChannelReceipt = {
    eventId: 'test-platform-publication-receipt', operationId: operation.id,
    platformProductId: '08888888888888888888888', platformStatus: '在售', rawStatus: 'TEST_ACTIVE',
    items: operation.items.map(item => ({ targetId: item.targetId, field: item.field, success: true, platformVariantId: externalIds.get(item.targetId) })),
  }
  assert.equal(sync.receiveChannelReceipt(receipt).result, '成功')
  const saved = catalog.getChannelListing(listing.id)!
  assert.equal(saved.platformProductId, receipt.platformProductId, '文本外部身份保留前导零和长数字')
  assert.equal(saved.platformStatus, '在售'); assert.equal(saved.syncStatus, '一致'); assert.ok(saved.lastSuccessAt)
  assert.deepEqual(catalog.listChannelVariants(listing.id).map(row => row.platformVariantId), [...externalIds.values()])
  const projected = getProjectChannelProductById(listing.id)!
  assert.equal(projected.upstreamProductId, receipt.platformProductId, '旧只读消费者显示同一事实')
  assert.equal(projected.listingBatchStatus, '已完成')
  const beforeRepeat = catalog.getPcsChannelCatalogSnapshot()
  sync.receiveChannelReceipt(receipt)
  assert.deepEqual(catalog.getPcsChannelCatalogSnapshot(), beforeRepeat, '重复回执不创建第二个 PID 或操作')
})

test('R1 changing approved sales content invalidates approval and does not publish stale content', () => {
  const listing = draft(); approve(listing.id)
  const approved = catalog.getChannelListing(listing.id)!
  catalog.saveChannelContent(listing.id, { ...approved.content, title: '审核后改动的标题' }, approved.version)
  assert.equal(catalog.getChannelListing(listing.id)!.reviewStatus, '草稿')
  assert.throws(() => sync.submitChannelSync(listing.id, '发布'), /审核当前渠道内容版本/)
  assert.equal(catalog.listChannelSyncOperations(listing.id).length, 0)
  approve(listing.id)
  const operation = sync.submitChannelSync(listing.id, '发布')
  assert.equal(operation.items.find(item => item.field === 'title')?.submittedValue, '审核后改动的标题')
})

test('R1 retired project publication and manual completion cannot mutate project or canonical listing', () => {
  const project = getProjectById('PRJ-008'), node = getProjectNodeRecordByStepCode('PRJ-008', 'CHANNEL_PRODUCT_LISTING')
  const before = catalog.getPcsChannelCatalogSnapshot()
  const created = createProjectChannelProductFromListingNode('PRJ-008', { listingTitle: '不应新建项目商品' })
  const completed = completeProjectChannelListingNode('PRJ-008')
  for (const result of [created, completed]) { assert.equal(result.ok, false); assert.match(result.message, /项目式入口已停用/); assert.equal(result.record, null) }
  assert.deepEqual(catalog.getPcsChannelCatalogSnapshot(), before)
  assert.deepEqual(getProjectById('PRJ-008'), project)
  assert.deepEqual(getProjectNodeRecordByStepCode('PRJ-008', 'CHANNEL_PRODUCT_LISTING'), node)
})
