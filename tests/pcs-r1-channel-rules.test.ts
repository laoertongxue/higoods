import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import * as catalog from '../src/data/pcs-channel-catalog.ts'
import * as stores from '../src/data/pcs-channel-store-repository.ts'
import * as sync from '../src/data/pcs-channel-sync.ts'
import { getChannelPlatformTemplate, channelPlatformTemplateVersion } from '../src/data/pcs-channel-platform-template.ts'
import { synchronizePublishedChannelChanges } from '../src/data/pcs-channel-commands.ts'
import { convertLegacyChannelSnapshot } from '../src/data/pcs-channel-legacy-conversion.ts'
import { listSkuArchives, getSkuArchiveById } from '../src/data/pcs-sku-archive-repository.ts'
import { listStyleArchives, getStyleArchiveById, getStyleArchiveStoreSnapshot, updateStyleArchive, replaceStyleArchiveStore } from '../src/data/pcs-style-archive-repository.ts'
import { getTestingOrderById, listTestingOrders, updateTestingOrder, prepareTestingOrderChannelListing, completeTestingOrderChannelListing, hasPassedTestingOrder } from '../src/data/pcs-testing-order-repository.ts'
import { getChannelWmsAvailability, synchronizeChannelWmsAvailability } from '../src/data/pcs-channel-wms-projection.ts'
import { stockRealtimeSeed } from '../src/data/wls/seed/stock-seed.ts'
import { renderFinishedStockRealtime } from '../src/pages/wls/finished/stock-realtime.ts'
import { renderPcsChannelProductListPage, renderPcsChannelProductDetailPage, renderPcsChannelProductEditPage, renderChannelSyncPanel, handlePcsChannelProductListInput, handlePcsChannelProductListEvent, hasUnsavedPcsChannelChanges, discardPcsChannelChanges } from '../src/pages/pcs-channel-products.ts'
import { renderPcsChannelStoreListPage, renderPcsChannelStoreDetailPage, renderPcsChannelStoreEditPage, handlePcsChannelStoresInput, hasUnsavedPcsChannelStoreChanges, discardPcsChannelStoreChanges } from '../src/pages/pcs-channel-stores.ts'
import { renderChannelDescription } from '../src/pages/pcs-channel-ui.ts'
import { listTechnicalDataVersionsByStyleId } from '../src/data/pcs-technical-data-version-repository.ts'
import { hasPcsUnsavedChanges, confirmPcsRouteLeave } from '../src/data/pcs-unsaved-changes.ts'
import { getProjectChannelProductById } from '../src/data/pcs-channel-product-project-repository.ts'
import { getProjectInstanceModel } from '../src/data/pcs-project-instance-model.ts'
import { getProjectRelationStoreSnapshot, listProjectRelations, upsertProjectRelation, replaceProjectRelationStore } from '../src/data/pcs-project-relation-repository.ts'
const baseline=catalog.getPcsChannelCatalogSnapshot(),storeBaseline=stores.getPcsChannelStoreSnapshot(),styleBaseline=getStyleArchiveStoreSnapshot()
const L=baseline.listings[0],V=baseline.variants.filter(v=>v.listingId===L.id),eligible=listSkuArchives().filter(catalog.isChannelSkuSelectable)
beforeEach(()=>{pcsRecordStore.setItem(catalog.PCS_CHANNEL_CATALOG_KEY,JSON.stringify(baseline));pcsRecordStore.setItem(stores.PCS_CHANNEL_STORE_KEY,JSON.stringify(storeBaseline));replaceStyleArchiveStore(styleBaseline);catalog.resetPcsChannelCatalogCache();stores.resetPcsChannelStoreCache()})
function make(){const sku=eligible[0];return catalog.createChannelListing({storeId:'ST-001',styleId:sku.styleId,internalSkuIds:[sku.skuId,sku.skuId],initialPrice:100})}
function approve(id:string){catalog.reviewChannelListing(id,'提交审核');catalog.reviewChannelListing(id,'审核通过')}
function publish(id:string){approve(id);const op=sync.submitChannelSync(id,'发布');sync.receiveChannelReceipt(sync.demoChannelReceipt(op.id));return catalog.getChannelListing(id)!}

