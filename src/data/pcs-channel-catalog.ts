import { pcsRecordStore, registerPcsRepositoryReset } from './pcs-record-runtime.ts'
import { listStyleArchives, getStyleArchiveById } from './pcs-style-archive-repository.ts'
import { listSkuArchives, listSkuArchivesByStyleId, getSkuArchiveById } from './pcs-sku-archive-repository.ts'
import { listTechnicalDataVersionsByStyleId } from './pcs-technical-data-version-repository.ts'
import { getChannelStore, listChannelStores, isChannelStorePublishable, isCurrentChannelStore } from './pcs-channel-store-repository.ts'
import type { ChannelBaseContentReference, ChannelCatalogSnapshot, ChannelContent, ChannelListing, ChannelVariant, ChannelPrice, ChannelPriceType, ChannelLog } from './pcs-channel-catalog-types.ts'
import { initializeChannelPlatformContent, assertChannelPlatformContentReady } from './pcs-channel-platform-template.ts'
import type { SkuArchiveRecord } from './pcs-sku-archive-types.ts'
export const PCS_CHANNEL_CATALOG_KEY = 'higood-pcs-channel-catalog-v1'
const iso = () => new Date().toISOString()
export function channelRecordId(): string { return crypto.randomUUID() }
export function isChannelStyleSelectable(style: ReturnType<typeof getStyleArchiveById>): boolean {
  return style?.approvalStatus === 'APPROVED' && style.lifecycleStatus === 'ACTIVE'
}
export function isChannelSkuSelectable(sku: SkuArchiveRecord): boolean {
  return sku.approvalStatus === 'APPROVED' && sku.lifecycleStatus === 'ACTIVE' && isChannelStyleSelectable(getStyleArchiveById(sku.styleId))
}
export function contentFromStyle(styleId: string, languageCode='id'): ChannelContent {
  const style=getStyleArchiveById(styleId);if(!style)throw new Error('款式档案不存在。')
  const sales=style.salesContents?.find(c=>c.language===languageCode),images=sales?.imageUrls?.length?sales.imageUrls:[style.mainImageUrl,...(style.galleryImageUrls||[])]
  const media:ChannelContent['media']=images.filter((url,index,all)=>url&&all.indexOf(url)===index).map((url,index)=>({id:`${style.styleId}-${languageCode}-image-${index}`,url,name:`${style.styleName} ${index+1}`,role:index?'详情图':'主图',sort:index+1}))
  for(const url of sales?.videoUrls||[])media.push({id:`${style.styleId}-video-${media.length}`,url,name:`${style.styleName} 视频`,role:'视频',sort:media.length+1})
  if(sales?.sizeChartUrl)media.push({id:`${style.styleId}-size-chart`,url:sales.sizeChartUrl,name:'销售尺码图',role:'尺码图',sort:media.length+1,sourceVersion:style.currentTechPackVersionId||''})
  return{title:sales?.title||style.styleNameEn||style.styleName,description:sales?.description||style.detailDescription||'',languageCode,sellingPoints:sales?.sellingPoints||style.sellingPointText||'',handle:'',platformCategoryId:'',platformBrandId:'',platformAttributes:{},platformAttributeSchemaVersion:'R1-apparel-demo-v1',platformAttributeUnits:{},translations:[],media,sizeChartSourceVersion:style.currentTechPackVersionId||''}
}
export function channelBaseContentReference(styleId: string, language: string): ChannelBaseContentReference {
  const style = getStyleArchiveById(styleId); if (!style) throw new Error('款式档案不存在。')
  const sales = style.salesContents?.find(value => value.language === language)
  return { id: sales ? `${styleId}:sales:${sales.language}:v${sales.version}` : `${styleId}:legacy:${language}:${style.updatedAt}`, styleId, language, version: sales?.version ?? null, source: sales ? '销售内容' : '历史基础资料', styleUpdatedAt: style.updatedAt }
}
export function contentForChannelStore(styleId: string, storeId: string): ChannelContent {
  const store = getChannelStore(storeId), style = getStyleArchiveById(styleId)
  if (!store || !style) throw new Error('请先选择店铺和款式。')
  return { ...contentFromStyle(styleId, store.languageCode), ...initializeChannelPlatformContent(store, style) }
}
function seed(): ChannelCatalogSnapshot {
  const snapshot: ChannelCatalogSnapshot = { version: 1, listings: [], variants: [], prices: [], syncOperations: [], fieldBaselines: [], logs: [], orderReferences: [] }
  const styles = listStyleArchives().filter(s => s.styleId !== 'style_r1_wms_tee' && listSkuArchivesByStyleId(s.styleId).length >= 2).slice(0, 4)
  const stores = listChannelStores(true)
  for (let index = 0; index < 8 && styles.length; index++) {
    const style = styles[index % styles.length], store = stores[index % stores.length], skus = listSkuArchivesByStyleId(style.styleId).slice(0, 2)
    const at = '2026-10-05T02:00:00Z', id = `channel-listing-demo-${index + 1}`, content = contentFromStyle(style.styleId,store.languageCode)
    content.platformCategoryId = 'apparel-tops'; content.platformBrandId = style.brandName || 'HiGood'
    const published = index !== 2 && index !== 5
    const listing: ChannelListing = { id, storeId: store.id, styleId: style.styleId, platformProductId: published ? ['demo-pid-701', 'demo-pid-702', '', 'demo-pid-704', 'demo-pid-705', '', 'demo-pid-707', 'demo-pid-708'][index] : '', content, contentVersion: 1, version: 1, reviewStatus: index === 5 ? '草稿' : '审核通过', approvedVersion: index === 5 ? null : 1, platformStatus: published ? (index > 5 ? '已下架' : '在售') : '未发布', platformRawStatus: published ? 'DEMO_ACTIVE' : '', syncStatus: index === 3 ? '失败' : published ? '一致' : '待同步', lastSuccessAt: published ? at : '', sourceTestingOrderId: '', testingListingActionId: '', sourceIdentity: 'R1静态演示，非真实平台商品', contentOverrides: [], baseStyleVersion: style.updatedAt, publishedContent: published ? structuredClone(content) : undefined, createdAt: at, updatedAt: at, updatedBy: '演示资料', remark: '固定演示记录，首次访问不写入浏览器' }
    snapshot.listings.push(listing)
    const sourceSkus = [skus[0], skus[1], skus[0]]
    sourceSkus.forEach((sku, line) => {
      const variant: ChannelVariant = { id: `${id}-v${line + 1}`, listingId: id, platformVariantId: published ? `demo-variant-${1000 + index * 10 + line}` : '', sellerSku: line === 2 ? `${sku.skuCode}-ALT` : sku.skuCode, internalSkuId: sku.skuId, displayColor: sku.colorName, displaySize: sku.sizeName, displayPattern: sku.printName, platformAttributeValues: {}, platformAttributeSchemaVersion:'R1-apparel-demo-v1',platformAttributeUnits:{}, imageId: sku.skuId, imageUrl: sku.skuImageUrl || style.mainImageUrl, mappingVersion: 1, mappingEffectiveAt: at, mappingReason: '初次映射', mappingHistory: [{ version: 1, internalSkuId: sku.skuId, effectiveAt: at, reason: '初次映射', actor: '演示资料' }], defaultPriceGroupId: `${store.id}:${sku.skuId}`, active: true, version: 1 }
      snapshot.variants.push(variant)
      if (!snapshot.prices.some(p => p.storeId === store.id && p.internalSkuId === sku.skuId && !p.externalVariantId)) {
        const price = store.salesCurrency === 'IDR' ? 149000 : store.salesCurrency === 'MYR' ? 49.9 : 399000
        for (const type of ['retail', 'regular', 'live', 'wholesale', 'clearance'] as ChannelPriceType[]) snapshot.prices.push({ id: `${store.id}:${sku.skuId}:${type}`, storeId: store.id, internalSkuId: sku.skuId, externalVariantId: '', priceType: type, amount: type === 'clearance' ? null : Math.round(price * ({ retail: 2, regular: 1, live: .9, wholesale: .8, clearance: .7 }[type]) * 100) / 100, currency: store.salesCurrency, mode: '默认', validFrom: '', validTo: '', origin: '演示', version: 1, updatedAt: at })
      }
      if (published) for (const [field, value] of Object.entries({ sellerSku: variant.sellerSku, displayColor: variant.displayColor, displaySize: variant.displaySize, displayPattern: variant.displayPattern, imageUrl: variant.imageUrl, platformAttributeValues: variant.platformAttributeValues, 'price.retail': snapshot.prices.find(p => p.storeId === store.id && p.internalSkuId === sku.skuId && p.priceType === 'retail')?.amount, 'price.regular': snapshot.prices.find(p => p.storeId === store.id && p.internalSkuId === sku.skuId && p.priceType === 'regular')?.amount })) snapshot.fieldBaselines.push({ id: `${id}:${variant.id}:${field}`, listingId: id, targetId: variant.id, field, value, version: 1, eventId: 'demo-baseline', updatedAt: at })
    })
    if (published) {
      for (const field of ['title', 'description', 'languageCode', 'sellingPoints', 'translations', 'handle', 'platformCategoryId', 'platformBrandId', 'platformAttributes', 'media'] as const) snapshot.fieldBaselines.push({ id: `${id}:${id}:${field}`, listingId: id, targetId: id, field, value: content[field], version: 1, eventId: 'demo-baseline', updatedAt: at })
      snapshot.syncOperations.push({ id: `demo-sync-${index + 1}`, listingId: id, targetVariantIds: snapshot.variants.filter(v => v.listingId === id).map(v => v.id), action: '发布', direction: 'PCS→平台', fieldScope: ['title', 'price.regular'], baseVersion: 1, submittedVersion: 1, sourceEventId: `demo-event-${index + 1}`, result: index === 3 ? '部分成功' : '成功', items: [{ targetId: id, field: 'title', submittedValue: content.title, baseValue: content.title, fieldVersion: 1, result: '成功', error: '' }, { targetId: `${id}-v3`, field: 'price.regular', submittedValue: 49.9, baseValue: 49.9, fieldVersion: 1, result: index === 3 ? '失败' : '成功', error: index === 3 ? '演示：该规格价格更新暂未收到确认，可重试本项。' : '' }], conflicts: [], errorReason: index === 3 ? '1 项价格更新失败' : '', startedAt: at, completedAt: at, parentOperationId: '', demo: true, attempt: 1, processedEventIds: [] })
    }
  }
  // 固定演示回执：可以从列表直接验收迟到回执、真正同字段并发和首次发布待核实。
  for (const scenario of ['late','conflict','unknown'] as const) {
    const source=snapshot.listings[scenario==='unknown'?2:0];if(!source)continue
    const index={late:9,conflict:10,unknown:11}[scenario],id=`channel-listing-demo-${index}`,listing=structuredClone(source)
    listing.id=id;listing.platformProductId=scenario==='unknown'?'':`demo-pid-${700+index}`;listing.sourceIdentity=`R1静态演示：${scenario}`
    const sourceVariants=snapshot.variants.filter(v=>v.listingId===source.id),map=new Map<string,string>()
    for(const [i,v] of sourceVariants.entries()){const next=structuredClone(v);next.id=`${id}-v${i+1}`;next.listingId=id;next.platformVariantId=scenario==='unknown'?'':`demo-variant-${1000+index*10+i}`;map.set(v.id,next.id);snapshot.variants.push(next)}
    for(const b of snapshot.fieldBaselines.filter(b=>b.listingId===source.id)){const next=structuredClone(b);next.id=`${id}:${b.id}`;next.listingId=id;next.targetId=b.targetId===source.id?id:map.get(b.targetId)!;snapshot.fieldBaselines.push(next)}
    const baseTitle=listing.content.title,opId=`demo-sync-${index}`,at='2026-10-05T03:00:00Z'
    const operation:ChannelCatalogSnapshot['syncOperations'][number]={id:opId,listingId:id,targetVariantIds:[],action:scenario==='unknown'?'发布':scenario==='conflict'?'平台变更':'更新',direction:scenario==='conflict'?'平台→PCS':'PCS→平台',fieldScope:['title'],baseVersion:1,submittedVersion:1,sourceEventId:`demo-event-${index}`,result:scenario==='unknown'?'结果待核实':scenario==='conflict'?'同时变更待处理':'已过期',items:[],conflicts:[],errorReason:'',startedAt:at,completedAt:scenario==='unknown'?'':at,parentOperationId:'',demo:true,attempt:1,processedEventIds:[]}
    if(scenario==='late'){
      listing.content.title=`${baseTitle} · 当前新版`;listing.contentVersion=2;listing.version=3;listing.approvedVersion=2;listing.syncStatus='一致';listing.publishedContent=structuredClone(listing.content)
      const baseline=snapshot.fieldBaselines.find(b=>b.listingId===id&&b.targetId===id&&b.field==='title');if(baseline){baseline.value=listing.content.title;baseline.version=2}
      operation.items=[{targetId:id,field:'title',submittedValue:baseTitle,baseValue:baseTitle,fieldVersion:1,result:'已过期',error:'旧提交回执晚于当前内容版本，只保留历史，不覆盖当前标题。'}]
    }else if(scenario==='conflict'){
      listing.content.title=`${baseTitle} · PCS 标题`;listing.contentOverrides=['title'];listing.contentVersion=2;listing.version=2;listing.approvedVersion=null;listing.reviewStatus='草稿';listing.syncStatus='同时变更待处理'
      operation.items=[{targetId:id,field:'title',submittedValue:`${baseTitle} · 平台标题`,baseValue:baseTitle,fieldVersion:2,result:'失败',error:'双方从同一标题基线分别修改，请确认最终标题。'}]
      operation.conflicts=[{targetId:id,field:'title',baseValue:baseTitle,pcsValue:listing.content.title,platformValue:`${baseTitle} · 平台标题`,pcsVersion:2,platformEventId:operation.sourceEventId,platformAt:at}]
    }else{
      listing.reviewStatus='审核通过';listing.approvedVersion=1;listing.platformStatus='未取得状态';listing.syncStatus='结果待核实';listing.lastSuccessAt='';listing.publishedContent=undefined
      operation.errorReason='首次新建响应超时，先核实同一次发布结果。';operation.targetVariantIds=[...map.values()]
      for(const field of ['title','description','languageCode','sellingPoints','translations','handle','platformCategoryId','platformBrandId','platformAttributes','media'] as const)operation.items.push({targetId:id,field,submittedValue:listing.content[field],baseValue:null,fieldVersion:1,result:'结果待核实',error:''})
      for(const v of snapshot.variants.filter(v=>v.listingId===id))for(const [field,value] of Object.entries({sellerSku:v.sellerSku,displayColor:v.displayColor,displaySize:v.displaySize,displayPattern:v.displayPattern,imageUrl:v.imageUrl,platformAttributeValues:v.platformAttributeValues,'price.regular':snapshot.prices.find(p=>p.storeId===listing.storeId&&p.internalSkuId===v.internalSkuId&&p.priceType==='regular')?.amount,'price.retail':snapshot.prices.find(p=>p.storeId===listing.storeId&&p.internalSkuId===v.internalSkuId&&p.priceType==='retail')?.amount}))operation.items.push({targetId:v.id,field,submittedValue:value,baseValue:null,fieldVersion:1,result:'结果待核实',error:''})
    }
    snapshot.listings.push(listing);snapshot.syncOperations.push(operation)
  }
  // 此内部 SKU 与 WLS 成衣演示的 SKU-GC-20001 为同一固定身份，数量只在 WLS 来源中读取。
  const wmsSku = getSkuArchiveById('sku_r1_wms_tee_black_s')
  const wmsStyle = wmsSku && getStyleArchiveById(wmsSku.styleId)
  if (wmsSku && wmsStyle) for (const [index, storeId] of ['ST-001', 'ST-007'].entries()) {
    const store = getChannelStore(storeId)!, at = '2026-10-05T04:00:00Z', id = `channel-listing-wms-demo-${index + 1}`
    const content = contentFromStyle(wmsStyle.styleId, store.languageCode)
    content.platformCategoryId = 'apparel-tops'; content.platformBrandId = wmsStyle.brandName || 'HiGood'
    const listing: ChannelListing = { id, storeId, styleId: wmsStyle.styleId, platformProductId: `demo-wms-pid-${index + 1}`, content, contentVersion: 1, version: 1, reviewStatus: '审核通过', approvedVersion: 1, platformStatus: '在售', platformRawStatus: 'DEMO_ACTIVE', syncStatus: '一致', lastSuccessAt: at, sourceTestingOrderId: '', testingListingActionId: '', sourceIdentity: 'R1 固定演示：共享 WLS 可售来源', contentOverrides: [], baseStyleVersion: wmsStyle.updatedAt, publishedContent: structuredClone(content), createdAt: at, updatedAt: at, updatedBy: '演示资料', remark: '两个 PID、三个平台规格实例关联同一内部 SKU；平台身份均为原型演示标识。' }
    snapshot.listings.push(listing)
    for (const priceType of ['retail', 'regular', 'live', 'wholesale', 'clearance'] as ChannelPriceType[]) snapshot.prices.push({ id: `${storeId}:${wmsSku.skuId}:${priceType}`, storeId, internalSkuId: wmsSku.skuId, externalVariantId: '', priceType, amount: priceType === 'clearance' ? null : priceType === 'retail' ? 298000 : priceType === 'regular' ? 149000 : priceType === 'live' ? 139000 : 129000, currency: store.salesCurrency, mode: '默认', validFrom: '', validTo: '', origin: '演示', version: 1, updatedAt: at })
    for (let line = 0; line < (index === 0 ? 2 : 1); line++) {
      const variant: ChannelVariant = { id: `${id}-v${line + 1}`, listingId: id, platformVariantId: `demo-wms-variant-${index + 1}-${line + 1}`, sellerSku: line ? `${wmsSku.skuCode}-ALT` : wmsSku.skuCode, internalSkuId: wmsSku.skuId, displayColor: wmsSku.colorName, displaySize: wmsSku.sizeName, displayPattern: wmsSku.printName, platformAttributeValues: {}, platformAttributeSchemaVersion: 'R1-apparel-demo-v1', platformAttributeUnits: {}, imageId: wmsSku.skuId, imageUrl: wmsSku.skuImageUrl || wmsStyle.mainImageUrl, mappingVersion: 1, mappingEffectiveAt: at, mappingReason: '演示物料身份核对', mappingHistory: [{ version: 1, internalSkuId: wmsSku.skuId, effectiveAt: at, reason: '演示物料身份核对', actor: '演示资料' }], defaultPriceGroupId: `${storeId}:${wmsSku.skuId}`, active: true, version: 1 }
      snapshot.variants.push(variant)
      for (const [field, value] of Object.entries({ sellerSku: variant.sellerSku, displayColor: variant.displayColor, displaySize: variant.displaySize, displayPattern: variant.displayPattern, imageUrl: variant.imageUrl, platformAttributeValues: variant.platformAttributeValues, 'price.retail': 298000, 'price.regular': 149000 })) snapshot.fieldBaselines.push({ id: `${id}:${variant.id}:${field}`, listingId: id, targetId: variant.id, field, value, version: 1, eventId: 'demo-wms-baseline', updatedAt: at })
    }
    for (const field of ['title', 'description', 'languageCode', 'sellingPoints', 'translations', 'handle', 'platformCategoryId', 'platformBrandId', 'platformAttributes', 'media'] as const) snapshot.fieldBaselines.push({ id: `${id}:${id}:${field}`, listingId: id, targetId: id, field, value: content[field], version: 1, eventId: 'demo-wms-baseline', updatedAt: at })
  }
  const first = snapshot.variants[0]
  if (first) snapshot.orderReferences.push({ id: 'demo-order-reference-1', listingId: first.listingId, externalVariantId: first.id, internalSkuId: first.internalSkuId, mappingVersion: 1, orderCode: '演示订单 OMS-1001', status: '履约中', route: '' })
  for (const listing of snapshot.listings) listing.baseContentReference = channelBaseContentReference(listing.styleId, listing.content.languageCode)
  return snapshot
}
let cache: ChannelCatalogSnapshot | null = null
let cachedRaw: string | null = null
export function resetPcsChannelCatalogCache(): void { cache = null; cachedRaw = null }
registerPcsRepositoryReset(resetPcsChannelCatalogCache)
function readChannelCatalog(): ChannelCatalogSnapshot {
  const raw = pcsRecordStore.getItem(PCS_CHANNEL_CATALOG_KEY)
  if (!cache || raw !== cachedRaw) {
    const value = raw ? JSON.parse(raw) : seed()
    if (!['listings', 'variants', 'prices', 'syncOperations', 'fieldBaselines', 'logs', 'orderReferences'].every(key => Array.isArray(value[key]))) throw new Error('渠道资料格式不完整，原资料已保留，请重新读取。')
    cache = value; cachedRaw = raw
  }
  return cache!
}
export function getPcsChannelCatalogSnapshot(): ChannelCatalogSnapshot {
  const result=structuredClone(readChannelCatalog());result.listings=result.listings.map(projectInheritedContent);return result
}
export type ChannelListingListRow = Pick<ChannelListing, 'id' | 'storeId' | 'styleId' | 'platformProductId' | 'reviewStatus' | 'platformStatus' | 'syncStatus' | 'lastSuccessAt' | 'sourceTestingOrderId' | 'updatedAt'> & {
  content: { title: string; media: Array<Pick<ChannelContent['media'][number], 'role' | 'url'>> }
  testingReferences?: Array<{ testingOrderId: string }>
}
export type ChannelVariantListRow = Pick<ChannelVariant, 'id' | 'listingId' | 'internalSkuId' | 'platformVariantId' | 'sellerSku' | 'active'>
/** 列表与筛选导出只取得所需字段，不复制同步回执、映射历史和发布内容快照。 */
export function getChannelCatalogListSnapshot(): { listings: ChannelListingListRow[]; variants: ChannelVariantListRow[]; prices: ChannelPrice[] } {
  const snapshot = readChannelCatalog()
  return {
    listings: snapshot.listings.map(value => {
      const l = value.platformProductId || value.publishedContent ? value : projectInheritedContent(structuredClone(value))
      return {
        id: l.id, storeId: l.storeId, styleId: l.styleId, platformProductId: l.platformProductId,
        reviewStatus: l.reviewStatus, platformStatus: l.platformStatus, syncStatus: l.syncStatus,
        lastSuccessAt: l.lastSuccessAt, sourceTestingOrderId: l.sourceTestingOrderId, updatedAt: l.updatedAt,
        content: { title: l.content.title, media: l.content.media.map(m => ({ role: m.role, url: m.url })) },
        testingReferences: l.testingReferences?.map(r => ({ testingOrderId: r.testingOrderId })),
      }
    }),
    variants: snapshot.variants.map(v => ({ id: v.id, listingId: v.listingId, internalSkuId: v.internalSkuId, platformVariantId: v.platformVariantId, sellerSku: v.sellerSku, active: v.active })),
    prices: structuredClone(snapshot.prices),
  }
}
/** 档案列表仅需数量，避免为统计复制刊登内容、回执和日志；返回独立 Map。 */
export function getChannelArchiveCounts(): { byStyle: Map<string, number>; bySku: Map<string, number> } {
  const snapshot = readChannelCatalog(), byStyle = new Map<string, number>(), bySku = new Map<string, number>()
  for (const listing of snapshot.listings) byStyle.set(listing.styleId, (byStyle.get(listing.styleId) || 0) + 1)
  for (const variant of snapshot.variants) bySku.set(variant.internalSkuId, (bySku.get(variant.internalSkuId) || 0) + 1)
  return { byStyle, bySku }
}
export function writePcsChannelCatalogSnapshot(snapshot: ChannelCatalogSnapshot): void { pcsRecordStore.setItem(PCS_CHANNEL_CATALOG_KEY, JSON.stringify(snapshot)); resetPcsChannelCatalogCache() }
export function channelLog(snapshot: ChannelCatalogSnapshot, objectId: string, action: string, detail: string, actor = '当前用户', source = 'PCS'): void { snapshot.logs.push({ id: channelRecordId(), objectId, action, actor, detail, at: iso(), source }) }
export function listChannelListings(includeHistory = false): ChannelListing[] {
  const storeIds = new Set(listChannelStores(includeHistory).map(store => store.id))
  return structuredClone(readChannelCatalog().listings.filter(listing => storeIds.has(listing.storeId))).map(projectInheritedContent).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))
}
export function getChannelListing(id: string): ChannelListing | null { const value = readChannelCatalog().listings.find(l => l.id === id); return value ? projectInheritedContent(structuredClone(value)) : null }
function projectInheritedContent(listing: ChannelListing): ChannelListing {
  if (listing.platformProductId || listing.publishedContent) return listing
  const style = getStyleArchiveById(listing.styleId); if (!style) return listing
  const language = listing.content.languageCode || getChannelStore(listing.storeId)?.languageCode || 'id', reference = channelBaseContentReference(listing.styleId, language)
  if (style.updatedAt === listing.baseStyleVersion && listing.baseContentReference?.id === reference.id) return listing
  const latest = contentFromStyle(listing.styleId, language)
  let changed=false
  for(const field of ['title','description','sellingPoints','media','sizeChartSourceVersion'] as const)if(!listing.contentOverrides.includes(field)&&JSON.stringify(listing.content[field])!==JSON.stringify(latest[field])){(listing.content as unknown as Record<string,unknown>)[field]=latest[field];changed=true}
  if(changed){listing.contentVersion++;listing.version++;listing.reviewStatus='草稿';listing.approvedVersion=null;listing.syncStatus='待同步'}
  listing.baseStyleVersion=style.updatedAt; listing.baseContentReference=reference
  return listing
}
export function listChannelVariants(listingId: string): ChannelVariant[] { return structuredClone(readChannelCatalog().variants.filter(v => v.listingId === listingId)) }
export function listChannelSyncOperations(listingId?: string) { return structuredClone(readChannelCatalog().syncOperations.filter(o => !listingId || o.listingId === listingId)) }
export function listChannelListingsByStyleId(styleId: string): ChannelListing[] { return listChannelListings(true).filter(l => l.styleId === styleId) }
export function assertChannelListingEditable(listing: ChannelListing): void { const store = getChannelStore(listing.storeId); if (!store || !isCurrentChannelStore(store)) throw new Error('历史渠道商品仅支持查询与追溯。') }
export function assertChannelListingPublishable(listing: ChannelListing): void { const store = getChannelStore(listing.storeId); if (!store || !isChannelStorePublishable(store)) throw new Error('店铺已停用或不在当前经营范围，不能刊登。') }
export function validateChannelMapping(styleId: string, variants: Array<Pick<ChannelVariant, 'id' | 'internalSkuId' | 'platformVariantId'>>): void {
  if (!getStyleArchiveById(styleId)) throw new Error('必须选择一个有效款式。')
  if (!variants.length) throw new Error('请至少选择一个已审核的内部 SKU。')
  const ids = new Set<string>(), platformIds = new Set<string>()
  for (const variant of variants) {
    const sku = getSkuArchiveById(variant.internalSkuId)
    if (!sku || sku.styleId !== styleId) throw new Error('每个平台规格必须映射到当前同一款式下的内部 SKU。')
    if (ids.has(variant.id)) throw new Error('平台规格实例编号重复。'); ids.add(variant.id)
    if (variant.platformVariantId && platformIds.has(variant.platformVariantId)) throw new Error('同一 PID 的平台规格 ID 不得重复。')
    if (variant.platformVariantId) platformIds.add(variant.platformVariantId)
  }
}
export interface NewChannelListingInput { id?: string; storeId: string; styleId: string; internalSkuIds: string[]; content?: Partial<ChannelContent>; sourceTestingOrderId?: string; testingListingActionId?: string; initialPrice?: number; actor?: string }
function validateChannelContent(styleId: string, content: ChannelContent): void {
  if (!content.title.trim()) throw new Error('请填写渠道标题。')
  if (content.media.some(m => !m.url || !m.id || m.url.startsWith('data:'))) throw new Error('图片须使用已登记资料，不能把文件内容写入商品字段。')
  if (content.sizeChartSourceVersion && !listTechnicalDataVersionsByStyleId(styleId).some(v=>v.technicalVersionId===content.sizeChartSourceVersion)) throw new Error('尺码图技术来源必须为当前款式的有效技术尺寸版本。')
}
export function assertChannelDescriptionReady(content: ChannelContent): void {
  if (!content.description?.trim()) throw new Error('审核和发布前请补齐商品描述；未完成内容可以先保存草稿。')
}
export function createChannelListing(input: NewChannelListingInput): ChannelListing {
  const snapshot = getPcsChannelCatalogSnapshot(), store = getChannelStore(input.storeId)
  if (!store || !isChannelStorePublishable(store)) throw new Error('请选择当前启用的 Shopify、TikTok 或独立站店铺。')
  if (input.id && snapshot.listings.some(l => l.id === input.id)) return projectInheritedContent(snapshot.listings.find(l => l.id === input.id)!)
  const style = getStyleArchiveById(input.styleId); if (!style) throw new Error('请选择款式。')
  if (!isChannelStyleSelectable(style)) throw new Error('新建渠道商品须选择已审核且启用的款式。')
  const id = input.id || channelRecordId(), at = iso()
  const variants: ChannelVariant[] = input.internalSkuIds.map((skuId, i) => {
    const sku = getSkuArchiveById(skuId)
    if (!sku || sku.styleId !== input.styleId || !isChannelSkuSelectable(sku)) throw new Error('只能新增当前款式已审核且启用的内部 SKU。')
    return { id: channelRecordId(), listingId: id, platformVariantId: '', sellerSku: sku.skuCode, internalSkuId: sku.skuId, displayColor: sku.colorName, displaySize: sku.sizeName, displayPattern: sku.printName, platformAttributeValues: {}, platformAttributeSchemaVersion:'R1-apparel-demo-v1',platformAttributeUnits:{}, imageId: sku.skuId, imageUrl: sku.skuImageUrl || style.mainImageUrl, mappingVersion: 1, mappingEffectiveAt: at, mappingReason: '初次映射', mappingHistory: [{ version: 1, internalSkuId: sku.skuId, effectiveAt: at, reason: '初次映射', actor: input.actor || '当前用户' }], defaultPriceGroupId: `${store.id}:${sku.skuId}`, active: true, version: 1 }
  })
  validateChannelMapping(input.styleId, variants)
  const baseContent = contentForChannelStore(input.styleId,store.id), content = { ...baseContent, ...input.content }
  validateChannelContent(input.styleId,content)
  const listing: ChannelListing = { id, storeId: store.id, styleId: input.styleId, platformProductId: '', content, contentVersion: 1, version: 1, reviewStatus: '草稿', approvedVersion: null, platformStatus: '未发布', platformRawStatus: '', syncStatus: '待同步', lastSuccessAt: '', sourceTestingOrderId: input.sourceTestingOrderId || '', testingListingActionId: input.testingListingActionId || '', sourceIdentity: '', contentOverrides: Object.keys(input.content || {}).filter(field=>JSON.stringify((input.content as any)[field])!==JSON.stringify((contentFromStyle(input.styleId,store.languageCode) as any)[field])), baseStyleVersion: style.updatedAt, createdAt: at, updatedAt: at, updatedBy: input.actor || '当前用户', remark: '' }
  listing.baseContentReference = channelBaseContentReference(input.styleId, content.languageCode)
  listing.contentOverrides = Object.keys(input.content || {}).filter(field=>JSON.stringify((input.content as any)[field])!==JSON.stringify((baseContent as any)[field]))
  snapshot.listings.push(listing); snapshot.variants.push(...variants)
  for (const skuId of new Set(input.internalSkuIds)) if (!snapshot.prices.some(p => p.storeId === store.id && p.internalSkuId === skuId && p.priceType === 'regular' && !p.externalVariantId)) snapshot.prices.push({ id: channelRecordId(), storeId: store.id, internalSkuId: skuId, externalVariantId: '', priceType: 'regular', amount: input.initialPrice ?? null, currency: store.salesCurrency, mode: '默认', validFrom: '', validTo: '', origin: 'PCS', version: 1, updatedAt: at })
  if (input.initialPrice !== undefined && (!Number.isFinite(input.initialPrice) || input.initialPrice <= 0)) throw new Error('日常售价须大于 0。')
  channelLog(snapshot, id, '新建渠道商品', `${variants.length} 个平台规格 / ${new Set(input.internalSkuIds).size} 个内部 SKU`, input.actor)
  writePcsChannelCatalogSnapshot(snapshot); return listing
}
export function saveChannelContent(id: string, content: ChannelContent, expectedVersion: number, actor = '当前用户', baseReference?: ChannelBaseContentReference): ChannelListing {
  const snapshot = getPcsChannelCatalogSnapshot(), listing = snapshot.listings.find(l => l.id === id)
  if (!listing) throw new Error('渠道商品不存在。'); assertChannelListingEditable(listing)
  if (listing.version !== expectedVersion) throw new Error('渠道商品已被其他操作修改，输入尚未保存，请重新读取后核对。')
  validateChannelContent(listing.styleId,content)
  const changed = Object.keys(content).filter(key => JSON.stringify((content as any)[key]) !== JSON.stringify((listing.content as any)[key]))
  if (!changed.length && (!baseReference || baseReference.id === listing.baseContentReference?.id)) return listing
  listing.content = structuredClone(content); listing.contentVersion++; listing.version++; listing.reviewStatus = '草稿'; listing.approvedVersion = null; listing.syncStatus = '待同步'; listing.updatedAt = iso(); listing.updatedBy = actor
  listing.contentOverrides = [...new Set([...listing.contentOverrides, ...changed])]
  if (baseReference) {
    listing.baseContentReference = baseReference; listing.baseStyleVersion = baseReference.styleUpdatedAt
    listing.contentOverrides = listing.contentOverrides.filter(field => !['title','description','sellingPoints','media','sizeChartSourceVersion'].includes(field))
  }
  channelLog(snapshot, id, '保存渠道内容', `内容第 ${listing.contentVersion} 版；修改 ${changed.join('、') || '无差异'}`, actor)
  writePcsChannelCatalogSnapshot(snapshot); return listing
}
export function applyStyleContent(id: string, actor = '当前用户'): ChannelListing {
  const listing = getChannelListing(id); if (!listing) throw new Error('渠道商品不存在。')
  const language = listing.content.languageCode || getChannelStore(listing.storeId)?.languageCode || 'id', base = contentFromStyle(listing.styleId,language)
  return saveChannelContent(id, { ...listing.content, title: base.title, description: base.description, sellingPoints: base.sellingPoints, media: base.media, sizeChartSourceVersion: base.sizeChartSourceVersion }, listing.version, actor, channelBaseContentReference(listing.styleId,language))
}
export function reviewChannelListing(id: string, action: '提交审核' | '审核通过' | '驳回', actor = '当前用户', reason = ''): ChannelListing {
  const snapshot = getPcsChannelCatalogSnapshot(), listing = snapshot.listings.find(l => l.id === id)
  if (!listing) throw new Error('渠道商品不存在。'); assertChannelListingEditable(listing)
  if (action !== '驳回') {
    assertChannelDescriptionReady(listing.content)
    assertChannelPlatformContentReady(getChannelStore(listing.storeId)!, listing.content, snapshot.variants.filter(v => v.listingId === id))
    if (!listing.content.title.trim() || !listing.content.media.some(m => m.role === '主图')) throw new Error('提交前请补齐标题和主图。')
    validateChannelMapping(listing.styleId, snapshot.variants.filter(v => v.listingId === id && v.active))
  }
  if (action === '审核通过' && listing.reviewStatus !== '待审核') throw new Error('请先提交渠道内容审核。')
  if (action === '驳回' && !reason.trim()) throw new Error('请填写驳回原因。')
  listing.reviewStatus = action === '提交审核' ? '待审核' : action === '审核通过' ? '审核通过' : '草稿'
  listing.approvedVersion = action === '审核通过' ? listing.contentVersion : null; listing.version++; listing.updatedAt = iso()
  channelLog(snapshot, id, action, reason || `内容第 ${listing.contentVersion} 版`, actor)
  writePcsChannelCatalogSnapshot(snapshot); return listing
}
export function channelContentFieldOrigin(listing: ChannelListing, field: keyof ChannelContent): string {
  if (listing.contentOverrides.includes(field)) return '店铺覆盖'
  if (!['title', 'description', 'sellingPoints', 'media', 'sizeChartSourceVersion'].includes(field)) return '店铺维护'
  return listing.platformProductId || listing.publishedContent ? '发布时基础内容快照' : '继承款式基础内容'
}
/** 从已保存的映射版本生成前后关系；不回写历史订单的接单快照。 */
export function channelMappingHistoryRows(variant: ChannelVariant) {
  const history = variant.mappingHistory.slice().sort((a, b) => a.version - b.version)
  return history.map((row, index) => ({ ...row, previousInternalSkuId: history[index - 1]?.internalSkuId || '' }))
}
export function saveChannelVariant(input: ChannelVariant, expectedVersion: number, actor = '当前用户', reason = ''): ChannelVariant {
  const snapshot = getPcsChannelCatalogSnapshot(), listing = snapshot.listings.find(l => l.id === input.listingId), previous = snapshot.variants.find(v => v.id === input.id)
  if (!listing) throw new Error('渠道商品不存在。'); assertChannelListingEditable(listing)
  if (previous && previous.version !== expectedVersion) throw new Error('该平台规格已被修改，请重新读取后保存。')
  const next = structuredClone(input)
  if(previous&&previous.listingId!==input.listingId)throw new Error('平台规格不能移入另一个 PID。')
  if(!previous&&next.platformVariantId)throw new Error('新增平台规格的外部 ID 必须等待平台分配。')
  if (previous && previous.platformVariantId !== next.platformVariantId) throw new Error('平台规格 ID 由平台回执维护，不能在编辑页改写。')
  validateChannelMapping(listing.styleId, [...snapshot.variants.filter(v => v.listingId === listing.id && v.id !== next.id), next])
  if (!previous || previous.internalSkuId !== next.internalSkuId) {
    if (!isChannelStyleSelectable(getStyleArchiveById(listing.styleId))) throw new Error('新增或改绑规格须选择已审核且启用的款式。')
    if (!isChannelSkuSelectable(getSkuArchiveById(next.internalSkuId)!)) throw new Error('新平台规格须选择已审核且启用的内部 SKU。')
  }
  if (previous && previous.internalSkuId !== next.internalSkuId) {
    if (!reason.trim()) throw new Error('更正映射须填写原因。')
    next.mappingVersion = previous.mappingVersion + 1; next.mappingEffectiveAt = iso(); next.mappingReason = reason; next.defaultPriceGroupId = `${listing.storeId}:${next.internalSkuId}`
    next.mappingHistory = [...previous.mappingHistory, { version: next.mappingVersion, internalSkuId: next.internalSkuId, effectiveAt: next.mappingEffectiveAt, reason, actor }]
    snapshot.prices.filter(p=>p.externalVariantId===next.id).forEach(p=>{p.internalSkuId=next.internalSkuId})
    // 订单引用是接单时的映射快照；此动作不更新订单或 WMS。
  }
  next.version = (previous?.version || 0) + 1
  snapshot.variants = [...snapshot.variants.filter(v => v.id !== next.id), next]
  listing.version++; listing.updatedAt = iso(); listing.syncStatus = '待同步'
  const mappingChange = previous && previous.internalSkuId !== next.internalSkuId
    ? `；${getSkuArchiveById(previous.internalSkuId)?.skuCode || previous.internalSkuId} → ${getSkuArchiveById(next.internalSkuId)?.skuCode || next.internalSkuId}` : ''
  channelLog(snapshot, listing.id, previous ? '修改平台规格' : '新增同 SKU 平台规格', `${next.sellerSku}；${reason || '维护显示信息'}；映射版本 ${next.mappingVersion}${mappingChange}`, actor)
  writePcsChannelCatalogSnapshot(snapshot); return next
}
export function addChannelVariant(listingId: string, internalSkuId: string, actor = '当前用户'): ChannelVariant {
  const listing = getChannelListing(listingId), sku = getSkuArchiveById(internalSkuId)
  if (!listing || !sku) throw new Error('款式或 SKU 不存在。')
  const at = iso(), variant: ChannelVariant = { id: channelRecordId(), listingId, platformVariantId: '', sellerSku: sku.skuCode, internalSkuId, displayColor: sku.colorName, displaySize: sku.sizeName, displayPattern: sku.printName, platformAttributeValues: {}, platformAttributeSchemaVersion:'R1-apparel-demo-v1',platformAttributeUnits:{}, imageId: sku.skuId, imageUrl: sku.skuImageUrl, mappingVersion: 1, mappingEffectiveAt: at, mappingReason: '新增平台实例', mappingHistory: [{ version: 1, internalSkuId, effectiveAt: at, reason: '新增平台实例', actor }], defaultPriceGroupId: `${listing.storeId}:${internalSkuId}`, active: true, version: 0 }
  return saveChannelVariant(variant, 0, actor)
}
export function channelLocalDateToIso(value: string, timeZone: string): string {
  if (!value) return ''
  if (/Z$|[+-]\d\d:\d\d$/.test(value)) { const date = new Date(value); if (!Number.isFinite(date.getTime())) throw new Error('价格生效时间无效。'); return date.toISOString() }
  const offset = timeZone === 'Asia/Kuala_Lumpur' || timeZone === 'Asia/Shanghai' ? '+08:00' : timeZone === 'Asia/Jakarta' || timeZone === 'Asia/Ho_Chi_Minh' ? '+07:00' : ''
  if (!offset) throw new Error('该店铺时区暂不支持新限时价。')
  const date = new Date(`${value}${offset}`); if (!Number.isFinite(date.getTime())) throw new Error('价格生效时间无效。'); return date.toISOString()
}
export function saveChannelPrice(input: Pick<ChannelPrice, 'storeId' | 'internalSkuId' | 'externalVariantId' | 'priceType' | 'amount' | 'validFrom' | 'validTo'> & { expectedVersion?: number; origin?: ChannelPrice['origin'] }, actor = '当前用户'): ChannelPrice {
  const snapshot = getPcsChannelCatalogSnapshot(), store = getChannelStore(input.storeId), sku = getSkuArchiveById(input.internalSkuId)
  if (!store || !isCurrentChannelStore(store) || !sku) throw new Error('请选择有效店铺和内部 SKU。')
  const variant = input.externalVariantId ? snapshot.variants.find(v => v.id === input.externalVariantId) : null
  if (input.externalVariantId && (!variant || variant.internalSkuId !== sku.skuId || snapshot.listings.find(l => l.id === variant.listingId)?.storeId !== store.id)) throw new Error('覆盖价格只能维护对应店铺的这个平台规格。')
  if (input.amount !== null && (!Number.isFinite(input.amount) || input.amount < 0 || (input.priceType === 'regular' && input.amount <= 0))) throw new Error('价格不能为负；日常售价必须大于 0。')
  if (!!input.validFrom !== !!input.validTo) throw new Error('限时价须同时填写开始和结束时间。')
  const validFrom = channelLocalDateToIso(input.validFrom, store.timeZone), validTo = channelLocalDateToIso(input.validTo, store.timeZone)
  if (validFrom && validTo <= validFrom) throw new Error('结束时间必须晚于开始时间。')
  if (input.priceType === 'clearance' && input.amount !== null && !validFrom) throw new Error('清仓价须填写有效期。')
  const previous = snapshot.prices.find(p => p.storeId === store.id && p.internalSkuId === sku.skuId && p.externalVariantId === input.externalVariantId && p.priceType === input.priceType)
  if (input.expectedVersion !== undefined && (previous?.version || 0) !== input.expectedVersion) throw new Error('价格已被其他操作修改，请重新读取。')
  const next: ChannelPrice = { ...input, id: previous?.id || channelRecordId(), amount: input.amount === null ? null : Math.round(input.amount * 10000) / 10000, currency: store.salesCurrency, mode: input.externalVariantId ? '覆盖' : '默认', validFrom, validTo, origin: input.origin || 'PCS', version: (previous?.version || 0) + 1, updatedAt: iso() }
  snapshot.prices = [...snapshot.prices.filter(p => p.id !== next.id), next]
  const affected = new Set(snapshot.variants.filter(v => input.externalVariantId ? v.id === input.externalVariantId : v.internalSkuId === sku.skuId && !snapshot.prices.some(p=>p.externalVariantId===v.id&&p.priceType===input.priceType)).filter(v => snapshot.listings.find(l => l.id === v.listingId)?.storeId === store.id).map(v => v.listingId))
  snapshot.listings.filter(l => affected.has(l.id)).forEach(l => { l.version++; l.syncStatus = '待同步'; l.updatedAt = iso() })
  channelLog(snapshot, input.externalVariantId || `${store.id}:${sku.skuId}`, '修改渠道价格', `${input.priceType} ${next.amount ?? '未设置'} ${next.currency}；${next.mode}`, actor, next.origin)
  writePcsChannelCatalogSnapshot(snapshot); return next
}
export function followChannelDefaultPrice(variantId: string, type: ChannelPriceType, actor = '当前用户'): void {
  const snapshot = getPcsChannelCatalogSnapshot(), variant = snapshot.variants.find(v => v.id === variantId)
  if (!variant) throw new Error('平台规格不存在。')
  const listing = snapshot.listings.find(l => l.id === variant.listingId)!; assertChannelListingEditable(listing)
  snapshot.prices = snapshot.prices.filter(p => !(p.externalVariantId === variantId && p.priceType === type))
  listing.version++; listing.syncStatus = '待同步'; listing.updatedAt = iso(); channelLog(snapshot, variantId, '恢复跟随默认价', type, actor)
  writePcsChannelCatalogSnapshot(snapshot)
}
type ChannelPriceResolution = { amount: number | null; currency: string; mode: '跟随默认' | '独立覆盖'; price: ChannelPrice | null; expired: boolean }
function resolveChannelPriceValues(override: ChannelPrice | undefined, price: ChannelPrice | null, currency: string, type: ChannelPriceType, at: string, regular: () => ChannelPriceResolution): ChannelPriceResolution {
  const outsidePeriod = !!price?.validFrom && (at < price.validFrom || at >= price.validTo)
  if (type === 'clearance' && outsidePeriod) return { ...regular(), expired: true }
  return { amount: outsidePeriod ? null : price?.amount ?? null, currency, mode: override ? '独立覆盖' : '跟随默认', price: price ? structuredClone(price) : null, expired: outsidePeriod }
}
export function resolveChannelPrice(variant: ChannelVariant, type: ChannelPriceType = 'regular', at = iso(), snapshot: ChannelCatalogSnapshot = readChannelCatalog()): ChannelPriceResolution {
  const listing = snapshot.listings.find(l => l.id === variant.listingId), store = listing && getChannelStore(listing.storeId)
  const override = snapshot.prices.find(p => p.externalVariantId === variant.id && p.priceType === type)
  const price = override || snapshot.prices.find(p => !p.externalVariantId && p.storeId === store?.id && p.internalSkuId === variant.internalSkuId && p.priceType === type) || null
  return resolveChannelPriceValues(override, price, store?.salesCurrency || '', type, at, () => resolveChannelPrice(variant, 'regular', at, snapshot))
}
// 列表、全筛选导出共用一次读取内的索引；索引不作为业务事实保存，也不跨读取复用。
export function createChannelPriceResolver(snapshot: { listings: Array<Pick<ChannelListing, 'id' | 'storeId'>>; prices: ChannelPrice[] } = getPcsChannelCatalogSnapshot()) {
  const listingStores = new Map(snapshot.listings.map(listing => [listing.id, listing.storeId]))
  const currencies = new Map(listChannelStores(true).map(store => [store.id, store.salesCurrency]))
  const overrides = new Map<string, ChannelPrice>(), defaults = new Map<string, ChannelPrice>()
  for (const price of snapshot.prices) {
    const map = price.externalVariantId ? overrides : defaults
    const key = JSON.stringify(price.externalVariantId ? [price.externalVariantId, price.priceType] : [price.storeId, price.internalSkuId, price.priceType])
    if (!map.has(key)) map.set(key, price)
  }
  const resolve = (variant: Pick<ChannelVariant, 'id' | 'listingId' | 'internalSkuId'>, type: ChannelPriceType = 'regular', at = iso()): ChannelPriceResolution => {
    const storeId = listingStores.get(variant.listingId), override = overrides.get(JSON.stringify([variant.id, type]))
    const price = override || defaults.get(JSON.stringify([storeId, variant.internalSkuId, type])) || null
    return resolveChannelPriceValues(override, price, currencies.get(storeId || '') || '', type, at, () => resolve(variant, 'regular', at))
  }
  return resolve
}
export function copyChannelListing(id: string, targetStoreId: string, actor = '当前用户'): ChannelListing {
  const source = getChannelListing(id); if (!source) throw new Error('源渠道商品不存在。')
  const store = getChannelStore(targetStoreId), style = getStyleArchiveById(source.styleId)
  if (!store || !style) throw new Error('请选择有效的目标店铺和款式。')
  const variants = listChannelVariants(id).filter(v => v.active)
  const result = createChannelListing({ storeId: targetStoreId, styleId: source.styleId, internalSkuIds: variants.map(v => v.internalSkuId), content: { ...structuredClone(source.content), ...initializeChannelPlatformContent(store, style), handle: '' }, actor })
  // 外部身份、审核和发布结果由新刊登独立取得，不继承。
  const snapshot = getPcsChannelCatalogSnapshot(), copied = snapshot.listings.find(listing => listing.id === result.id)!
  copied.baseContentReference = source.baseContentReference ? structuredClone(source.baseContentReference) : undefined
  copied.baseStyleVersion = source.baseStyleVersion
  channelLog(snapshot, copied.id, '复制渠道商品', `复制来源 ${source.id}；按目标店铺模板初始化平台专用字段`, actor)
  writePcsChannelCatalogSnapshot(snapshot)
  result.baseContentReference = copied.baseContentReference; result.baseStyleVersion = copied.baseStyleVersion
  return result
}
export function listChannelMappingsBySkuId(skuId: string) {
  const snapshot = getPcsChannelCatalogSnapshot()
  return snapshot.variants.filter(v => v.internalSkuId === skuId).map(v => { const l = snapshot.listings.find(l => l.id === v.listingId)!, s = getChannelStore(l.storeId)!, p = resolveChannelPrice(v, 'regular', iso(), snapshot); return { storeId: s.id, storeName: s.storeName, channelCode: s.channelCode, market: s.marketCode, listingId: l.id, platformProductId: l.platformProductId, externalVariantId: v.id, platformVariantId: v.platformVariantId, sellerSku: v.sellerSku, displayColor: v.displayColor, displaySize: v.displaySize, effectivePrice: p.amount, currency: p.currency, platformStatus: l.platformStatus, syncStatus: l.syncStatus, active: v.active } })
}
export function listChannelAffectedOrders(variantId: string) { return structuredClone(readChannelCatalog().orderReferences.filter(o => o.externalVariantId === variantId && o.status === '履约中')) }
export interface ChannelImportRow { storeId: string; styleCode: string; internalSkuCode: string; platformProductId: string; platformVariantId: string; sellerSku: string; title: string; price: number; imageUrl?: string }
export function previewChannelImport(rows: ChannelImportRow[]): { errors: Array<{ row: number; message: string }>; groups: Map<string, ChannelImportRow[]> } {
  const errors: Array<{ row: number; message: string }> = [], groups = new Map<string, ChannelImportRow[]>(), skuByCode = new Map(listSkuArchives().map(s=>[s.skuCode,s])), styleByCode = new Map(listStyleArchives().map(s=>[s.styleCode,s])), storeById = new Map(listChannelStores(true).flatMap(s=>[s.id,...s.legacyAliases].map(id=>[id,s] as const))), existingPids = new Set(readChannelCatalog().listings.map(l=>`${l.storeId}:${l.platformProductId}`)), externalIds = new Map<string,Set<string>>()
  rows.forEach((row, index) => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) { errors.push({ row: index + 1, message: '每行须为完整的渠道规格记录' }); return }
    const store = storeById.get(row.storeId), style = styleByCode.get(row.styleCode), sku = skuByCode.get(row.internalSkuCode)
    let error = ''
    if (!store) error = '店铺不存在，无法确定历史平台身份范围'
    else if (!style || !sku || sku.styleId !== style.styleId) error = '必须完整匹配同一款式下的内部 SKU'
    else if (typeof row.platformProductId!=='string'||typeof row.platformVariantId!=='string'||!row.platformProductId.trim()||!row.platformVariantId.trim()) error = '历史导入须保留平台 PID 与规格 ID 原值'
    else if (typeof row.title !== 'string' || !row.title.trim() || !Number.isFinite(row.price) || row.price <= 0) error = '文本标题和大于 0 的数字日常售价必填'
    else if (row.sellerSku !== undefined && typeof row.sellerSku !== 'string') error = 'sellerSku 须以文本保存'
    else if (row.imageUrl !== undefined && (typeof row.imageUrl !== 'string' || /^(data:|blob:|javascript:)/i.test(row.imageUrl))) error = '图片须使用有效资源地址，不能导入 Base64 或临时预览地址'
    const key = `${store?.id}:${row.platformProductId}`
    const first=groups.get(key)?.[0]
    if (!error && first && first.styleCode !== row.styleCode) error = '一个 PID 只能对应一个款式'
    if (!error && first && first.title !== row.title) error = '同一 PID 的渠道标题须保持一致'
    if (!error && externalIds.get(key)?.has(row.platformVariantId)) error = '本次导入平台规格 ID 重复'
    if (!error && existingPids.has(key)) error = '该店铺 PID 已存在，请进入原渠道商品维护'
    if (error) errors.push({ row: index + 1, message: error }); else {
      const group=groups.get(key);if(group)group.push(row);else groups.set(key,[row])
      const ids=externalIds.get(key);if(ids)ids.add(row.platformVariantId);else externalIds.set(key,new Set([row.platformVariantId]))
    }
  })
  return { errors, groups }
}
export function importChannelRows(rows: ChannelImportRow[], actor = '当前用户'): string[] {
  const preview=previewChannelImport(rows);if(preview.errors.length)throw new Error(`第 ${preview.errors[0].row} 行：${preview.errors[0].message}；未导入任何记录。`)
  const snapshot=getPcsChannelCatalogSnapshot(),ids:string[]=[],skus=listSkuArchives(),at=iso()
  for(const group of preview.groups.values()){
    const first=group[0],style=listStyleArchives().find(s=>s.styleCode===first.styleCode)!,store=getChannelStore(first.storeId)!,id=channelRecordId(),content={...contentFromStyle(style.styleId,store.languageCode),title:first.title}
    const listing:ChannelListing={id,storeId:store.id,styleId:style.styleId,platformProductId:first.platformProductId,content,contentVersion:1,version:1,reviewStatus:'草稿',approvedVersion:null,platformStatus:'未取得状态',platformRawStatus:'',syncStatus:'待同步',lastSuccessAt:'',sourceTestingOrderId:'',testingListingActionId:'',sourceIdentity:'渠道业务导入',contentOverrides:['title'],baseStyleVersion:style.updatedAt,publishedContent:structuredClone(content),createdAt:at,updatedAt:at,updatedBy:actor,remark:'原始 PID 与规格 ID 已承接，尚未收到新的平台状态观测'}
    listing.baseContentReference=channelBaseContentReference(style.styleId,content.languageCode)
    snapshot.listings.push(listing)
    for(const row of group){const sku=skus.find(s=>s.skuCode===row.internalSkuCode)!,variantId=channelRecordId()
      snapshot.variants.push({id:variantId,listingId:id,platformVariantId:row.platformVariantId,sellerSku:row.sellerSku||sku.skuCode,internalSkuId:sku.skuId,displayColor:sku.colorName,displaySize:sku.sizeName,displayPattern:sku.printName,platformAttributeValues:{},imageId:sku.skuId,imageUrl:row.imageUrl||sku.skuImageUrl||style.mainImageUrl,mappingVersion:1,mappingEffectiveAt:at,mappingReason:'历史渠道完整映射',mappingHistory:[{version:1,internalSkuId:sku.skuId,effectiveAt:at,reason:'历史渠道完整映射',actor}],defaultPriceGroupId:`${store.id}:${sku.skuId}`,active:true,version:1})
      snapshot.prices.push({id:channelRecordId(),storeId:store.id,internalSkuId:sku.skuId,externalVariantId:variantId,priceType:'regular',amount:row.price,currency:store.salesCurrency,mode:'覆盖',validFrom:'',validTo:'',origin:'导入',version:1,updatedAt:at})
    }
    channelLog(snapshot,id,'导入渠道商品',`${group.length} 个外部规格全部匹配内部 SKU；保留原始外部身份`,actor);ids.push(id)
  }
  writePcsChannelCatalogSnapshot(snapshot);return ids
}

export function bindChannelListingToTesting(input:{listingId:string;testingOrderId:string;testingListingActionId:string;styleId:string},actor='当前用户'):ChannelListing {
  const snapshot=getPcsChannelCatalogSnapshot(), listing=snapshot.listings.find(l=>l.id===input.listingId)
  if(!listing||listing.styleId!==input.styleId)throw Error('只能关联同一款式的渠道 PID。')
  assertChannelListingEditable(listing)
  if(!input.testingOrderId||!input.testingListingActionId)throw Error('测款单及上架动作标识不能为空。')
  const references=listing.testingReferences||[]
  if(references.some(r=>r.testingOrderId===input.testingOrderId&&r.testingListingActionId===input.testingListingActionId))return listing
  listing.testingReferences=[...references,{id:input.testingListingActionId,testingOrderId:input.testingOrderId,testingListingActionId:input.testingListingActionId,at:iso()}]
  if(!listing.sourceTestingOrderId){listing.sourceTestingOrderId=input.testingOrderId;listing.testingListingActionId=input.testingListingActionId}
  channelLog(snapshot,listing.id,'关联测款上架动作',`${input.testingOrderId} / ${input.testingListingActionId}`,actor)
  writePcsChannelCatalogSnapshot(snapshot);return listing
}
