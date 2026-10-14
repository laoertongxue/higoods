import assert from 'node:assert/strict'
import test from 'node:test'
import { installPmsMemoryIdb } from '../helpers/pms-memory-idb.ts'
import { createPmsProductPurchaseOrders, preparePmsProductPurchaseOrders, getPmsProductPurchaseOrder, listPmsProductPurchaseOrders, listPmsPurchaseProductCandidates, listPmsCoreDemoProducts, pmsProductPurchaseOrderAmount, pmsProductPurchaseOrderLineAmount, pmsProductPurchaseExportTable, updatePmsProductPurchaseOrder, performPmsProductPurchaseAction, type PmsCreatePurchaseOrderInput } from '../../src/data/pms/product-purchase-orders.ts'
import { getPublishedPurchaseMaterials } from '../../src/data/pms/canonical-purchase-references.ts'
import { PMS_BUYER_ACTOR, PmsDomainError, listPmsLogs, roundPmsQty } from '../../src/data/pms/runtime.ts'
const idb=installPmsMemoryIdb();test.after(()=>idb.restore())
const product=listPmsCoreDemoProducts()[0]
function baseInput():PmsCreatePurchaseOrderInput {const sku=product.skus[0];return {spu:product.spu,productName:product.productName,imageUrl:product.imageUrl,purchaseType:'做货',area:'印尼',supplierName:'佛山成衣加工厂',warehouse:'中央总仓-成衣仓',expectedDeliveryDate:'2026-10-30',lines:[{sku:sku.sku,color:sku.color,size:sku.size,qty:100,standardPrice:sku.price,actualPrice:31.25}]}}
test('固定采购快照补齐采购专员、首翻单和真实canonical SKU字段',()=>{const first=getPmsProductPurchaseOrder('CG-2026-0016')!;assert.ok(first);assert.equal(first.purchaser,'王采购');assert.equal(first.isUrgent,'否');assert.equal(first.isFirstOrder,'否');assert.equal(first.productionArea,'印尼');assert.equal(getPmsProductPurchaseOrder('CG-2026-0017')?.purchaser,'陈采购');assert.equal(getPmsProductPurchaseOrder('CG-2026-0019')?.isUrgent,'是');assert.equal(getPmsProductPurchaseOrder('CG-2026-0020')?.isFirstOrder,'是');const sku=listPmsPurchaseProductCandidates().find(row=>row.spu===first.spu)!.skus.find(row=>row.sku===first.lines[0].sku)!;assert.equal(first.lines[0].imageUrl,sku.imageUrl);assert.equal(first.lines[0].weight,sku.weight);assert.equal(first.lines[0].applicant,'张三');assert.equal(first.lines[0].creator,'李四');assert.equal(first.lines[0].bomNo,'');assert.equal(first.lines[0].bomStatus,first.lines[0].bomMatched?'已匹配':'未匹配');assert.ok(listPmsProductPurchaseOrders().length>=12)})
test('新建采购单原子保存采购专员、加急、首单、区域与SKU字段并回显',async()=>{const [created]=await createPmsProductPurchaseOrders([{...baseInput(),purchaser:'陈采购',isUrgent:'是',isFirstOrder:'是',productionArea:'其他',remark:'采购字段验证',lines:[{...baseInput().lines[0],qty:120,applicant:'张三',creator:'李四',weight:0.42}]}],PMS_BUYER_ACTOR,'ppo-fields');const saved=getPmsProductPurchaseOrder(created.purchaseOrderNo)!;assert.equal(saved.purchaser,'陈采购');assert.equal(saved.isUrgent,'是');assert.equal(saved.isFirstOrder,'是');assert.equal(saved.productionArea,'其他');assert.equal(saved.remark,'采购字段验证');assert.equal(saved.lines[0].bomVersion,getPublishedPurchaseMaterials(saved.spu)?.version);assert.equal(saved.lines[0].bomStatus,'已匹配');assert.equal(saved.lines[0].applicant,'张三');assert.equal(saved.lines[0].creator,'李四');assert.equal(saved.lines[0].weight,0.42);assert.ok(listPmsLogs('product-purchase-order',created.purchaseOrderNo).some(log=>log.action==='创建采购单'))})
test('省略字段使用当前SKU来源与默认值，成衣不生成BOM需求',async()=>{const [created]=await createPmsProductPurchaseOrders([baseInput()],PMS_BUYER_ACTOR,'ppo-defaults');assert.equal(created.purchaser,PMS_BUYER_ACTOR.name);assert.equal(created.isUrgent,'否');assert.equal(created.isFirstOrder,'否');assert.equal(created.productionArea,'印尼');assert.equal(created.lines[0].weight,product.skus[0].weight);const [garment]=await createPmsProductPurchaseOrders([{...baseInput(),purchaseType:'成衣',productionArea:''}],PMS_BUYER_ACTOR,'ppo-garment-defaults');assert.equal(garment.productionArea,'印尼');assert.equal(garment.lines[0].needBom,false);assert.equal(garment.lines[0].bomStatus,'未匹配');assert.equal(garment.lines[0].bomVersion,'')})
test('采购员、做货区域、非负重量校验既在纯候选也在async保存入口生效',async()=>{for(const [patch,code]of [[{purchaser:' '},'PPO_PURCHASER_REQUIRED'],[{productionArea:''},'PPO_PRODUCTION_AREA_REQUIRED'],[{lines:[{...baseInput().lines[0],weight:-0.1}]},'PPO_WEIGHT_INVALID']] as const){const input={...baseInput(),...patch};assert.throws(()=>preparePmsProductPurchaseOrders([input],PMS_BUYER_ACTOR,'invalid'),error=>error instanceof PmsDomainError&&error.code===code);await assert.rejects(createPmsProductPurchaseOrders([input],PMS_BUYER_ACTOR,'invalid-'+code),error=>error instanceof PmsDomainError&&error.code===code)}})
test('编辑保存字段与版本，非法输入阻断；事务中止不发布内存假成功',async()=>{const [created]=await createPmsProductPurchaseOrders([baseInput()],PMS_BUYER_ACTOR,'ppo-edit-source');const saved=await updatePmsProductPurchaseOrder(created.purchaseOrderNo,{purchaser:'刘采购',isUrgent:'是',isFirstOrder:'否',productionArea:'其他',lines:[{lineId:created.lines[0].lineId,qty:150,actualPrice:31.4,weight:0.4}]},PMS_BUYER_ACTOR,'ppo-edit');assert.equal(saved.purchaser,'刘采购');assert.equal(saved.isUrgent,'是');assert.equal(saved.productionArea,'其他');assert.equal(saved.version,2);assert.equal(saved.lines[0].qty,150);assert.equal(saved.lines[0].weight,0.4);assert.ok(listPmsLogs('product-purchase-order',saved.purchaseOrderNo).some(log=>log.action==='编辑采购单'));await assert.rejects(updatePmsProductPurchaseOrder(saved.purchaseOrderNo,{purchaser:' '},PMS_BUYER_ACTOR),/不能为空/);await assert.rejects(updatePmsProductPurchaseOrder(saved.purchaseOrderNo,{productionArea:''},PMS_BUYER_ACTOR),/区域/);await assert.rejects(updatePmsProductPurchaseOrder(saved.purchaseOrderNo,{lines:[{lineId:saved.lines[0].lineId,qty:150,actualPrice:31.4,weight:-1}]},PMS_BUYER_ACTOR),/重量/);idb.setFailWrites(true);try{await assert.rejects(updatePmsProductPurchaseOrder(saved.purchaseOrderNo,{remark:'未保存'},PMS_BUYER_ACTOR,'ppo-abort'));assert.notEqual(getPmsProductPurchaseOrder(saved.purchaseOrderNo)?.remark,'未保存');assert.equal(getPmsProductPurchaseOrder(saved.purchaseOrderNo)?.version,2)}finally{idb.setFailWrites(false)}})
test('新做货SKU冻结当前已发布技术包版本，缺技术包保持未匹配，不引用退休BOM对象',()=>{const matched=preparePmsProductPurchaseOrders([baseInput()],PMS_BUYER_ACTOR,'matched')[0];assert.equal(matched.lines[0].bomMatched,true);assert.equal(matched.lines[0].bomStatus,'已匹配');assert.equal(matched.lines[0].bomNo,'');assert.equal(matched.lines[0].bomVersion,getPublishedPurchaseMaterials(matched.spu)?.version);const missing=listPmsPurchaseProductCandidates().find(row=>!getPublishedPurchaseMaterials(row.spu))!;const sku=missing.skus[0];const order=preparePmsProductPurchaseOrders([{...baseInput(),spu:missing.spu,productName:missing.productName,imageUrl:missing.imageUrl,lines:[{sku:sku.sku,color:sku.color,size:sku.size,qty:10,standardPrice:sku.price,actualPrice:sku.price}]}],PMS_BUYER_ACTOR,'missing')[0];assert.equal(order.lines[0].bomMatched,false);assert.equal(order.lines[0].bomStatus,'未匹配');assert.equal(order.lines[0].bomNo,'')})
test('行金额按既有精度舍入，采购汇总严格等于逐行金额之和',async()=>{const order=getPmsProductPurchaseOrder('CG-2026-0016')!;for(const line of order.lines)assert.equal(pmsProductPurchaseOrderLineAmount(line),roundPmsQty(line.actualPrice*line.qty));assert.equal(pmsProductPurchaseOrderAmount(order),roundPmsQty(order.lines.reduce((sum,line)=>sum+pmsProductPurchaseOrderLineAmount(line),0)));const [created]=await createPmsProductPurchaseOrders([{...baseInput(),lines:product.skus.slice(0,2).map((sku,index)=>({sku:sku.sku,color:sku.color,size:sku.size,qty:index?7:3,standardPrice:sku.price,actualPrice:index?3.333:10.005}))}],PMS_BUYER_ACTOR,'amount');assert.equal(pmsProductPurchaseOrderAmount(created),roundPmsQty(created.lines.reduce((sum,line)=>sum+pmsProductPurchaseOrderLineAmount(line),0)))})

