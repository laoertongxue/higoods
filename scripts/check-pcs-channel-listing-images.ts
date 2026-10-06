import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import * as catalog from '../src/data/pcs-channel-catalog.ts'
import { submitChannelSync, receiveChannelReceipt, demoChannelReceipt } from '../src/data/pcs-channel-sync.ts'
import { renderPcsChannelProductDetailPage, renderPcsChannelProductEditPage, discardPcsChannelChanges } from '../src/pages/pcs-channel-products.ts'
import { renderChannelDescription } from '../src/pages/pcs-channel-ui.ts'

// R1 媒体归渠道内容，使用图片角色和文件引用，不要求开发项目图片确认。
const source = readFileSync('src/pages/pcs-channel-products.ts', 'utf8')
const types = readFileSync('src/data/pcs-channel-catalog-types.ts', 'utf8')
assert.match(types, /interface ChannelMedia[\s\S]*?fileId\?: string/)
for (const marker of ['registerPcsFile', 'releasePcsPendingFile', 'runPcsRecordCommand']) assert.ok(source.includes(marker), `媒体保存边界缺少 ${marker}`)
assert.ok(!/readAsDataURL|FileReader/.test(source), '不得以 Base64 替代文件仓库')
const original = pcsRecordStore.getItem(catalog.PCS_CHANNEL_CATALOG_KEY)
try {
  const styleId = 'style_r1_wms_tee', internalSkuId = 'sku_r1_wms_tee_black_s'
  const base = catalog.contentFromStyle(styleId).media[0]
  const draft = catalog.createChannelListing({ storeId: 'ST-001', styleId, internalSkuIds: [internalSkuId], initialPrice: 149000, content: { media: [] } })
  assert.throws(() => catalog.reviewChannelListing(draft.id, '提交审核'), /主图/)
  assert.throws(() => catalog.saveChannelContent(draft.id, { ...draft.content, media: [{ ...base, url: 'data:image/png;base64,AAAA' }] }, draft.version), /文件内容/)
  const saved = catalog.saveChannelContent(draft.id, { ...draft.content, media: [
    { ...base, id: 'channel-detail', role: '详情图', sort: 2 },
    { ...base, id: 'channel-main', role: '主图', sort: 1 },
  ] }, draft.version)
  catalog.reviewChannelListing(draft.id, '提交审核'); catalog.reviewChannelListing(draft.id, '审核通过')
  const operation = submitChannelSync(draft.id, '发布')
  assert.deepEqual(operation.items.find(item => item.field === 'media')?.submittedValue, saved.content.media, '上传保留明确的媒体角色及顺序')
  receiveChannelReceipt(demoChannelReceipt(operation.id))
  assert.equal(catalog.getChannelListing(draft.id)!.syncStatus, '一致')
  const detail = renderPcsChannelProductDetailPage(draft.id), edit = renderPcsChannelProductEditPage(draft.id)
  assert.ok(detail.includes(base.url), '渠道详情须展示实际图片源')
  for (const label of ['刊登媒体', '添加图片 / 视频', '主图', '详情图', '尺码图', '视频']) assert.ok(edit.includes(label), `媒体编辑缺少 ${label}`)
  assert.ok(!/导出完整备份|清理无引用附件|本机资料/.test(detail + edit), '业务页不得复活维护工具')
  const html = renderChannelDescription('<table><tr><td>M</td></tr></table><img src="/materials/pcs-reviewed/tee-black.jpg" onerror="alert(1)"><script>alert(1)</script>')
  assert.ok(html.includes('<table>') && html.includes('/materials/pcs-reviewed/tee-black.jpg'))
  assert.ok(!html.includes('onerror') && !html.includes('<script'), '销售说明展示保留内容但不执行脚本')
} finally {
  discardPcsChannelChanges()
  if (original === null) pcsRecordStore.removeItem(catalog.PCS_CHANNEL_CATALOG_KEY); else pcsRecordStore.setItem(catalog.PCS_CHANNEL_CATALOG_KEY, original)
  catalog.resetPcsChannelCatalogCache()
}
console.log('check-pcs-channel-listing-images.ts PASS (R1 channel media, review gate, receipt payload and safe preview)')
