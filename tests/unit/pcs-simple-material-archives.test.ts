import test,{beforeEach} from 'node:test'
import assert from 'node:assert/strict'
import {pcsRecordStore} from '../../src/data/pcs-record-runtime.ts'
import * as repo from '../../src/data/pcs-material-archive-repository.ts'
import * as transfer from '../../src/data/pcs-material-transfer.ts'
import {listSimpleMaterialCategories} from '../../src/data/pcs-simple-material-categories.ts'
import {assertMaterialArchiveCanBeArchived} from '../../src/data/pcs-material-reference-check.ts'
const baseline=repo.getMaterialArchiveBaseline()
beforeEach(()=>{pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY,JSON.stringify(baseline));repo.resetMaterialArchiveCache()})
function draft(kind:'parts'|'consumable',name='测试档案',spec='10英寸'):repo.MaterialArchiveDraft{return {kind,materialName:name,materialNameEn:'',categoryName:listSimpleMaterialCategories(kind)[0].name,remark:'',specSummary:'',composition:'',processTags:[],widthText:'',gramWeightText:'',pricingUnit:'PCS',mainImageUrl:'/materials/pcs-reviewed/knife.jpg',barcodeTemplateCode:'material-label-r1',firstSku:{colorName:'',specName:spec,sizeName:'',skuImageUrl:'/materials/pcs-reviewed/knife.jpg',costPrice:0,freightCost:0,weightKg:0,lengthCm:0,widthCm:0,heightCm:0,barcode:'',mainUnit:'PCS',pricingUnit:'PCS'}}}
function csv(kind:'parts'|'consumable',mode:transfer.MaterialTransferMode,values:Record<string,string>[]){const h=transfer.materialTransferHeaders(mode,kind);return transfer.materialRowsToCsv([h,...values.map(v=>h.map(x=>v[x]||''))])}
test('SIMPLE-001/049: a saved simple archive cannot switch type to bypass capability boundaries',()=>{
 for(const kind of ['parts','consumable'] as const){const root=repo.createMaterialArchive(draft(kind)),before=JSON.stringify(repo.getMaterialArchiveStoreSnapshot());for(const target of ['parts','consumable','fabric','accessory'] as const){if(target===kind)continue;const input=target==='parts'||target==='consumable'?draft(target):{...baseline.records.find(x=>x.kind===target)!};assert.throws(()=>repo.updateMaterialArchive(root.materialId,{...input,materialCode:root.materialCode,firstSku:undefined}),/物料类型/);assert.equal(JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),before)}}
 for(const root of baseline.records.filter(x=>x.kind==='fabric'||x.kind==='accessory')){const before=JSON.stringify(repo.getMaterialArchiveStoreSnapshot());for(const target of ['parts','consumable'] as const){assert.throws(()=>repo.updateMaterialArchive(root.materialId,{...draft(target),firstSku:undefined}),/物料类型/);assert.equal(JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),before)}}
})
test('SIMPLE-002/005/006/007/009/016: basic identity is readable normalized text, no technical template dependency; failed first SKU publishes nothing',()=>{
 for(const kind of ['parts','consumable'] as const){const d=draft(kind),before=JSON.stringify(repo.getMaterialArchiveStoreSnapshot());assert.throws(()=>repo.createMaterialArchive({...d,firstSku:undefined}),/首个规格/);assert.throws(()=>repo.createMaterialArchive({...d,firstSku:{...d.firstSku!,specName:''}}),/规格型号/);assert.equal(JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),before)
 assert.throws(()=>repo.createMaterialArchive({...d,firstSku:{...d.firstSku!,specName:'中'.repeat(121)}}),/120/);assert.equal(JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),before)
 const root=repo.createMaterialArchive(d),first=repo.listMaterialSkuRecordsByMaterialId(root.materialId)[0];assert.equal(root.templateId,undefined);assert.equal(first.specName,'10英寸');assert.throws(()=>repo.createMaterialSkuRecord(root.materialId,{...d.firstSku!,specName:' 10英寸 '}),/存在/)
 assert.ok(repo.createMaterialSkuRecord(root.materialId,{...d.firstSku!,specName:'254mm'}));assert.ok(repo.createMaterialSkuRecord(root.materialId,{...d.firstSku!,specName:'12英寸'}))}
})
test('SIMPLE-008/017/039/041: parent and first SKU review together; new spec remains draft; approved wording correction retains ID/barcodes',async()=>{
 const d=draft('parts'),root=repo.createMaterialArchive(d),first=repo.listMaterialSkuRecordsByMaterialId(root.materialId)[0]
 const commit=async(recipe:()=>void)=>recipe()
 assert.ok((await repo.runMaterialApprovalBatch([first.materialSkuId],'SUBMIT','t',commit))[0].ok);assert.equal(repo.getMaterialArchiveById(root.materialId)?.approvalStatus,'PENDING')
 assert.ok((await repo.runMaterialApprovalBatch([first.materialSkuId],'APPROVE','t2',commit))[0].ok)
 repo.correctSimpleMaterialSpecification(first.materialSkuId,'10英寸刀片','仅补齐名称，实物未变化');const corrected=repo.getMaterialSkuRecordById(first.materialSkuId)!;assert.equal(corrected.materialSkuId,first.materialSkuId);assert.equal(corrected.materialSkuCode,first.materialSkuCode);assert.equal(corrected.barcode,first.barcode)
 const next=repo.createMaterialSkuRecord(root.materialId,{...d.firstSku!,specName:'12英寸'})!;assert.equal(next.approvalStatus,'DRAFT');repo.setMaterialApproval(next.materialSkuId,'SUBMIT');assert.equal(repo.getMaterialArchiveById(root.materialId)?.approvalStatus,'APPROVED')
 assert.ok(repo.listMaterialLogRecordsByMaterialId(root.materialId).some(x=>x.detail.includes('实物未变化')))
})
test('SIMPLE-029/030/033/034/035/036: packaging revisions preserve adopted quote, exact costs and null versus explicit zero',()=>{
 const root=repo.createMaterialArchive(draft('parts')),sku=repo.listMaterialSkuRecordsByMaterialId(root.materialId)[0]
 const packInput={packageTypeId:'箱',contentQty:10,contentUnitId:'PCS',grossWeightKg:null,lengthCm:null,widthCm:null,heightCm:null,volumeM3:null,volumeSource:'UNKNOWN' as const,measurementBasis:'确认10个装',status:'ACTIVE' as const}
 const p=repo.saveMaterialPackageSpec(sku.materialSkuId,packInput),r=repo.listMaterialUnitRelations(sku.materialSkuId).find(x=>x.packageSpecId===p.packageSpecId)!
 assert.ok(r.uses.includes('PRICING'));repo.saveMaterialStandardCost(sku.materialSkuId,{purchaseStandardCny:20,transportStandardCny:1,pricingUnit:'箱',pricingUnitRelationId:r.relationId,changeReason:'含税每盒报价'})
 assert.equal(repo.getMaterialStandardCost(sku.materialSkuId).totalStandardCny,21);assert.equal(repo.getMaterialUnitFactor(sku.materialSkuId,'箱','PCS',r.relationId),10)
 repo.saveMaterialPackageSpec(sku.materialSkuId,{...packInput,packageSpecId:p.packageSpecId,contentQty:20,measurementBasis:'新版20个装'})
 assert.equal(repo.listMaterialCostVersions(sku.materialSkuId).at(-1)?.pricingUnitRelationId,r.relationId);assert.equal(repo.getMaterialUnitFactor(sku.materialSkuId,'箱','PCS',r.relationId),10);assert.equal(repo.getMaterialStandardCost(sku.materialSkuId).totalStandardCny,21)
 repo.saveMaterialStandardCost(sku.materialSkuId,{purchaseStandardCny:0,transportStandardCny:0,pricingUnit:'PCS',changeReason:'确认零费用'});assert.equal(repo.getMaterialStandardCost(sku.materialSkuId).totalStandardCny,0)
 repo.saveMaterialStandardCost(sku.materialSkuId,{purchaseStandardCny:0,transportStandardCny:null,pricingUnit:'PCS',changeReason:'待补运输'});assert.ok(repo.getMaterialStandardCost(sku.materialSkuId).completeness.length)
 assert.throws(()=>repo.saveMaterialStandardCost(sku.materialSkuId,{processStandardCny:0,pricingUnit:'PCS',changeReason:'伪造'}),/不维护加工费/)
})
test('SIMPLE-042/049: independent PMS archive preflight and forged process creation do not write',async()=>{
 const root=repo.createMaterialArchive(draft('consumable')),sku=repo.listMaterialSkuRecordsByMaterialId(root.materialId)[0],before=JSON.stringify(repo.getMaterialArchiveStoreSnapshot())
 await assertMaterialArchiveCanBeArchived(root.materialId,async()=>false);await assert.rejects(()=>assertMaterialArchiveCanBeArchived(root.materialId,async()=>true),/采购/);assert.throws(()=>repo.setMaterialUseStatus(root.materialId,'ARCHIVED','旧预检不可重用'),/核对采购/);await assert.rejects(()=>assertMaterialArchiveCanBeArchived(root.materialId,async()=>{throw Error('offline')}),/未归档/)
 assert.throws(()=>repo.createProcessedMaterialSku({inputSkuId:sku.materialSkuId,processType:'DYEING',colorName:'黑色',colorCode:'black',pantoneSystem:'TCX',pantoneCode:'19-4003'}),/不新增物料加工/);assert.equal(JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),before)
})
test('SIMPLE-051/052: simple CSV has no technical IDs, auto root codes, read-only preview and atomic repeated specifications',()=>{
 for(const kind of ['consumable','parts'] as const){for(const mode of ['archives','units','costs'] as const){assert.doesNotMatch(transfer.buildMaterialBusinessTemplate(kind,mode),/技术属性JSON|加工类型|计量关系ID|关系ID|模板ID/)}
 const row={模式:'新增',物料名称:'导入测试'+kind,分类编码:listSimpleMaterialCategories(kind)[0].code,规格型号:'10英寸',主计量单位:'PCS',识别图:'/materials/pcs-reviewed/knife.jpg',主档说明:'仅用于设备A',规格说明:'识别说明'}
 const before=JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),preview=transfer.previewMaterialBusinessImport(kind,'archives',csv(kind,'archives',[row,{...row,规格型号:'12英寸'}]));assert.equal(preview.failedRows,0);assert.equal(JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),before)
 const result=transfer.applyMaterialBusinessImportPreview(preview);assert.equal(result[0].codes.length,2)
 const root=repo.getMaterialArchiveByCode(preview.groups[0].key)!;assert.equal(repo.listMaterialSkuRecordsByMaterialId(root.materialId).length,2)
 assert.equal(transfer.previewMaterialBusinessImport(kind,'archives',csv(kind,'archives',[row,row])).failedRows,1)
 const exported=transfer.parseMaterialBusinessCsv(transfer.exportMaterialBusinessRows('archives',repo.listMaterialSkuRecordsByMaterialId(root.materialId).map(x=>x.materialSkuId))),updated=Object.fromEntries(exported[0].map((x,i)=>[x,exported[1][i]]));updated['规格说明']='更新说明';updated['物料名称']='已更新名称'
 const update=transfer.previewMaterialBusinessImport(kind,'archives',csv(kind,'archives',[updated]));assert.equal(update.failedRows,0);assert.match(update.rows[0].description,/更新说明/);transfer.applyMaterialBusinessImportPreview(update);assert.equal(repo.getMaterialArchiveById(root.materialId)?.materialName,'已更新名称');assert.equal(repo.getMaterialArchiveById(root.materialId)?.remark,'仅用于设备A')
 assert.throws(()=>transfer.applyMaterialBusinessImportPreview(update),/已变化/)
 }}
)