test('混币导出逐单标明原币；保存的汇率不换算原币金额，缺汇率保持空白',()=>{
  const rows=preparePmsProductPurchaseOrders([{...baseInput(),currency:'USD',exchangeRate:7.2,lines:[{...baseInput().lines[0],qty:2,actualPrice:10}]},{...baseInput(),currency:'IDR',exchangeRate:2200,lines:[{...baseInput().lines[0],qty:3,actualPrice:50000}]}],PMS_BUYER_ACTOR,'export-currencies')
  rows[1].exchangeRate=undefined
  const table=pmsProductPurchaseExportTable(rows),sku=pmsProductPurchaseExportTable(rows,true)
  assert.equal(table.rows[0][table.headers.indexOf('币种')],'USD');assert.equal(table.rows[1][table.headers.indexOf('币种')],'IDR')
  assert.equal(table.rows[0][table.headers.indexOf('采购金额（原币）')],20);assert.equal(table.rows[1][table.headers.indexOf('采购金额（原币）')],150000)
  assert.equal(table.rows[0][table.headers.indexOf('汇率')],7.2);assert.equal(table.rows[1][table.headers.indexOf('汇率')],'')
  assert.equal(sku.rows[0][sku.headers.indexOf('币种')],'USD');assert.equal(sku.rows[0][sku.headers.indexOf('采购单价（原币）')],10);assert.equal(sku.rows[1][sku.headers.indexOf('采购单价（原币）')],50000)
  assert.equal(rows[0].lines[0].actualPrice,10);assert.equal(rows[1].exchangeRate,undefined)
})

