import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { pcsRecordStore, registerPcsFile } from '../src/data/pcs-record-runtime.ts'
import * as repo from '../src/data/pcs-material-archive-repository.ts'
import { buildProcessedMaterialCode, checkedMaterialCode, fixedMaterialFactor, materialDecimalAdd, materialPackageVolume } from '../src/data/pcs-material-rules.ts'
import type { MaterialProcessDraft } from '../src/data/pcs-material-archive-types.ts'

const BASE='material-r1-MAT-FB-00000001-B01'
const baseline=repo.getMaterialArchiveBaseline()
beforeEach(()=>{pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY,JSON.stringify(baseline));repo.resetMaterialArchiveCache()})
const dye=(extra:Partial<MaterialProcessDraft>={}):MaterialProcessDraft=>({inputSkuId:BASE,processType:'DYEING',colorCode:'black',colorName:'黑色',pantoneSystem:'TCX',pantoneCode:'19-4003',skuImageUrl:'/materials/process-orders/white-black-cotton-jersey.jpg',...extra})
function useReviewedProcessFixture():void {
 const fixture=repo.getMaterialArchiveStoreSnapshot()
 for(const sku of fixture.skuRecords.filter(item=>item.materialSkuId.startsWith('material-r1-process-'))){sku.approvalStatus='APPROVED';sku.status='ACTIVE'}
 pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY,JSON.stringify(fixture));repo.resetMaterialArchiveCache()
}

