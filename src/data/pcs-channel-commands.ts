/** 单次页面业务动作内的正常同步。演示回执与事务一起保存，不连接真实 API。 */
import { getPcsChannelCatalogSnapshot, getChannelListing } from './pcs-channel-catalog.ts'
import { submitChannelSync, receiveChannelReceipt, demoChannelReceipt, readChannelSyncField, CHANNEL_CONTENT_SYNC_FIELDS, CHANNEL_VARIANT_SYNC_FIELDS, channelFieldSupported } from './pcs-channel-sync.ts'
import { getChannelStore, isChannelStorePublishable } from './pcs-channel-store-repository.ts'
import type { ChannelCatalogSnapshot, ChannelSyncOperation } from './pcs-channel-catalog-types.ts'
export function synchronizePublishedChannelChanges(before:ChannelCatalogSnapshot):ChannelSyncOperation[]{
 const after=getPcsChannelCatalogSnapshot(),results:ChannelSyncOperation[]=[]
 for(const listing of after.listings){
  const previous=before.listings.find(l=>l.id===listing.id),store=getChannelStore(listing.storeId)
  if(!previous||!listing.platformProductId||!store||!isChannelStorePublishable(store)||listing.reviewStatus!=='审核通过'||listing.approvedVersion!==listing.contentVersion)continue
  const candidates=[...CHANNEL_CONTENT_SYNC_FIELDS.map(field=>({targetId:listing.id,field})),...after.variants.filter(v=>v.listingId===listing.id&&v.active).flatMap(v=>CHANNEL_VARIANT_SYNC_FIELDS.map(field=>({targetId:v.id,field})))]
  const fields=candidates.filter(item=>channelFieldSupported(store.channelCode,item.field)).filter(item=>{
   const next=readChannelSyncField(after,listing,item.targetId,item.field);if(next===undefined)return false
   if(item.targetId!==listing.id&&!before.variants.some(v=>v.id===item.targetId))return true
   const last=readChannelSyncField(before,previous,item.targetId,item.field),baseline=after.fieldBaselines.find(b=>b.listingId===listing.id&&b.targetId===item.targetId&&b.field===item.field)
   return JSON.stringify(next)!==JSON.stringify(last)||(previous.reviewStatus!=='审核通过'&&JSON.stringify(next)!==JSON.stringify(baseline?.value))
  })
  if(!fields.length)continue
  const op=submitChannelSync(listing.id,'更新',{fields});results.push(receiveChannelReceipt(demoChannelReceipt(op.id)))
 }
 return results
}