test('CHAN-001/002/003/018 current scopes, separate MYR sales/CNY settlement, inactive is not platform offline',()=>{
 assert.deepEqual(stores.CURRENT_CHANNELS.map(c=>c.code),['shopify','tiktok','independent-site']);assert.deepEqual(stores.CURRENT_MARKETS.map(c=>c.code),['ID','MY'])
 const my=stores.getChannelStore('ST-008')!;assert.equal(my.salesCurrency,'MYR');assert.equal(my.settlementCurrency,'CNY');assert.equal(stores.listChannelStores().length,6);assert.equal(stores.listChannelStores(true).length,8)
 stores.setChannelStoreOperatingStatus(L.storeId,'停用');assert.equal(catalog.getChannelListing(L.id)!.platformStatus,'在售')
 assert.throws(()=>catalog.createChannelListing({storeId:L.storeId,styleId:L.styleId,internalSkuIds:[V[0].internalSkuId]}),/启用/)
 assert.throws(()=>catalog.saveChannelContent(baseline.listings[7].id,baseline.listings[7].content,1),/历史/)
})
test('STORE-011/012 store responsibility uses existing IDs and logs original and changed owner/team',()=>{
 const current=stores.getChannelStore('ST-001')!,people=stores.getChannelResponsibilityOptions()
 const owner=people.owners.find(value=>value.id!==current.ownerId)!,team=people.teams.find(value=>value.id!==current.teamId)!
 assert.throws(()=>stores.saveChannelStore({...current,ownerId:'随手输入的名字'},current.version),/已有人员/)
 assert.throws(()=>stores.saveChannelStore({...current,teamId:'随手输入的团队'},current.version),/已有团队/)
 const next=stores.saveChannelStore({...current,ownerId:owner.id,teamId:team.id},current.version,'当前维护人')
 assert.equal(next.ownerId,owner.id);assert.equal(next.teamId,team.id)
 const log=stores.getPcsChannelStoreSnapshot().logs.find(log=>log.action==='变更店铺负责人与团队')!
 for(const value of [current.ownerId,next.ownerId,current.teamId,next.teamId])assert.ok(log.detail.includes(value))
 assert.equal(log.actor,'当前维护人');assert.ok(log.at)
 const detail=renderPcsChannelStoreDetailPage(next.id),edit=renderPcsChannelStoreEditPage(next.id)
 assert.ok(detail.includes(owner.name));assert.ok(detail.includes(team.name));assert.match(edit,/select[^>]+data-pcs-channel-store-field="form.ownerId"/)
 discardPcsChannelStoreChanges()
})
test('CHAN-004/005 new container cannot cross SPUs, duplicate internal SKU has independent external records',()=>{
 const other=eligible.find(s=>s.styleId!==L.styleId)!
 assert.throws(()=>catalog.createChannelListing({storeId:'ST-001',styleId:L.styleId,internalSkuIds:[V[0].internalSkuId,other.skuId]}),/款式/)
 const l=make(),vs=catalog.listChannelVariants(l.id);assert.equal(vs.length,2);assert.notEqual(vs[0].id,vs[1].id);assert.equal(vs[0].internalSkuId,vs[1].internalSkuId);assert.equal(vs[0].platformVariantId,'')
 const otherForNew=eligible.find(s=>s.styleId!==l.styleId)!
 assert.throws(()=>catalog.saveChannelVariant({...vs[0],internalSkuId:otherForNew.skuId},vs[0].version,'测试','更正'),/同一款式/)
})
test('CHAN-004 stopped parent SPU blocks new PID and new mappings while existing listing stays maintainable',()=>{
 const listing=make(),variants=catalog.listChannelVariants(listing.id),sku=getSkuArchiveById(variants[0].internalSkuId)!,other=listSkuArchives().find(s=>s.styleId===listing.styleId&&s.skuId!==sku.skuId&&catalog.isChannelSkuSelectable(s))!
 assert.ok(other);updateStyleArchive(listing.styleId,{lifecycleStatus:'INACTIVE',archiveStatus:'INACTIVE'})
 assert.equal(getSkuArchiveById(sku.skuId)!.lifecycleStatus,'ACTIVE');assert.equal(catalog.isChannelSkuSelectable(sku),false)
 const before=catalog.getPcsChannelCatalogSnapshot()
 assert.throws(()=>catalog.createChannelListing({storeId:listing.storeId,styleId:listing.styleId,internalSkuIds:[sku.skuId]}),/已审核且启用的款式/)
 assert.throws(()=>catalog.addChannelVariant(listing.id,sku.skuId),/已审核且启用的款式/)
 assert.throws(()=>catalog.saveChannelVariant({...variants[0],internalSkuId:other.skuId},variants[0].version,'当前用户','改绑规格'),/已审核且启用的款式/)
 assert.deepEqual(catalog.getPcsChannelCatalogSnapshot(),before)
 assert.ok(catalog.getChannelListing(listing.id));assert.ok(renderPcsChannelProductDetailPage(listing.id).includes('渠道内容'))
 const content=catalog.saveChannelContent(listing.id,{...listing.content,title:'父款停用后的既有渠道标题'},listing.version)
 assert.equal(content.content.title,'父款停用后的既有渠道标题')
 assert.equal(catalog.saveChannelVariant({...variants[0],displaySize:'原映射的新展示尺码'},variants[0].version).displaySize,'原映射的新展示尺码')
 catalog.saveChannelPrice({storeId:listing.storeId,internalSkuId:sku.skuId,externalVariantId:variants[0].id,priceType:'regular',amount:123,validFrom:'',validTo:''})
 assert.equal(catalog.resolveChannelPrice(variants[0]).amount,123)
})
test('CHAN-004 parent and SKU qualification both apply to candidates and save; existing selection remains visible',async()=>{
 const style=getStyleArchiveById(L.styleId)!,sku=getSkuArchiveById(V[0].internalSkuId)!
 for(const approvalStatus of ['DRAFT','PENDING'] as const){
  updateStyleArchive(style.styleId,{approvalStatus,lifecycleStatus:'NOT_ENABLED',archiveStatus:'DRAFT'})
  assert.equal(catalog.isChannelSkuSelectable(sku),false)
  assert.throws(()=>catalog.createChannelListing({storeId:L.storeId,styleId:style.styleId,internalSkuIds:[sku.skuId]}),/已审核且启用的款式/)
 }
 updateStyleArchive(style.styleId,{approvalStatus:'APPROVED',lifecycleStatus:'ACTIVE',archiveStatus:'ACTIVE'})
 assert.equal(catalog.isChannelSkuSelectable(sku),true)
 assert.equal(catalog.isChannelSkuSelectable({...sku,approvalStatus:'PENDING'}),false)
 assert.equal(catalog.isChannelSkuSelectable({...sku,lifecycleStatus:'INACTIVE'}),false)
 updateStyleArchive(style.styleId,{lifecycleStatus:'INACTIVE',archiveStatus:'INACTIVE'})
 discardPcsChannelChanges()
 const fresh=renderPcsChannelProductEditPage()
 assert.ok(!fresh.includes(`<option value="${style.styleId}"`),'停用款式不进入新建候选')
 discardPcsChannelChanges();renderPcsChannelProductEditPage(L.id)
 const tab={dataset:{pcsChannelProductListAction:'edit-tab',tab:'mapping'},closest(){return this}} as unknown as HTMLElement
 await handlePcsChannelProductListEvent(tab)
 const edit=renderPcsChannelProductEditPage(L.id)
 assert.match(edit,/data-pcs-channel-product-list-action="add-variant"[^>]*disabled/)
 assert.ok(edit.includes(`<option value="${sku.skuId}" selected>`),'原有映射仍可识别并维护显示信息')
 discardPcsChannelChanges()
})
test('CHAN-006/007/008 store content, display names and technical source do not rewrite internal identities',()=>{
 const old=getSkuArchiveById(V[0].internalSkuId)!,style=getStyleArchiveById(L.styleId)!,other=baseline.listings[1].content.title
 catalog.saveChannelContent(L.id,{...L.content,title:'本店标题',sizeChartSourceVersion:L.content.sizeChartSourceVersion},L.version)
 catalog.saveChannelVariant({...V[0],displaySize:'Platform M Alias'},V[0].version)
 assert.equal(getSkuArchiveById(old.skuId)!.sizeName,old.sizeName);assert.equal(getStyleArchiveById(L.styleId)!.styleName,style.styleName);assert.equal(catalog.getChannelListing(baseline.listings[1].id)!.content.title,other)
 assert.equal(catalog.getChannelListing(L.id)!.content.sizeChartSourceVersion,L.content.sizeChartSourceVersion)
})
test('CHAN-006 unpublished untouched fields follow base sales; published stays explicit',()=>{
 const l=make(),before=catalog.getChannelListing(L.id)!.content.title,style=getStyleArchiveById(l.styleId)!
 updateStyleArchive(l.styleId,{salesContents:[{language:'id',title:'新版基础销售标题',description:'新描述',sellingPoints:'新卖点',imageUrls:[style.mainImageUrl],videoUrls:[],sizeChartUrl:'',version:2}],updatedAt:'2099-10-05T00:00:00Z'})
 assert.equal(catalog.getChannelListing(l.id)!.content.title,'新版基础销售标题');assert.equal(catalog.getPcsChannelCatalogSnapshot().listings.find(x=>x.id===l.id)!.content.title,'新版基础销售标题')
 assert.equal(catalog.getChannelListing(L.id)!.content.title,before)
})
test('CONTENT-005 incomplete description drafts save but review and cached-approved publication are blocked',()=>{
 const listing=make(),draft=catalog.saveChannelContent(listing.id,{...listing.content,description:'   '},listing.version)
 assert.equal(draft.content.description,'   ')
 assert.throws(()=>catalog.reviewChannelListing(draft.id,'提交审核'),/商品描述/)
 const cached=catalog.getPcsChannelCatalogSnapshot(),subject=cached.listings.find(l=>l.id===draft.id)!
 subject.reviewStatus='审核通过';subject.approvedVersion=subject.contentVersion
 catalog.writePcsChannelCatalogSnapshot(cached)
 const before=catalog.getPcsChannelCatalogSnapshot()
 for(const action of ['发布','更新','重新同步'] as const)assert.throws(()=>sync.submitChannelSync(draft.id,action),/商品描述/)
 assert.deepEqual(catalog.getPcsChannelCatalogSnapshot(),before,'发布入口应在生成操作记录前拒绝空描述')
 const repaired=catalog.saveChannelContent(draft.id,{...subject.content,description:'<p>适合日常穿着的柔软面料。</p>'},subject.version)
 approve(repaired.id)
 assert.equal(sync.submitChannelSync(repaired.id,'发布').result,'提交中')
})
test('CONTENT-011 base sales references retain exact language and version; published references advance only by explicit application',()=>{
 const sku=eligible[0],style=getStyleArchiveById(sku.styleId)!
 const sales=(language:'id'|'ms',version:number,title:string)=>({language,version,title,description:`${language} 销售说明`,sellingPoints:'柔软透气',imageUrls:[style.mainImageUrl],videoUrls:[],sizeChartUrl:''})
 updateStyleArchive(style.styleId,{salesContents:[sales('id',2,'印尼语标题'),sales('ms',3,'马来语标题')]})
 const first=catalog.createChannelListing({storeId:'ST-006',styleId:style.styleId,internalSkuIds:[sku.skuId],initialPrice:99})
 assert.equal(first.content.languageCode,'ms');assert.equal(first.content.title,'马来语标题');assert.equal(first.baseContentReference?.language,'ms');assert.equal(first.baseContentReference?.version,3)
 const published=publish(first.id),draft=catalog.createChannelListing({storeId:'ST-006',styleId:style.styleId,internalSkuIds:[sku.skuId],initialPrice:99})
 const snapshot=getStyleArchiveStoreSnapshot(),record=snapshot.records.find(value=>value.styleId===style.styleId)!,unchangedTime=record.updatedAt
 record.salesContents=[sales('id',2,'印尼语标题'),sales('ms',4,'马来语第四版')];replaceStyleArchiveStore(snapshot)
 assert.equal(getStyleArchiveById(style.styleId)!.updatedAt,unchangedTime,'版本更新场景不依赖档案更新时间变动')
 assert.equal(catalog.getChannelListing(draft.id)!.content.title,'马来语第四版');assert.equal(catalog.getChannelListing(draft.id)!.baseContentReference?.version,4)
 assert.deepEqual(catalog.getChannelListing(published.id)!.baseContentReference,published.baseContentReference);assert.equal(catalog.getChannelListing(published.id)!.content.title,'马来语标题')
 const overridden=catalog.saveChannelContent(published.id,{...published.content,title:'本店标题'},published.version)
 assert.deepEqual(overridden.baseContentReference,published.baseContentReference,'店铺覆盖不冒充已经引用了新的基础版本')
 const applied=catalog.applyStyleContent(published.id)
 assert.equal(applied.content.title,'马来语第四版');assert.equal(applied.baseContentReference?.id,`${style.styleId}:sales:ms:v4`);assert.equal(applied.contentOverrides.includes('title'),false)
 const html=renderPcsChannelProductDetailPage(applied.id);assert.ok(html.includes('销售内容 · ms · 第 4 版'));assert.ok(html.includes(applied.baseContentReference!.id))
})
test('LIST-006/007/008 configured store mappings initialize content and current template requirements gate review and actual publish',()=>{
 const style=getStyleArchiveById(eligible[0].styleId)!,current=stores.getChannelStore('ST-001')!,template=getChannelPlatformTemplate(current)
 template.requiredFields=['platformCategoryId','platformBrandId'];template.requiredAttributes=['BrandLabel','weight'];template.categoryMappings[style.productCategoryId||style.subCategoryId||style.categoryId]='external-category-22';template.brandMappings[style.brandId]='external-brand-31';template.attributeMappings={BrandLabel:'brandName'};template.defaultAttributes={weight:'0.2'};template.attributeUnits={weight:'kg'}
 const store=stores.saveChannelStore({...current,platformTemplate:template},current.version)
 assert.equal(store.platformTemplate!.version,2)
 const listing=make(),c=listing.content
 assert.equal(c.platformCategoryId,'external-category-22');assert.equal(c.platformBrandId,'external-brand-31');assert.equal(c.platformAttributes.BrandLabel,style.brandName);assert.equal(c.platformAttributes.weight,'0.2');assert.equal(c.platformAttributeUnits!.weight,'kg');assert.equal(c.platformAttributeSchemaVersion,channelPlatformTemplateVersion(store))
 const draft=catalog.saveChannelContent(listing.id,{...c,platformCategoryId:'',platformBrandId:'',platformAttributes:{weight:'0.2'}},listing.version)
 assert.throws(()=>catalog.reviewChannelListing(draft.id,'提交审核'),/平台类目.*平台品牌.*BrandLabel/)
 const snapshot=catalog.getPcsChannelCatalogSnapshot(),cached=snapshot.listings.find(value=>value.id===draft.id)!;cached.reviewStatus='审核通过';cached.approvedVersion=cached.contentVersion;catalog.writePcsChannelCatalogSnapshot(snapshot)
 const before=catalog.getPcsChannelCatalogSnapshot();assert.throws(()=>sync.submitChannelSync(draft.id,'发布'),/当前店铺模板要求/);assert.deepEqual(catalog.getPcsChannelCatalogSnapshot(),before)
 const repaired=catalog.saveChannelContent(draft.id,c,draft.version);approve(repaired.id)
 const changed=getChannelPlatformTemplate(store);changed.requiredAttributes.push('Care');stores.saveChannelStore({...store,platformTemplate:changed},store.version)
 assert.throws(()=>sync.submitChannelSync(draft.id,'发布'),/Care/,'实际发布重新校验后来变更的模板，不能凭缓存审核绕过')
 const latest=catalog.getChannelListing(draft.id)!,prepared={...latest.content,platformAttributes:{...latest.content.platformAttributes,Care:'手洗'}}
 const filled=catalog.saveChannelContent(draft.id,prepared,latest.version);assert.throws(()=>catalog.reviewChannelListing(draft.id,'提交审核'),/模板已更新/)
 const final=catalog.saveChannelContent(draft.id,{...filled.content,platformAttributeSchemaVersion:channelPlatformTemplateVersion(stores.getChannelStore(store.id)!)},filled.version);approve(final.id)
 assert.equal(sync.submitChannelSync(final.id,'发布').result,'提交中');assert.equal(getStyleArchiveById(style.styleId)!.brandId,style.brandId)
 assert.equal(stores.getPcsChannelStoreSnapshot().logs.filter(log=>log.action==='调整平台字段模板').length,2)
})
test('CONTENT-008/EXT-004/006/007/009/010 template media and per-instance requirements gate review and cached-approved publish',()=>{
 const current=stores.getChannelStore('ST-001')!,template=getChannelPlatformTemplate(current)
 template.requiredMediaRoles=['主图','尺码图'];template.requiredVariantFields=['sellerSku','displayColor','displaySize','displayPattern','imageId'];template.requiredVariantAttributes=['Composition']
 stores.saveChannelStore({...current,platformTemplate:template},current.version)
 const listing=make(),initialVariants=catalog.listChannelVariants(listing.id),draft=catalog.saveChannelContent(listing.id,{...listing.content,media:[]},listing.version)
 assert.throws(()=>catalog.reviewChannelListing(draft.id,'提交审核'),/主图.*尺码图/)
 const original=initialVariants[0]
 catalog.saveChannelVariant({...original,sellerSku:'',displayColor:'',displaySize:'',displayPattern:'',imageId:'',imageUrl:'',platformAttributeValues:{}},original.version)
 let row=catalog.getChannelListing(draft.id)!
 const content={...row.content,media:[...listing.content.media,{id:'sales-size-chart',url:original.imageUrl,name:'原型尺码图',role:'尺码图' as const,sort:99}]}
 catalog.saveChannelContent(row.id,content,row.version)
 assert.throws(()=>catalog.reviewChannelListing(row.id,'提交审核'),/商家 SKU.*平台颜色.*平台尺码.*平台花型.*规格图片.*Composition/)
 for(const variant of catalog.listChannelVariants(row.id))catalog.saveChannelVariant({...variant,sellerSku:original.sellerSku,displayColor:'黑色',displaySize:'S',displayPattern:'素色',imageId:original.imageId,imageUrl:original.imageUrl,platformAttributeValues:{Composition:'Cotton'}},variant.version)
 approve(row.id)
 const beforePublish=catalog.listChannelVariants(row.id)[0]
 catalog.saveChannelVariant({...beforePublish,platformAttributeValues:{}},beforePublish.version)
 assert.throws(()=>sync.submitChannelSync(row.id,'发布'),/Composition/,'实际发布也校验每一个规格，不能依赖早先的内容审核')
 const repaired=catalog.listChannelVariants(row.id).find(variant=>variant.id===beforePublish.id)!;catalog.saveChannelVariant({...repaired,platformAttributeValues:{Composition:'Cotton'}},repaired.version)
 assert.equal(sync.submitChannelSync(row.id,'发布').result,'提交中')
 const options=getChannelPlatformTemplate(stores.getChannelStore(current.id)!);assert.deepEqual(options.requiredMediaRoles,['主图','尺码图']);assert.deepEqual(options.requiredVariantAttributes,['Composition'])
})
test('CONTENT-010 detail labels each inherited field, store override and published snapshot separately',()=>{
 const draft=make()
 assert.equal(catalog.channelContentFieldOrigin(draft,'title'),'继承款式基础内容')
 assert.equal(catalog.channelContentFieldOrigin(draft,'handle'),'店铺维护')
 const changed=catalog.saveChannelContent(draft.id,{...draft.content,title:'本店独立销售标题'},draft.version)
 assert.equal(catalog.channelContentFieldOrigin(changed,'title'),'店铺覆盖')
 assert.equal(catalog.channelContentFieldOrigin(changed,'description'),'继承款式基础内容')
 const html=renderPcsChannelProductDetailPage(changed.id)
 assert.match(html,/data-channel-content-origin="title">店铺覆盖/)
 assert.match(html,/data-channel-content-origin="description">继承款式基础内容/)
 const published=publish(changed.id)
 assert.equal(catalog.channelContentFieldOrigin(published,'description'),'发布时基础内容快照')
 assert.equal(catalog.channelContentFieldOrigin(published,'title'),'店铺覆盖')
})
test('CHAN-009/010/011 five price types, defaults affect followers only and platform price overrides one instance',()=>{
 const v=V[0],other=V[2],base=sync.readChannelSyncField(catalog.getPcsChannelCatalogSnapshot(),L,v.id,'price.regular')
 sync.receiveChannelPlatformChange({eventId:'platform-price-1',listingId:L.id,at:'2026-10-05T03:00:00Z',changes:[{targetId:v.id,field:'price.regular',baseValue:base,value:173000}]})
 catalog.saveChannelPrice({storeId:L.storeId,internalSkuId:v.internalSkuId,externalVariantId:'',priceType:'regular',amount:180000,validFrom:'',validTo:''})
 assert.equal(catalog.resolveChannelPrice(v).amount,173000);assert.equal(catalog.resolveChannelPrice(other).amount,180000)
 for(const type of ['retail','live','wholesale'] as const){catalog.saveChannelPrice({storeId:L.storeId,internalSkuId:v.internalSkuId,externalVariantId:v.id,priceType:type,amount:0,validFrom:'',validTo:''});assert.equal(catalog.resolveChannelPrice(v,type).amount,0)}
 assert.equal(catalog.resolveChannelPrice(v,'clearance').amount,null);assert.throws(()=>catalog.saveChannelPrice({storeId:L.storeId,internalSkuId:v.internalSkuId,externalVariantId:v.id,priceType:'regular',amount:0,validFrom:'',validTo:''}),/大于 0/)
})
test('CHAN-017 clearance uses store time zone and expires into daily price',()=>{
 catalog.saveChannelPrice({storeId:L.storeId,internalSkuId:V[0].internalSkuId,externalVariantId:V[0].id,priceType:'clearance',amount:90000,validFrom:'2026-10-05T08:00',validTo:'2026-10-06T08:00'})
 const p=catalog.resolveChannelPrice(V[0],'clearance','2026-10-05T02:00:00.000Z');assert.equal(p.amount,90000);assert.equal(p.price?.validFrom,'2026-10-05T01:00:00.000Z')
 assert.equal(catalog.resolveChannelPrice(V[0],'clearance','2026-10-07T00:00:00.000Z').amount,catalog.resolveChannelPrice(V[0]).amount)
 const indexed=catalog.createChannelPriceResolver()
 for(const at of ['2026-10-05T02:00:00.000Z','2026-10-07T00:00:00.000Z'])for(const type of ['retail','regular','live','wholesale','clearance'] as const)assert.deepEqual(indexed(V[0],type,at),catalog.resolveChannelPrice(V[0],type,at))
 const detached=indexed(V[0],'clearance','2026-10-05T02:00:00.000Z');detached.price!.amount=1;assert.equal(indexed(V[0],'clearance','2026-10-05T02:00:00.000Z').amount,90000)
 assert.throws(()=>catalog.saveChannelPrice({storeId:L.storeId,internalSkuId:V[0].internalSkuId,externalVariantId:V[0].id,priceType:'clearance',amount:90000,validFrom:'2026-10-06T08:00',validTo:'2026-10-05T08:00'}),/结束时间/)
})
test('CHAN-012 historic imports preserve string IDs and reject incomplete mapping without partial formal records',()=>{
 const code=getSkuArchiveById(V[0].internalSkuId)!.skuCode,style=getStyleArchiveById(L.styleId)!,rows=[{storeId:'ST-003',styleCode:style.styleCode,internalSkuCode:code,platformProductId:'999999999999999999991',platformVariantId:'999999999999999999992',sellerSku:'seller-original',title:'历史完整映射',price:29}]
 const bad=[...rows,{...rows[0],internalSkuCode:'missing',platformVariantId:'wrong'}],before=catalog.getPcsChannelCatalogSnapshot().listings.length
 assert.equal(catalog.previewChannelImport(bad).errors.length,1);assert.throws(()=>catalog.importChannelRows(bad),/未导入/);assert.equal(catalog.getPcsChannelCatalogSnapshot().listings.length,before)
 const [id]=catalog.importChannelRows(rows);assert.equal(catalog.getChannelListing(id)!.platformProductId,rows[0].platformProductId);assert.equal(catalog.listChannelVariants(id)[0].platformVariantId,rows[0].platformVariantId)
})
test('CHAN-014/015/016 mapping correction versions preserve old fulfillment snapshots',async()=>{
 const before=catalog.listChannelAffectedOrders(V[0].id)[0],sameStyle=V[1].internalSkuId
 assert.throws(()=>catalog.saveChannelVariant({...V[0],internalSkuId:sameStyle},V[0].version),/原因/)
 const v=catalog.saveChannelVariant({...V[0],internalSkuId:sameStyle},V[0].version,'当前用户','同款颜色映射更正')
 assert.equal(v.mappingVersion,2);assert.equal(v.mappingHistory.length,2);assert.deepEqual(catalog.listChannelAffectedOrders(v.id)[0],before)
 const history=catalog.channelMappingHistoryRows(v)
 assert.equal(history[1].previousInternalSkuId,V[0].internalSkuId);assert.equal(history[1].internalSkuId,sameStyle)
 assert.equal(history[1].actor,'当前用户');assert.equal(history[1].reason,'同款颜色映射更正');assert.equal(history[1].effectiveAt,v.mappingEffectiveAt)
 renderPcsChannelProductDetailPage(L.id)
 const node={dataset:{pcsChannelProductListAction:'tab',tab:'mapping'},closest(){return this}} as unknown as HTMLElement
 await handlePcsChannelProductListEvent(node)
 const html=renderPcsChannelProductDetailPage(L.id)
 assert.match(html,/<details[^>]+data-channel-mapping-history/);assert.ok(html.includes(`${getSkuArchiveById(V[0].internalSkuId)!.skuCode} → ${getSkuArchiveById(sameStyle)!.skuCode}`))
 assert.ok(html.includes('同款颜色映射更正'));assert.ok(html.includes('当前用户'))
 assert.equal('projectId' in catalog.getChannelListing(L.id)!,false);assert.equal('stockQty' in v,false)
})
test('CHAN-014 legacy channel projection has no project identity or inventory, historical relations read canonical PID cardinality',()=>{
 const listing=make(), projection=getProjectChannelProductById(listing.id)!
 for(const field of ['projectId','projectCode','projectName','projectNodeId'])assert.equal(field in projection,false)
 assert.ok(projection.specLines.every(line=>!('stockQty' in line)))
 const saved=getProjectRelationStoreSnapshot(),source=listProjectRelations().find(relation=>getProjectInstanceModel(relation.projectId))!
 assert.ok(source)
 try{
  const relation=upsertProjectRelation({...source,projectRelationId:'channel-r1-read-reference',sourceObjectType:'渠道店铺商品',sourceObjectId:listing.id,sourceObjectCode:listing.id,sourceTitle:'旧标题',sourceStatus:'旧状态'})
  const model=getProjectInstanceModel(relation.projectId)!,instance=model.instances.find(item=>item.sourceObjectId===listing.id)!
  assert.equal(instance.title,listing.content.title);assert.equal(instance.status,'未发布');assert.equal(instance.targetRoute,`/pcs/products/channel-products/${listing.id}`)
  assert.equal(instance.fields.find(field=>field.fieldKey==='variantCounts')?.value,'2 / 1')
  assert.equal(instance.fields.find(field=>field.fieldKey==='internalSkuCodes')?.value,getSkuArchiveById(catalog.listChannelVariants(listing.id)[0].internalSkuId)!.skuCode)
  assert.equal('projectId' in catalog.getChannelListing(listing.id)!,false)
 }finally{replaceProjectRelationStore(saved)}
})
test('CHAN-019 copy has independent internal container and clears external identity/results',()=>{
 const copied=catalog.copyChannelListing(L.id,'ST-007'),rows=catalog.listChannelVariants(copied.id)
 assert.equal(copied.platformProductId,'');assert.equal(copied.platformStatus,'未发布');assert.equal(copied.reviewStatus,'草稿');assert.equal(copied.lastSuccessAt,'');assert.equal(rows.length,V.length);assert.ok(rows.every(v=>!v.platformVariantId));assert.deepEqual(rows.map(v=>v.internalSkuId),V.map(v=>v.internalSkuId))
})
test('SYNC-001/002 normal two-way changes synchronize immediately without asking to adopt',()=>{
 const before=catalog.getPcsChannelCatalogSnapshot();catalog.saveChannelPrice({storeId:L.storeId,internalSkuId:V[0].internalSkuId,externalVariantId:V[0].id,priceType:'regular',amount:158000,validFrom:'',validTo:''})
 const ops=synchronizePublishedChannelChanges(before);assert.equal(ops.length,1);assert.equal(ops[0].result,'成功');assert.equal(catalog.getChannelListing(L.id)!.syncStatus,'一致')
 const l=catalog.getChannelListing(L.id)!,op=sync.receiveChannelPlatformChange({eventId:'platform-title',listingId:l.id,at:'2026-10-05T04:00:00Z',changes:[{targetId:l.id,field:'title',baseValue:l.content.title,value:'平台新标题'}]})
 assert.equal(op.result,'成功');assert.equal(catalog.getChannelListing(l.id)!.content.title,'平台新标题');assert.equal(catalog.getChannelListing(l.id)!.syncStatus,'一致')
})
test('SYNC-003 concurrent same field requires resolution; different fields merge',()=>{
 catalog.saveChannelContent(L.id,{...L.content,title:'PCS 标题'},L.version)
 const op=sync.receiveChannelPlatformChange({eventId:'conflict-title',listingId:L.id,at:'2026-10-05T04:00:00Z',changes:[{targetId:L.id,field:'title',baseValue:L.content.title,value:'平台标题'},{targetId:L.id,field:'description',baseValue:L.content.description,value:'平台描述'}]})
 assert.equal(op.conflicts.length,1);assert.equal(op.result,'同时变更待处理');assert.equal(catalog.getChannelListing(L.id)!.content.description,'平台描述');assert.equal(catalog.getChannelListing(L.id)!.content.title,'PCS 标题')
 sync.resolveChannelSyncConflict(op.id,L.id,'title','平台');assert.equal(catalog.getChannelListing(L.id)!.content.title,'平台标题');assert.equal(catalog.getChannelListing(L.id)!.syncStatus,'一致')
})
test('SYNC-004/005 late receipt cannot overwrite new content, own event cannot loop',()=>{
 const op=sync.submitChannelSync(L.id,'更新'),receipt=sync.demoChannelReceipt(op.id)
 catalog.saveChannelContent(L.id,{...L.content,title:'更新的 PCS 版本'},L.version)
 assert.equal(sync.receiveChannelReceipt(receipt).result,'已过期');assert.equal(catalog.getChannelListing(L.id)!.content.title,'更新的 PCS 版本')
 const count=catalog.getPcsChannelCatalogSnapshot().syncOperations.length
 sync.receiveChannelPlatformChange({eventId:'echo-1',sourceOperationId:op.id,listingId:L.id,at:'2026-10-05T04:00:00Z',changes:[{targetId:L.id,field:'title',baseValue:L.content.title,value:'不应覆盖'}]})
 assert.equal(catalog.getPcsChannelCatalogSnapshot().syncOperations.length,count);assert.equal(catalog.getChannelListing(L.id)!.content.title,'更新的 PCS 版本')
})
test('SYNC-002/004 platform status-only observations are current facts and older status cannot overwrite them',()=>{
 const latest=sync.receiveChannelPlatformChange({eventId:'status-offline',listingId:L.id,at:'2099-10-05T04:00:00Z',changes:[],platformStatus:'已下架',rawStatus:'DEMO_OFFLINE'})
 assert.equal(latest.result,'成功');assert.equal(catalog.getChannelListing(L.id)!.platformStatus,'已下架')
 const late=sync.receiveChannelPlatformChange({eventId:'status-old',listingId:L.id,at:'2099-10-04T04:00:00Z',changes:[],platformStatus:'在售',rawStatus:'DEMO_ACTIVE'})
 assert.equal(late.result,'已过期');assert.equal(catalog.getChannelListing(L.id)!.platformStatus,'已下架')
})
test('SYNC-006 partial failures retry exactly failed items, preserve successful external IDs',()=>{
 const l=make();approve(l.id);const op=sync.submitChannelSync(l.id,'发布');const partial=sync.receiveChannelReceipt(sync.demoChannelReceipt(op.id,'partial'))
 assert.equal(partial.result,'部分成功');const originalIds=catalog.listChannelVariants(l.id).map(v=>v.platformVariantId),retry=sync.retryChannelFailedItems(op.id)
 assert.equal(retry.items.length,partial.items.filter(i=>i.result==='失败').length);assert.equal(retry.items.length,1);sync.receiveChannelReceipt(sync.demoChannelReceipt(retry.id))
 assert.deepEqual(catalog.listChannelVariants(l.id).map(v=>v.platformVariantId),originalIds);assert.equal(catalog.getChannelListing(l.id)!.syncStatus,'一致')
})
test('SYNC-011 immutable per-receipt external identity and raw status survive partial retry and later changes',()=>{
 const listing=make();approve(listing.id)
 const operation=sync.submitChannelSync(listing.id,'发布'),receipt=sync.demoChannelReceipt(operation.id,'partial')
 receipt.rawStatus='DEMO_PARTIAL_ORIGINAL'
 const received=sync.receiveChannelReceipt(receipt),original=JSON.parse(JSON.stringify(received.receiptSnapshots![0])) as NonNullable<typeof received.receiptSnapshots>[number]
 assert.equal(original.platformProductId,receipt.platformProductId);assert.equal(original.rawStatus,'DEMO_PARTIAL_ORIGINAL')
 assert.deepEqual(original.items,JSON.parse(JSON.stringify(receipt.items)));assert.ok(received.items.some(item=>item.platformVariantId))
 receipt.items[0].error='改变调用方对象不能改历史回执'
 const retry=sync.retryChannelFailedItems(operation.id);sync.receiveChannelReceipt(sync.demoChannelReceipt(retry.id))
 sync.receiveChannelPlatformChange({eventId:'later-offline-snapshot',listingId:listing.id,at:'2099-10-05T00:00:00Z',changes:[],platformStatus:'已下架',rawStatus:'LATER_OFFLINE'})
 const saved=catalog.getPcsChannelCatalogSnapshot().syncOperations.find(op=>op.id===operation.id)!
 assert.deepEqual(saved.receiptSnapshots![0],original);assert.equal(saved.result,'成功')
 assert.equal(original.items.filter(item=>!item.success).length,1,'原始失败事实不会被重试成功覆写')
 const html=renderChannelSyncPanel(listing.id);assert.ok(html.includes('DEMO_PARTIAL_ORIGINAL'));assert.ok(html.includes('LATER_OFFLINE'));assert.ok(html.includes('当次平台规格 ID'))
})
test('SYNC-007 first publish unknown reuses same operation and duplicate submission does not mint two PIDs',()=>{
 const l=make();approve(l.id);const op=sync.submitChannelSync(l.id,'发布');assert.equal(sync.submitChannelSync(l.id,'发布').id,op.id)
 sync.receiveChannelReceipt(sync.demoChannelReceipt(op.id,'unknown'));assert.equal(catalog.getChannelListing(l.id)!.platformProductId,'');assert.throws(()=>sync.submitChannelSync(l.id,'发布'),/待核实/)
 sync.verifyUnknownChannelOperation(op.id);assert.ok(catalog.getChannelListing(l.id)!.platformProductId.startsWith('demo-'));assert.equal(catalog.getPcsChannelCatalogSnapshot().syncOperations.filter(o=>o.listingId===l.id).length,1)
})
test('SYNC-008 unsupported fields remain explicit, never success',()=>{
 const op=sync.submitChannelSync(L.id,'更新',{fields:[{targetId:V[0].id,field:'price.clearance'}]});assert.equal(op.items[0].result,'不支持');assert.equal(op.result,'失败');assert.throws(()=>sync.retryChannelFailedItems(op.id),/不支持/)
})
test('SYNC-009/010 same internal availability is shared observations, not multiplied or written to inventory',()=>{
 const l=make(),sku=catalog.listChannelVariants(l.id)[0].internalSkuId;catalog.addChannelVariant(l.id,sku);publish(l.id)
 const ops=sync.recordSharedChannelAvailability({sourceRef:'WMS-demonstration-only',sourceVersion:'v1',rows:[{internalSkuId:sku,available:100,unit:'件'}],listingIds:[l.id]})
 assert.deepEqual(ops[0].observedAvailability!.map(v=>v.quantity),[100,100,100]);assert.equal('stockQty' in catalog.getChannelListing(l.id)!,false)
 const receipt=ops[0].receiptSnapshots![0];assert.equal(receipt.platformProductId,catalog.getChannelListing(l.id)!.platformProductId);assert.equal(receipt.rawStatus,catalog.getChannelListing(l.id)!.platformRawStatus);assert.deepEqual(receipt.items.map(item=>item.platformVariantId),catalog.listChannelVariants(l.id).map(variant=>variant.platformVariantId));assert.deepEqual(receipt.items.map(item=>item.value),[...Array(3)].map(()=>({quantity:100,unit:'件',source:'WMS-demonstration-only@v1'})))
 const before=catalog.getPcsChannelCatalogSnapshot(),v=catalog.listChannelVariants(l.id)[0]
 const op=sync.receiveChannelPlatformChange({eventId:'attempt-stock',listingId:l.id,at:'2026-10-05T00:00:00Z',changes:[{targetId:v.id,field:'inventory',baseValue:null,value:300}]})
 assert.equal(op.items[0].result,'不支持');assert.equal('inventory' in catalog.listChannelVariants(l.id)[0],false);assert.equal(before.variants.length,catalog.getPcsChannelCatalogSnapshot().variants.length)
})
test('CHAN-013/SYNC-011 test order selection uses canonical listing and precise action; passing production stays independent',()=>{
 const order=listTestingOrders().find(o=>o.status==='进行中'&&listSkuArchives().filter(s=>s.styleId===o.styleId&&o.skuCodes.includes(s.skuCode)).every(catalog.isChannelSkuSelectable))!
 assert.ok(order);const passed=hasPassedTestingOrder(order.styleId);updateTestingOrder(order.testingOrderId,{currentStepKey:'channel-listing'})
 const result=prepareTestingOrderChannelListing(order.testingOrderId,{storeId:'ST-001',actionId:'test-action-1',shipMethod:'人头'})
 assert.equal(catalog.getChannelListing(result.listingId)!.platformProductId,'');assert.equal(getTestingOrderById(order.testingOrderId)!.currentStepKey,'channel-listing');assert.equal(completeTestingOrderChannelListing(order.testingOrderId).ok,false)
 for(const variant of catalog.listChannelVariants(result.listingId))catalog.saveChannelPrice({storeId:'ST-001',internalSkuId:variant.internalSkuId,externalVariantId:'',priceType:'regular',amount:149000,validFrom:'',validTo:''})
 publish(result.listingId);assert.equal(sync.getTestingChannelListingResults(order.testingOrderId,'test-action-1')[0].listingId,result.listingId);assert.equal(sync.getTestingChannelListingResults(order.testingOrderId,'another-action').length,0);assert.equal(hasPassedTestingOrder(order.styleId),passed)
 const bound=prepareTestingOrderChannelListing(order.testingOrderId,{storeId:'ST-001',existingListingId:result.listingId,actionId:'test-action-2',shipMethod:'空运'})
 assert.equal(bound.listingId,result.listingId);assert.equal(sync.getTestingChannelListingResults(order.testingOrderId,'test-action-2')[0].testingListingActionId,'test-action-2')
})