test('CODE: direct predecessor is preserved across dye, embroidery, A/AB and penetration',()=>{
 const d=buildProcessedMaterialCode('CNIDML160',dye())
 assert.equal(d,'CNIDML160-black-19-4003PT')
 assert.equal(buildProcessedMaterialCode(d,dye({processType:'EMBROIDERY',patternCode:'pl001197'})),d+'-pl001197XH')
 assert.equal(buildProcessedMaterialCode(d,dye({processType:'PRINTING',patternCode:'pl001197',printSide:'A'})),d+'-pl001197-AYH')
 assert.equal(buildProcessedMaterialCode(d,dye({processType:'PRINTING',patternCode:'pl001197',backPatternCode:'pl001197',printSide:'AB'})),d+'-pl001197-ABYH')
 assert.equal(buildProcessedMaterialCode(d,dye({processType:'PRINTING',patternCode:'pl001197',backPatternCode:'pl001198',printSide:'AB',penetration:true})),d+'-Fpl001197-Bpl001198-AB-STYH')
 assert.equal(buildProcessedMaterialCode(d,dye({processType:'HEAT_TRANSFER',patternCode:'pl001197',deliveryRevisionSegment:'R02'})),d+'-pl001197R02TH')
 assert.throws(()=>buildProcessedMaterialCode('CNIDML160',dye({pantoneSystem:''})),/Pantone/)
 assert.throws(()=>buildProcessedMaterialCode('CNIDML160',dye({objectType:'CUT_PIECE'})),/裁片/)
 assert.throws(()=>checkedMaterialCode('A'.repeat(257)),/256/)
})
test('CODE/MAT: previous target IDs and aliases resolve to one canonical identity; no code parsing',()=>{
 useReviewedProcessFixture()
 const sku=repo.resolveMaterialSkuIdentity('CNIDML160-black-19-4003-pl001197-xPT')!
 assert.equal(sku.materialSkuId,'material-r1-process-embroidery')
 assert.deepEqual(repo.listMaterialSkuLineage(sku.materialSkuId).map(x=>x.materialSkuId),[BASE,'material-r1-process-dye','material-r1-process-embroidery'])
 const intent=repo.materialProcessOrderIntent(sku.materialSkuId)
 assert.equal(intent.inputSkuId,'material-r1-process-dye')
 assert.ok(!('inventory' in intent))
 assert.throws(()=>repo.createProcessedMaterialSku(dye({inputSkuId:'material-r1-process-dye'})),/不重复/)
})
test('COST: P + initial freight + every F; automatic descendants, immutable business snapshot',()=>{
 assert.equal(repo.getMaterialStandardCost(BASE).totalStandardCny,6)
 const frozen=repo.freezeMaterialCostSnapshot('material-r1-process-print')
 assert.equal(frozen.totalStandardCny,8)
 const preview=repo.previewMaterialCostChange(BASE,{purchaseStandardCny:6})
 assert.equal(preview.find(x=>x.materialSkuId==='material-r1-process-print')?.after,9)
 assert.equal(repo.getMaterialStandardCost(BASE).totalStandardCny,6)
 repo.saveMaterialStandardCost(BASE,{purchaseStandardCny:6,changeReason:'人工标准采购价格调整'})
 assert.equal(repo.getMaterialStandardCost('material-r1-process-print').totalStandardCny,9)
 assert.equal(repo.getMaterialStandardCost('material-r1-process-embroidery').totalStandardCny,9.8)
 assert.equal(repo.readMaterialCostReference('material-r1-process-print',frozen,true).totalStandardCny,8)
 assert.equal(repo.readMaterialCostReference('material-r1-process-print',frozen).changed,true)
 assert.equal(repo.getMaterialStandardCost('material-r1-process-print').lines.filter(x=>x.kind==='TRANSPORT').length,1)
 assert.throws(()=>repo.saveMaterialStandardCost('material-r1-process-print',{transportStandardCny:5,changeReason:'后段运输'}),/后段运输/)
})
test('COST: zero is complete; null is missing; display rates do not produce versions',()=>{
 repo.saveMaterialStandardCost(BASE,{purchaseStandardCny:0,transportStandardCny:0,changeReason:'已确认零值'})
 assert.equal(repo.getMaterialStandardCost(BASE).totalStandardCny,0)
 const n=repo.listMaterialCostVersions(BASE).length
 assert.equal(repo.materialStandardCostDisplay(BASE,'IDR',2200).displayAmount,0)
 assert.equal(repo.materialStandardCostDisplay(BASE,'USD').message,'未配置汇率')
 assert.equal(repo.listMaterialCostVersions(BASE).length,n)
 repo.saveMaterialStandardCost(BASE,{purchaseStandardCny:null,changeReason:'待维护'})
 assert.equal(repo.getMaterialStandardCost(BASE).totalStandardCny,null)
 assert.ok(repo.getMaterialStandardCost('material-r1-process-print').completeness.includes('上道成本不完整'))
 assert.equal(materialDecimalAdd(.18,.05),.23)
})
test('COST/UOM: source currency and unit normalization retains quote precision',()=>{
 repo.saveMaterialStandardCost(BASE,{sourceMoney:{amount:'14000.1234',currency:'IDR',unit:'Yard',cnyPerSourceCurrency:'0.0005',normalizationBasis:'确认报价'},changeReason:'原币标准'})
 assert.equal(repo.listMaterialCostVersions(BASE).at(-1)?.sourceMoney?.amount,'14000.1234')
 assert.equal(repo.getMaterialStandardCost(BASE).totalStandardCny,8.0000617)
 repo.saveMaterialStandardCost(BASE,{purchaseStandardCny:5,changeReason:'人工新标准'})
 assert.equal(repo.getMaterialStandardCost(BASE).totalStandardCny,6)
})
test('UOM: fixed conversions cannot be altered; cross dimensions need basis and retain versions',()=>{
 assert.equal(fixedMaterialFactor('Yard','M'),.9144)
 assert.throws(()=>repo.saveMaterialUnitRelation(BASE,{auxUnitId:'M',mainQtyPerAux:1,basisType:'FIXED',basisReference:'',uses:['PURCHASE'],isDefaultForUse:[],status:'ACTIVE',changeReason:'测试'}),/固定/)
 assert.throws(()=>repo.saveMaterialUnitRelation(BASE,{auxUnitId:'KG',mainQtyPerAux:5,basisType:'SPECIFICATION',basisReference:'',uses:['PRICING'],isDefaultForUse:[],status:'ACTIVE',changeReason:'测试'}),/依据/)
 const first=repo.saveMaterialUnitRelation(BASE,{auxUnitId:'KG',mainQtyPerAux:5,basisType:'SPECIFICATION',basisReference:'门幅与克重技术测定',uses:['PRICING'],isDefaultForUse:['PRICING'],status:'ACTIVE',changeReason:'新增'})
 const second=repo.saveMaterialUnitRelation(BASE,{...first,relationId:first.relationId,mainQtyPerAux:4,changeReason:'确认规格调整'})
 assert.notEqual(first.relationId,second.relationId)
 assert.equal(second.version,2)
 assert.equal(repo.getMaterialUnitFactor(BASE,'KG','Yard',first.relationId),5)
 assert.equal(repo.getMaterialUnitFactor(BASE,'KG','Yard'),4)
 assert.throws(()=>repo.updateMaterialSkuRecord(BASE,{...repo.getMaterialSkuRecordById(BASE)!,mainUnit:'KG'}),/主计量单位/)
})
test('UOM: two packages share SKU identity, have separate relations, unknown volume stays null',()=>{
 const id=baseline.skuRecords.find(x=>x.materialId==='material-r1-root-MAT-CS-00000001')?.materialSkuId||baseline.skuRecords.find(x=>x.materialName.includes('包装袋'))!.materialSkuId
 const before=repo.getMaterialSkuRecordById(id)!
 const common={packageTypeId:'包',contentUnitId:before.mainUnit!,grossWeightKg:null,lengthCm:null,widthCm:null,heightCm:null,volumeM3:null,volumeSource:'UNKNOWN'as const,measurementBasis:'包装含量确认',status:'ACTIVE'as const}
 const p1=repo.saveMaterialPackageSpec(id,{...common,contentQty:100}),p2=repo.saveMaterialPackageSpec(id,{...common,contentQty:600})
 assert.notEqual(p1.packageSpecId,p2.packageSpecId)
 assert.equal(repo.getMaterialSkuRecordById(id)?.materialSkuCode,before.materialSkuCode)
 assert.equal(repo.listMaterialPackageSpecs(id).length,2)
 assert.equal(repo.getMaterialUnitFactor(id,'包',before.mainUnit!),null)
 assert.equal(repo.getMaterialUnitFactor(id,'包',before.mainUnit!,repo.listMaterialUnitRelations(id).find(x=>x.packageSpecId===p1.packageSpecId)!.relationId),100)
 assert.equal(materialPackageVolume({lengthCm:10,widthCm:20,heightCm:30,volumeM3:null,volumeSource:'DIMENSIONS',measurementBasis:'量测'}),.006)
 assert.equal(p1.volumeM3,null)
})
test('MAT: identities approve without price; same operator; unrelated older SKU remains approved',()=>{
 const newSku=repo.createMaterialSkuRecord(baseline.records[0].materialId,{colorName:'Pink',specName:'测试规格',sizeName:'',mainUnit:'Yard',skuImageUrl:baseline.records[0].mainImageUrl,costPrice:0,freightCost:0,purchaseStandardCny:null,transportStandardCny:null,weightKg:0,lengthCm:0,widthCm:0,heightCm:0,barcode:''})!
 repo.setMaterialApproval(newSku.materialSkuId,'SUBMIT')
 repo.setMaterialApproval(newSku.materialSkuId,'APPROVE')
 assert.equal(repo.getMaterialSkuRecordById(newSku.materialSkuId)?.approvalStatus,'APPROVED')
 assert.equal(repo.getMaterialSkuRecordById(BASE)?.approvalStatus,'APPROVED')
 assert.equal(repo.getMaterialStandardCost(newSku.materialSkuId).totalStandardCny,null)
})
test('read operations never persist or mutate business snapshots',()=>{
 const before=JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),original=pcsRecordStore.setItem
 let writes=0
 pcsRecordStore.setItem=(...args)=>{writes++;return original(...args)}
 try{repo.listMaterialArchives();repo.listMaterialSkuLineage('material-r1-process-print');repo.getMaterialStandardCost('material-r1-process-print');repo.listMaterialUnitRelations(BASE);assert.equal(writes,0);assert.equal(JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),before)}finally{pcsRecordStore.setItem=original}
})

