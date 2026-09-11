// Requirements: DATA-001..005, BAR-006/007/009/010/012, PRINT-001..005.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { DYE_DEMO_DETAILS, DYE_FACTORY_TABS, dyeTheoreticalWeight } from '../src/data/fcs/dye-work-order-demo-details.ts'
import { listDyeWorkOrderOnlineRows } from '../src/data/fcs/dye-work-order-online-view.ts'
import { getDyeOutputRolls, saveDyeOutputRolls, markDyeOutputRolls, getDyeOrderHandoverSummary } from '../src/data/fcs/dyeing-task-domain.ts'
import { buildDyeWorkOrderFlowCardPrintDocument, renderDyeWorkOrderFlowCardTemplate } from '../src/pages/print/templates/dye-work-order-flow-card-template.ts'
const rows = listDyeWorkOrderOnlineRows()
assert.equal(rows.length, 22)
assert.equal(rows.filter(row => row.isYarn).length, 3, '保留三个纱线毛净重演示场景')
for (const row of rows) {
  assert(DYE_DEMO_DETAILS[row.dyeOrderId], row.dyeOrderId)
  for (const key of ['productCode','productName','materialName','rawMaterialSku','colorSku','colorNo','composition','width','supplierName','purchaseOrderNo','batchNo','fabricReceiver','plannedFinishAt'] as const) assert(row[key] && !/待补|待确认|^—$/.test(String(row[key])), `${row.dyeOrderId} ${key}`)
  for (const key of ['productImageUrl','materialImageUrl','outputImageUrl','sampleImageUrl'] as const) assert(existsSync('public' + row[key]), `${row.dyeOrderId} ${key}`)
  assert(row.usageKnown, `${row.dyeOrderId} 预设实际投入有明确来源`)
  assert(!row.completedAt || row.completedAt >= row.orderedAt, `${row.dyeOrderId} 完工不得早于下单`)
  if (row.isYarn) {
    assert.equal(row.width, '不适用（纱线）')
    assert.equal(row.weightGsm, 0, '纱线不套用面料克重')
    assert.equal(getDyeOutputRolls(row.dyeOrderId).length, 0, '纱线使用整单标签，不生成面料卷码')
    assert(row.yarnQuantities?.received.length, '纱线实际接收三项数量有具体值')
  } else {
    assert(row.weightGsm && row.weightGsm > 0)
    assert(getDyeOutputRolls(row.dyeOrderId).length > 0)
  }
}
assert.deepEqual(DYE_FACTORY_TABS.slice(0,5).map(tab=>tab.label), ['全部加工厂','GTG','MJS','goto_global','测试专用工厂'])
assert.equal(dyeTheoreticalWeight(23,'Yard',150,130),4.1)
assert.equal(dyeTheoreticalWeight(660,'Yard',165,200),199.16)
assert.equal(dyeTheoreticalWeight(100,'件',150,130),null)
const normal = rows.find(row=>!row.isReplenishment)!, supplement=rows.find(row=>row.isReplenishment)!
for (const row of [normal,supplement]) {
  const html=renderDyeWorkOrderFlowCardTemplate(buildDyeWorkOrderFlowCardPrintDocument(row.dyeOrderId))
  assert.equal(html.includes('<div class="dye-flow-supplement">'),row.isReplenishment)
  assert.equal(html.includes('<div class="dye-flow-stamp">'),row.isReplenishment)
  for (const text of [row.workOrderNo,row.purchaseOrderNo,row.colorSku,row.supplierName,'备料','松布','装袋','卷支','络筒','复样','染色','脱水','开幅','烘干','定型','包装','出货']) assert(html.includes(text),text)
}
const batch = renderDyeWorkOrderFlowCardTemplate(buildDyeWorkOrderFlowCardPrintDocument(`${normal.dyeOrderId},${supplement.dyeOrderId}`))
assert.equal((batch.match(/<article class="dye-flow-card"/g)||[]).length,2)
assert(batch.includes('data-dye-flow-sequence="2"'))
const id=normal.dyeOrderId, before=JSON.stringify(getDyeOrderHandoverSummary(id)), completion=normal.completedQty
const roll=saveDyeOutputRolls(id,[{qty:23,weightKg:8.1,vatNo:'KEEP',remark:'CHECK'}]).at(-1)!
saveDyeOutputRolls(id,[{id:roll.id,remark:'CHANGED'}])
assert.equal(getDyeOutputRolls(id).at(-1)!.qty,23)
assert.equal(getDyeOutputRolls(id).at(-1)!.vatNo,'KEEP')
const snapshot=JSON.stringify(getDyeOutputRolls(id))
assert.throws(()=>saveDyeOutputRolls(id,[{qty:1},{qty:-2}]),/非负/)
assert.equal(JSON.stringify(getDyeOutputRolls(id)),snapshot)
markDyeOutputRolls(id,[roll.id],'stage');markDyeOutputRolls(id,[roll.id],'print')
assert(getDyeOutputRolls(id).at(-1)!.printedBy)
assert.equal(JSON.stringify(getDyeOrderHandoverSummary(id)),before)
assert.equal(listDyeWorkOrderOnlineRows().find(row=>row.dyeOrderId===id)!.completedQty,completion)
const code=readFileSync('src/pages/process-factory/dyeing/barcode-dialog.ts','utf8')
assert(code.includes("if(t.dataset.dyeBarcodeField==='importText'){importRows=[]"),'编辑导入文本必须清除旧预览')
console.log('PASS 22张完整资料/图片（含3张纱线）、工厂Tab、Yard换算、普通/补料/批量流程卡、条码留空保值/整体回滚/打印下架独立于加工与交接')