test('SYNC-002/003 platform merge never approves a different pending PCS field; conflict choice sends only its field',()=>{
 catalog.saveChannelContent(L.id,{...L.content,title:'本地标题草稿',description:'本地描述草稿'},L.version)
 const incoming=sync.receiveChannelPlatformChange({eventId:'mixed-draft',listingId:L.id,at:'2026-10-05T04:00:00Z',changes:[{targetId:L.id,field:'title',baseValue:L.content.title,value:'平台另一个标题'},{targetId:L.id,field:'sellingPoints',baseValue:L.content.sellingPoints,value:'平台正常卖点'}]})
 assert.equal(catalog.getChannelListing(L.id)!.reviewStatus,'草稿');assert.equal(catalog.getChannelListing(L.id)!.approvedVersion,null)
 sync.resolveChannelSyncConflict(incoming.id,L.id,'title','PCS')
 const after=catalog.getPcsChannelCatalogSnapshot(),latest=after.syncOperations.at(-1)!
 assert.equal(latest.result,'成功');assert.deepEqual(latest.fieldScope,['title']);assert.equal(catalog.getChannelListing(L.id)!.reviewStatus,'草稿');assert.equal(catalog.getChannelListing(L.id)!.content.description,'本地描述草稿')
 assert.equal(catalog.getChannelListing(L.id)!.publishedContent!.description,L.content.description)
})
test('SYNC-001 clearing an optional supported price publishes null instead of retaining a stale platform amount',()=>{
 const l=baseline.listings.find(l=>l.storeId==='ST-008')!,v=catalog.listChannelVariants(l.id)[0],before=catalog.getPcsChannelCatalogSnapshot()
 catalog.saveChannelPrice({storeId:l.storeId,internalSkuId:v.internalSkuId,externalVariantId:v.id,priceType:'retail',amount:null,validFrom:'',validTo:''})
 const operations=synchronizePublishedChannelChanges(before);assert.ok(operations.some(o=>o.items.some(i=>i.targetId===v.id&&i.field==='price.retail'&&i.submittedValue===null)))
 assert.equal(catalog.getPcsChannelCatalogSnapshot().fieldBaselines.find(b=>b.targetId===v.id&&b.field==='price.retail')!.value,null)
})
test('reading canonical listings, variants and store views creates no business writes',()=>{
 const original=pcsRecordStore.setItem;let writes=0
 pcsRecordStore.setItem=(key,value)=>{writes++;return original.call(pcsRecordStore,key,value)}
 try{catalog.resetPcsChannelCatalogCache();stores.resetPcsChannelStoreCache();catalog.listChannelListings(true);catalog.listChannelVariants(L.id);stores.listChannelStores(true);assert.equal(writes,0)}finally{pcsRecordStore.setItem=original}
})