test('SIMPLE-019/042/056: legacy identity survives cleanup; direct orphan copy/archive cannot bypass guards',async()=>{
 const snap=repo.getMaterialArchiveBaseline(),root=snap.records.find(x=>x.kind==='parts')!;root.categoryAttributes={};root.composition='钢';root.widthText='12 mm';root.equipmentCompatibility=['裁床'];root.processTags=['旧工艺'];root.templateId=undefined;root.subcategoryId=undefined
 const originalId=root.materialId;pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY,JSON.stringify(snap));repo.resetMaterialArchiveCache();const view=repo.getMaterialArchiveById(originalId)!;assert.match(view.remark,/钢/);assert.match(view.remark,/12 mm/);assert.match(view.remark,/裁床/)
 repo.updateMaterialArchive(originalId,{...view});const reopened=repo.getMaterialArchiveById(originalId)!;assert.match(reopened.remark,/裁床/);assert.equal(reopened.materialId,originalId);assert.throws(()=>repo.copyMaterialArchive(originalId),/新规格/);assert.throws(()=>repo.setMaterialUseStatus(originalId,'ARCHIVED','测试'),/核对采购/);await assertMaterialArchiveCanBeArchived(originalId,async()=>false);repo.setMaterialUseStatus(originalId,'ARCHIVED','无引用确认');assert.equal(repo.getMaterialArchiveById(originalId)?.status,'ARCHIVED')
})

 test('SIMPLE-051/052/060: documented simple CSV limits reject whole oversized file before preparing groups',()=>{
 const row={模式:'新增',物料名称:'单批上限验收',分类编码:listSimpleMaterialCategories('parts')[0].code,规格型号:'10英寸',主计量单位:'PCS',主档说明:'',规格说明:''}
 const before=JSON.stringify(repo.getMaterialArchiveStoreSnapshot())
 assert.throws(()=>transfer.previewMaterialBusinessImport('parts','archives',csv('parts','archives',Array.from({length:501},()=>row))),/最多 500 行/)
 for(const mode of ['units','costs'] as const)assert.throws(()=>transfer.previewMaterialBusinessImport('parts',mode,csv('parts',mode,Array.from({length:21},()=>({})))),/最多 20 行/)
 assert.equal(JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),before)
 })