test('合并阻断不同币种或汇率，原单内容和日志保持；相同币种汇率可守恒合并',async()=>{
  const input={...baseInput(),purchaseType:'成衣' as const}
  const [cny,usd,usdOther,usdSame]=await createPmsProductPurchaseOrders([
    {...input,currency:'CNY',exchangeRate:1},
    {...input,currency:'USD',exchangeRate:7.2},
    {...input,currency:'USD',exchangeRate:7.3},
    {...input,currency:'USD',exchangeRate:7.2},
  ],PMS_BUYER_ACTOR,'merge-currency-source')
  for(const [index,pair]of [[cny,usd],[usd,usdOther]].entries()){
    const before=pair.map(row=>structuredClone(getPmsProductPurchaseOrder(row.purchaseOrderNo)))
    const logs=pair.map(row=>listPmsLogs('product-purchase-order',row.purchaseOrderNo))
    await assert.rejects(performPmsProductPurchaseAction(pair.map(row=>row.purchaseOrderNo),'合并采购单',{},PMS_BUYER_ACTOR,'merge-currency-block-'+index),error=>error instanceof PmsDomainError&&error.code==='PPO_MERGE_CURRENCY')
    assert.deepEqual(pair.map(row=>getPmsProductPurchaseOrder(row.purchaseOrderNo)),before)
    assert.deepEqual(pair.map(row=>listPmsLogs('product-purchase-order',row.purchaseOrderNo)),logs)
  }
  const saved=await performPmsProductPurchaseAction([usd.purchaseOrderNo,usdSame.purchaseOrderNo],'合并采购单',{},PMS_BUYER_ACTOR,'merge-currency-allowed')
  const merged=saved.find(row=>row.purchaseOrderNo!==usd.purchaseOrderNo&&row.purchaseOrderNo!==usdSame.purchaseOrderNo)!
  assert.equal(merged.currency,'USD');assert.equal(merged.exchangeRate,7.2)
  assert.equal(merged.lines[0].qty,200)
  assert.equal(pmsProductPurchaseOrderAmount(merged),pmsProductPurchaseOrderAmount(usd)+pmsProductPurchaseOrderAmount(usdSame))
  assert.equal(getPmsProductPurchaseOrder(usd.purchaseOrderNo)?.mergedInto,merged.purchaseOrderNo)
  assert.equal(getPmsProductPurchaseOrder(usdSame.purchaseOrderNo)?.mergedInto,merged.purchaseOrderNo)
})

