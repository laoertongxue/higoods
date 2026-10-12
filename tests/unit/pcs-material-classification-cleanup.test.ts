import test,{beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {pcsRecordStore} from '../../src/data/pcs-record-runtime.ts'
import * as config from '../../src/data/pcs-material-config.ts'
import * as repo from '../../src/data/pcs-material-archive-repository.ts'
import * as transfer from '../../src/data/pcs-material-transfer.ts'
import * as pages from '../../src/pages/pcs-material-archives.ts'
import {materialPurchaseHandoffPath} from '../../src/data/pcs-material-handoff.ts'
const baseline=repo.getMaterialArchiveBaseline(),configBaseline=config.getMaterialConfigSnapshot()
beforeEach(()=>{pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY,JSON.stringify(baseline));pcsRecordStore.setItem(config.PCS_MATERIAL_CONFIG_KEY,JSON.stringify(configBaseline));config.resetMaterialConfigCache();repo.resetMaterialArchiveCache();pages.resetPcsMaterialArchiveState()})
function draft(kind:'accessory'|'parts'|'consumable',category=kind==='accessory'?'扣合类':''):repo.MaterialArchiveDraft{return {kind,categoryName:category,materialName:'验收对象',materialNameEn:'',specSummary:'',composition:'',widthText:'',gramWeightText:'',processTags:[],mainImageUrl:'/materials/pcs-reviewed/knife.jpg',pricingUnit:'PCS',barcodeTemplateCode:'material-label-r1',remark:'',categoryAttributes:kind==='accessory'?{installationType:'机打'}:{},firstSku:{colorName:'',sizeName:'',specName:'10英寸',mainUnit:'PCS',skuImageUrl:'/materials/pcs-reviewed/knife.jpg',barcode:'',costPrice:0,freightCost:0,weightKg:0,lengthCm:0,widthCm:0,heightCm:0}}}
test('CAT-01..04/06: fixed classifications and codes; no cross-kind or simple templates',()=>{
 const expected={fabric:['SZ','ZZ','LL','MZ','YH','GN'],accessory:['SN','BF','LR','TB','LB','HD','OT'],yarn:['NF','CF','BL']}
 for(const [kind,codes]of Object.entries(expected)){const rows=config.listMaterialTemplates().filter(t=>t.kind===kind);assert.deepEqual(rows.map(t=>t.categoryCode),codes);for(const t of rows){assert.equal('version'in t,false);assert.throws(()=>config.getMaterialTemplate('parts',t.category),/分类/)}assert.equal(repo.getMaterialArchiveCategoryOptions(kind as any).length,codes.length)}
 assert.equal(config.listMaterialTemplates().length,16);assert.deepEqual(repo.getMaterialArchiveCategoryOptions('parts'),[]);assert.throws(()=>repo.createMaterialArchive({...draft('accessory'),categoryName:'纽扣'}),/分类/)
 const t=config.getMaterialTemplate('accessory','扣合类');assert.throws(()=>config.saveMaterialTemplate({...t,category:'自创分类',categoryCode:'NEW'},'管理员'),/固定目录/)
})
test('FAST-01..03: every BF save requires explicit installation type independently of physical fastening',()=>{
 for(const method of ['', '默认','脚式'])assert.throws(()=>repo.createMaterialArchive({...draft('accessory'),categoryAttributes:{installationType:method}}),/类型|请选择/)
 for(const method of ['机打','手缝']){const d=draft('accessory');d.categoryAttributes={installationType:method,fastening:'脚式'};const r=repo.createMaterialArchive(d);assert.equal(r.categoryAttributes?.installationType,method)}
 const d=draft('accessory','其他类目');d.categoryAttributes={};assert.ok(repo.createMaterialArchive(d));const field=config.getMaterialTemplate('accessory','扣合类').fields.find(f=>f.key==='installationType')!;assert.deepEqual(field.options,['机打','手缝']);assert.ok(field.required)
})
test('DEL-01/02/KEEP-01/02: current configuration saves once; old field units and identities remain dossier facts',()=>{
 const old=repo.listMaterialArchives('fabric')[0],before=repo.listMaterialSkuRecordsByMaterialId(old.materialId).map(s=>[s.materialSkuId,s.materialSkuCode]);const t=config.getMaterialTemplate('fabric',old.categoryName)
 config.saveMaterialTemplate({...t,changeNote:'维护当前说明'},'管理员');repo.resetMaterialArchiveCache();config.resetMaterialConfigCache()
 const saved=config.getMaterialTemplate('fabric',old.categoryName);assert.equal('version'in saved,false);assert.equal(config.listMaterialTemplates().filter(x=>x.templateId===t.templateId).length,1);assert.deepEqual(repo.listMaterialSkuRecordsByMaterialId(old.materialId).map(s=>[s.materialSkuId,s.materialSkuCode]),before);assert.deepEqual(repo.getMaterialArchiveById(old.materialId)?.attributeFields,old.attributeFields)
 assert.equal(config.listFixedMaterialConversions()[0].factor,.9144)
})
test('LIST-01..06/09: SPU search selects all children; approved root can review new draft children; no enable step',()=>{
 for(const kind of ['parts','consumable']as const){const d=draft(kind),r=repo.createMaterialArchive(d),s1=repo.listMaterialSkuRecordsByMaterialId(r.materialId)[0];repo.setMaterialApproval(r.materialId,'SUBMIT');repo.setMaterialApproval(r.materialId,'APPROVE');assert.ok(repo.isMaterialSkuAvailableForNewUse(repo.getMaterialSkuRecordById(s1.materialSkuId)));assert.match(materialPurchaseHandoffPath(s1.materialSkuId),/purchase/)
 const s2=repo.createMaterialSkuRecord(r.materialId,{...d.firstSku!,specName:'12英寸'})!;const q=repo.queryMaterialArchiveList(kind,{view:'root',search:s2.materialSkuCode});assert.equal(q.roots.length,1);assert.equal(q.skus.length,2);assert.equal(q.stats.total,1);repo.setMaterialApproval(r.materialId,'SUBMIT');assert.equal(repo.getMaterialArchiveById(r.materialId)?.approvalStatus,'APPROVED');assert.equal(repo.getMaterialSkuRecordById(s1.materialSkuId)?.approvalStatus,'APPROVED');assert.equal(repo.getMaterialSkuRecordById(s2.materialSkuId)?.approvalStatus,'PENDING');repo.setMaterialApproval(r.materialId,'APPROVE');assert.ok(repo.isMaterialSkuAvailableForNewUse(repo.getMaterialSkuRecordById(s2.materialSkuId)));assert.throws(()=>repo.setMaterialUseStatus(r.materialId,'ACTIVE'),/不提供/)}
})
test('LIST-07/08/10/DEL-04: retired operation surfaces are gone on all named details and simple lists',()=>{
 for(const kind of ['fabric','accessory','yarn','parts','consumable']as const){const r=repo.listMaterialArchives(kind)[0],sku=repo.listMaterialSkuRecordsByMaterialId(r.materialId)[0];for(const html of [pages.renderPcsMaterialArchiveDetailPage(kind,r.materialId),pages.renderPcsMaterialSkuDetailPage(kind,r.materialId,sku.materialSkuId)]){assert.doesNotMatch(html,/技术引用|复制主档|使用情况/);if(kind==='parts'||kind==='consumable')assert.doesNotMatch(html,/simple-actions|copy-sku|use-status/)} }
 for(const render of [pages.renderPcsPartsArchiveListPage,pages.renderPcsConsumableArchiveListPage]){const html=render();assert.match(html,/物料 \/ SPU/);assert.match(html,/规格 SKU/);assert.doesNotMatch(html,/simple-actions|copy-sku|use-status|使用状态/);assert.match(html,/data-material-list-actions/)}
})
test('PROC-01/FAST-02: import cannot bypass BF required type; headers contain new modes and no template revisions',()=>{
 const headers=transfer.materialTransferHeaders('archives','accessory');assert.ok(headers.includes('染色方式')&&headers.includes('印花方式'));assert.ok(headers.includes('扣合类型'));assert.ok(!headers.includes('模板版本')&&!headers.includes('渗透印'))
 const sample=transfer.buildMaterialBusinessTemplate('accessory','archives'),parsed=transfer.parseMaterialBusinessCsv(sample),type=parsed[0].indexOf('扣合类型');parsed[1][type]='';const preview=transfer.previewMaterialBusinessImport('accessory','archives',transfer.materialRowsToCsv(parsed));assert.equal(preview.failedRows,1);assert.match(preview.rows[0].errors.join(' '),/机打|类型/)
})

