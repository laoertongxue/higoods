import assert from 'node:assert/strict'
import { listDyeWorkOrderOnlineRows } from '../src/data/fcs/dye-work-order-online-view.ts'

const rows = listDyeWorkOrderOnlineRows()
assert.equal(rows.find(row => row.dyeOrderId === 'DWO-007')!.completedAt, '2026-03-28 17:00:00', '包装实际完成时间不能取单据更新时间 17:20')
console.log('PASS TIME-003: 实际加工完成时间来自包装记录')

const { buildDyeWorkOrderTimes, formatDyeTimeItem, DYE_TIME_LABELS } = await import('../src/data/fcs/dye-work-order-times.ts')
const { getDyeWorkOrderById, listDyeExecutionNodeRecords, getDyeOrderHandoverRecords } = await import('../src/data/fcs/dyeing-task-domain.ts')
const { listFactoryReceivingSources } = await import('../src/data/fcs/factory-receiving.ts')
const { filterDyeWorkOrderOnlineRows, buildDyeWorkOrderCsv } = await import('../src/data/fcs/dye-work-order-online-view.ts')
const { renderDyeWorkOrderTimes } = await import('../src/pages/process-factory/dyeing/work-order-times.ts')
type Input = Parameters<typeof buildDyeWorkOrderTimes>[0]
type Section = ReturnType<typeof buildDyeWorkOrderTimes>[number]
const point = (sections: Section[], key: string) => sections.flatMap(section => section.items).find(item => item.key === key)!
const first = rows.find(row => row.dyeOrderId === 'DWO-001')!
assert.equal(first.purchaseOrderNo, 'DEM-202603-0086')
assert.equal(point(first.timeSections, 'demandCreatedAt').events[0].at, '2026-03-13 08:00:00')
assert.equal(point(first.timeSections, 'productionCreatedAt').events[0].at, '2026-03-13 08:35:00')
assert.equal(point(first.timeSections, 'orderedAt').events[0].at, '2026-03-28 08:10:00')
const receivedOrder = rows.find(row => row.dyeOrderId === 'DWO-008')!
assert.equal(receivedOrder.completedAt, '2026-03-28 16:50:00')
assert.equal(receivedOrder.deliveredAt, '2026-03-28 17:25:00')
assert.equal(point(receivedOrder.timeSections, 'downstreamReceivedAt').events[0].at, '2026-03-28 18:10:00')
const stock = rows.find(row => row.dyeOrderId === 'DWO-013')!
assert.equal(stock.purchaseOrderNo, '备货创建')
assert.equal(formatDyeTimeItem(point(stock.timeSections, 'demandCreatedAt')), '不适用（备货创建）')
const shipped = rows.find(row => row.dyeOrderId === 'DYE-DISPATCH-DEMO-5')!
assert.equal(point(shipped.timeSections, 'dispatchCreatedAt').events[0].at, '2026-09-11 15:00:00')
assert.equal(point(shipped.timeSections, 'deliveredAt').events[0].at, '2026-09-11 15:20:00')
const draft = rows.find(row => row.dyeOrderId === 'DYE-DISPATCH-DEMO-2')!
assert.equal(point(draft.timeSections, 'dispatchCreatedAt').events.length, 1, '同一交出单挂在其他加工单上时也应按明细归属取到')
assert.equal(point(draft.timeSections, 'deliveredAt').events.length, 0)
for (const row of rows) {
  assert.deepEqual(row.timeSections.map(section => section.key), ['creation', 'receipt', 'production', 'handover'])
  for (const key of Object.keys(DYE_TIME_LABELS)) assert(formatDyeTimeItem(point(row.timeSections, key)).trim(), `${row.dyeOrderId}/${key}`)
  const html = renderDyeWorkOrderTimes(row.timeSections)
  assert.equal((html.match(/data-dye-time-section=/g) || []).length, 4)
  assert(html.includes('divide-y divide-gray-200') && !html.includes('undefined') && !html.includes('NaN'))
}