test('SIMPLE-049/057: direct historical simple process asset and source-money cost mutation are read-only',()=>{
 for(const kind of ['parts','consumable'] as const){
 const snap=repo.getMaterialArchiveBaseline(),process=snap.processDefinitions![0],output=snap.skuRecords.find(x=>x.materialSkuId===process.outputSkuId)!,root=snap.records.find(x=>x.materialId===output.materialId)!;root.kind=kind;
 pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY,JSON.stringify(snap));repo.resetMaterialArchiveCache();const before=JSON.stringify(repo.getMaterialArchiveStoreSnapshot());
 for(const role of ['PRINT_FILE','SPECIFICATION'] as const)assert.throws(()=>repo.addMaterialAsset({materialId:root.materialId,materialSkuId:output.materialSkuId,name:'伪造资料',role,url:'/materials/pcs-reviewed/knife.jpg',createdBy:'测试'}),/历史加工资料仅供查阅/);
 assert.throws(()=>repo.reviseMaterialProcessAssets(output.materialSkuId,['forged-file'],'forged-version'),/历史加工资料仅供查阅/);
 assert.throws(()=>repo.saveMaterialStandardCost(output.materialSkuId,{sourceMoney:{amount:99,currency:'CNY',unit:output.pricingUnit},changeReason:'试图重写历史加工费'}),/历史加工成本仅供查阅/);
 assert.equal(JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),before);
 }
})