test('COST: preview normalizes the original currency exactly like confirmed save',()=>{
 const input={sourceMoney:{amount:'14000.1234',currency:'IDR',unit:'Yard',cnyPerSourceCurrency:'0.0005',normalizationBasis:'确认报价'},changeReason:'原币标准预览'}
 const projected=repo.previewMaterialCostChange(BASE,input)
 assert.equal(projected.find(x=>x.materialSkuId===BASE)?.after,8.0000617)
 assert.equal(repo.getMaterialStandardCost(BASE).totalStandardCny,6)
 repo.saveMaterialStandardCost(BASE,input)
 for(const item of projected)assert.equal(repo.getMaterialStandardCost(item.materialSkuId).totalStandardCny,item.after)
})
test('MAT: reload restores SKU identity, unit versions and changed costs from record snapshot',()=>{
 const relation=repo.saveMaterialUnitRelation(BASE,{auxUnitId:'KG',mainQtyPerAux:5,basisType:'SPECIFICATION',basisReference:'标准门幅克重换算',uses:['PURCHASE'],isDefaultForUse:['PURCHASE'],status:'ACTIVE',changeReason:'确认'})
 repo.saveMaterialStandardCost(BASE,{purchaseStandardCny:6,changeReason:'新标准'})
 repo.resetMaterialArchiveCache()
 assert.equal(repo.getMaterialSkuRecordById(BASE)?.materialSkuCode,'MAT-FB-00000001-B01')
 assert.equal(repo.getMaterialUnitFactor(BASE,'KG','Yard',relation.relationId),5)
 assert.equal(repo.getMaterialStandardCost('material-r1-process-print').totalStandardCny,9)
})
test('BRIDGE-005: one canonical target retains both dye and print with each direct predecessor',async()=>{
 const {resolveDesignRevisionMaterialSku}=await import('../src/data/pcs-design-revision-material-sku.ts')
 const sku=repo.listAllMaterialSkuRecords().find(x=>x.designRevisionProcesses?.length===2)!
 const resolved=resolveDesignRevisionMaterialSku(sku.materialSkuId)
 assert.equal(resolved.requiresDye,true);assert.equal(resolved.requiresPrint,true)
 assert.deepEqual(resolved.processStages?.map(x=>x.processType),['DYEING','PRINTING'])
 assert.equal(resolved.processStages?.[0].inputSkuId,resolved.rawSkuId)
 assert.equal(resolved.processStages?.[0].outputSkuId,resolved.dyedSkuId)
 assert.equal(resolved.processStages?.[1].inputSkuId,resolved.dyedSkuId)
 assert.equal(resolved.processStages?.[1].outputSkuId,resolved.targetSkuId)
})
test('MAT: handoff uses existing routes, revalidates parent identity and never creates a document',async()=>{
 const {materialPurchaseHandoffPath,materialProcessHandoffPath,readPcsMaterialHandoff}=await import('../src/data/pcs-material-handoff.ts')
 useReviewedProcessFixture()
 const before=JSON.stringify(repo.getMaterialArchiveStoreSnapshot())
 assert.ok(materialPurchaseHandoffPath(BASE).startsWith('/pms/material-purchase-orders?'))
 const path=materialProcessHandoffPath('material-r1-process-print')!
 assert.ok(path.startsWith('/fcs/process/material-plans/new?'))
 const context=readPcsMaterialHandoff(path.split('?')[1])!
 assert.equal(context.input?.materialSkuId,'material-r1-process-dye')
 assert.equal(context.target.materialSkuId,'material-r1-process-print')
 assert.equal(context.process?.outputSkuId,context.target.materialSkuId)
 assert.throws(()=>readPcsMaterialHandoff(path.split('?')[1].replace('inputSkuId=material-r1-process-dye','inputSkuId=wrong')),/不一致/)
 assert.ok(materialProcessHandoffPath('material-r1-process-heat').startsWith('/fcs/process/material-plans/new?'))
 assert.equal(JSON.stringify(repo.getMaterialArchiveStoreSnapshot()),before)
})
test('MAT: copying a display name alone cannot bypass existing SKU identity',()=>{
 const source=repo.getMaterialSkuRecordById(BASE)!
 assert.throws(()=>repo.createMaterialSkuRecord(source.materialId,{...source,specName:'只改展示名称'}),/身份规格已存在/)
})

