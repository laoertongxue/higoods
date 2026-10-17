import type { StandardListColumn } from '../../../components/ui/list-table.ts'
import { getDifferenceRecordsByWorkOrderId, listProcessHandoverRecords, type ProcessHandoverRecord } from '../../../data/fcs/process-warehouse-domain.ts'
import { getSpecialCraftBindingSummaryByTaskOrderId } from '../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import { getProductionOrderTechPackSnapshot } from '../../../data/fcs/production-order-tech-pack-runtime.ts'
import { listFactoryReceipts } from '../../../data/fcs/factory-receiving.ts'
import { reviewedStyleImage } from '../../../data/pcs-reviewed-image-catalog.ts'
import { readPcsMaterialSkuIdentity } from '../../../data/pcs-material-sku-identity.ts'
import { productionOrders } from '../../../data/fcs/production-orders.ts'
import { resolveAuxiliaryWarehouseFlow } from '../../../data/fcs/special-craft-operations.ts'
import type { SpecialCraftTaskOrder } from '../../../data/fcs/special-craft-task-orders.ts'
import { readWoolQuerySnapshot } from '../../../data/fcs/wool-domain/queries.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderWoolObjectImage } from '../wool/stage-display.ts'
import { formatQty, formatSpecialCraftFactoryLabel, renderStatusBadge } from './shared.ts'

type Order = SpecialCraftTaskOrder
const field = (label: string, value: string | undefined) => `<div class="leading-5"><span class="text-muted-foreground">${escapeHtml(label)}：</span><span class="break-words">${escapeHtml(value || '未记录')}</span></div>`
const qty = (value: number | undefined, unit: string) => `${formatQty(value)} ${unit}`
const section = (key: string, html: string) => `<section class="py-3 first:pt-0 last:pb-0" data-craft-section="${key}">${html}</section>`
const group = (key: string, html: string) => `<div class="divide-y divide-gray-200 text-xs" data-craft-cell="${key}">${html}</div>`

let handoversByOrder: Map<string, ProcessHandoverRecord[]> | undefined
function handoverRecords(order: Order): ProcessHandoverRecord[] {
  if (!handoversByOrder) {
    handoversByOrder = new Map()
    for (const record of listProcessHandoverRecords()) {
      const rows = handoversByOrder.get(record.workOrderId) || []
      rows.push(record)
      handoversByOrder.set(record.workOrderId, rows)
    }
  }
  return matchingHandovers(order, handoversByOrder.get(order.taskOrderId) || [])
}
function matchingHandovers(order: Order, records: ProcessHandoverRecord[]): ProcessHandoverRecord[] {
  return [...new Map(records.filter(record => record.workOrderId === order.taskOrderId && record.qtyUnit === (order.outputUnit || order.unit) && Number.isFinite(record.handoverObjectQty) && record.handoverObjectQty >= 0 && Boolean(record.handoverAt)).map(record => [record.handoverRecordId, record])).values()]
}
export function resolveSpecialCraftHandedOverQty(order: Order, records: ProcessHandoverRecord[]): number | undefined {
  const known = order.handedOverQty ?? order.returnedQty
  if (typeof known === 'number' && Number.isFinite(known)) return known
  const matched = matchingHandovers(order, records)
  return matched.length === 1 ? matched[0].handoverObjectQty : undefined
}
export function latestSpecialCraftRecordedTime(values: Array<string | undefined>): string | undefined {
  return values.filter((value): value is string => Boolean(value) && Number.isFinite(Date.parse(value!.replace(' ', 'T'))))
    .reduce<string | undefined>((latest, value) => !latest || Date.parse(value.replace(' ', 'T')) > Date.parse(latest.replace(' ', 'T')) ? value : latest, undefined)
}