test('legacy conversion is pure, preserves many external IDs per same SKU and rejects unmatched lines',()=>{
 const sku=getSkuArchiveById(V[0].internalSkuId)!,style=getStyleArchiveById(L.styleId)!,source={records:[{channelProductId:'old-one',styleId:style.styleId,storeId:'store-tiktok-01',channelCode:'tiktok',listingTitle:'旧标题',upstreamProductId:'original-long-pid',specLines:[{specLineId:'a',sellerSku:sku.skuCode,upstreamSkuId:'original-a',priceAmount:11},{specLineId:'b',sellerSku:sku.skuCode,upstreamSkuId:'original-b',priceAmount:12}]}]},json=JSON.stringify(source)
 const converted=convertLegacyChannelSnapshot(source,storeBaseline,baseline,listSkuArchives(),listStyleArchives()),newRows=converted.catalogSnapshot.variants.filter(v=>v.listingId==='old-one')
 assert.equal(JSON.stringify(source),json);assert.equal(converted.counts.variants,2);assert.equal(newRows.length,2);assert.equal(newRows[0].internalSkuId,newRows[1].internalSkuId);assert.notEqual(newRows[0].platformVariantId,newRows[1].platformVariantId)
 assert.equal(convertLegacyChannelSnapshot(source,converted.storeSnapshot,converted.catalogSnapshot,listSkuArchives(),listStyleArchives()).counts.listings,0)
 assert.throws(()=>convertLegacyChannelSnapshot({records:[{...source.records[0],channelProductId:'bad',specLines:[{sellerSku:'not-found'}]}]},storeBaseline,baseline,listSkuArchives(),listStyleArchives()),/未匹配/)
})
test('page structure has independent list/detail/edit and explicit demo sync, no inventory editor or browser maintenance',()=>{
 const list=renderPcsChannelProductListPage(),detail=renderPcsChannelProductDetailPage(L.id),edit=renderPcsChannelProductEditPage(L.id),work=renderChannelSyncPanel(L.id)
 assert.ok(list.includes('渠道店铺商品'));assert.ok(!list.includes('data-pcs-channel-product-list-field="content.title"'));for(const text of ['渠道内容','规格映射','价格','发布与同步','测款关联','记录'])assert.ok(detail.includes(text))
 assert.ok(edit.includes('保存修改'));assert.ok(work.includes('原型演示回执'));assert.ok(work.includes('未连接真实平台 API'));assert.ok(!edit.includes('手工库存'));assert.ok(!detail.includes('导出完整备份'))
 assert.ok(renderPcsChannelStoreListPage().includes('销售币种'));assert.ok(renderPcsChannelStoreDetailPage('ST-008').includes('结算 CNY'));assert.ok(renderPcsChannelStoreEditPage('ST-008').includes('经营配置'))
})