test('COST/UOM: new conversion version updates current descendants but preserves prior snapshots',()=>{
 const first=repo.saveMaterialUnitRelation(BASE,{auxUnitId:'KG',mainQtyPerAux:5,basisType:'SPECIFICATION',basisReference:'确认计量关系',uses:['PRICING'],isDefaultForUse:[],status:'ACTIVE',changeReason:'初次确认'})
 const target=repo.createProcessedMaterialSku(dye({colorCode:'green',colorName:'绿色',pantoneCode:'16-0421',mainUnit:'KG',pricingUnit:'KG',unitBridgeVersionId:first.relationId,processStandardCny:.8}))
 const frozen=repo.freezeMaterialCostSnapshot(target.materialSkuId)
 assert.equal(frozen.totalStandardCny,30.8)
 const next=repo.saveMaterialUnitRelation(BASE,{...first,relationId:first.relationId,mainQtyPerAux:4,changeReason:'新标准换算'})
 assert.equal(repo.getMaterialStandardCost(target.materialSkuId).totalStandardCny,24.8)
 assert.equal(repo.readMaterialCostReference(target.materialSkuId,frozen).changed,true)
 assert.equal(repo.readMaterialCostReference(target.materialSkuId,frozen,true).totalStandardCny,30.8)
 assert.equal(repo.getMaterialUnitFactor(BASE,'KG','Yard',first.relationId),5)
 assert.throws(()=>repo.saveMaterialUnitRelation(BASE,{...next,relationId:next.relationId,status:'INACTIVE',changeReason:'停用'}),/下游/)
})