function buildContext(order: Order) {
  const production = productionOrders.find(item => item.productionOrderId === order.productionOrderId)
  const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  const wool = order.woolOrderId ? readWoolQuerySnapshot().workOrders[order.woolOrderId] : undefined
  const piece = wool?.externalPieces.find(item => item.pieceKey === order.woolPieceKey)
  const nodeIndex = piece?.routeNodes.findIndex(item => item.sourceEntryId === order.woolRouteNodeId) ?? -1
  const lines = order.demandLines || []
  const bom = snapshot?.bomItems.find(item => lines.some(line => line.sourceBomItemId && line.sourceBomItemId === item.id))
    || snapshot?.bomItems.find(item => (item.materialSkuId || item.materialCode) === order.materialSku)
  const receiptTimes = order.woolPieceKey ? listFactoryReceipts().filter(receipt => receipt.lines.some(line => line.woolCraftOrderId === order.taskOrderId)).map(receipt => receipt.receivedAt) : []
  const material = bom?.materialSkuId ? readPcsMaterialSkuIdentity(bom.materialSkuId) : null
  return { production, snapshot, wool, piece, nodeIndex, lines, bom, material, receiptTimes, handovers: handoverRecords(order) }
}

let contexts = new WeakMap<Order, ReturnType<typeof buildContext>>()
export function resetSpecialCraftDisplayContext(): void { contexts = new WeakMap(); handoversByOrder = undefined }
function context(order: Order) {
  let result = contexts.get(order)
  if (!result) { result = buildContext(order); contexts.set(order, result) }
  return result
}

function objectLabel(order: Order): string {
  return order.woolPieceKey ? '毛织片' : order.targetObject
}

export function renderSpecialCraftProductIdentity(order: Order): string {
  const { production, snapshot, wool } = context(order)
  const name = wool?.styleName || production?.demandSnapshot?.spuName || '商品名称未记录'
  const code = wool?.styleNo || production?.demandSnapshot?.spuCode || ''
  const image = wool?.styleImageUrl || snapshot?.imageSnapshot.productImages[0] || snapshot?.imageSnapshot.styleImages[0] || snapshot?.imageSnapshot.sampleImages[0] || reviewedStyleImage(code, order.fabricColor) || reviewedStyleImage(code)
  return `<div class="flex items-start gap-2">${renderWoolObjectImage(image, `${name} ${code} 商品图`)}<div class="min-w-0"><div class="font-medium">${escapeHtml(name)}</div><div class="break-all text-muted-foreground">${escapeHtml(code)}</div></div></div>`
}

export function renderSpecialCraftMaterialIdentity(order: Order): string {
  const { bom, material } = context(order)
  return bom && order.targetObject !== '成衣'
    ? `<div class="my-2 flex items-start gap-2">${renderWoolObjectImage(bom.materialImageUrl || material?.skuImageUrl, `${bom.name} ${material?.materialSkuCode || bom.materialCode || ''} 物料图`)}<div class="min-w-0">${field('投入物料', bom.name)}${material?.materialSkuCode ? field('物料 SKU', material.materialSkuCode) : field('物料编号', bom.materialCode)}</div></div>`
    : ''
}

function inputs(order: Order): string {
  const { lines, bom, wool, piece, nodeIndex } = context(order)
  let input = field('加工对象', objectLabel(order))
  if (bom && order.targetObject !== '成衣') input += renderSpecialCraftMaterialIdentity(order)
  else if (order.woolPieceKey) input += field('毛织 SKU', piece?.skuCode)
  else if (order.materialSku) input += field('投入 SKU', order.materialSku)
  const identities = [...new Set(lines.map(line => [line.partName, line.colorName, line.sizeCode].filter(Boolean).join(' / ')))].filter(Boolean)
  input += identities.length ? identities.map(text => field('部位／颜色／尺码', text)).join('') : field('部位／颜色／尺码', [order.partName, order.fabricColor, order.sizeCode].filter(Boolean).join(' / '))
  if (order.quantityMode === 'TICKET_INPUT_OUTPUT') input += field('捆条菲票', (order.buttonLoopInputLines || []).map(line => line.feiTicketNo).join('、') || order.feiTicketNos.join('、'))
  else if (!order.woolPieceKey && order.feiTicketNos.length) input += field('关联菲票', order.feiTicketNos.join('、'))
  const previous = piece && nodeIndex > 0 ? piece.routeNodes[nodeIndex - 1] : undefined
  const upstream = order.woolPieceKey
    ? (previous?.factoryName || wool?.factoryName)
    : order.sourceFactoryName || resolveAuxiliaryWarehouseFlow(order.targetObject).sourceObjectName
  const source = order.woolPieceKey ? '毛织片路线' : '供料来源'
  const documents = order.warehouseLinks.filter(link => link.warehouseKind === '待加工仓' && link.inboundRecordNo).map(link => link.inboundRecordNo!)
  return group('inputs', section('input', input) + section('upstream', field('上游', upstream) + field('来源依据', source) + (documents.length ? field('接收记录', [...new Set(documents)].join('、')) : '')))
}