const source = structuredClone(listFactoryReceivingSources().find(source => source.lines.some(line => line.dyeOrderId === 'DWO-001'))!)
source.createdAt = '2026-09-11 08:00:00'; source.approvedAt = '2026-09-11 09:00:00'
source.lines = [source.lines.find(line => line.dyeOrderId === 'DWO-001')!]
const line = source.lines[0]
const order = structuredClone(getDyeWorkOrderById('DWO-001')!)
order.createdAt = '2026-09-11 12:00:00'
order.materialReceipts = [
  {receiptId:'RCPT-ZERO', qty:0, receiverName:'hilon', receivedAt:'2026-09-11 10:30:00', upstreamRecordId:source.id},
  {receiptId:'RCPT-1', qty:100, receiverName:'hilon', receivedAt:'2026-09-11 11:00:00', upstreamRecordId:source.id},
  {receiptId:'RCPT-2', qty:120, receiverName:'hilon', receivedAt:'2026-09-12 11:00:00', upstreamRecordId:source.id},
]
const input: Input = {order, nodes:[], handovers:[], plannedFinishAt:'2026-09-14 18:00:00', upstreamDocumentNos:[source.documentNo], materialSku:line.material.sku,
  sentQty:220,receivedQty:220,completedQty:0,handedOverQty:0,downstreamReceivedQty:0,
  context:{sources:[source],receipts:[],dispatches:[],deliveries:[{id:'DEL-1',barcode:'DLV:DEL-1',deliveredAt:'2026-09-11 10:00:00',createdBy:'仓库发货员',lines:[{id:'DEL-1-L1',sourceId:source.id,sourceLineId:line.id,qty:100,unit:line.unit,rollBarcodes:[]}]}]}}
let sections = buildDyeWorkOrderTimes(input)
assert.equal(point(sections,'pendingReceiptAt').events[0].at,source.approvedAt,'调拨待接收取审核时间，不取建单时间')
assert.equal(point(sections,'upstreamSentAt').events[0].at,'2026-09-11 10:00:00')
assert.equal(point(sections,'receivedAt').events.length,2)
assert.match(formatDyeTimeItem(point(sections,'receivedAt')),/首次 2026-09-11 11:00:00；最近 2026-09-12 11:00:00；共 2 笔/)
assert.equal(point(sections,'zeroReceiptAt').events.length,1,'零数量单列登记')
assert(point(sections,'receivedAt').events[0].at < order.createdAt,'允许收备料在先、加工单创建在后')
const detail = renderDyeWorkOrderTimes(sections,true)
assert(detail.includes('RCPT-1')&&detail.includes('RCPT-2')&&detail.includes('RCPT-ZERO'),'保留逐笔记录与时间')
const multiRow = {...first,timeSections:sections}
assert.equal(filterDyeWorkOrderOnlineRows([multiRow],{timeField:'receivedAt',startDate:'2026-09-11',endDate:'2026-09-11'}).length,1,'筛选命中首次，不只查最近')
assert.equal(filterDyeWorkOrderOnlineRows([first],{timeField:'receivedAt',endDate:'2026-09-12'}).length,0,'仅结束日期也排除无接收时间')
const zeroOnly = buildDyeWorkOrderTimes({...input,receivedQty:0,order:{...order,materialReceipts:order.materialReceipts.slice(0,1)}})
assert.equal(formatDyeTimeItem(point(zeroOnly,'receivedAt')),'尚未实际接收')
const otherLine = {...line,id:'OTHER-LINE',dyeOrderId:'DWO-002'}
const otherDelivery = {...input.context.deliveries[0],lines:[{...input.context.deliveries[0].lines[0],sourceLineId:otherLine.id}]}
assert.equal(point(buildDyeWorkOrderTimes({...input,context:{...input.context,sources:[{...source,lines:[line,otherLine]}],deliveries:[otherDelivery]}}),'upstreamSentAt').events.length,0,'同源其他物料送货不能计入本单')
const handoutSource = {...source,type:'HANDOUT' as const,approvedAt:undefined,handedOutAt:'2026-09-11 09:30:00'}
assert.equal(point(buildDyeWorkOrderTimes({...input,context:{...input.context,sources:[handoutSource],deliveries:[]}}),'pendingReceiptAt').events[0].at,'2026-09-11 09:30:00')
assert.equal(point(buildDyeWorkOrderTimes({...input,context:{...input.context,sources:[{...source,approvedAt:undefined}],deliveries:[]}}),'pendingReceiptAt').events.length,0,'审核前不产生待接收事件')

const dye = listDyeExecutionNodeRecords('DWO-007').find(node=>node.nodeCode==='DYE')!
const pack = listDyeExecutionNodeRecords('DWO-007').find(node=>node.nodeCode==='PACK')!
sections = buildDyeWorkOrderTimes({...input,nodes:[dye,pack,{...dye,nodeRecordId:dye.nodeRecordId,startedAt:'2026-09-12 12:00:00',finishedAt:'2026-09-12 13:00:00'},{...pack,nodeRecordId:pack.nodeRecordId,startedAt:'2026-09-12 14:00:00',finishedAt:'2026-09-12 15:00:00'}],completedQty:200})
assert.equal(point(sections,'completedAt').events.length,2)
assert.equal(point(sections,'completedAt').events[1].at,'2026-09-12 15:00:00','多批次加工完成用各批包装时间')
assert.equal(formatDyeTimeItem(point(buildDyeWorkOrderTimes({...input,completedQty:20}),'completedAt')),'历史时间未记录')
const missing = point(sections,'completedAt'); missing.events.push({id:'OLD-BATCH',at:'',reference:'旧包装记录'})
assert.match(formatDyeTimeItem(missing),/首次已记录.*1 笔历史时间未记录/)