test('MAT: processed siblings retain independent identities when only packaging information changes',()=>{
 const target=repo.getMaterialSkuRecordById('material-r1-process-double')!
 const updated=repo.updateMaterialSkuRecord(target.materialSkuId,{...target,netWeightPerMainKg:.25})!
 assert.equal(updated.materialSkuId,target.materialSkuId)
 assert.equal(updated.netWeightPerMainKg,.25)
 assert.throws(()=>repo.updateMaterialSkuRecord(target.materialSkuId,{...target,patternCode:'different-pattern'}),/加工产出的交付身份/)
})

test('MAT: copied archive reuses file references, resets approval and has no copied SKU or price history',()=>{
 const source=repo.getMaterialArchiveById('material-r1-MAT-FB-00000001')!
 const asset=repo.addMaterialAsset({materialId:source.materialId,role:'SPECIFICATION',name:'受控技术文件',url:'/materials/pcs-reviewed/cotton-white.jpg',fileId:'shared-file-id'})
 const copy=repo.copyMaterialArchive(source.materialId)
 assert.notEqual(copy.materialCode,source.materialCode)
 assert.equal(copy.approvalStatus,'DRAFT')
 assert.equal(repo.listMaterialSkuRecordsByMaterialId(copy.materialId).length,0)
 const copiedAsset=repo.listMaterialAssets(copy.materialId).find(x=>x.fileId===asset.fileId)!
 assert.notEqual(copiedAsset.assetId,asset.assetId)
 assert.equal(copiedAsset.url,asset.url)
})