test('fixed current prototype scenarios expose success, partial, late, concurrent and unknown receipts',()=>{
 const values=new Set(catalog.getPcsChannelCatalogSnapshot().syncOperations.map(o=>o.result));for(const expected of ['成功','部分成功','已过期','同时变更待处理','结果待核实'])assert.ok(values.has(expected as any))
 const unknown=catalog.getPcsChannelCatalogSnapshot().syncOperations.find(o=>o.result==='结果待核实')!;sync.verifyUnknownChannelOperation(unknown.id);assert.equal(catalog.getChannelListing(unknown.listingId)!.syncStatus,'一致')
 const conflict=catalog.getPcsChannelCatalogSnapshot().syncOperations.find(o=>o.conflicts.length)!;sync.resolveChannelSyncConflict(conflict.id,conflict.listingId,'title','PCS');assert.equal(catalog.getChannelListing(conflict.listingId)!.syncStatus,'一致')
})

test('SYNC-009/010 fixed shared SKU reads the exact WLS source across two PIDs and three external instances',()=>{
 const skuId='sku_r1_wms_tee_black_s',source=getChannelWmsAvailability(skuId)!
 assert.ok(source);assert.equal(source.skuCode,'SKU-GC-20001');assert.equal(source.unit,'件');assert.equal(source.available,608)
 const mapped=catalog.getPcsChannelCatalogSnapshot().variants.filter(v=>v.internalSkuId===skuId)
 assert.equal(new Set(mapped.map(v=>v.listingId)).size,2);assert.equal(mapped.length,3)
 const before=JSON.stringify(stockRealtimeSeed),operations=synchronizeChannelWmsAvailability('channel-listing-wms-demo-1')
 assert.equal(operations.length,2);assert.deepEqual(operations.flatMap(o=>o.observedAvailability!.map(v=>v.quantity)),[608,608,608]);assert.equal(JSON.stringify(stockRealtimeSeed),before)
 const row=stockRealtimeSeed.find(r=>r.sku===source.skuCode&&r.spotStock>=7)!,occupied=row.spotOrderOccupiedQuantity
 try{row.spotOrderOccupiedQuantity=(occupied||0)+7;const changed=getChannelWmsAvailability(skuId)!;assert.equal(changed.available,601);assert.notEqual(changed.sourceVersion,source.sourceVersion);assert.deepEqual(synchronizeChannelWmsAvailability('channel-listing-wms-demo-1').flatMap(o=>o.observedAvailability!.map(v=>v.quantity)),[601,601,601])}finally{row.spotOrderOccupiedQuantity=occupied}
 assert.equal(getChannelWmsAvailability('sku_r1_tee_white_m'),null)
})