test('round-one: legacy BF direct parent and child approvals cannot bypass installation type',()=>{
 const x=structuredClone(baseline),r=x.records.find(r=>r.kind==='accessory')!,sk=x.skuRecords.find(s=>s.materialId===r.materialId)!;Object.assign(r,{categoryName:'扣合类',templateId:'material-category-accessory-BF',approvalStatus:'PENDING',categoryAttributes:{}});sk.approvalStatus='PENDING';pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY,JSON.stringify(x));repo.resetMaterialArchiveCache();for(const id of [r.materialId,sk.materialSkuId])assert.throws(()=>repo.setMaterialApproval(id,'APPROVE'),/机打或手缝/)
})
test('round-one: unknown legacy yarn stays unclassified in editor and SKU guard; old identities remain readable',()=>{
 const x=structuredClone(baseline),r=x.records.find(r=>r.kind==='yarn')!,sk=x.skuRecords.find(s=>s.materialId===r.materialId)!;Object.assign(r,{categoryName:'针织用纱',composition:'',compositionItems:undefined,templateId:undefined,categoryAttributes:{}});pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY,JSON.stringify(x));repo.resetMaterialArchiveCache();assert.equal(repo.getMaterialArchiveById(r.materialId)?.categoryName,'');assert.ok(repo.listMaterialArchives('fabric').length);const html=pages.renderPcsMaterialArchiveEditPage('yarn',r.materialId);assert.doesNotMatch(html,/value="天然纤维纱线"[^>]*selected/);assert.match(pages.renderPcsMaterialSkuEditPage('yarn',r.materialId,sk.materialSkuId),/请先补齐物料分类/);assert.equal(repo.getMaterialSkuRecordById(sk.materialSkuId)?.materialSkuCode,sk.materialSkuCode)
})
test('round-one: adopted units remain in display after unrelated unit configuration save',()=>{
 const x=structuredClone(baseline),r=x.records.find(r=>r.kind==='fabric')!;r.categoryAttributes={...r.categoryAttributes,width:1500};r.attributeFields=[{key:'width',label:'幅宽',unit:'mm'}];pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY,JSON.stringify(x));repo.resetMaterialArchiveCache();const unit=config.listMaterialUnitDefinitions()[0];config.saveMaterialUnit({...unit,nameZh:unit.nameZh},'管理员');repo.resetMaterialArchiveCache();assert.match(pages.renderPcsMaterialArchiveDetailPage('fabric',r.materialId),/幅宽（mm）[\s\S]*?1500/);assert.deepEqual(repo.getMaterialArchiveById(r.materialId)?.attributeFields,r.attributeFields)
})
test('round-one: BF CSV same SPU cannot silently merge conflicting installation types',()=>{
 const parsed=transfer.parseMaterialBusinessCsv(transfer.buildMaterialBusinessTemplate('accessory','archives')),type=parsed[0].indexOf('扣合类型'),sku=parsed[0].indexOf('规格名称');parsed[1][type]='机打';const next=[...parsed[1]];next[type]='手缝';if(sku>=0)next[sku]='第二规格';parsed.push(next);const result=transfer.previewMaterialBusinessImport('accessory','archives',transfer.materialRowsToCsv(parsed));assert.ok(result.failedRows>0);assert.match(result.rows.flatMap(r=>r.errors).join(' '),/类型|主档/)
})

