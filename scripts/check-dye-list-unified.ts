import assert from 'node:assert/strict'
import { listDyeWorkOrders, completeDyeInputReceipt, getDyeExecutionNodeRecord } from '../src/data/fcs/dyeing-task-domain.ts'
import { getDyePendingReceiptQty, listDyeWorkOrderOnlineRows, getDyeWorkOrderOnlineSummary, filterDyeWorkOrderOnlineRows, buildDyeWorkOrderCsv } from '../src/data/fcs/dye-work-order-online-view.ts'
import { renderCraftDyeingWorkOrdersPage } from '../src/pages/process-factory/dyeing/work-orders.ts'
import { renderDyeWorkOrderOverlay } from '../src/pages/process-factory/dyeing/work-order-overlays.ts'
const order = listDyeWorkOrders().find(item => item.status === 'WAIT_MATERIAL' && !item.requiresWaterSoluble)!
assert(order)
completeDyeInputReceipt(order.dyeOrderId, { outputQty: 5600, receiptId: 'UNIFIED-RECEIPT', upstreamRecordId: 'UNIFIED-SOURCE', operatorName: '验收员' })
assert.equal(getDyeExecutionNodeRecord(order.dyeOrderId, 'DYE'), undefined)
const row = listDyeWorkOrderOnlineRows().find(item => item.dyeOrderId === order.dyeOrderId)!
assert.equal(row.receivedInputQty, 5600)
assert.equal(row.rawMaterialQty, 0, '已收不能当作已使用')
assert.equal(row.lossQty, 0, '已收未用不能视作损耗')
assert.equal(row.usageKnown, true)
const rows = listDyeWorkOrderOnlineRows()
assert(rows.every(item => !/^TDV[-_]/i.test(item.colorNo)), '技术包编号不冒充色号')
const filtered = filterDyeWorkOrderOnlineRows(rows, { keyword: row.rawMaterialSku })
assert(filtered.some(item => item.dyeOrderId === row.dyeOrderId), '综合查询支持物料')
assert(getDyeWorkOrderOnlineSummary(rows).unknownUsageCount === rows.filter(item => !item.usageKnown).length)
assert(buildDyeWorkOrderCsv(rows, '全部').includes('实际使用'))
const html = renderCraftDyeingWorkOrdersPage()
for (const title of ['加工单／商品','加工投入／上游','加工要求','处理进度','加工产出／下游','工厂／交期','更多筛选','全选本页','全选筛选结果']) assert(html.includes(title), title)
for (const title of ['投入来源</','三个状态</','唯一接收方</','数量进度</']) assert(!html.includes(title), title)
const detail = renderDyeWorkOrderOverlay({ type: 'view', dyeOrderId: row.dyeOrderId })
for (const title of ['UNIFIED-RECEIPT','验收员','供料记录','交接记录','确认损耗','色样待补充']) assert(detail.includes(title), title)
console.log('染色统一列表专项通过：接收5600未用/未损耗、7列、分组、筛选、未知数量汇总、逐笔记录。')
const { buildDyeWorkOrderFlowCardPrintDocument } = await import('../src/pages/print/templates/dye-work-order-flow-card-template.ts')
const printed = buildDyeWorkOrderFlowCardPrintDocument(row.dyeOrderId)
const printFields = printed.sections.flatMap(section => section.fields)
assert.equal(printFields.find(item => item.label === '实际使用')?.value, `0 ${row.qtyUnit}`)
assert.equal(printFields.find(item => item.label === '确认损耗')?.value, `0 ${row.qtyUnit}`)
assert.equal(printed.imageBlocks.find(item => item.title === '目标色样')?.imageUrl, '', '不得将投入物料图当正式色样')
assert(!JSON.stringify(printed).includes('亿程'), '不能硬编码不存在的供应商')
console.log('染色流程卡专项通过：已收未用量、确认损耗、供料方、正式色样缺失明确。')

const sampleHandover = rows.flatMap(item => item.handoverRecords)[0]
assert(sampleHandover, '需要实际交接记录覆盖待收关闭场景')
const openHandover = { ...sampleHandover, submittedQty: 800, receiverWrittenQty: 760, warehouseWrittenQty: 760, taskReceipts: [], handoverRecordStatus: sampleHandover.handoverRecordStatus, factoryDiffDecision: undefined, objectionStatus: undefined }
assert.equal(getDyePendingReceiptQty([openHandover]), 40, '800交出760实收应待收40')
assert.equal(getDyePendingReceiptQty([{ ...openHandover, factoryDiffDecision: 'ACCEPT_DIFF' }]), 0, '已接受短少差异不继续挂待收')
assert.equal(getDyePendingReceiptQty([{ ...openHandover, objectionStatus: 'RESOLVED' }]), 0, '已解决异议不继续挂待收')
assert.equal(getDyePendingReceiptQty([{ ...openHandover, handoverRecordStatus: 'VOIDED' }]), 0, '已作废交出不继续挂待收')
assert.equal(getDyePendingReceiptQty([openHandover, { ...openHandover, handoverRecordStatus: 'VOIDED' }]), 40, '混合记录仅汇总有效未收数量')
console.log('染色待收行为回归通过：800/760待收40；接受差异、解决异议、作废均归零，混合仅累计有效记录。')

const rowWithoutNext = rows.find(item => !item.downstreamLinks.length)
assert(rowWithoutNext)
const noNextDetail = renderDyeWorkOrderOverlay({type: 'view', dyeOrderId: rowWithoutNext.dyeOrderId})
assert(noNextDetail.includes('下道工序待确定'), '没有正式下道时不能从接收对象推断工序')
assert(noNextDetail.includes('接收单位'), '实际接收单位必须单独标记')
if (rowWithoutNext.receiverWarehouseName !== rowWithoutNext.receiverName) assert(noNextDetail.includes('接收仓'), '仓库与单位不同应单独展示')
for (const item of rows.filter(item => item.downstreamLinks.some(link => link.href))) {
  const linkedDetail = renderDyeWorkOrderOverlay({ type: 'view', dyeOrderId: item.dyeOrderId })
  for (const link of item.downstreamLinks.filter(link => link.href)) assert(linkedDetail.includes(`href="${link.href}"`), '正式下游链接可以打开')
}
console.log('染色上下游身份回归通过：正式下道与接收单位/仓分离，无正式关系明确待确定。')
for (const item of rows.filter(item => item.rawMaterialSku === item.materialName || /[\u4e00-\u9fff]/.test(item.rawMaterialSku))) {
  const materialDetail = renderDyeWorkOrderOverlay({type: 'view', dyeOrderId: item.dyeOrderId})
  assert(!materialDetail.includes(`${item.materialName} · ${item.rawMaterialSku}`), '中文描述或同名描述不能追加冒充物料编码')
}
console.log('染色投入身份回归通过：同名和中文描述不追加冒充编码。')
