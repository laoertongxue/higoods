import assert from 'node:assert/strict'
import test from 'node:test'
import {checkPmsMaterialRequirementPush,closePmsMaterialPurchaseOrder,getPmsMaterialPurchaseOrder,importPmsMaterialLogistics,listPmsMaterialLogisticsRecords,pushPmsMaterialRequirement,validatePmsLogisticsImportRow,preparePmsSupplierPurchaseConfirmation,type PmsLogisticsImportRow} from '../../src/data/pms/material-purchase-orders.ts'
import {listPmsMaterialRequirements} from '../../src/data/pms/material-requirements.ts'
import {createPmsFirstLegBatch,createPmsFirstLegChannel,getPmsFirstLegBatch,listPmsFirstLegBatches,listPmsFirstLegChannels,listPmsJoinableLogisticsRows,pmsAllowedBatchNextStatuses,pmsFirstLegBatchAggregate,togglePmsFirstLegCarrierStatus} from '../../src/data/pms/first-leg-logistics.ts'
import {checkPmsConfirmation,getPmsSupplierConfirmation} from '../../src/data/pms/supplier-confirmations.ts'
import {PMS_BUYER_ACTOR} from '../../src/data/pms/runtime.ts'
const unavailable=/IndexedDB|存储|数据库/
test('需求正常来源及建议量可下推；存储失败保留全部来源',async()=>{
  assert.equal(listPmsMaterialRequirements().length,3)
  const check=checkPmsMaterialRequirementPush('MREQ-0001');assert.equal(check.ok,true)
  const lines=check.pushableLines.filter(line=>line.suggestedQty>0);assert.equal(lines.length,3)
  assert.ok(lines.every(line=>Math.abs(line.suggestedQty-Math.max(0,line.bomDemand-line.stockQty-line.purchasingQty))<0.01))
  const before=structuredClone(listPmsMaterialRequirements())
  await assert.rejects(pushPmsMaterialRequirement('MREQ-0001',lines.map(line=>({lineNo:line.lineNo,actualQty:line.suggestedQty,unitPrice:12})),PMS_BUYER_ACTOR,'flow-push-unavailable'),unavailable)
  assert.deepEqual(listPmsMaterialRequirements(),before)
})
test('物流导入校验存在、唯一、日期、数量边界；整批失败不插入',async()=>{
  const base:PmsLogisticsImportRow={purchaseOrderNo:'CGF-2026-0007',company:'顺丰速运',trackingNo:'SF-UNIT-0001',shipDate:'2026-06-12',estimatedArrival:'2026-06-15',boxCount:1,rolls:1,qty:100,fee:60,remark:''}
  assert.equal(validatePmsLogisticsImportRow(base,new Set(),new Set()),'')
  assert.match(validatePmsLogisticsImportRow({...base,purchaseOrderNo:'CGF-XXXX'},new Set(),new Set()),/不存在/)
  assert.match(validatePmsLogisticsImportRow({...base,shipDate:'06/12/2026'},new Set(),new Set()),/YYYY-MM-DD/)
  assert.match(validatePmsLogisticsImportRow({...base,qty:301},new Set(),new Set()),/超过/)
  assert.match(validatePmsLogisticsImportRow(base,new Set([base.trackingNo]),new Set()),/已存在/)
  const before=structuredClone(listPmsMaterialLogisticsRecords())
  await assert.rejects(importPmsMaterialLogistics([base],PMS_BUYER_ACTOR,'flow-import-unavailable'),unavailable)
  assert.deepEqual(listPmsMaterialLogisticsRecords(),before)
})
test('头程阶段可用动作与货箱汇总；失败不改变相邻物流',async()=>{
  const batch=getPmsFirstLegBatch('FL-2026-0001')!;assert.deepEqual(pmsAllowedBatchNextStatuses(batch.status),['已装柜'])
  assert.equal(pmsFirstLegBatchAggregate(batch).boxCount,6)
  const boxed={...batch,boxes:[{boxNo:'UNIT-1',cargoType:'普通货箱' as const,weightKg:10,lengthCm:100,widthCm:50,heightCm:20,remark:'',sealed:false,items:[]}]}
  assert.deepEqual(pmsFirstLegBatchAggregate(boxed),{boxCount:1,totalWeightKg:10,totalVolumeM3:0.1,transitDays:null})
  const joinable=listPmsJoinableLogisticsRows()[0];assert.ok(joinable)
  const before=structuredClone(listPmsFirstLegBatches()),records=structuredClone(listPmsMaterialLogisticsRecords())
  await assert.rejects(createPmsFirstLegBatch({batchNo:'FL-UNIT-0001',batchName:'',carrierId:'FL-CN-001',channelId:'CH-CN-0001',transferCenter:'',destinationWarehouse:'',plannedShipDate:'2026-06-20',fee:50,remark:'',allocations:[{recordNo:joinable.record.recordNo,qty:joinable.joinableQty,rolls:joinable.joinableRolls}]},PMS_BUYER_ACTOR,'flow-batch-unavailable'),unavailable)
  assert.deepEqual(listPmsFirstLegBatches(),before);assert.deepEqual(listPmsMaterialLogisticsRecords(),records)
})
test('供应确认缺标签阻断；纯关联候选不提前发布采购单',()=>{
  const confirmation=getPmsSupplierConfirmation('CONF-2026-0001')!;assert.ok(confirmation.rolls.some(roll=>!roll.labelNo));assert.equal(checkPmsConfirmation(confirmation.confirmationNo).ok,false)
  const order=getPmsMaterialPurchaseOrder('CGF-2026-0001')!,before=structuredClone(order),candidate=preparePmsSupplierPurchaseConfirmation(order.purchaseOrderNo)
  assert.equal(candidate.supplierConfirmed,true);assert.ok(candidate.supplierConfirmedAt);assert.deepEqual(order,before)
})
test('整柜静态渠道四箱型完整；创建与启停失败不伪装成功',async()=>{
  const channel=listPmsFirstLegChannels().find(row=>row.billingMethod==='整柜')!;assert.equal(new Set(channel.containerPrices.map(row=>row.containerType)).size,4)
  const before=structuredClone(listPmsFirstLegChannels())
  await assert.rejects(createPmsFirstLegChannel({carrierId:'FL-CN-002',channelName:'测试渠道',transportMethod:'海卡',estimatedTransitDays:15,billingMethod:'整柜',unitPrice:0,currency:'RMB',taxMethod:'不报税',containerPrices:[],originPlace:'广州',destinationWarehouse:'印尼雅加达面辅料仓',remark:''},PMS_BUYER_ACTOR,'flow-channel-unavailable'),unavailable)
  await assert.rejects(togglePmsFirstLegCarrierStatus('FL-CN-004',PMS_BUYER_ACTOR,'flow-carrier-unavailable'),unavailable)
  assert.deepEqual(listPmsFirstLegChannels(),before)
})
test('关闭失败不改变采购状态和原因',async()=>{
  const order=getPmsMaterialPurchaseOrder('CGF-2026-0007')!,before=structuredClone(order)
  await assert.rejects(closePmsMaterialPurchaseOrder(order.purchaseOrderNo,'供应商产能不足',PMS_BUYER_ACTOR,'flow-close-unavailable'),unavailable)
  assert.deepEqual(order,before)
})
