import assert from 'node:assert/strict'
import test from 'node:test'
import { productionOrders } from '../../src/data/fcs/production-orders.ts'
import { listAllMaterialSkuRecords, getMaterialArchiveById } from '../../src/data/pcs-material-archive-repository.ts'
import { getDefaultQualityConfigurations } from '../../src/data/fcs/quality-management-records.ts'
import { resolveProductionInspectionSource, evaluateInitialFullInspection } from '../../src/data/fcs/quality-management-source.ts'
import type { InspectionRuleConfig } from '../../src/data/fcs/quality-management-types.ts'
const conditions=(getDefaultQualityConfigurations().find(row=>row.kind==='RULE') as InspectionRuleConfig).initialFullInspection!
test('FQ04: 20项默认面料SPU范围逐项精确，不能缩写或遗漏',()=>{
 assert.deepEqual(conditions.fabricSpuWhitelist,['CNIDML002','CNIDML018','CNIDML021','CNIDML031','CNIDML043','CNIDML003','CNIDML132','CNIDML076','CNIDML160','CNIDML030','CNIDML046','CNIDML059','CNIDML022','CNIDML328','CNIDML006','CNIDML129','CNIDML074','CNIDML347','CNIDML095','CNIDML040'])
})
test('FQ03/04: 读取生产单绑定的完整正式BOM，第9条范围外仍命中，不使用页面前8条',()=>{
 const order=productionOrders.find(row=>row.techPackSnapshot?.bomItems.length)!, original=structuredClone(order.techPackSnapshot!)
 const skus=listAllMaterialSkuRecords(),inside=skus.find(sku=>getMaterialArchiveById(sku.materialId)?.kind==='fabric')!,outside=skus.find(sku=>getMaterialArchiveById(sku.materialId)?.kind==='fabric' && sku.materialId!==inside.materialId)!
 const insideRoot=getMaterialArchiveById(inside.materialId)!,outsideRoot=getMaterialArchiveById(outside.materialId)!
 try {
  const template=original.bomItems[0]
  order.techPackSnapshot!.bomItems=Array.from({length:9},(_,i)=>({...template,id:`FORMAL-ROW-${i+1}`,type:'面料' as const,materialSkuId:i===8?outside.materialSkuId:inside.materialSkuId,materialCode:'页面展示编码不得盖过已绑定SKU'}))
  const input={productionOrderId:order.productionOrderId,taskId:'FQ-BOUND',factoryId:'FQ-FACTORY'}
  const source=resolveProductionInspectionSource(input)
  assert.equal(source.techPackVersionId,original.sourceTechPackVersionId);assert.equal(source.fabrics.length,9)
  assert.equal(source.fabrics[8].materialId,outside.materialId);assert.equal(source.fabrics[8].spu,outsideRoot.materialCode)
  const result=evaluateInitialFullInspection(source,{...conditions,basicStyle:false,highDifficulty:false,firstFactoryTasks:false,fabricSpuWhitelist:[...conditions.fabricSpuWhitelist.filter(code=>code!==outsideRoot.materialCode),insideRoot.materialCode]})
  assert.deepEqual(result.reasons.map(reason=>reason.code),['OUTSIDE_FABRIC_WHITELIST']);assert.deepEqual(result.reasons[0].fabricSpus,[outsideRoot.materialCode])
 }finally{order.techPackSnapshot=original}
})
test('FQ05: 精确根SPU/原料SKU/加工SKU同根；错误后缀及无效SKU ID不能猜前缀',()=>{
 const order=productionOrders.find(row=>row.techPackSnapshot?.bomItems.length)!, original=structuredClone(order.techPackSnapshot!)
 const skus=listAllMaterialSkuRecords(),raw=skus.find(row=>row.materialSkuCode==='CNIDML360-white-1')!,processed=skus.find(row=>row.materialSkuId==='material-r1-process-techpack-cn360-print')!
 assert.ok(raw);assert.ok(processed)
 try {
  const template=original.bomItems[0]
  order.techPackSnapshot!.bomItems=[
   {...template,id:'ROOT',type:'面料',materialCode:'CNIDML360',materialSkuId:undefined},
   {...template,id:'RAW',type:'面料',materialCode:raw.materialSkuCode,materialSkuId:raw.materialSkuId},
   {...template,id:'PROCESSED',type:'面料',materialCode:processed.materialSkuCode,materialSkuId:processed.materialSkuId},
   {...template,id:'BAD-SUFFIX',type:'面料',materialCode:'CNIDML360-white-1-never-registered',materialSkuId:undefined},
   {...template,id:'BAD-ID',type:'面料',materialCode:'CNIDML360',materialSkuId:'unregistered-id'},
   {...template,id:'ACCESSORY',type:'辅料',materialCode:'unresolved-accessory',materialSkuId:undefined},
  ]
  const source=resolveProductionInspectionSource({productionOrderId:order.productionOrderId,taskId:'FQ-MATERIAL',factoryId:'FQ-FACTORY'})
  assert.equal(source.fabrics.length,5);assert.deepEqual(source.fabrics.slice(0,3).map(row=>row.spu),['CNIDML360','CNIDML360','CNIDML360'])
  assert.deepEqual(source.fabrics.slice(3).map(row=>row.status),['UNRESOLVED','UNRESOLVED']);assert.ok(source.fabrics.slice(3).every(row=>row.spu===undefined))
 }finally{order.techPackSnapshot=original}
})