const handedRecord = structuredClone(getDyeOrderHandoverRecords('DWO-008')[0])
handedRecord.taskReceipts = [{receiptId:'DOWN-1',targetTaskOrderId:'DOWN-TASK',qty:100,receiverName:'下游仓管',receivedAt:'2026-09-12 17:00:00'},{receiptId:'DOWN-2',targetTaskOrderId:'DOWN-TASK',qty:110,receiverName:'下游仓管',receivedAt:'2026-09-13 09:00:00'}]
sections=buildDyeWorkOrderTimes({...input,handovers:[handedRecord],handedOverQty:220,downstreamReceivedQty:210})
assert.equal(point(sections,'downstreamReceivedAt').events.length,2)
assert.equal(point(sections,'deliveredAt').events[0].at,handedRecord.factorySubmittedAt)
assert.equal(point(buildDyeWorkOrderTimes({...input,handovers:[{...handedRecord,handoverRecordStatus:'VOIDED'}]}),'deliveredAt').events.length,0)
for(const kind of ['全部','投入接收','超期未完结'] as const){
  const csv=buildDyeWorkOrderCsv([{...multiRow,isOverdue:true}],kind)
  assert(csv.includes('首次 2026-09-11 11:00:00；最近 2026-09-12 11:00:00；共 2 笔'))
  assert(csv.includes('零收货登记')&&csv.includes('2026-09-11 10:30:00'))
}
assert(buildDyeWorkOrderCsv([],'全部').includes('交出单创建'),'空结果仍保留完整时间表头')
console.log('PASS TIME-001..007: 四段真实时间、来源一致、两类待接收触发、分次/零收货、分批加工、备料先收、草稿/作废、下游实收、逐笔详情、日期筛选、三类导出')

for (const row of rows) {
  const time = (key: string) => point(row.timeSections, key).events.filter(event => event.at).map(event => event.at).sort()
  const demand = time('demandCreatedAt').at(-1), production = time('productionCreatedAt').at(-1)
  if (demand && production) assert(demand <= production, `${row.dyeOrderId}: 需求不晚于生产单`)
  if (production) assert(production <= row.orderedAt, `${row.dyeOrderId}: 来源生产单不晚于自动生成的染色单`)
  if (time('dyeFinishedAt').length && time('completedAt').length) assert(time('dyeFinishedAt').at(-1)! <= time('completedAt').at(-1)!, `${row.dyeOrderId}: 包装不能早于染色结束`)
}
assert.equal(point(rows.find(row=>row.dyeOrderId==='DWO-007')!.timeSections, 'upstreamSentAt').events[0].at, '2026-03-28 09:00:00', '已有出库事实不能被当作历史时间缺失')
console.log('PASS TIME-001/003: 原始演示数据时间先后与真实来源关联一致；已有仓库出库时间展示完整')
const notReceived = {...handedRecord,taskReceipts:undefined,receiverWrittenQty:0,receiverWrittenAt:undefined,warehouseWrittenQty:undefined,warehouseWrittenAt:undefined}
assert(!buildDyeWorkOrderTimes({...input,handovers:[notReceived]}).flatMap(section=>section.items).some(item=>item.key==='downstreamZeroReceiptAt'),'默认实收 0 且无登记时间，不能伪装成零收货登记')
assert.equal(point(buildDyeWorkOrderTimes({...input,handovers:[handedRecord]}),'dispatchCreatedAt').events[0].at,'','历史交出缺建单时间不能用实际交出时间填充')

const archivedMissing = buildDyeWorkOrderTimes({...input,order:{...order,completedExecutionBatches:[[{...pack,finishedAt:undefined}]]},nodes:[{...pack,finishedAt:undefined},{...pack,finishedAt:'2026-09-14 14:00:00'}],completedQty:200})
assert.equal(point(archivedMissing,'completedAt').events.length,2,'已归档批次时间缺失仍保留一笔，不与当前同编号工序合并')
assert.match(formatDyeTimeItem(point(archivedMissing,'completedAt')),/首次已记录.*1 笔历史时间未记录/)
console.log('PASS TIME-005: 同工序编号跨批复用、部分归档时间缺失、默认零值非登记')
