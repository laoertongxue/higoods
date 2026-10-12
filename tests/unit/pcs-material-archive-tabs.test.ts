import test,{beforeEach}from'node:test'
import assert from'node:assert/strict'
import{readFileSync}from'node:fs'
import{pcsRecordStore}from'../../src/data/pcs-record-runtime.ts'
import * as repo from'../../src/data/pcs-material-archive-repository.ts'
import * as pages from'../../src/pages/pcs-material-archives.ts'
const baseline=repo.getMaterialArchiveBaseline(),kinds=['fabric','accessory','yarn']as const
beforeEach(()=>{pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY,JSON.stringify(baseline));repo.resetMaterialArchiveCache();pages.resetPcsMaterialArchiveState()})
const target=(action:string,value:string)=>({dataset:{pcsMaterialArchiveAction:action,value},getAttribute:()=>action,closest(){return this}}as unknown as HTMLElement)
async function tab(action:string,value:string){await pages.handlePcsMaterialArchiveEvent(target(action,value))}
for(const kind of kinds)test(`TAB-01..05 ${kind}: no plans or documents tabs; specification composer only two basic roles`,async()=>{
 const root=repo.listMaterialArchives(kind)[0],sku=repo.listMaterialSkuRecordsByMaterialId(root.materialId)[0]
 const a=pages.renderPcsMaterialArchiveDetailPage(kind,root.materialId),b=pages.renderPcsMaterialSkuDetailPage(kind,root.materialId,sku.materialSkuId)
 for(const html of[a,b]){assert.doesNotMatch(html,/data-value="assets"|data-value="plans"|创建加工计划|关联加工计划/);assert.match(html,/补充图片与规格说明/);assert.doesNotMatch(html,/<option value="(?:PRINT_FILE|EMBROIDERY_FILE|HEAT_TRANSFER_FILE)"/)}
 await tab('sku-tab','plans');assert.match(pages.renderPcsMaterialSkuDetailPage(kind,root.materialId,sku.materialSkuId),/规格资料/)
 await tab('root-tab','assets');assert.match(pages.renderPcsMaterialArchiveDetailPage(kind,root.materialId),/基本资料/)
})
test('TAB-02: dedicated FCS dependency, plan query, view and click handler are deleted',()=>{
 const src=readFileSync('src/pages/pcs-material-archives.ts','utf8');for(const text of['listFcsMaterialProcessPlans','fcsMaterialProcessPlanDetailPath','renderRelatedMaterialPlans','materialProcessHandoffPath',"action==='process-order'",'function renderAssets('])assert.equal(src.includes(text),false,text)
})
test('TAB-06: all eight historical roles remain reachable exactly once and root never lists another SKU file',async()=>{
 const snap=structuredClone(baseline),root=snap.records.find(r=>r.materialId==='material-r1-MAT-FB-00000001')!,sku=snap.skuRecords.find(s=>s.materialSkuId==='material-r1-process-dye')!
 const roles=['IDENTIFICATION','INPUT','PATTERN','COLOR_SAMPLE','PRINT_FILE','EMBROIDERY_FILE','HEAT_TRANSFER_FILE','SPECIFICATION']as const
 for(const role of roles)snap.assets!.push({assetId:'qa-'+role,materialId:root.materialId,materialSkuId:sku.materialSkuId,role,name:'历史_'+role,url:'/materials/packing-bag.jpg',version:1,createdAt:'2026-10-12'})
 snap.assets!.push({assetId:'qa-root',materialId:root.materialId,role:'SPECIFICATION',name:'主档共用说明',url:'/technical-data/dye-standard-demo.md',version:1,createdAt:'2026-10-12'})
 pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY,JSON.stringify(snap));repo.resetMaterialArchiveCache();const original=JSON.stringify(repo.getMaterialArchiveStoreSnapshot())
 const r=pages.renderPcsMaterialArchiveDetailPage('fabric',root.materialId);assert.ok(r.includes('主档共用说明'));assert.ok(!r.includes('历史_IDENTIFICATION'))
 const spec=pages.renderPcsMaterialSkuDetailPage('fabric',root.materialId,sku.materialSkuId);await tab('sku-tab','process');const proc=pages.renderPcsMaterialSkuDetailPage('fabric',root.materialId,sku.materialSkuId)
 for(const role of roles){assert.equal(Number(spec.includes('历史_'+role))+Number(proc.includes('历史_'+role)),1,role)}
 assert.equal(JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),original,'render does not persist or delete assets')
})
test('TAB-05: execution upload shows only the current process role, dye has color sample and specification',async()=>{
 for(const [id,expected]of[['dye',['COLOR_SAMPLE','SPECIFICATION']],['print',['PRINT_FILE']],['embroidery',['EMBROIDERY_FILE']],['heat',['HEAT_TRANSFER_FILE']]]as const){pages.resetPcsMaterialArchiveState();const sku=repo.getMaterialSkuRecordById('material-r1-process-'+id)!;pages.renderPcsMaterialSkuDetailPage('fabric',sku.materialId,sku.materialSkuId);await tab('sku-tab','process');const html=pages.renderPcsMaterialSkuDetailPage('fabric',sku.materialId,sku.materialSkuId);assert.match(html,/加工说明与执行文件/);if(expected.length===2){assert.match(html,/value="COLOR_SAMPLE"/);assert.match(html,/value="SPECIFICATION"/)}else{assert.doesNotMatch(html,/data-pcs-material-archive-field="assetRole"/)}assert.doesNotMatch(html,/assetProcessVersion/)}
})
test('TAB-09: root edit and SKU image editors compile without a hidden generic documents composer',()=>{const root=repo.listMaterialArchives('fabric')[0],sku=repo.listMaterialSkuRecordsByMaterialId(root.materialId)[0];pages.renderPcsMaterialArchiveEditPage('fabric',root.materialId);assert.ok(pages.renderPcsMaterialSkuEditPage('fabric',root.materialId,sku.materialSkuId))})
function input(key:string,value:string,extras:Record<string,unknown>={}){const el={dataset:{pcsMaterialArchiveField:key,fieldScope:'form'},value,files:[],getAttribute:()=>key,removeAttribute(){},closest(){return this},...extras};pages.handlePcsMaterialArchiveInput(el as unknown as HTMLElement)}
test('TAB-08: chosen file cannot be written to another archive or section',async()=>{
 const sku=repo.getMaterialSkuRecordById('material-r1-process-dye')!,root=repo.getMaterialArchiveById(sku.materialId)!;pages.renderPcsMaterialSkuDetailPage('fabric',root.materialId,sku.materialSkuId)
 input('assetFile','',{files:[new File(['image'],'sample.png',{type:'image/png'})],dataset:{pcsMaterialArchiveField:'assetFile',fieldScope:'form',assetContext:'another-owner//spec'}})
 const el={dataset:{pcsMaterialArchiveAction:'save-asset',materialId:root.materialId,skuId:sku.materialSkuId,assetSection:'spec'},getAttribute:()=> 'save-asset',closest(){return this}};const before=JSON.stringify(repo.getMaterialArchiveStoreSnapshot());await pages.handlePcsMaterialArchiveEvent(el as unknown as HTMLElement);assert.equal(JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),before);assert.match(pages.renderPcsMaterialSkuDetailPage('fabric',root.materialId,sku.materialSkuId),/不属于当前档案/)
})
test('TAB-08: dye form rejects injected printing role before write and preserves input',async()=>{
 const sku=repo.getMaterialSkuRecordById('material-r1-process-dye')!;pages.renderPcsMaterialSkuDetailPage('fabric',sku.materialId,sku.materialSkuId);await tab('sku-tab','process');pages.renderPcsMaterialSkuDetailPage('fabric',sku.materialId,sku.materialSkuId)
 input('assetFile','',{files:[new File(['image'],'sample.png',{type:'image/png'})],dataset:{pcsMaterialArchiveField:'assetFile',fieldScope:'form',assetContext:`${sku.materialId}/${sku.materialSkuId}/process`}});input('assetRole','PRINT_FILE')
 const el={dataset:{pcsMaterialArchiveAction:'save-asset',materialId:sku.materialId,skuId:sku.materialSkuId,assetSection:'process'},getAttribute:()=> 'save-asset',closest(){return this}};const before=JSON.stringify(repo.getMaterialArchiveStoreSnapshot());await pages.handlePcsMaterialArchiveEvent(el as unknown as HTMLElement);assert.equal(JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),before);const html=pages.renderPcsMaterialSkuDetailPage('fabric',sku.materialId,sku.materialSkuId);assert.match(html,/当前规格或工艺/);assert.match(html,/sample.png/)
})
