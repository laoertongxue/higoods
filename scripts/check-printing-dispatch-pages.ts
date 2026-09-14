import './check-printing-factory-alignment.ts'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  renderPrintingPendingHandoverPage,
  renderPrintingHandoverDocumentsPage,
  renderPrintingDispatchPrintDocument,
  getPrintingPendingDispatchRows,
  groupPrintingDispatchSelection,
  getPrintingDispatchLines,
  getPrintingDispatchReceiptSummary,
  printingDispatchProgress,
} from '../src/pages/process-factory/printing/dispatch.ts'
import {
  listPrintingWorkOrders, createPrintingDispatch, listPrintingDispatchDocuments,
  scanPrintingDispatchRoll, confirmPrintingDispatch, receivePrintingHandover, getPrintingWorkOrderById, isPrintablePrintingRoll,
  type PrintingDispatchDocument,
} from '../src/data/fcs/printing-task-domain.ts'

const pending = renderPrintingPendingHandoverPage()
const documents = renderPrintingHandoverDocumentsPage()
for (const [name, html] of [['待交出列表', pending], ['交出单据', documents]]) {
  assert.ok(html.includes('data-standard-list-page'), `${name} 必须使用标准管理列表`)
  assert.ok(html.includes('data-standard-list-scroll'), `${name} 必须在表格内部横向滚动`)
  assert.ok(html.includes('pageSize'), `${name} 必须提供分页与每页条数`)
  assert.ok(html.includes('open-column-settings'), `${name} 必须提供独立列偏好`)
  assert.ok(html.includes('加工厂切换'), `${name} 必须可按工厂查看`)
}
assert.ok(pending.includes('是否可创建') && pending.includes('卷码准备'), '卷码缺失和已建单必须可筛选查看')
assert.ok(pending.includes('data-printing-dialog-surface'), '独立页必须保留卷码维护弹窗宿主')
assert.ok(documents.includes('扫卷与交出') && documents.includes('下游实收'), '单据列表必须区分核对、实际交出和实收')

const waiting = getPrintingPendingDispatchRows().filter(row => !row.reason && row.rolls.some(roll => isPrintablePrintingRoll(row.order, roll)))
assert.ok(waiting.length > 0, '至少有一张真实资料齐备、可创建的印花产出演示单')
const row = waiting[0]
const roll = row.rolls.find(roll => isPrintablePrintingRoll(row.order, roll))!
const key = `${row.order.workOrderId}|${roll.id}`
const groups = groupPrintingDispatchSelection([key, key])
assert.equal(groups.length, 1)
assert.equal(groups[0].rollCount, 1, '重复选择同一物理卷不能重复计入建单预览')
assert.equal(groups[0].qty, roll.lengthY)
assert.throws(() => groupPrintingDispatchSelection([`${row.order.workOrderId}|not-existing`]), /已变化|不可建单/)
const id = createPrintingDispatch(groups[0].lines, '交出页面专项核查')
const read = () => listPrintingDispatchDocuments().find(doc => doc.id === id)!
assert.equal(printingDispatchProgress(read()), '已建单待扫卷')
const occupied = getPrintingPendingDispatchRows().find(item => item.order.workOrderId === row.order.workOrderId)!
assert.ok(occupied.documentIds.includes(id), '已建单记录仍应能从待交出列表打开')
assert.ok(!occupied.rolls.some(item => item.id === roll.id), '草稿占用卷不再可选')
assert.ok(!getPrintingDispatchReceiptSummary(read()).records.length, '草稿不显示伪造下游实收')

scanPrintingDispatchRoll(id, roll.barcode, '核对人')
assert.equal(printingDispatchProgress(read()), '工厂扫齐待交接', '扫齐必须仍属于待交接')
assert.equal(read().status, '草稿')
const preview = renderPrintingDispatchPrintDocument(read())
for (const field of ['需求来源', '加工厂', '接收组织', '目标仓库', '扫齐时间', '实际交出', '尚未实际交出', 'A4 landscape']) assert.ok(preview.includes(field), `打印缺少 ${field}`)
assert.ok(preview.includes(row.order.output.imageUrl), '交出单必须携带对应产出物料图')
assert.ok(preview.includes(roll.barcode), '交出单必须携带本单实际卷码')
assert.ok(preview.includes(`${roll.lengthY.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${row.order.output.qtyUnit}`), '打印主数量必须按物理卷和本单单位展示')

confirmPrintingDispatch(id, '交出人')
assert.equal(printingDispatchProgress(read()), '已实际交出')
assert.equal(getPrintingDispatchLines(read()).length, 1)
const receipt = getPrintingDispatchReceiptSummary(read())
assert.equal(receipt.unknown, false, '新交出必须关联到自己的实收来源')
assert.equal(receipt.pending.reduce((sum, item) => sum + item.qty, 0), roll.lengthY, '本单待接收不能带上其他交出单累计数量')
assert.equal(receipt.received.reduce((sum, item) => sum + item.qty, 0), 0)
assert.ok(!renderPrintingDispatchPrintDocument(read()).includes('本单尚未实际交出'))
const rid=receipt.records[0]!.handoverRecordId||receipt.records[0]!.recordId
assert.throws(()=>receivePrintingHandover(row.order.workOrderId,{receivedQty:0,receiverName:'接收员',differenceReason:'未收到'}),/具体交出记录/)
receivePrintingHandover(row.order.workOrderId,{handoverRecordId:rid,receivedQty:0,receiverName:'接收员',differenceReason:'整批未到'})
assert.equal(getPrintingDispatchReceiptSummary(read()).received[0]?.qty??0,0)
receivePrintingHandover(row.order.workOrderId,{handoverRecordId:rid,receivedQty:roll.lengthY+1,receiverName:'接收员',differenceReason:'复测多1'})
assert.equal(getPrintingDispatchReceiptSummary(read()).received.reduce((n,r)=>n+r.qty,0),roll.lengthY+1)
assert.equal(getPrintingWorkOrderById(row.order.workOrderId)!.handover.handedOverQty,98,'零收及超收不得改变本厂交出98')
assert.equal(getPrintingWorkOrderById(row.order.workOrderId)!.handover.receivedQty,64+roll.lengthY+1,'多批按记录分别累计，保留首批64')

const synthetic: PrintingDispatchDocument = { id: 'CHECK', status: '草稿', createdAt: '', createdBy: '', lines: [{ workOrderId: 'A', barcodeIds: ['1', '2'] }], scans: [{ workOrderId: 'A', barcodeId: '1', barcode: '1', scannedAt: '', scannedBy: '核对人' }] }
assert.equal(printingDispatchProgress(synthetic), '扫卷中')
assert.equal(printingDispatchProgress({ ...synthetic, status: '已作废' }), '已作废')
const source = readFileSync(new URL('../src/pages/process-factory/printing/dispatch.ts', import.meta.url), 'utf8')
assert.ok(source.includes('appStore.navigate(paths[next])'), '旧交出入口必须进入同一独立页面')
assert.ok(source.includes('data-dispatch-overlay-surface') && !source.includes('root.innerHTML=renderBody'), '弹窗维护不得触发应用整页重绘')
assert.ok(listPrintingWorkOrders().some(order => order.workOrderId === row.order.workOrderId))
console.log('PASS printing dispatch pages: independent standard lists, roll grouping/reservation, scan vs dispatch, receipt attribution and A4 fields')