test('channel WLS source link applies an exact SKU filter on the existing warehouse page',()=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window'),storage={getItem:()=>null,setItem:()=>{}}
 try{Object.defineProperty(globalThis,'window',{value:{location:{search:'?sku=SKU-GC-20001'},localStorage:storage},configurable:true});const html=renderFinishedStockRealtime();assert.ok(html.includes('SKU-GC-20001'));assert.ok(!html.includes('SKU-GC-20002'))}finally{if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window')}
})

test('read optimizations preserve immutable object boundaries and no-op content does not create versions',()=>{
 const counts=catalog.getChannelArchiveCounts(),countSnapshot=catalog.getPcsChannelCatalogSnapshot();assert.equal(counts.byStyle.get(L.styleId),countSnapshot.listings.filter(value=>value.styleId===L.styleId).length);assert.equal(counts.bySku.get(V[0].internalSkuId),countSnapshot.variants.filter(value=>value.internalSkuId===V[0].internalSkuId).length);counts.byStyle.clear();assert.ok(catalog.getChannelArchiveCounts().byStyle.size)

 const raw=pcsRecordStore.getItem(catalog.PCS_CHANNEL_CATALOG_KEY),l=catalog.getChannelListing(L.id)!,v=catalog.listChannelVariants(L.id),p=catalog.resolveChannelPrice(v[0])
 l.content.title='不能通过读取返回值修改事实';v[0].sellerSku='不能泄漏可变缓存';if(p.price)p.price.amount=1
 assert.equal(catalog.getChannelListing(L.id)!.content.title,L.content.title);assert.equal(catalog.listChannelVariants(L.id)[0].sellerSku,V[0].sellerSku);assert.notEqual(catalog.resolveChannelPrice(V[0]).amount,1)
 const same=catalog.saveChannelContent(L.id,L.content,L.version);assert.equal(same.contentVersion,L.contentVersion);assert.equal(pcsRecordStore.getItem(catalog.PCS_CHANNEL_CATALOG_KEY),raw)
})

