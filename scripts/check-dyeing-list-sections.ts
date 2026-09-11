// LIST-001..009: complete named demo rows, upstream quantities and independent progress.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { listDyeWorkOrderOnlineRows, filterDyeWorkOrderOnlineRows, buildDyeWorkOrderCsv } from '../src/data/fcs/dye-work-order-online-view.ts'
import { DYE_DEMO_PARTNER_SCENARIOS, dyePartnerFields } from '../src/data/fcs/dye-work-order-demo-details.ts'
import { listWarehouseIssueOrders } from '../src/data/fcs/warehouse-material-execution.ts'
import { listFactoryReceivingSources } from '../src/data/fcs/factory-receiving.ts'
import { renderCraftDyeingWorkOrdersPage } from '../src/pages/process-factory/dyeing/work-orders.ts'

const rows = listDyeWorkOrderOnlineRows()
assert.equal(rows.length,19)
assert.equal(rows.filter(row=>row.isYarn).length,3)
for (const row of rows) {
  for (const key of ['workOrderNo','taskNo','salesType','productName','productCode','colorSku','processName','headVatOrRedye','shade','orderedAt','plannedFinishAt','receiverName','fabricReceiver'] as const) {
    assert(row[key] && !/^(—|-|尚未指定)$/.test(row[key]), `${row.dyeOrderId}: ${key}`)
  }
  if (row.sourceType !== 'STOCK') assert(row.productionOrderNo, `${row.dyeOrderId}: 生产单`)
  assert(row.inputMaterials.length)
  for (const item of row.inputMaterials) {
    assert(item.name && item.sku && item.imageUrl)
    assert(existsSync(`public${item.imageUrl}`),item.imageUrl)
  }
  if (row.isYarn) {
    assert(row.yarnQuantities?.received.length)
    for (const weights of [row.yarnQuantities!.upstream, row.yarnQuantities!.received]) {
      assert(weights.length)
      for (const weight of weights) {
        assert(Number.isInteger(weight.pcs) && weight.pcs > 0)
        assert(Number.isInteger(weight.grossGrams) && weight.grossGrams > 0)
        assert(Number.isInteger(weight.netGrams) && weight.netGrams > 0 && weight.netGrams < weight.grossGrams)
      }
    }
    assert(row.upstreamDocuments.length)
    for (const doc of row.upstreamDocuments) {
      assert(doc.name && doc.documentNo && doc.documentType && doc.status && doc.unit)
      assert(doc.plannedQty > 0 && doc.sentQty > 0)
      assert(dyePartnerFields(doc.partner).every(([,value])=>value.trim()))
    }
    assert(row.downstreamPartner && dyePartnerFields(row.downstreamPartner).every(([,value])=>value.trim()))
    assert.equal(row.receiverName,row.downstreamPartner.name)
    assert.equal(row.completedRollCount,0,'纱线完成数量不能伪装成面料卷数')
    continue
  }
  for (const doc of row.upstreamDocuments) {
    assert(doc.name && doc.documentNo && doc.documentType && doc.status && doc.unit)
    assert(Number.isFinite(doc.plannedQty) && doc.plannedQty > 0)
    assert(Number.isFinite(doc.sentQty) && doc.sentQty >= 0)
    assert(!doc.name.includes('雅加达'))
    const source = listFactoryReceivingSources().find(source=>source.documentNo===doc.documentNo)
    if (source) {
      assert.deepEqual(doc.partner,source.origin,'真实来货使用原单上游，不能沿用旧计划演示来源')
      const lines=source.lines.filter(line=>line.dyeOrderId===row.dyeOrderId && line.unit===doc.unit)
      assert(lines.length)
      assert.equal(doc.plannedQty,lines.reduce((sum,line)=>sum+line.plannedQty,0))
      assert.equal(doc.sentQty,lines.reduce((sum,line)=>sum+line.sentQty,0))
      assert(source.type==='HANDOUT'?source.handedOutAt:source.approvedAt)
      assert.equal(doc.documentType,source.type==='HANDOUT'?'加工单':source.type==='ISSUE'?'出库单':'调拨单')
      continue
    }
    assert.deepEqual(doc.partner,DYE_DEMO_PARTNER_SCENARIOS[row.dyeOrderId].upstream)
    assert(dyePartnerFields(doc.partner).every(([,value])=>value.trim()))
    if (doc.partner.kind === 'FACTORY') {
      assert.equal(doc.documentType,'加工单')
      assert(!/调拨|备料/.test(doc.status),'加工厂必须展示加工状态')
      assert(!doc.documentNo.startsWith('WL-DYE'),'不能把仓库发料单改名为加工单')
      assert.equal(row.receivedInputQty,0,'未交出的工厂演示来源不伪造接收')
      assert.equal(doc.sentQty,0)
    } else assert(['调拨单','出库单'].includes(doc.documentType))
    if (doc.documentNo.startsWith('DB-DEMO')) {
      assert.equal(doc.sentQty,0,'未执行的演示计划不能增加调拨数量')
      assert.equal(row.receivedInputQty,0)
      assert.equal(row.receiptStatus,'WAIT_SOURCE')
    } else if (['调拨单','出库单'].includes(doc.documentType)) {
      const original = listWarehouseIssueOrders().find(item=>item.docNo === doc.documentNo)!
      assert(original,'已调拨来源必须真实存在于本地演示仓库单据')
      assert.equal(doc.documentType,'出库单','原 ISSUE 保留出库单类型')
      assert.equal(original.warehouseId,doc.partner.id)
      assert.equal(original.warehouseName,doc.partner.name)
      assert.equal(doc.sentQty,original.lines.reduce((sum,line)=>sum+line.issuedQty,0))
    }
  }
  assert(row.downstreamPartner,`${row.dyeOrderId}: 下游资料`)
  assert(dyePartnerFields(row.downstreamPartner).every(([,value])=>value.trim()))
  assert.equal(row.receiverName,row.downstreamPartner.name)
  for (const key of ['preparedRollCount','completedRollCount','handedOverRollCount'] as const) assert(Number.isInteger(row[key]) && row[key] >= 0)
  assert.equal(row.completedQty > 0,row.completedRollCount > 0,`${row.dyeOrderId}: 完成卷数与完成事实`)
  assert.equal(row.handedOverQty > 0,row.handedOverRollCount > 0,`${row.dyeOrderId}: 交出卷数与交出事实`)
  assert.equal(row.preparedQty > 0,row.preparedRollCount > 0,`${row.dyeOrderId}: 备料卷数`)
}
const multi = rows.find(row=>row.inputMaterials.length > 1)!
assert(multi,'至少一个多SKU演示场景')
assert(rows.some(row=>row.isOverdue && row.isReplenishment),'超期与补料可同时出现')
assert.equal(filterDyeWorkOrderOnlineRows(rows,{keyword:multi.inputMaterials[1].sku})[0]?.dyeOrderId,multi.dyeOrderId)
const finishedNotSent = rows.find(row=>row.completedQty > 0 && row.handedOverQty === 0)!
assert(finishedNotSent)
assert.equal(finishedNotSent.processingStatus,'COMPLETED')
assert.notEqual(finishedNotSent.handoverStatus,'FULL_HANDOVER')
const html = renderCraftDyeingWorkOrdersPage()
for (const label of ['染色加工单','任务单','生产单','售卖类型','下单时间','交货时间','完成时间','交出时间','加工用料','备料数量','备料卷数','备料重量','完成数量','交出数量','损耗数量']) assert(html.includes(label),label)
assert(html.includes(multi.inputMaterials[1].sku))
assert(!html.includes('undefined') && !html.includes('NaN'))
assert(!html.includes('雅加达中心仓'))
const downstreamKinds = new Set(rows.map(row=>row.downstreamPartner!.kind === 'WAREHOUSE' ? row.downstreamPartner!.warehouseAttribute : '加工厂'))
assert.deepEqual([...downstreamKinds].sort(),['中转仓','加工厂','辅料中央仓','面料中央仓'].sort())
assert.equal(rows.filter(row=>row.upstreamDocuments.some(doc=>doc.partner.kind === 'FACTORY')).length,4)
assert(filterDyeWorkOrderOnlineRows(rows,{keyword:'印花厂'}).some(row=>row.dyeOrderId === 'DWO-002'))
assert.equal(filterDyeWorkOrderOnlineRows(rows,{keyword:'WH-FITTING-001'})[0].dyeOrderId,'DYE-WATER-PO-202603-081')
const csv = buildDyeWorkOrderCsv(rows,'全部')
assert(!csv.includes('雅加达中心仓'))
for (const term of ['工厂类型','仓库属性','面料中央仓(GKP)','辅料中央仓(GTP)','中转仓（Sea Cutting）','中转仓（新裁床）','berys konveksi']) assert(csv.includes(term),term)
assert(!csv.includes('所属工厂') && !html.includes('所属工厂'))
assert.equal(multi.inputMaterials[0].width,'150 cm')
assert.equal(multi.inputMaterials[1].width,'160 cm')
assert.equal(rows.find(row=>row.dyeOrderId === 'DYE-WATER-PO-202603-081')!.materialType,'辅料')
for (const row of rows) for (const item of row.inputMaterials) {
  assert(item.materialType && item.composition && item.width)
  if (row.isYarn) { assert.equal(item.width,'不适用（纱线）'); assert.equal(item.weightGsm,0) }
  else assert(item.weightGsm && item.weightGsm > 0)
}
for (const section of ['plan','receipt','processing','handover']) assert.equal(html.split(`data-dye-quantity-section="${section}"`).length-1,10)
console.log('PASS REFINE-001..003：仓库无所属工厂、投入产出规格齐全、独立幅宽及四段数量')
console.log('PASS PARTY-001..005：上下游资料完整、4个加工厂来源、下游4类覆盖、染色调拨同源、搜索及导出无旧仓库名')
console.log('PASS 19行资料和来源完整（含3行纱线三项数量）、多SKU搜索、上游单据发出量、卷数、独立进度及时间/数量列')

