import test from 'node:test'
import assert from 'node:assert/strict'
import { assertTmfDyePrintContinuation } from '../../src/data/fcs/tmf-process-continuation.ts'
import type { DyeWorkOrder } from '../../src/data/fcs/dyeing-task-domain.ts'
import type { PrintWorkOrder } from '../../src/data/fcs/printing-task-domain.ts'
import type { ProductionOrderTechPackSnapshot } from '../../src/data/fcs/production-tech-pack-snapshot-types.ts'
function fixture(){
 const source={sourceType:'PRODUCTION_ORDER',productionOrderId:'P1',techPackVersionId:'V1',bomItemId:'WB'}
 const dye={dyeOrderId:'D1',sourceSnapshot:{...source,processEntryId:'D'},outputMaterial:{sku:'BLUE'},qtyUnit:'米',status:'WAIT_HANDOVER'} as DyeWorkOrder
 const print={printOrderId:'I1',sourceSnapshot:{...source,processEntryId:'I'},materialSku:'BLUE',printFactoryId:'F090',printFactoryName:'测试印花厂',qtyUnit:'米',status:'WAIT_MATERIAL'} as PrintWorkOrder
 const pack={productionOrderId:'P1',sourceTechPackVersionId:'V1',processEntries:[{id:'D',processCode:'DYE',outputObjectType:'ACCESSORY',outputInventoryForm:'CONTINUOUS',outputMaterialSkuId:'BLUE'},{id:'I',processCode:'PRINT',inputObjectType:'ACCESSORY',inputInventoryForm:'CONTINUOUS',inputMaterialSkuId:'BLUE',predecessorEntryIds:['D']}]} as ProductionOrderTechPackSnapshot
 return {dye,print,pack}
}
test('正式生产路线只关联相邻同BOM同SKU的染色→印花，不生成数量或修改来源',()=>{
 const {dye,print,pack}=fixture(),before=structuredClone({dye,print,pack})
 assert.doesNotThrow(()=>assertTmfDyePrintContinuation(dye,print,pack));assert.deepEqual({dye,print,pack},before)
})
test('跨单/版本/工序/用途/SKU/单位、缺工厂与已有其他接收单都不能接续',()=>{
 for(const change of [
  (x:ReturnType<typeof fixture>)=>{x.print.sourceSnapshot!.productionOrderId='OTHER'},
  x=>{x.print.sourceSnapshot!.techPackVersionId='OLD'},
  x=>{x.pack.processEntries[1].predecessorEntryIds=[]},
  x=>{x.pack.processEntries[1].inputInventoryForm='FINISHED_PIECES'},
  x=>{x.print.sourceSnapshot!.bomItemId='OTHER'},
  x=>{x.print.materialSku='OTHER'},
  x=>{x.print.qtyUnit='kg'},
  x=>{x.print.printFactoryId=''},
  x=>{x.dye.sourceSnapshot!.downstreamWorkOrderId='OTHER'},
  x=>{x.print.status='CANCELLED'},
  x=>{x.dye.sourceSnapshot!.sourceType='DESIGN_REVISION'},
 ]){const x=fixture();change(x);assert.throws(()=>assertTmfDyePrintContinuation(x.dye,x.print,x.pack))}
})

test('印花连续辅料仅接同版本同BOM的直接截断节点，不修改SKU和数量',async()=>{
 const {assertTmfPrintCutContinuation}=await import('../../src/data/fcs/tmf-process-continuation.ts')
 const {print,pack}=fixture()
 print.outputMaterialSku='PATTERN'
 Object.assign(pack.processEntries[1],{outputObjectType:'ACCESSORY',outputInventoryForm:'CONTINUOUS',outputMaterialSkuId:'PATTERN'})
 const spec={id:'S',bomItemId:'WB',usage:'腰带',garmentSize:'S',piecesPerGarment:1,cutLengthMm:500,finishedLengthMm:500,lengthBasis:'EXCLUDING_ENDS',toleranceMm:2,measurementCondition:'自然平放',cuttingMethod:'冷切',acceptanceRequirement:'按确认样',tippingRequired:false,endA:{method:'NONE',specification:''},endB:{method:'NONE',specification:''}}
 pack.processEntries.push({id:'CUT',processCode:'WEBBING_CUT',predecessorEntryIds:['I'],inputObjectType:'ACCESSORY',inputInventoryForm:'CONTINUOUS',inputMaterialSkuId:'PATTERN',webbingSpecifications:[spec]} as unknown as ProductionOrderTechPackSnapshot['processEntries'][number])
 const before=structuredClone({print,pack})
 assert.doesNotThrow(()=>assertTmfPrintCutContinuation(print,'CUT',pack));assert.deepEqual({print,pack},before)
 const changes:Array<(x:typeof before)=>void>=[
  x=>{x.print.sourceSnapshot!.techPackVersionId='OLD'},
  x=>{x.pack.processEntries[2].predecessorEntryIds=['D']},
  x=>{x.pack.processEntries[2].predecessorEntryIds=['I','D']},
  x=>{x.pack.processEntries[2].processCode='ELASTIC_CUT'},
  x=>{x.pack.processEntries[2].inputInventoryForm='CUT_PIECES'},
  x=>{x.print.outputMaterialSku='OTHER'},
  x=>{x.pack.processEntries[2].webbingSpecifications![0].bomItemId='OTHER'},
  x=>{x.pack.processEntries[2].webbingSpecifications![0].tippingRequired=null},
  x=>{x.print.productionTmfContinuation={cutEntryId:'OTHER',factoryId:'FAC-TMF',factoryName:'辅料厂'}},
 ]
 for(const change of changes){const x=structuredClone(before);change(x);assert.throws(()=>assertTmfPrintCutContinuation(x.print,'CUT',x.pack))}
})

test('染色来源已绑定印花时拒绝直接截断，不读取不存在的顶层字段', async () => {
 const {assertTmfDyeCutContinuation}=await import('../../src/data/fcs/tmf-process-continuation.ts')
 const {dye,pack}=fixture()
 dye.sourceSnapshot!.downstreamWorkOrderId='BOUND-PRINT'
 assert.throws(()=>assertTmfDyeCutContinuation(dye,'CUT',pack),/已绑定下游印花/)
})
