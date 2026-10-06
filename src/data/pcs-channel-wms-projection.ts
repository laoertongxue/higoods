/** 仅读取 WLS 同一静态来源；不维护库存、预分份额或写回仓储。 */
import { warehouseSeed } from './wls/seed/shared-seed.ts'
import { stockRealtimeSeed } from './wls/seed/stock-seed.ts'
import { getChannelStore,isChannelStorePublishable } from './pcs-channel-store-repository.ts'
import { getSkuArchiveById } from './pcs-sku-archive-repository.ts'
import { getPcsChannelCatalogSnapshot } from './pcs-channel-catalog.ts'
import { recordSharedChannelAvailability } from './pcs-channel-sync.ts'
export function getChannelWmsAvailability(internalSkuId:string){
 const sku=getSkuArchiveById(internalSkuId);if(!sku)return null
 const finishedWarehouses=new Set(warehouseSeed.filter(w=>w.businessType==='FINISHED').map(w=>w.name))
 const rows=stockRealtimeSeed.filter(r=>finishedWarehouses.has(r.warehouseName)&&(r.sku===sku.skuCode||!!sku.legacyCode&&r.sku===sku.legacyCode))
 if(!rows.length)return null
 const units=new Set(rows.map(r=>r.unit));if(units.size!==1||!rows[0].unit)throw Error('WLS 来源单位不一致，请先核对仓储资料。')
 return{internalSkuId,available:rows.reduce((sum,r)=>sum+Math.max(0,r.spotStock-(r.spotOrderOccupiedQuantity||0)-(r.preSaleOrderOccupiedQuantity||0)),0),unit:rows[0].unit!,sourceRef:`WLS:${rows.map(r=>r.id).sort().join(',')}`,sourceVersion:JSON.stringify(rows.map(r=>[r.id,r.spotStock,r.transitStock,r.spotOrderOccupiedQuantity,r.preSaleOrderOccupiedQuantity])),skuCode:rows[0].sku,route:`/wls/finished/stock-realtime?sku=${encodeURIComponent(rows[0].sku)}`}
}
export function synchronizeChannelWmsAvailability(listingId:string){
 const snapshot=getPcsChannelCatalogSnapshot(),ids=[...new Set(snapshot.variants.filter(v=>v.listingId===listingId&&v.active).map(v=>v.internalSkuId))],sources=ids.map(getChannelWmsAvailability).filter((x):x is NonNullable<typeof x>=>!!x)
 if(!sources.length)throw Error('当前内部 SKU 尚无精确匹配的 WLS 可售来源，请先核对仓储对应关系。')
 const listingIds=[...new Set(snapshot.variants.filter(v=>v.active&&sources.some(s=>s.internalSkuId===v.internalSkuId)).map(v=>v.listingId))].filter(id=>{const listing=snapshot.listings.find(l=>l.id===id),store=listing&&getChannelStore(listing.storeId);return store&&isChannelStorePublishable(store)&&!!listing.platformProductId})
 return recordSharedChannelAvailability({sourceRef:sources.map(s=>s.sourceRef).join(';'),sourceVersion:sources.map(s=>s.sourceVersion).join(';'),rows:sources.map(s=>({internalSkuId:s.internalSkuId,available:s.available,unit:s.unit})),listingIds})
}