test('CHAN-004/012 import grouping rejects cross-style, duplicate instance and different PID titles with exact row errors',()=>{
 const sku=getSkuArchiveById(V[0].internalSkuId)!,style=getStyleArchiveById(L.styleId)!,other=eligible.find(s=>s.styleId!==L.styleId)!,otherStyle=getStyleArchiveById(other.styleId)!
 const base={storeId:'ST-001',styleCode:style.styleCode,internalSkuCode:sku.skuCode,platformProductId:'import-same-pid',platformVariantId:'import-one',sellerSku:sku.skuCode,title:'同一款式',price:149000}
 const preview=catalog.previewChannelImport([base,{...base,platformVariantId:'import-two'},{...base,platformVariantId:'import-three',title:'不一致标题'},{...base},{...base,platformVariantId:'import-four',styleCode:otherStyle.styleCode,internalSkuCode:other.skuCode}])
 assert.equal(preview.groups.size,1);assert.equal([...preview.groups.values()][0].length,2);assert.deepEqual(preview.errors.map(e=>e.row),[3,4,5]);assert.match(preview.errors[0].message,/标题/);assert.match(preview.errors[1].message,/重复/);assert.match(preview.errors[2].message,/款式/)
})

test('CHAN-008 sales size chart source links to an actual same-style technical version and rejects foreign versions',async()=>{
 const versions=listTechnicalDataVersionsByStyleId(L.styleId);assert.ok(versions.some(v=>v.technicalVersionId===L.content.sizeChartSourceVersion))
 assert.throws(()=>catalog.saveChannelContent(L.id,{...L.content,sizeChartSourceVersion:'nonexistent-version'},L.version),/技术尺寸版本/)
 const foreign=baseline.listings.find(l=>l.styleId!==L.styleId&&l.content.sizeChartSourceVersion)!.content.sizeChartSourceVersion
 assert.throws(()=>catalog.saveChannelContent(L.id,{...L.content,sizeChartSourceVersion:foreign},L.version),/当前款式/)
 const node={dataset:{pcsChannelProductListAction:'tab',tab:'content'},closest(){return this}} as unknown as HTMLElement
 await handlePcsChannelProductListEvent(node);const html=renderPcsChannelProductDetailPage(L.id)
 assert.ok(html.includes(`/pcs/products/styles/${L.styleId}/technical-data/${L.content.sizeChartSourceVersion}`))
})