test('MAT/CODE: a draft root code change regenerates descendants without changing their IDs',()=>{
 const old=repo.getMaterialArchiveById('material-r1-MAT-FB-00000001')!
 const root=repo.createMaterialArchive({...old,materialCode:'TEST-ROOT',firstSku:{...repo.getMaterialSkuRecordById(BASE)!,colorName:'白色',colorCode:'white'}})
 const first=repo.listMaterialSkuRecordsByMaterialId(root.materialId)[0]
 const child=repo.createProcessedMaterialSku(dye({inputSkuId:first.materialSkuId}))
 repo.updateMaterialArchive(root.materialId,{...root,materialCode:'TEST-RENAMED'})
 assert.equal(repo.getMaterialSkuRecordById(first.materialSkuId)?.materialSkuCode,'TEST-RENAMED-B01')
 assert.equal(repo.getMaterialSkuRecordById(child.materialSkuId)?.materialSkuCode,'TEST-RENAMED-B01-black-19-4003PT')
 assert.equal(repo.getMaterialProcessDefinition(child.materialSkuId)?.inputSkuId,first.materialSkuId)
})

test('MAT-012: formal processed SKU requires real pattern/version plus the process-specific execution document',async()=>{
 const {getMaterialPatternReference,listMaterialPatternChoices}=await import('../src/data/pcs-material-pattern.ts')
 const flower=getMaterialPatternReference(listMaterialPatternChoices()[0].id)
 const target=repo.createProcessedMaterialSku(dye({processType:'PRINTING',...flower,printSide:'A',patternImageUrl:'/materials/fei-ticket/blue-white-print-cotton.png'}))
 assert.equal(repo.getMaterialProcessDefinition(target.materialSkuId)?.patternId,flower.patternId)
 assert.throws(()=>repo.setMaterialApproval(target.materialSkuId,'SUBMIT'),/执行工艺资料/)
 const wrong=repo.addMaterialAsset({materialId:target.materialId,materialSkuId:target.materialSkuId,role:'EMBROIDERY_FILE',name:'绣花资料',url:'/materials/fei-ticket/blue-white-print-cotton.png'})
 assert.throws(()=>repo.reviseMaterialProcessAssets(target.materialSkuId,[wrong.assetId],'v2'),/资料/)
 const right=repo.addMaterialAsset({materialId:target.materialId,materialSkuId:target.materialSkuId,role:'PRINT_FILE',name:'印花执行稿',url:'/materials/fei-ticket/blue-white-print-cotton.png'})
 repo.reviseMaterialProcessAssets(target.materialSkuId,[right.assetId],'v2')
 repo.setMaterialApproval(target.materialSkuId,'SUBMIT')
 repo.setMaterialApproval(target.materialSkuId,'APPROVE')
 assert.equal(repo.getMaterialSkuRecordById(target.materialSkuId)?.approvalStatus,'APPROVED')
})

