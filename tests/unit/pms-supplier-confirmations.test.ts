import assert from 'node:assert/strict'
import test from 'node:test'
import { calculatePmsBoxVolume, getPmsSupplierConfirmation, listPmsSupplierConfirmations, generatePmsConfirmationLabels, generatePmsConfirmationRolls, summarizePmsConfirmationLabels } from '../../src/data/pms/supplier-confirmations.ts'
import { getPmsMaterialPurchaseOrder, preparePmsSupplierPurchaseConfirmation } from '../../src/data/pms/material-purchase-orders.ts'
import { renderPmsSupplierConfirmationsPage } from '../../src/pages/pms/supplier-confirmations.ts'
import { PMS_BUYER_ACTOR, listPmsLogs } from '../../src/data/pms/runtime.ts'

test('普通读取确认单不改采购单确认状态', () => {
 const order=getPmsMaterialPurchaseOrder('CGF-2026-0005')
 const before=structuredClone(order)
 const rows=listPmsSupplierConfirmations()
 assert.equal(rows.length,6)
 assert.deepEqual(getPmsMaterialPurchaseOrder('CGF-2026-0005'),before)
 assert.equal(calculatePmsBoxVolume(60,40,35),84000)
})
test('有效采购单准备确认候选，不提前发布供应商确认事实',()=>{
 const original=getPmsMaterialPurchaseOrder('CGF-2026-0001')!
 const before=structuredClone(original)
 const candidate=preparePmsSupplierPurchaseConfirmation(original.purchaseOrderNo)
 assert.equal(candidate.supplierConfirmed,true)
 assert.ok(Number.isFinite(Date.parse(candidate.supplierConfirmedAt)))
 assert.equal(candidate.orderedQty,original.orderedQty)
 assert.notEqual(candidate,original)
 assert.deepEqual(original,before)
})
test('标签都已生成但未打印时汇总为已生成，部分实打才为部分打印',()=>{
 const candidate=structuredClone(getPmsSupplierConfirmation('CONF-2026-0001')!)
 candidate.rolls.forEach((roll,index)=>{roll.labelNo=`CHECK-${index}`;roll.labelStatus='已生成';roll.printCount=0})
 assert.equal(summarizePmsConfirmationLabels(candidate),'已生成')
 candidate.rolls[0].printCount=1
 assert.equal(summarizePmsConfirmationLabels(candidate),'部分打印')
 candidate.rolls.forEach(roll=>{roll.printCount=1})
 assert.equal(summarizePmsConfirmationLabels(candidate),'已打印')
 candidate.rolls[0].printCount=2
 assert.equal(summarizePmsConfirmationLabels(candidate),'已重打')
})
test('标签保存失败不发布标签与操作日志',async()=>{
 const before=structuredClone(getPmsSupplierConfirmation('CONF-2026-0001'))
 const logs=listPmsLogs('supplier-confirmation').length
 const roll=before!.rolls.find(row=>!row.labelNo)!
 await assert.rejects(generatePmsConfirmationLabels(before!.confirmationNo,[roll.rollNo],PMS_BUYER_ACTOR,'label-save-failure'),/IndexedDB|存储|数据库/)
 assert.deepEqual(getPmsSupplierConfirmation(before!.confirmationNo),before)
 assert.equal(listPmsLogs('supplier-confirmation').length,logs)
})
test('卷号保存失败保留原包装与箱规',async()=>{
 const before=structuredClone(getPmsSupplierConfirmation('CONF-2026-0004'))
 await assert.rejects(generatePmsConfirmationRolls('CONF-2026-0004',{rollCount:5,qtyPerPackage:100,packageUnit:'卷',boxCount:2,rollNoPrefix:'FAB',metersPerRoll:100,startSequence:1},PMS_BUYER_ACTOR,'roll-save-failure'),/IndexedDB|存储|数据库/)
 assert.deepEqual(getPmsSupplierConfirmation('CONF-2026-0004'),before)
})
test('确认列表读取失败仍显示固定资料、错误及两页入口',async()=>{
 const html=await renderPmsSupplierConfirmationsPage()
 assert.match(html,/用户记录未读取/)
 assert.match(html,/CONF-2026-0001/)
 assert.match(html,/data-pms-conf-action="next-page"/)
 assert.match(html,/保存不可用/)
})