test('sales description preview retains text/table/list/image semantics and drops executable attributes',()=>{
 const source='<p>尺寸 &amp; 面料</p><table><tr><td colspan="2">M</td></tr></table><ul><li>机洗</li></ul><img src="https://example.test/size.png" onerror="alert(1)"><a href="javascript:alert(1)" onclick="alert(1)" data-nav="/danger">详情</a><script>alert(1)</script><svg><a href="javascript:alert(1)">x</a></svg>'
 const html=renderChannelDescription(source)
 for(const expected of ['<p>尺寸 &amp; 面料</p>','<table>','colspan="2"','<ul>','src="https://example.test/size.png"'])assert.ok(html.includes(expected))
 for(const unsafe of ['<script','<svg','onerror','onclick','data-nav','javascript:'])assert.ok(!html.includes(unsafe))
 const hostile=renderChannelDescription('<img src="/safe.png" style="position:fixed" data-pcs-channel-product-list-action="publish"><iframe src="/sensitive"></iframe>')
 assert.ok(!hostile.includes('style='));assert.ok(!hostile.includes('data-pcs-'));assert.ok(!hostile.includes('<iframe'))
})

test('channel forms register with the common dirty guard: cancel preserves inputs and confirm discards only pending edits',async()=>{
 discardPcsChannelChanges();discardPcsChannelStoreChanges();renderPcsChannelProductEditPage(L.id)
 const field={dataset:{pcsChannelProductListField:'content.title'},value:'尚未保存的渠道标题',closest(){return this}} as unknown as Element
 await handlePcsChannelProductListInput(field);assert.equal(hasUnsavedPcsChannelChanges(),true);assert.equal(hasPcsUnsavedChanges(),true)
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window'),fake={confirm:()=>false}
 try{
  Object.defineProperty(globalThis,'window',{value:fake,configurable:true});assert.equal(confirmPcsRouteLeave(`/pcs/products/channel-products/${L.id}/edit`,'/pcs/products/styles'),false);assert.equal(hasUnsavedPcsChannelChanges(),true)
  assert.ok(renderPcsChannelProductEditPage(L.id).includes('尚未保存的渠道标题'))
  fake.confirm=()=>true;assert.equal(confirmPcsRouteLeave('/pcs/products/channel-products/edit','/pcs/products/styles'),true);assert.equal(hasUnsavedPcsChannelChanges(),false)
  renderPcsChannelStoreEditPage('ST-008');const storeField={dataset:{pcsChannelStoreField:'form.storeName'},value:'尚未保存店名',closest(){return this}} as unknown as Element
  await handlePcsChannelStoresInput(storeField);assert.equal(hasUnsavedPcsChannelStoreChanges(),true);assert.equal(hasPcsUnsavedChanges(),true)
  assert.equal(confirmPcsRouteLeave('/pcs/channels/stores/ST-008/edit','/pcs/channels/stores'),true);assert.equal(hasUnsavedPcsChannelStoreChanges(),false)
  assert.equal(catalog.getChannelListing(L.id)!.content.title,L.content.title);assert.equal(stores.getChannelStore('ST-008')!.storeName,storeBaseline.stores.find(s=>s.id==='ST-008')!.storeName)
 }finally{discardPcsChannelChanges();discardPcsChannelStoreChanges();if(previous)Object.defineProperty(globalThis,'window',previous);else Reflect.deleteProperty(globalThis,'window')}
})

test('SYNC-004/007 late first-creation receipt preserves external identity without overwriting newer content',()=>{
 const l=make();approve(l.id);const operation=sync.submitChannelSync(l.id,'发布'),receipt=sync.demoChannelReceipt(operation.id),before=catalog.getChannelListing(l.id)!
 catalog.saveChannelContent(l.id,{...before.content,title:'提交以后更新的标题'},before.version)
 const result=sync.receiveChannelReceipt(receipt),current=catalog.getChannelListing(l.id)!
 assert.equal(result.result,'已过期');assert.equal(current.content.title,'提交以后更新的标题');assert.equal(current.platformProductId,receipt.platformProductId);assert.ok(catalog.listChannelVariants(l.id).every(v=>v.platformVariantId));assert.notEqual(current.syncStatus,'一致')
 approve(l.id);const update=sync.submitChannelSync(l.id,'更新');sync.receiveChannelReceipt(sync.demoChannelReceipt(update.id));assert.equal(catalog.getChannelListing(l.id)!.platformProductId,receipt.platformProductId)
})

test('SYNC-007/CHAN-005 incomplete or nontext external identity never becomes a successful formal publication',()=>{
 const l=make();approve(l.id);const operation=sync.submitChannelSync(l.id,'发布'),receipt=sync.demoChannelReceipt(operation.id)
 assert.throws(()=>sync.receiveChannelReceipt({...receipt,platformProductId:123 as unknown as string}),/文本原值/);assert.equal(catalog.getChannelListing(l.id)!.platformProductId,'')
 const missing=sync.receiveChannelReceipt({...receipt,platformProductId:undefined});assert.equal(missing.result,'结果待核实');assert.equal(catalog.getChannelListing(l.id)!.platformStatus,'未取得状态')
 assert.throws(()=>sync.submitChannelSync(l.id,'发布'),/核实/);sync.verifyUnknownChannelOperation(operation.id);assert.equal(catalog.getChannelListing(l.id)!.syncStatus,'一致')
 const another=make();approve(another.id);const next=sync.submitChannelSync(another.id,'发布'),noVariantIds=sync.demoChannelReceipt(next.id);noVariantIds.items=noVariantIds.items.map(i=>({...i,platformVariantId:undefined}))
 assert.equal(sync.receiveChannelReceipt(noVariantIds).result,'结果待核实');assert.equal(catalog.getChannelListing(another.id)!.syncStatus,'结果待核实');sync.verifyUnknownChannelOperation(next.id);assert.equal(catalog.getChannelListing(another.id)!.syncStatus,'一致')
})
