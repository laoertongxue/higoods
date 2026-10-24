import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync}from'node:fs'
import {execFileSync}from'node:child_process'
import {MATERIAL_ARCHIVE_STORAGE_KEY}from'../../src/data/pcs-material-archive-repository.ts'
import { removeRetiredTechnicalProcessContent } from '../../src/data/pcs-technical-data-demo-projection.ts'
const path='src/data/generated/pcs-record-baseline.json',current=JSON.parse(readFileSync(path,'utf8')),before=JSON.parse(execFileSync('git',['show','c89009bb6c7189acb6370b1902347004c1052693:'+path],{encoding:'utf8',maxBuffer:20*1024*1024})),now=JSON.parse(current[MATERIAL_ARCHIVE_STORAGE_KEY]),old=JSON.parse(before[MATERIAL_ARCHIVE_STORAGE_KEY])
// The later formal craft rename changes exactly one option label and its three label mentions.
// All other fields remain byte-equivalent to the material change's frozen source.
function currentCraftLabel(raw:string):string {
  const value=JSON.parse(raw), option=value.options.find((row:any)=>row.dimensionId==='specialCrafts'&&row.id==='specialCrafts-4')
  assert.ok(option)
  const prior=option.name_zh
  option.name_zh='缝边绣'
  for(const log of option.logs)log.detail=log.detail.replaceAll(prior,'缝边绣')
  return JSON.stringify(value)
}
const feedbackStores = [
  ['Asaya Ind', 'IDLCD3W8X6'], ['FADFAD ID', 'IDLC2XWXEM'], ['CHICMORE IND', 'IDLCNHWLC3'],
  ['CHICMORE Basic', 'IDLCEXWXE6'], ['FADFAD.Tendblank', 'IDLCLGLL62'], ['Asaya Style', 'IDLCWNWW6Q'],
  ['MODISH Indonesia', 'IDLC7U2LWUA'], ['FADFAD Indonesia', 'IDLC6EW72S'], ['LUXLUX.ID', 'IDLCHVWXRR'],
] as const
const feedbackStoreIds = feedbackStores.map((_, index) => `ST-FB-${String(index + 1).padStart(3, '0')}`)
const feedbackListingIds = Array.from({ length: 10 }, (_, index) => `channel-listing-feedback-${index + 1}`)
const feedbackStyleIds = ['style_demand_SPU_QC_001', 'style_demand_SPU_QC_002', 'style_demand_SPU_QC_003']
const feedbackSkuIds = feedbackStyleIds.map((styleId, index) => [`skuSeed_${styleId}_001`, `skuSeed_${styleId}_${index === 2 ? '003' : '002'}`])
const feedbackPriceTypes = ['retail', 'regular', 'live', 'wholesale', 'clearance']
const feedbackVariantFields = ['sellerSku', 'displayColor', 'displaySize', 'displayPattern', 'imageUrl', 'platformAttributeValues', 'price.retail', 'price.regular']
const feedbackListingFields = ['title', 'description', 'languageCode', 'sellingPoints', 'translations', 'handle', 'platformCategoryId', 'platformBrandId', 'platformAttributes', 'media']