test('SIMPLE-019/036: new simple SKU legacy numeric defaults do not imply confirmed free costs; explicit standard zero remains valid',()=>{
 for(const kind of ['parts','consumable'] as const){const d=draft(kind),root=repo.createMaterialArchive(d),first=repo.listMaterialSkuRecordsByMaterialId(root.materialId)[0],cost=repo.getMaterialStandardCost(first.materialSkuId);assert.equal(cost.totalStandardCny,null);assert.ok(cost.completeness.length);
 const zero=repo.createMaterialSkuRecord(root.materialId,{...d.firstSku!,specName:'明确零报价',purchaseStandardCny:0,transportStandardCny:0})!;assert.equal(repo.getMaterialStandardCost(zero.materialSkuId).totalStandardCny,0);assert.deepEqual(repo.getMaterialStandardCost(zero.materialSkuId).completeness,[]);}
})

test('SIMPLE-049/053: simple archives accept ordinary identification and specification files but reject new process roles',()=>{for(const kind of ['parts','consumable'] as const){const root=repo.createMaterialArchive(draft(kind)),sku=repo.listMaterialSkuRecordsByMaterialId(root.materialId)[0];for(const role of ['IDENTIFICATION','SPECIFICATION'] as const)assert.ok(repo.addMaterialAsset({materialId:root.materialId,materialSkuId:sku.materialSkuId,name:'普通资料',role,url:'/materials/pcs-reviewed/knife.jpg',createdBy:'测试'}));const before=JSON.stringify(repo.getMaterialArchiveStoreSnapshot());for(const role of ['PRINT_FILE','EMBROIDERY_FILE','HEAT_TRANSFER_FILE','PATTERN','INPUT','COLOR_SAMPLE'] as const)assert.throws(()=>repo.addMaterialAsset({materialId:root.materialId,materialSkuId:sku.materialSkuId,name:'伪造加工资料',role,url:'/materials/pcs-reviewed/knife.jpg',createdBy:'测试'}),/只维护识别图片和普通规格资料/);assert.equal(JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),before)}})
