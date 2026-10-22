/** 仅读取 WLS 唯一成衣库存投影，不维护渠道预分份额或写回仓储。 */
import { finishedInventoryAvailability } from './wls/finished-inventory-quality.ts'
import { getChannelStore,isChannelStorePublishable } from './pcs-channel-store-repository.ts'
import { getSkuArchiveById } from './pcs-sku-archive-repository.ts'
import { getPcsChannelCatalogSnapshot } from './pcs-channel-catalog.ts'
import { recordSharedChannelAvailability } from './pcs-channel-sync.ts'
export function getChannelWmsAvailability(internalSkuId:string){
 const sku=getSkuArchiveById(internalSkuId);if(!sku)return null
 const source=finishedInventoryAvailability(sku.skuCode) || (sku.legacyCode ? finishedInventoryAvailability(sku.legacyCode) : null)
 if(!source)return null
 return{internalSkuId,available:source.available,unit:'件',sourceRef:`WLS:${source.sourceRef}`,sourceVersion:source.sourceVersion,skuCode:sku.skuCode,route:`/wls/finished/stock/realtime?sku=${encodeURIComponent(sku.skuCode)}`}
}
export function synchronizeChannelWmsAvailability(listingId:string){
 const snapshot=getPcsChannelCatalogSnapshot(),ids=[...new Set(snapshot.variants.filter(v=>v.listingId===listingId&&v.active).map(v=>v.internalSkuId))],sources=ids.map(getChannelWmsAvailability).filter((x):x is NonNullable<typeof x>=>!!x)
 if(!sources.length)throw Error('当前内部 SKU 尚无精确匹配的 WLS 可售来源，请先核对仓储对应关系。')
 const listingIds=[...new Set(snapshot.variants.filter(v=>v.active&&sources.some(s=>s.internalSkuId===v.internalSkuId)).map(v=>v.listingId))].filter(id=>{const listing=snapshot.listings.find(l=>l.id===id),store=listing&&getChannelStore(listing.storeId);return store&&isChannelStorePublishable(store)&&!!listing.platformProductId})
 return recordSharedChannelAvailability({sourceRef:sources.map(s=>s.sourceRef).join(';'),sourceVersion:sources.map(s=>s.sourceVersion).join(';'),rows:sources.map(s=>({internalSkuId:s.internalSkuId,available:s.available,unit:s.unit})),listingIds})
}
