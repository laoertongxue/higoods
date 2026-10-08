import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import * as repo from '../src/data/pcs-material-archive-repository.ts'
import { listFixedMaterialConversions } from '../src/data/pcs-material-config.ts'
import { fixedMaterialFactor } from '../src/data/pcs-material-rules.ts'
import { renderPcsMaterialSkuEditPage, handlePcsMaterialArchiveEvent, handlePcsMaterialArchiveInput } from '../src/pages/pcs-material-archives.ts'
const BASE='material-r1-MAT-FB-00000001-B01', ROOT='material-r1-MAT-FB-00000001'
const baseline=repo.getMaterialArchiveBaseline()
beforeEach(()=>{pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY,JSON.stringify(baseline));repo.resetMaterialArchiveCache()})
const dye=(extra={})=>({inputSkuId:BASE,processType:'DYEING' as const,colorCode:'blue-test',colorName:'蓝色',pantoneSystem:'TCX',pantoneCode:'19-4003',skuImageUrl:'/materials/process-orders/white-black-cotton-jersey.jpg',processStandardCny:2,...extra})
test('fixed cost conversions use exactly the configuration relationships in both directions',()=>{
 for(const relation of listFixedMaterialConversions()){
  assert.equal(fixedMaterialFactor(relation.fromUnit,relation.toUnit),relation.factor)
  assert.equal(fixedMaterialFactor(relation.toUnit,relation.fromUnit),1/relation.factor)
 }
 assert.equal(fixedMaterialFactor('米','码'),1/.9144)
 assert.equal(fixedMaterialFactor('KG','Yard'),null)
})
test('automatic same-unit and fixed conversions match saved downstream standard cost',()=>{
 for(const unit of ['Yard','M']){
  const preview=repo.getMaterialCostUnitConversion(BASE,unit,'Yard')
  assert.equal(preview.kind,unit==='Yard'?'SAME':'FIXED')
  assert.equal(preview.relationId,undefined)
  const saved=repo.createProcessedMaterialSku(dye({colorCode:unit,mainUnit:unit,pricingUnit:unit}))
  const cost=repo.getMaterialStandardCost(saved.materialSkuId)
  assert.equal(cost.totalStandardCny,unit==='Yard'?8:8.5616798)
 }
})
test('SKU conversion adopts current version, reports its basis and preserves frozen costs',()=>{
 const r=repo.saveMaterialUnitRelation(BASE,{auxUnitId:'KG',mainQtyPerAux:5,basisType:'SPECIFICATION',basisReference:'确认幅宽克重标准',uses:['PRICING'],isDefaultForUse:[],status:'ACTIVE',changeReason:'维护'})
 const preview=repo.getMaterialCostUnitConversion(BASE,'KG','Yard')
 assert.equal(preview.factor,5);assert.equal(preview.relationId,r.relationId);assert.match(preview.basis,/确认幅宽克重标准/)
 const saved=repo.createProcessedMaterialSku(dye({mainUnit:'KG',pricingUnit:'KG',unitBridgeVersionId:preview.relationId}))
 const frozen=repo.freezeMaterialCostSnapshot(saved.materialSkuId)
 assert.equal(frozen.totalStandardCny,32)
 repo.saveMaterialUnitRelation(BASE,{...r,relationId:r.relationId,mainQtyPerAux:4,changeReason:'新规格'})
 assert.equal(repo.getMaterialStandardCost(saved.materialSkuId).totalStandardCny,26)
 assert.equal(repo.readMaterialCostReference(saved.materialSkuId,frozen,true).totalStandardCny,32)
})
test('missing conversion and ambiguous package are explicit, never guessed as 1:1',()=>{
 assert.equal(repo.getMaterialCostUnitConversion(BASE,'KG','Yard').kind,'MISSING')
 const common={packageTypeId:'包',contentUnitId:'Yard',grossWeightKg:null,lengthCm:null,widthCm:null,heightCm:null,volumeM3:null,volumeSource:'UNKNOWN' as const,measurementBasis:'确认每包长度',status:'ACTIVE' as const}
 repo.saveMaterialPackageSpec(BASE,{...common,contentQty:100})
 const pack=repo.saveMaterialPackageSpec(BASE,{...common,contentQty:600})
 const preview=repo.getMaterialCostUnitConversion(BASE,'包','Yard')
 assert.equal(preview.kind,'CHOICE');assert.equal(preview.factor,null)
 const relation=preview.candidates.find(r=>r.packageSpecId===pack.packageSpecId)!
 assert.equal(repo.getMaterialCostUnitConversion(BASE,'包','Yard',relation.relationId).factor,600)
})
test('process fee page removes generic relationship selector and exposes readable automatic preview',async()=>{
 renderPcsMaterialSkuEditPage('fabric',ROOT,BASE,true)
 await handlePcsMaterialArchiveEvent({closest:()=>({getAttribute:()=> 'form-tab',dataset:{value:'cost'}})} as any)
 const html=renderPcsMaterialSkuEditPage('fabric',ROOT,BASE,true)
 assert.ok(!html.includes('投入到产出的计量关系'))
 assert.ok(!html.includes('data-pcs-material-archive-field="unitBridgeVersionId"'))
 assert.match(html,/上道与本次计价单位一致，无需换算/)
 assert.match(html,/加工后综合标准成本：待补齐/)
 const old=globalThis.document
 globalThis.document={querySelector:()=>null} as any
 try{
  for(const [key,value] of [['pricingUnit','M'],['processStandardCny','2']]) handlePcsMaterialArchiveInput({closest:()=>({getAttribute:()=>key,dataset:{},value})} as any)
  const fixed=renderPcsMaterialSkuEditPage('fabric',ROOT,BASE,true)
  assert.match(fixed,/基础配置 · 固定单位换算/)
  assert.match(fixed,/加工后综合标准成本：8.5616798 元\/米/)
  handlePcsMaterialArchiveInput({closest:()=>({getAttribute:()=> 'pricingUnit',dataset:{},value:'KG'})} as any)
  const missing=renderPcsMaterialSkuEditPage('fabric',ROOT,BASE,true)
  assert.match(missing,/尚未维护可用的单位换算关系/)
  assert.match(missing,/查看投入物料计量单位/)
  assert.match(missing,/加工后综合标准成本：待补齐/)
 }finally{globalThis.document=old}
})