// Keep the original frozen source. Only the exact, authorized additions may follow each untouched old array.
function assertExactAppend(original: Record<string, any>, actual: Record<string, any>, expectedIds: Record<string, string[]>) {
  assert.deepEqual(Object.keys(actual), Object.keys(original), '不得新增或移除快照集合')
  const additions: Record<string, any[]> = {}
  for (const field of Object.keys(original)) {
    if (!expectedIds[field]) { assert.deepEqual(actual[field], original[field], `未授权集合或字段必须保留：${field}`); continue }
    assert.deepEqual(actual[field].slice(0, original[field].length), original[field], `既有 ${field} 每条记录的全部字段及顺序必须保留`)
    additions[field] = actual[field].slice(original[field].length)
    assert.deepEqual(additions[field].map((row: any) => row.id), expectedIds[field], `只允许精确追加授权的 ${field} ID，不允许缺失、重复或额外记录`)
  }
  return additions
}
function assertFeedbackStores(original: Record<string, any>, actual: Record<string, any>) {
  const added = assertExactAppend(original, actual, { stores: feedbackStoreIds }).stores
  for (const [index, store] of added.entries()) {
    assert.deepEqual([store.storeCode, store.storeName, store.externalStoreId, store.channelCode, store.marketCode, store.timeZone, store.salesCurrency], [feedbackStoreIds[index], ...feedbackStores[index], 'tiktok', 'ID', 'Asia/Jakarta', 'IDR'])
    assert.equal(store.operatingStatus, '启用'); assert.equal(store.inventorySource, 'WMS_SHARED'); assert.deepEqual(store.legacyAliases, [])
  }
}
function assertFeedbackCatalog(original: Record<string, any>, actual: Record<string, any>) {
  const expectedPrices = feedbackStoreIds.flatMap((storeId, index) => feedbackSkuIds[index % 3].flatMap(skuId => feedbackPriceTypes.map(type => `${storeId}:${skuId}:${type}`)))
  const expectedBaselines = feedbackListingIds.flatMap(id => [
    ...[1, 2].flatMap(line => feedbackVariantFields.map(field => `${id}:${id}-v${line}:${field}`)),
    ...feedbackListingFields.map(field => `${id}:${id}:${field}`),
  ])
  const added = assertExactAppend(original, actual, { listings: feedbackListingIds, variants: feedbackListingIds.flatMap(id => [`${id}-v1`, `${id}-v2`]), prices: expectedPrices, fieldBaselines: expectedBaselines })
  const styles = JSON.parse(before['higood-pcs-style-archive-store-v3']).records, skus = JSON.parse(before['higood-pcs-sku-archive-store-v1']).records
  const at = '2026-07-01T01:00:00Z'
  for (const [index, listing] of added.listings.entries()) {
    const styleIndex = index % 3, style = styles.find((row: any) => row.styleId === feedbackStyleIds[styleIndex])
    assert.ok(style)
    assert.deepEqual([listing.storeId, listing.styleId, listing.platformProductId, listing.platformStatus], [feedbackStoreIds[index % 9], style.styleId, `feedback-demo-pid-${index + 1}`, index === 8 ? '已下架' : '在售'])
    assert.equal(listing.sourceIdentity, '商品反馈一期静态示例，平台链接标识为 Mock'); assert.equal(listing.baseStyleVersion, style.updatedAt); assert.deepEqual(listing.publishedContent, listing.content)
    for (let line = 0; line < 2; line++) {
      const variant = added.variants[index * 2 + line], sku = skus.find((row: any) => row.skuId === feedbackSkuIds[styleIndex][line])
      assert.ok(sku); assert.equal(sku.styleId, style.styleId)
      assert.deepEqual([variant.listingId, variant.platformVariantId, variant.internalSkuId, variant.sellerSku, variant.imageUrl, variant.defaultPriceGroupId], [listing.id, `feedback-demo-variant-${index + 1}-${line + 1}`, sku.skuId, sku.skuCode, sku.skuImageUrl || style.mainImageUrl, `${listing.storeId}:${sku.skuId}`])
      assert.deepEqual(variant.mappingHistory, [{ version: 1, internalSkuId: sku.skuId, effectiveAt: at, reason: '反馈一期共享商品示例', actor: '演示资料' }]); assert.equal(variant.active, index !== 8)
    }
  }
  for (const price of added.prices) {
    const index = feedbackStoreIds.indexOf(price.storeId)
    assert.ok(index >= 0 && feedbackSkuIds[index % 3].includes(price.internalSkuId))
    assert.deepEqual(price, { id: `${price.storeId}:${price.internalSkuId}:${price.priceType}`, storeId: price.storeId, internalSkuId: price.internalSkuId, externalVariantId: '', priceType: price.priceType, amount: price.priceType === 'clearance' ? null : price.priceType === 'retail' ? 298000 : 149000, currency: 'IDR', mode: '默认', validFrom: '', validTo: '', origin: '演示', version: 1, updatedAt: at })
  }
  for (const baseline of added.fieldBaselines) {
    const index = feedbackListingIds.indexOf(baseline.listingId), listing = added.listings[index], variant = added.variants.find(row => row.id === baseline.targetId)
    const value = variant ? baseline.field === 'price.retail' ? 298000 : baseline.field === 'price.regular' ? 149000 : variant[baseline.field] : listing.content[baseline.field]
    assert.deepEqual(baseline, { id: `${listing.id}:${baseline.targetId}:${baseline.field}`, listingId: listing.id, targetId: baseline.targetId, field: baseline.field, value, version: 1, eventId: `feedback-demo-publish-${index + 1}`, updatedAt: at })
  }
}
test('KEEP/PROC: existing material and adopted SKU facts stay exact; only authorized craft, retired process content and append-only feedback records change',()=>{
  assert.deepEqual(Object.keys(current),Object.keys(before))
  for(const key of Object.keys(current))if(key!==MATERIAL_ARCHIVE_STORAGE_KEY) {
    if (key === 'higood-pcs-technical-data-version-store-v5') {
      const original = JSON.parse(before[key]), actual = JSON.parse(current[key])
      const contents = original.contents.map(removeRetiredTechnicalProcessContent)
      const counts = new Map(contents.map((content: any) => [content.technicalVersionId, content.processEntries.length]))
      assert.deepEqual(actual, JSON.parse(JSON.stringify({ ...original, contents, records: original.records.map((record: any) => ({ ...record, processEntryCount: counts.get(record.technicalVersionId) ?? record.processEntryCount })) })), '技术内容只允许定向退役旧节点及其BOM/成本引用，其他已发布/人员/物料事实必须保留')
      assert.equal(contents.flatMap((content: any) => content.processEntries).filter((entry: any) => ['WASH', 'craft-wash', 'PROC_WASH'].includes(entry.processCode)).length, 0)
    } else if (key === 'higood-pcs-channel-catalog-v1') assertFeedbackCatalog(JSON.parse(before[key]), JSON.parse(current[key]))
    else if (key === 'higood-pcs-channel-store-v1') assertFeedbackStores(JSON.parse(before[key]), JSON.parse(current[key]))
    else assert.equal(current[key],key==='higood-pcs-config-workspace-store-v1'?currentCraftLabel(before[key]):before[key],key)
  }
  for(const s of old.skuRecords){const found=now.skuRecords.find((x:any)=>x.materialSkuId===s.materialSkuId);assert.equal(found.materialSkuCode,s.materialSkuCode);assert.equal(found.materialId,s.materialId)}
  assert.deepEqual(now.records,old.records)
})
test('feedback append exception still rejects old-field mutations, unrelated collection changes and extra or missing records', () => {
  const original = JSON.parse(before['higood-pcs-channel-catalog-v1']), actual = JSON.parse(current['higood-pcs-channel-catalog-v1'])
  const changedOld = structuredClone(actual); changedOld.variants[0].sellerSku += '-changed'; assert.throws(() => assertFeedbackCatalog(original, changedOld), /既有 variants/)
  const unrelated = structuredClone(actual); unrelated.logs.push({ id: 'unauthorized-log' }); assert.throws(() => assertFeedbackCatalog(original, unrelated), /未授权集合或字段/)
  const extra = structuredClone(actual); extra.listings.push({ ...extra.listings.at(-1), id: 'channel-listing-feedback-11' }); assert.throws(() => assertFeedbackCatalog(original, extra), /授权的 listings ID/)
  const missing = structuredClone(actual); missing.prices.pop(); assert.throws(() => assertFeedbackCatalog(original, missing), /授权的 prices ID/)
  const storeOriginal = JSON.parse(before['higood-pcs-channel-store-v1']), changedStore = JSON.parse(current['higood-pcs-channel-store-v1']); changedStore.stores[0].storeName += '-changed'; assert.throws(() => assertFeedbackStores(storeOriginal, changedStore), /既有 stores/)
})
test('DYE/PRINT: active generated static input contains all six modes and exactly two additional specimen outputs with their independent fees',()=>{assert.equal(now.processDefinitions.find((p:any)=>p.outputSkuId==='material-r1-process-dye').dyeMethod,'MJS');assert.equal(now.processDefinitions.find((p:any)=>p.outputSkuId==='material-r1-process-dye-gtg').dyeMethod,'GTG');assert.equal(now.processDefinitions.find((p:any)=>p.outputSkuId==='material-r1-process-double').printSide,'AA');assert.equal(now.processDefinitions.find((p:any)=>p.outputSkuId==='material-r1-process-penetration').printSide,'CT');assert.equal(now.processDefinitions.find((p:any)=>p.outputSkuId==='material-r1-process-double-different').printSide,'AB');assert.equal(now.skuRecords.length,old.skuRecords.length+2);assert.equal(now.costVersions.length,old.costVersions.length+2);assert.equal(now.processDefinitions.find((p:any)=>p.outputSkuId==='dr_cotton_dyed').dyeMethod,undefined)})
test('round-two: explicit A/CT/AA static definitions have one pattern and no independent backside fields',()=>{for(const p of now.processDefinitions.filter((p:any)=>p.outputSkuId.startsWith('material-r1-')&&p.processType==='PRINTING'&&p.printSide!=='AB'))for(const key of ['backPatternId','backPatternCode','backPatternVersionId','backDeliveryRevisionSegment'])assert.equal(p[key],undefined,p.outputSkuId+'/'+key)})
test('round-two: newly added AB specimen with unadopted pattern references stays draft, never an approved execution source',()=>{const s=now.skuRecords.find((s:any)=>s.materialSkuId==='material-r1-process-double-different'),p=now.processDefinitions.find((p:any)=>p.outputSkuId===s.materialSkuId);assert.equal(s.approvalStatus,'DRAFT');assert.equal(s.status,'NOT_ENABLED');assert.deepEqual(p.executionAssetIds,[])})