test('MAT-013/CODE-005: execution-file corrections preserve prior versions and the output identity',()=>{
 const sku=repo.getMaterialSkuRecordById('material-r1-process-print')!,code=sku.materialSkuCode
 const originalExecutionIds=repo.getMaterialProcessDefinition(sku.materialSkuId)!.executionAssetIds
 const first=repo.addMaterialAsset({materialId:sku.materialId,materialSkuId:sku.materialSkuId,role:'PRINT_FILE',name:'执行资料第一版',url:'/materials/fei-ticket/blue-white-print-cotton.png'})
 const next=repo.addMaterialAsset({materialId:sku.materialId,materialSkuId:sku.materialSkuId,role:'PRINT_FILE',name:'执行资料修正版',url:'/materials/fei-ticket/blue-white-print-cotton.png'})
 repo.reviseMaterialProcessAssets(sku.materialSkuId,[first.assetId],'v1')
 assert.throws(()=>repo.reviseMaterialProcessAssets(sku.materialSkuId,[next.assetId],'v1'),/新的资料版本/)
 repo.reviseMaterialProcessAssets(sku.materialSkuId,[next.assetId],'v2')
 const definition=repo.getMaterialProcessDefinition(sku.materialSkuId)!
 assert.equal(repo.getMaterialSkuRecordById(sku.materialSkuId)?.materialSkuCode,code)
 assert.equal(definition.processVersionId,'v2')
 assert.ok(definition.documentHistory?.some(version=>version.executionAssetIds.length===1&&version.executionAssetIds[0]===first.assetId))
 assert.ok(definition.documentHistory?.some(version=>JSON.stringify(version.executionAssetIds)===JSON.stringify(originalExecutionIds)))
 assert.ok(repo.listMaterialAssets(sku.materialId).some(item=>item.assetId===first.assetId))
})
test('MAT-012: registered file previews pass image validation while temporary blobs do not',async()=>{
 const {getMaterialPatternReference,listMaterialPatternChoices}=await import('../src/data/pcs-material-pattern.ts')
 const flower=getMaterialPatternReference(listMaterialPatternChoices()[0].id)
 const file=registerPcsFile(new Blob(['image fixture'],{type:'image/png'}),'material-pattern-image-test')
 const target=repo.createProcessedMaterialSku(dye({processType:'PRINTING',...flower,printSide:'A',patternImageUrl:file.url}))
 const execution=repo.addMaterialAsset({materialId:target.materialId,materialSkuId:target.materialSkuId,role:'PRINT_FILE',name:'执行稿',url:'/materials/fei-ticket/blue-white-print-cotton.png'})
 repo.reviseMaterialProcessAssets(target.materialSkuId,[execution.assetId],'v1')
 repo.setMaterialApproval(target.materialSkuId,'SUBMIT')
 assert.equal(repo.getMaterialSkuRecordById(target.materialSkuId)?.approvalStatus,'PENDING')
 const temporary=repo.createProcessedMaterialSku(dye({processType:'PRINTING',...flower,printSide:'A',deliveryRevisionSegment:'R02',patternImageUrl:'blob:unsaved-pattern-image'}))
 assert.throws(()=>repo.setMaterialApproval(temporary.materialSkuId,'SUBMIT'),/已保存的真实展示图/)
})
test('MAT-003/UOM: output width is one field and package edits retain previous contents',()=>{
 const target=repo.createProcessedMaterialSku(dye({colorCode:'green',colorName:'绿色',pantoneCode:'16-0421',effectiveSpecValues:{widthCm:145,gramWeightGsm:185}}))
 assert.equal(target.effectiveSpecValues?.width,145)
 assert.equal(target.effectiveSpecValues?.widthCm,undefined)
 assert.equal(repo.getMaterialSkuRecordById(BASE)?.effectiveSpecValues?.width,150)
 const sku=repo.getMaterialSkuRecordById('material-r1-MAT-CS-00000001-B01')!
 const input={packageTypeId:'包',contentQty:100,contentUnitId:'PCS',grossWeightKg:null,lengthCm:null,widthCm:null,heightCm:null,volumeM3:null,volumeSource:'UNKNOWN'as const,measurementBasis:'确认含量',status:'ACTIVE'as const}
 const first=repo.saveMaterialPackageSpec(sku.materialSkuId,input)
 const second=repo.saveMaterialPackageSpec(sku.materialSkuId,{...input,packageSpecId:first.packageSpecId,contentQty:600})
 assert.equal(first.contentQty,100);assert.equal(second.contentQty,600);assert.equal(second.version,2)
 assert.equal(repo.listMaterialPackageSpecs(sku.materialSkuId,true).find(x=>x.packageSpecId===first.packageSpecId)?.status,'INACTIVE')
 assert.throws(()=>repo.saveMaterialPackageSpec(sku.materialSkuId,{...input,contentQty:100.5}),/数量精度/)
 assert.throws(()=>repo.updateMaterialSkuRecord(sku.materialSkuId,{...sku,netWeightPerMainKg:-1}),/净重/)
})
