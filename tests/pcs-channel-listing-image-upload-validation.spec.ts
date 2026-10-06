import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import * as catalog from '../src/data/pcs-channel-catalog.ts'
import * as sync from '../src/data/pcs-channel-sync.ts'
import type { ChannelMedia } from '../src/data/pcs-channel-catalog-types.ts'
import { listProjectImageAssets } from '../src/data/pcs-project-image-repository.ts'

const baseline = catalog.getPcsChannelCatalogSnapshot()
const styleId = 'style_r1_wms_tee', internalSkuId = 'sku_r1_wms_tee_black_s'
const baseMedia = catalog.contentFromStyle(styleId).media[0]
assert.ok(baseMedia?.url)
beforeEach(() => { pcsRecordStore.setItem(catalog.PCS_CHANNEL_CATALOG_KEY, JSON.stringify(baseline)); catalog.resetPcsChannelCatalogCache() })
function create(media: ChannelMedia[]) { return catalog.createChannelListing({ storeId: 'ST-001', styleId, internalSkuIds: [internalSkuId], initialPrice: 149000, content: { title: '渠道自有图片校验', media } }) }

test('R1 incomplete image drafts are allowed, but title/main-image validation blocks review and publication', () => {
  const listing = create([]), before = catalog.getChannelListing(listing.id)!
  assert.equal(before.reviewStatus, '草稿')
  assert.throws(() => catalog.reviewChannelListing(listing.id, '提交审核'), /标题和主图/)
  assert.throws(() => sync.submitChannelSync(listing.id, '发布'), /审核/)
  assert.deepEqual(catalog.getChannelListing(listing.id), before, '审核失败不更新版本和状态')
  const detailOnly = create([{ ...baseMedia, role: '详情图', sort: 1 }])
  assert.throws(() => catalog.reviewChannelListing(detailOnly.id, '提交审核'), /主图/)
  assert.equal(catalog.listChannelSyncOperations(listing.id).length, 0)
})

test('R1 explicit main and detail media can publish without a project image or development-project prerequisite', () => {
  const projectImages = listProjectImageAssets('PRJ-008')
  const listing = create([{ ...baseMedia, id: 'channel-own-detail', role: '详情图', sort: 2 }, { ...baseMedia, id: 'channel-own-main', role: '主图', sort: 1 }])
  assert.equal('projectId' in listing, false)
  catalog.reviewChannelListing(listing.id, '提交审核', '同一操作人'); catalog.reviewChannelListing(listing.id, '审核通过', '同一操作人')
  const operation = sync.submitChannelSync(listing.id, '发布')
  assert.deepEqual(operation.items.find(item => item.targetId === listing.id && item.field === 'media')!.submittedValue, listing.content.media)
  assert.equal(sync.receiveChannelReceipt(sync.demoChannelReceipt(operation.id)).result, '成功')
  assert.equal(catalog.getChannelListing(listing.id)!.platformStatus, '在售')
  assert.deepEqual(listProjectImageAssets('PRJ-008'), projectImages, '渠道引用不额外制造项目图片资产')
})

test('R1 missing references and embedded file bytes fail before saving while valid media keeps its role', () => {
  const initial = catalog.getPcsChannelCatalogSnapshot()
  for (const media of [{ ...baseMedia, id: '' }, { ...baseMedia, url: '' }, { ...baseMedia, url: 'data:image/png;base64,AAAA' }]) {
    assert.throws(() => create([media]), /已登记资料/); assert.deepEqual(catalog.getPcsChannelCatalogSnapshot(), initial)
  }
  const listing = create([{ ...baseMedia, role: '主图' }]), before = catalog.getChannelListing(listing.id)!
  assert.throws(() => catalog.saveChannelContent(listing.id, { ...before.content, media: [{ ...baseMedia, url: 'data:image/png;base64,AAAA' }] }, before.version), /文件内容/)
  assert.deepEqual(catalog.getChannelListing(listing.id), before)
})