function requirements(order: Order): string {
  const { lines } = context(order)
  const length = order.fixedLengthCm ?? lines.find(line => line.fixedLengthCm)?.fixedLengthCm
  return group('requirements', section('requirement', field('工艺', order.operationName) + field('作用对象', objectLabel(order)) + field('技术包版本', order.techPackVersion) + (length ? field('定长要求', `${length} cm`) : '') + (order.outputQtyPerGarment ? field('每件产出', qty(order.outputQtyPerGarment, order.outputUnit || order.unit)) : '') + (order.quantityMode === 'TICKET_INPUT_OUTPUT' ? field('计量要求', '投入按菲票张数；盘扣产出按个') : '') + (order.remark ? field('备注', order.remark) : '')))
}

function progress(order: Order): string {
  const records = getDifferenceRecordsByWorkOrderId(order.taskOrderId)
  const unresolved = records.filter(record => !['已关闭', '已确认差异'].includes(record.status)).length
  let flow = ''
  if (!order.woolPieceKey && order.targetObject !== '成衣' && order.quantityMode !== 'MATERIAL_INPUT_OUTPUT' && order.feiTicketNos.length) {
    const summary = getSpecialCraftBindingSummaryByTaskOrderId(order.taskOrderId)
    flow = field('关联菲票', `${summary.linkedFeiTicketCount} 张`) + field('已发料／已回仓菲票', `${summary.dispatchedFeiTicketCount} / ${summary.returnedFeiTicketCount} 张`) + field('回仓状态', summary.returnStatus)
  }
  return group('progress', section('status', renderStatusBadge(order.status) + field('派工', order.assignmentStatusLabel || (order.factoryId ? '已分配' : '待分配'))) + section('flow', (order.woolPieceKey ? field('交接方式', '按毛织片实际交出批次接收') : flow) + field('差异', records.length ? `${records.length} 条，待处理 ${unresolved} 条` : '无差异')))
}

function outputs(order: Order): string {
  const { wool, piece, nodeIndex, handovers } = context(order)
  const next = piece && nodeIndex >= 0 ? piece.routeNodes[nodeIndex + 1] : undefined
  const destination = order.woolPieceKey
    ? (next ? `${next.craftName} / ${next.factoryName || '待派工'}` : `缝盘 / ${wool?.factoryName || '待明确工厂'}`)
    : order.receiverWarehouseName || resolveAuxiliaryWarehouseFlow(order.targetObject).receiverWarehouseName
  const label = order.quantityMode === 'TICKET_INPUT_OUTPUT' ? '盘扣' : order.quantityMode === 'MATERIAL_INPUT_OUTPUT' ? '布包扣' : order.operationId === 'SPC-OP-ELASTIC-FIXED-LENGTH-CUTTING' ? '定长橡筋' : objectLabel(order)
  const records = order.warehouseLinks.filter(link => link.warehouseKind === '待交出仓' && link.handoverRecordNo).map(link => link.handoverRecordNo!)
  return group('outputs', section('output', field('加工产出', label) + field('产出单位', order.outputUnit || order.unit) + (order.fabricColor ? field('颜色', order.fabricColor) : '') + (order.sizeCode ? field('尺码', order.sizeCode) : '')) + section('downstream', field('交出去向', destination) + (handovers.length ? handovers.map(record => field('交出记录', `${record.handoverRecordNo} / ${qty(record.handoverObjectQty, record.qtyUnit)} / ${record.status}`)).join('') : records.length ? field('交出记录', [...new Set(records)].join('、')) : '')))
}