// REFINE-004..005: note-only edits must preserve execution facts and survive local reload.
const {getDyeWorkOrderOnlineRecord, updateDyeWorkOrderRemark, listDyeWorkOrderOnlineLogs, captureDyeOnlineMutationState, restoreDyeOnlineMutationState} = await import('../src/data/fcs/dye-work-order-online-domain.ts')
const snapshot = captureDyeOnlineMutationState()
const storage = new Map<string,string>()
const previousWindow = Object.getOwnPropertyDescriptor(globalThis,'window')
Object.defineProperty(globalThis,'window',{value:{localStorage:{getItem:(key:string)=>storage.get(key) ?? null,setItem:(key:string,value:string)=>storage.set(key,value)}},configurable:true})
try {
  const before = getDyeWorkOrderOnlineRecord('DWO-001')
  const logCount = listDyeWorkOrderOnlineLogs('DWO-001').length
  assert.throws(()=>updateDyeWorkOrderRemark('DWO-001','  ',before.version),/填写备注/)
  assert.throws(()=>updateDyeWorkOrderRemark('DWO-001','备注',before.version-1),/已被其他操作更新/)
  assert.equal(listDyeWorkOrderOnlineLogs('DWO-001').length,logCount)
  updateDyeWorkOrderRemark('DWO-001','按确认色样加工\n每卷标注缸号',before.version)
  const after = getDyeWorkOrderOnlineRecord('DWO-001')
  for (const key of Object.keys(before) as Array<keyof typeof before>) if (!['remark','version','updatedAt'].includes(key)) assert.deepEqual(after[key],before[key],key)
  assert.equal(after.remark,'按确认色样加工\n每卷标注缸号')
  assert.deepEqual(listDyeWorkOrderOnlineLogs('DWO-001')[0].changes.map(item=>item.field),['remark'])
  restoreDyeOnlineMutationState({records:[],logs:[],logSequence:0})
  assert.equal(getDyeWorkOrderOnlineRecord('DWO-001').remark,after.remark)
  window.localStorage.setItem = () => { throw new Error('storage full') }
  assert.throws(()=>updateDyeWorkOrderRemark('DWO-001','应保留的草稿',1),/备注未保存/)
  assert.equal(getDyeWorkOrderOnlineRecord('DWO-001').remark,after.remark)
  console.log('PASS REFINE-004..005：备注保存/刷新恢复，空白/旧版本/存储失败阻断，仅备注变化')
} finally {
  restoreDyeOnlineMutationState(snapshot)
  if (previousWindow) Object.defineProperty(globalThis,'window',previousWindow)
  else Reflect.deleteProperty(globalThis,'window')
}
