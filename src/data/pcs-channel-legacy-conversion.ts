/** 独立升级使用的纯转换。输入和旧源均不修改；没有可确认的内部映射时拒绝整次转换。 */
import type { ChannelCatalogSnapshot, ChannelStoreSnapshot, ChannelStore, ChannelCode, ChannelContent, ChannelListing, ChannelVariant, ChannelMedia } from './pcs-channel-catalog-types.ts'
interface LegacySku { skuId: string; skuCode: string; styleId: string; colorName?: string; sizeName?: string; printName?: string; skuImageUrl?: string }
interface LegacyStyle { styleId: string; styleCode: string; styleName: string; updatedAt?: string; mainImageUrl?: string }
const str=(v:unknown)=>typeof v==='string'?v:''
function convertLegacyMedia(record: any, listingId: string, style: LegacyStyle): ChannelMedia[] {
 const images = Array.isArray(record.listingImages) ? record.listingImages.filter((image:any)=>str(image.imageUrl)&&!image.isDelete) : []
 const mainUrls = Array.isArray(record.mainImageUrls) ? record.mainImageUrls.filter((url:unknown)=>str(url)) : []
 const detailUrls = Array.isArray(record.detailImageUrls) ? record.detailImageUrls.filter((url:unknown)=>str(url)) : []
 if (images.length) {
  const explicitMain = str(record.listingMainImageId)
  const hasMainEvidence = images.some((image:any)=>image.imageId===explicitMain||image.mainFlag===true||image.isMain===true||image.role==='主图'||mainUrls.includes(image.imageUrl))
  return images.map((image:any,index:number)=>{
   const role: ChannelMedia['role'] = ['主图','详情图','尺码图','视频'].includes(image.role) ? image.role : image.imageId===explicitMain||image.mainFlag===true||image.isMain===true||mainUrls.includes(image.imageUrl)||(!hasMainEvidence&&index===0) ? '主图' : '详情图'
   return {id:str(image.imageId)||`${listingId}-image-${index}`,url:image.imageUrl,name:str(image.imageName)||style.styleName,role,sort:Number.isFinite(image.sortNo)&&image.sortNo>0?image.sortNo:index+1,...(str(image.fileId)?{fileId:image.fileId}:{}),...(str(image.sourceVersion)?{sourceVersion:image.sourceVersion}:{})}
  }).sort((a:ChannelMedia,b:ChannelMedia)=>a.sort-b.sort)
 }
 const urls = [...mainUrls.map((url:string)=>({url,role:'主图' as const})),...detailUrls.map((url:string)=>({url,role:'详情图' as const}))]
 if (!urls.length&&style.mainImageUrl) urls.push({url:style.mainImageUrl,role:'主图'})
 return urls.map((image,index)=>({id:`${listingId}-image-${index}`,url:image.url,name:style.styleName,role:image.role,sort:index+1}))
}
export function convertLegacyChannelSnapshot(raw:unknown, storesSnapshot:ChannelStoreSnapshot, catalogSnapshot:ChannelCatalogSnapshot, skuRecords:LegacySku[], styleRecords:LegacyStyle[]):{storeSnapshot:ChannelStoreSnapshot;catalogSnapshot:ChannelCatalogSnapshot;counts:{listings:number;variants:number;stores:number}} {
 const old=typeof raw==='string'?JSON.parse(raw):raw
 if(!old||typeof old!=='object'||!Array.isArray((old as any).records))throw Error('旧渠道资料格式不完整，未改动旧源。')
 const stores=structuredClone(storesSnapshot),catalog=structuredClone(catalogSnapshot),counts={listings:0,variants:0,stores:0}
 const skuById=new Map(skuRecords.map(s=>[s.skuId,s])),skuByCode=new Map(skuRecords.map(s=>[s.skuCode.toLowerCase(),s])),styles=new Map(styleRecords.map(s=>[s.styleId,s]))
 for(const r of (old as any).records){
  const sourceId=str(r.channelProductId);if(!sourceId)throw Error('旧渠道商品缺少稳定标识，未改动旧源。')
  if(catalog.listings.some(l=>l.sourceIdentity===`legacy:${sourceId}`||l.id===sourceId)||catalog.logs.some(l=>l.id===`legacy-log:${sourceId}`))continue
  let store=stores.stores.find(s=>s.id===r.storeId||s.legacyAliases.includes(r.storeId));const at=str(r.updatedAt)||str(r.createdAt)||'2026-10-05T00:00:00Z'
  if(!store){
   const code=normalizeLegacyChannel(str(r.channelCode)||str(r.channelName)),currency=str(r.currencyCode)||str(r.currency)||'IDR',market=currency==='IDR'?'ID':currency==='MYR'?'MY':currency==='VND'?'VN':currency==='PHP'?'PH':'UNKNOWN'
   const id=`legacy-store:${str(r.storeId)||sourceId}`
   store={id,storeCode:str(r.storeId)||id,storeName:str(r.storeName)||'历史店铺',channelCode:code,externalStoreId:'',marketCode:market,salesCurrency:currency,settlementCurrency:currency,languageCode:market==='ID'?'id':market==='MY'?'ms':'',timeZone:market==='ID'?'Asia/Jakarta':market==='MY'?'Asia/Kuala_Lumpur':'UTC',teamId:'',ownerId:'历史资料',operatingStatus:'停用',inventorySource:'WMS_SHARED',connectionDescription:'历史导入；外部店铺身份及连接待核对',allowListing:false,defaultCategoryId:'',handlingDays:0,legacyAliases:r.storeId?[r.storeId]:[],version:1,createdAt:at,updatedAt:at,updatedBy:'历史升级'} satisfies ChannelStore
   stores.stores.push(store);counts.stores++
  }
  const lines=Array.isArray(r.specLines)&&r.specLines.length?r.specLines:[{specLineId:`${sourceId}-legacy-line`,sellerSku:r.skuCode,internalSkuId:r.skuId,priceAmount:r.listingPrice}]
  const mapped=lines.map((line:any)=>{
   let sku=skuById.get(str(line.internalSkuId))||skuById.get(str(line.skuId))||skuByCode.get(str(line.skuCode).toLowerCase())||skuByCode.get(str(line.sellerSku).toLowerCase())
   if(!sku&&lines.length===1)sku=skuById.get(str(r.skuId))||skuByCode.get(str(r.skuCode).toLowerCase())
   if(!sku&&r.styleId){const matches=skuRecords.filter(s=>s.styleId===r.styleId&&s.colorName===line.colorName&&s.sizeName===line.sizeName&&(s.printName||'')===(line.printName||''));if(matches.length===1)sku=matches[0]}
   if(!sku)throw Error(`历史渠道商品 ${r.channelProductCode||sourceId} 的规格 ${line.sellerSku||line.specLineId||''} 未匹配内部 SKU，旧资料已保留。`)
   return {line,sku}
  })
  const styleIds=new Set(mapped.map((m:{sku:LegacySku})=>m.sku.styleId));if(styleIds.size!==1)throw Error(`历史 PID ${r.upstreamProductId||sourceId} 涉及多个款式，旧资料已保留。`)
  const styleId=[...styleIds][0] as string,style=styles.get(styleId);if(!style)throw Error(`内部款式 ${styleId} 不存在，旧资料已保留。`)
  const pid=str(r.upstreamProductId),existing=pid?catalog.listings.find(l=>l.storeId===store!.id&&l.platformProductId===pid):null
  if(existing&&existing.styleId!==styleId)throw Error(`平台 PID ${pid} 已对应其他款式，旧资料已保留。`)
  const id=existing?.id||sourceId
  const content:ChannelContent={languageCode:store.languageCode||'id',sellingPoints:'',title:str(r.listingTitle)||str(r.styleListingTitle)||style.styleName,description:str(r.listingDescription),handle:'',platformCategoryId:'',platformBrandId:'',platformAttributes:r.platformAttributes||{},platformAttributeSchemaVersion:str(r.platformAttributeSchemaVersion),platformAttributeUnits:r.platformAttributeUnits||{},translations:[],media:convertLegacyMedia(r,id,style),sizeChartSourceVersion:''}
  const listing:ChannelListing=existing||{id,storeId:store.id,styleId,platformProductId:pid,content,contentVersion:1,version:1,reviewStatus:pid?'审核通过':'草稿',approvedVersion:pid?1:null,platformStatus:pid?['已下架','已失效'].includes(r.channelProductStatus)?'已下架':r.channelProductStatus==='在售'?'在售':'未取得状态':'未发布',platformRawStatus:str(r.channelProductStatus),syncStatus:'待同步',lastSuccessAt:'',sourceTestingOrderId:str(r.sourceTestingOrderId),testingListingActionId:str(r.testingListingActionId),sourceIdentity:`legacy:${sourceId}`,contentOverrides:['title','description','media'],baseStyleVersion:style.updatedAt||'',publishedContent:pid?structuredClone(content):undefined,createdAt:str(r.createdAt)||at,updatedAt:at,updatedBy:'历史升级',remark:str(r.listingRemark)}
  if(!existing){catalog.listings.push(listing);counts.listings++}
  for(const {line,sku} of mapped){
   const externalId=str(line.upstreamSkuId)||str(line.platformVariantId),duplicate=externalId&&catalog.variants.find(v=>v.listingId===id&&v.platformVariantId===externalId)
   if(duplicate){if(duplicate.internalSkuId!==sku.skuId)throw Error(`平台规格 ${externalId} 对应多个内部 SKU，旧资料已保留。`);continue}
   const variantId=`legacy:${sourceId}:${str(line.specLineId)||counts.variants+1}`
   const v:ChannelVariant={id:variantId,listingId:id,platformVariantId:externalId,sellerSku:str(line.sellerSku)||sku.skuCode,internalSkuId:sku.skuId,displayColor:str(line.colorName)||sku.colorName||'',displaySize:str(line.sizeName)||sku.sizeName||'',displayPattern:str(line.printName)||sku.printName||'',platformAttributeValues:line.platformAttributeValues||{},platformAttributeSchemaVersion:str(line.platformAttributeSchemaVersion),platformAttributeUnits:line.platformAttributeUnits||{},imageId:str(line.productImageId),imageUrl:str(line.productImageUrl)||sku.skuImageUrl||style.mainImageUrl||'',mappingVersion:1,mappingEffectiveAt:at,mappingReason:'历史资料明确映射',mappingHistory:[{version:1,internalSkuId:sku.skuId,effectiveAt:at,reason:'历史资料明确映射',actor:'历史升级'}],defaultPriceGroupId:`${store.id}:${sku.skuId}`,active:true,version:1}
   catalog.variants.push(v);counts.variants++
   const amount=Number(line.priceAmount??r.listingPrice??r.defaultPriceAmount),valid=Number.isFinite(amount)?amount:null
   catalog.prices.push({id:`${variantId}:regular`,storeId:store.id,internalSkuId:sku.skuId,externalVariantId:variantId,priceType:'regular',amount:valid,currency:store.salesCurrency,mode:'覆盖',validFrom:'',validTo:'',origin:'导入',version:1,updatedAt:at})
  }
  catalog.logs.push({id:`legacy-log:${sourceId}`,objectId:id,action:'承接历史渠道商品',actor:'历史升级',at,detail:`原记录 ${r.channelProductCode||sourceId}；保留原始 PID、平台规格 ID、媒体和价格；新同步回执尚未确认。`,source:`legacy:${sourceId}`})
 }
 return{storeSnapshot:stores,catalogSnapshot:catalog,counts}
}
function normalizeLegacyChannel(value:string):ChannelCode{const lower=value.toLowerCase();if(lower.includes('shopify'))return'shopify';if(lower.includes('tiktok'))return'tiktok';if(lower.includes('shopee')||value==='虾皮')return'shopee';if(lower.includes('lazada'))return'lazada';if(lower.includes('shopxo'))return'shopxo';if(lower.includes('shopline')||value==='店匠')return'shopline';if(lower.includes('independent')||value.includes('独立'))return'independent-site';throw Error(`未知历史渠道 ${value}，未修改旧源。`)}