function times(order: Order): string {
  const records = order.nodeRecords
  const woolRecords = order.woolPieceKey ? readWoolQuerySnapshot().craftRecords.filter(item => item.taskOrderId === order.taskOrderId) : []
  const last = (pattern: RegExp) => latestSpecialCraftRecordedTime(records.filter(item => pattern.test(item.actionName)).map(item => item.operatedAt))
  const {handovers, receiptTimes} = context(order)
  return group('times', section('planned-time', field('建单时间', order.createdAt) + field('计划完成', order.dueAt)) + section('actual-time', field('最近接收', latestSpecialCraftRecordedTime([...receiptTimes, last(/^(接收确认|确认接收|收货)/)])) + field('最近完工登记', latestSpecialCraftRecordedTime([...woolRecords.filter(item => item.action === 'PROCESS_REPORT').map(item => item.operatedAt), last(/完工|加工填报/)])) + field('最近交出', latestSpecialCraftRecordedTime([...woolRecords.filter(item => item.action === 'HANDOVER').map(item => item.operatedAt), ...handovers.map(item => item.handoverAt), last(/^(发起交出|确认交出|交出登记)$/)])) + field('最近下游实收', latestSpecialCraftRecordedTime([...handovers.map(item => item.receiveAt), last(/^交出接收$/)])) + field('最近更新', order.updatedAt)))
}

export function renderSpecialCraftQuantities(order: Order): string {
  const handovers = context(order).handovers
  const handedOver = resolveSpecialCraftHandedOverQty(order, handovers)
  const handoverText = handedOver !== undefined ? qty(handedOver, order.outputUnit || order.unit) : handovers.length > 1 ? '汇总未记录' : '未记录'
  const inputUnit = order.inputUnit || order.unit
  const outputUnit = order.outputUnit || order.unit
  const ticket = order.quantityMode === 'TICKET_INPUT_OUTPUT'
  const converted = ticket || order.quantityMode === 'MATERIAL_INPUT_OUTPUT' || inputUnit !== outputUnit
  const input = ticket
    ? field('计划投入菲票', qty(order.inputTicketCount ?? order.planQty, '张')) + field('已接收菲票', qty(order.receivedTicketCount, '张')) + field('投入长度 (追溯)', qty(order.inputLengthM, '米'))
    : field('计划投入', qty(converted ? order.inputPlannedQty : order.planQty, inputUnit)) + field('实收投入', qty(converted ? order.inputReceivedQty : order.receivedQty, inputUnit))
  return group('quantities', section('input-quantity', input) + section('output-quantity', (ticket ? '' : field('计划产出', qty(order.planQty, outputUnit))) + field('完成产出', qty(ticket ? order.outputQty : order.completedQty, outputUnit)) + field('损耗', qty(order.lossQty, outputUnit)) + field('损坏', qty(order.damageQty, outputUnit))) + section('handover-quantity', field('已交出', handoverText) + field('待交出', qty(order.waitHandoverQty, outputUnit))))
}

export function createSpecialCraftDisplayColumns(renderDetail: (order: Order) => string): StandardListColumn<Order>[] {
  return [
    { key: 'order', title: '加工单／商品', width: 260, required: true, freezeable: true, sortable: true, sortValue: order => order.taskOrderNo,
      render: order => group('order', section('documents', field('加工厂', formatSpecialCraftFactoryLabel(order.factoryName, order.factoryId)) + `<div class="rounded border border-blue-100 bg-blue-50 px-2 py-1 text-blue-800">${field('需求来源', order.sourceTriggerLabel || order.generationSourceLabel || (order.woolPieceKey ? '毛织片技术包路线' : '生产单生成'))}</div><div class="leading-5">${escapeHtml(order.operationName)}加工单：${renderDetail(order)}</div>` + field('任务单', order.sourceTaskNo) + field('生产单', order.productionOrderNo)) + section('product', renderSpecialCraftProductIdentity(order))) },
    { key: 'inputs', title: '加工投入／上游', width: 270, required: true, freezeable: true, render: inputs },
    { key: 'requirements', title: '加工要求', width: 230, freezeable: true, render: requirements },
    { key: 'progress', title: '处理进度', width: 220, required: true, freezeable: true, sortable: true, sortValue: order => order.status, render: progress },
    { key: 'outputs', title: '加工产出／下游', width: 240, freezeable: true, render: outputs },
    { key: 'times', title: '时间', width: 250, freezeable: true, sortable: true, sortValue: order => order.dueAt, render: times },
    { key: 'quantities', title: '数量', width: 210, required: true, freezeable: true, sortable: true, sortValue: order => order.planQty, render: renderSpecialCraftQuantities },
  ]
}