test('round-one: explicit model text 规格0/规格1 never becomes the common SPU name on read/save',()=>{
 const d=draft('consumable');d.firstSku!.specName='规格0';const r=repo.createMaterialArchive(d);repo.createMaterialSkuRecord(r.materialId,{...d.firstSku!,specName:'规格1'});repo.resetMaterialArchiveCache();const skus=repo.listMaterialSkuRecordsByMaterialId(r.materialId);assert.deepEqual(skus.map(s=>s.specName),['规格0','规格1']);repo.saveSimpleMaterialDossier({...r,materialName:'更正主档展示名称'},skus,r.materialId);repo.resetMaterialArchiveCache();assert.deepEqual(repo.listMaterialSkuRecordsByMaterialId(r.materialId).map(s=>s.specName),['规格0','规格1'])
})

test('round-two: current process segments are controlled rules even with legacy serialized configuration; names and enable state persist',()=>{
 const cfg=structuredClone(configBaseline),p=cfg.processes.find(p=>p.id==='PRINTING')!;Object.assign(p,{segment:'花型-A/AB-[ST]YH',name:'用户维护的印花名称',enabled:false});pcsRecordStore.setItem(config.PCS_MATERIAL_CONFIG_KEY,JSON.stringify(cfg));config.resetMaterialConfigCache();const current=config.listMaterialProcessConfigurations().find(p=>p.id==='PRINTING')!;assert.equal(current.segment,config.MATERIAL_PROCESS_DEFINITIONS.find(p=>p.id==='PRINTING')!.segment);assert.equal(current.name,'用户维护的印花名称');assert.equal(current.enabled,false);assert.doesNotThrow(()=>config.saveMaterialProcessConfiguration({...current,name:'继续维护名称'},'管理员'))
})
test('round-two: adopted mm units agree in root technical edit and processed effective specification inputs',()=>{
 const x=structuredClone(baseline),r=x.records.find(r=>r.kind==='fabric')!,s=x.skuRecords.find(s=>s.materialId===r.materialId)!;r.categoryAttributes={width:1500};r.attributeFields=[{key:'width',label:'幅宽',unit:'mm'}];pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY,JSON.stringify(x));repo.resetMaterialArchiveCache();pages.renderPcsMaterialArchiveEditPage('fabric',r.materialId);const target=(action:string,value:string)=>({dataset:{pcsMaterialArchiveAction:action,value},getAttribute:()=>action,closest(){return this}} as unknown as HTMLElement);pages.handlePcsMaterialArchiveEvent(target('form-tab','technical'));const html=pages.renderPcsMaterialArchiveEditPage('fabric',r.materialId);assert.match(html,/幅宽（mm）/);assert.doesNotMatch(html,/幅宽（cm）/);pages.resetPcsMaterialArchiveState();pages.renderPcsMaterialSkuEditPage('fabric',r.materialId,s.materialSkuId,true);pages.handlePcsMaterialArchiveEvent(target('form-tab','spec'));const process=pages.renderPcsMaterialSkuEditPage('fabric',r.materialId,s.materialSkuId,true);assert.match(process,/加工后幅宽（mm）/)
})

test('round-two: BF core choice cannot be changed into numeric, conditional or unrelated dictionary input',()=>{
 for(const patch of [{type:'number'},{type:'text'},{requiredWhen:'optional'},{dictionaryId:'colors'}]){const t=config.getMaterialTemplate('accessory','扣合类');Object.assign(t.fields.find(f=>f.key==='installationType')!,patch);assert.throws(()=>config.saveMaterialTemplate(t,'管理员'),/扣合类|枚举|字典/)}
})