test('复制和转类生成新待采购单，不继承原单审核、质检或重开入库事实', async () => {
  const [source] = await createPmsProductPurchaseOrders([{ ...baseInput(), purchaseType: '样衣' }], PMS_BUYER_ACTOR, 'copy-facts-source')
  await performPmsProductPurchaseAction([source.purchaseOrderNo], '审核采购', {}, PMS_BUYER_ACTOR, 'copy-facts-audit')
  await performPmsProductPurchaseAction([source.purchaseOrderNo], '样衣质检', { skuQty: { [source.lines[0].sku]: 100 }, remark: '已检查合格' }, PMS_BUYER_ACTOR, 'copy-facts-qc')
  await performPmsProductPurchaseAction([source.purchaseOrderNo], '开启入库', {}, PMS_BUYER_ACTOR, 'copy-facts-reopen')
  const before = structuredClone(getPmsProductPurchaseOrder(source.purchaseOrderNo))
  assert.equal(before?.qualityResult, '已检查合格')
  assert.ok(before?.auditedAt)
  assert.equal(before?.inboundReopened, true)
  for (const [index, action] of (['复制采购单', '现货采购', '样衣转做货'] as const).entries()) {
    const [copy] = await performPmsProductPurchaseAction([source.purchaseOrderNo], action, {}, PMS_BUYER_ACTOR, `copy-facts-${index}`)
    assert.equal(copy.status, '待采购')
    assert.equal(copy.qualityResult, '')
    assert.equal(copy.auditedAt, '')
    assert.equal(copy.inboundReopened, false)
    assert.equal(copy.lines[0].deliveredQty, 0)
    assert.deepEqual(getPmsProductPurchaseOrder(source.purchaseOrderNo), before)
  }
})
