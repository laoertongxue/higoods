import { woolOrderGenerationIssues } from '../../../data/fcs/wool-domain/stage-rules.ts'
import { escapeHtml } from '../../../utils.ts'
import { productionOrders } from '../../../data/fcs/production-orders.ts'
import { productionDemands } from '../../../data/fcs/production-demands.ts'
import { buildProductionOrderLink } from '../../../data/fcs/fcs-route-links.ts'
import { getProductionOrderTechPackSnapshot } from '../../../data/fcs/production-order-tech-pack-runtime.ts'
import {
  getWoolOutputReadiness, getWoolOutputReportedQty, getWoolOutputHandedOverQty,
  getWoolHandoverEffectiveQty, getWoolProcessingStatus, getWoolWorkOrderReadinessProjection,
  woolWarehouseFlowSignedQty, type WoolWorkOrder,
} from '../../../data/fcs/wool-task-domain.ts'
import { readWoolQuerySnapshot as readWoolStore, readWoolReceivingQuerySnapshot } from '../../../data/fcs/wool-domain/queries.ts'
import { formatQty, renderKindBadge, renderStatusBadge } from './shared.ts'
import { linkingCapacity, stageReportedQty, pieceAvailableQty } from '../../../data/fcs/wool-domain/stage-rules.ts'
import { listWoolCraftTaskOrders, woolCraftOrderId } from '../../../data/fcs/wool-domain/craft-flow.ts'
import { buildSpecialCraftTaskDetailPath } from '../../../data/fcs/special-craft-operations.ts'

export type WoolPageStage = 'KNITTING' | 'LINKING'
export function woolStageLabel(stage: WoolPageStage): string { return stage === 'KNITTING' ? '横机加工单' : '缝盘加工单' }
export function woolStagePath(stage: WoolPageStage): string { return `/fcs/craft/wool/${stage === 'KNITTING' ? 'knitting-orders' : 'linking-orders'}` }
export function woolStageDetailPath(order: WoolWorkOrder): string { return `${woolStagePath(order.stage)}/${encodeURIComponent(order.woolOrderId)}` }

export function renderWoolObjectImage(url: string | undefined, label: string): string {
  if (!url) return '<span class="inline-flex h-12 w-12 shrink-0 items-center rounded border border-amber-200 px-1 text-center text-[10px] text-amber-800">真实图片待补</span>'
  return `<button type="button" class="relative h-12 w-12 shrink-0 cursor-zoom-in overflow-hidden rounded border bg-white" data-pda-image-preview-url="${escapeHtml(url)}" data-pda-image-preview-title="${escapeHtml(label)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(label)}大图"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" class="h-full w-full object-contain" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"><span class="absolute inset-0 flex items-center justify-center bg-white px-1 text-center text-[10px] text-muted-foreground">图片加载中</span></button>`
}

function field(label: string, value: string): string { return `<div class="leading-5"><span class="text-muted-foreground">${escapeHtml(label)}：</span><span class="break-words">${escapeHtml(value)}</span></div>` }
function block(title: string, body: string): string { return `<section class="space-y-1 py-2 first:pt-0 last:pb-0"><div class="font-medium text-slate-600">${escapeHtml(title)}</div>${body}</section>` }
function compact(items: string[], order: WoolWorkOrder): string { return `${items.slice(0, 2).join('')}${items.length > 2 ? `<a class="block pt-1 text-blue-700 hover:underline" href="${escapeHtml(woolStageDetailPath(order))}">查看全部 ${items.length} 项</a>` : ''}` }
function compareTimes(a: string, b: string): number { return a.replace('T', ' ').localeCompare(b.replace('T', ' ')) }
function timeRange(label: string, times: Array<string | undefined>): string {
  const valid = times.filter((time): time is string => Boolean(time?.trim())).sort(compareTimes)
  if (!times.length) return field(label, '尚未发生')
  if (!valid.length) return field(label, '时间未记录')
  return field(label, `${valid[0]}${valid.length > 1 ? ` ～ ${valid.at(-1)}（${times.length} 笔）` : ''}${valid.length < times.length ? '；部分时间未记录' : ''}`)
}

export function renderWoolOrderIdentity(order: WoolWorkOrder, expanded = false): string {
  const production = productionOrders.find(item => item.productionOrderId === order.productionOrderId)
  const paired = readWoolStore().workOrders[order.pairedWorkOrderId]
  const source = order.demoSource
    ? `<div class="rounded border border-blue-100 bg-blue-50 px-2 py-1 text-blue-800">${escapeHtml(order.demoSource.demandNo)} · ${escapeHtml(order.demoSource.label)}</div>${field('演示生产单', order.productionOrderNo)}${field('演示任务', order.taskNo)}`
    : `<a href="${escapeHtml(buildProductionOrderLink(order.productionOrderId))}" class="block rounded border border-blue-100 bg-blue-50 px-2 py-1 text-blue-800 hover:underline">${escapeHtml(production?.sourceDemandIds.join('、') || '来源需求待补充')}</a><a class="block text-blue-700 hover:underline" href="${escapeHtml(buildProductionOrderLink(order.productionOrderId))}">生产单：${escapeHtml(order.productionOrderNo)}</a><a class="block text-blue-700 hover:underline" href="/fcs/progress/board/tasks/${encodeURIComponent(order.sourceTaskId)}">任务：${escapeHtml(order.taskNo)}</a>`
  if (!expanded) return `<div class="space-y-2 text-xs"><div><a class="font-mono font-medium text-blue-700 hover:underline" href="${escapeHtml(woolStageDetailPath(order))}">${escapeHtml(order.woolOrderNo)}</a>${paired ? `<a class="ml-2 text-blue-700 hover:underline" href="${escapeHtml(woolStageDetailPath(paired))}">配对 ${escapeHtml(paired.woolOrderNo)}</a>` : ''}</div><div class="flex gap-2">${renderWoolObjectImage(order.styleImageUrl, `${order.styleNo} 款式图`)}<div class="min-w-0"><div>${escapeHtml(order.styleName)}</div><div>${escapeHtml(order.styleNo)}</div><div class="text-muted-foreground">内部款号 ${escapeHtml(order.internalStyleCode || '未维护')}</div></div></div><div>${renderKindBadge(order.kind)} · ${escapeHtml(order.factoryName)}</div>${order.demoSource ? `<div class="text-blue-800">演示需求 ${escapeHtml(order.demoSource.demandNo)}</div><div class="text-muted-foreground">${escapeHtml(order.demoSource.label)}</div><div>${escapeHtml(order.productionOrderNo)} · ${escapeHtml(order.taskNo)}</div>` : source}</div>`
  return `<div class="divide-y text-xs">${block('需求来源', source)}${block(woolStageLabel(order.stage), `<a class="font-mono font-medium text-blue-700 hover:underline" href="${escapeHtml(woolStageDetailPath(order))}">${escapeHtml(order.woolOrderNo)}</a>${paired ? `<a class="block text-blue-700 hover:underline" href="${escapeHtml(woolStageDetailPath(paired))}">配对单：${escapeHtml(paired.woolOrderNo)}</a>` : field('配对单', '配对关系缺失')}${field('承接工厂', order.factoryName)}`)}${block('商品', `<div class="flex items-start gap-2">${renderWoolObjectImage(order.styleImageUrl, `${order.styleNo} 款式图`)}<div class="min-w-0">${field('款式', order.styleName)}${field('SPU', order.styleNo)}${field('内部货号', order.internalStyleCode || '未维护')}</div></div><div class="mt-1">${renderKindBadge(order.kind)}</div>`)}</div>`
}

export function renderWoolStageInputs(order: WoolWorkOrder): string {
  const store = readWoolStore()
  const receipts = store.yarnReceipts.filter(item => item.woolOrderId === order.woolOrderId)
  if (order.stage === 'LINKING') {
    const knitting = store.workOrders[order.pairedWorkOrderId]
    const internalQty = store.internalReceipts.filter(item => item.woolOrderId === order.woolOrderId).reduce((sum, item) => sum + item.qty, 0)
    const pieces = order.externalPieces.map(piece => {
      const qty = store.pieceReceipts.filter(item => item.woolOrderId === order.woolOrderId && item.pieceKey === piece.pieceKey).reduce((sum, item) => sum + item.qty, 0)
      return `<div>${field('片', `${piece.pieceName} / ${piece.skuCode}`)}${field('末工艺厂', piece.routeNodes.at(-1)?.factoryName || '未派工')}${field('实际回货', formatQty(qty, '片'))}</div>`
    })
    return `<div class="divide-y text-xs">${block('不外发片', field('内部进度', `对应 ${internalQty} 件`) + field('来源', knitting?.woolOrderNo || order.pairedWorkOrderId))}${block('外加工片', pieces.length ? compact(pieces, order) : '<div>无外加工；随横机填报自动接收并填报。</div>')}</div>`
  }
  const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  const receiving = readWoolReceivingQuerySnapshot()
  const allocations = receiving.allocations.filter(item => item.woolOrderId === order.woolOrderId)
  const actualReceipts = receiving.receipts.filter(item => item.factoryId === order.factoryId)
  const allocatedLines = allocations.flatMap(allocation => actualReceipts.flatMap(receipt => receipt.lines.filter(line => line.id === allocation.receiptLineId).map(line => ({ receipt, line, allocation }))))
  const projection = getWoolWorkOrderReadinessProjection(order.woolOrderId)
  const sources = receiving.sources.filter(source => source.targetFactoryId === order.factoryId && source.lines.some(line => line.woolOrderId === order.woolOrderId))
  const skus = [...new Set(order.outputPlanLines.flatMap(line => line.requiredYarnSkus))]
  return `<div class="space-y-3 text-xs">${compact(skus.map(sku => {
    const lines = receipts.flatMap(receipt => receipt.lines.filter(line => line.yarnSkuCode === sku).map(line => ({ receipt, line })))
    const sourceBomIds = order.outputPlanLines.filter(line => line.requiredYarnSkus.includes(sku)).flatMap(line => line.sourceBomItemIds)
    const bom = snapshot?.bomItems.find(item => item.materialSkuId === sku || item.materialCode === sku || item.id === sku || (sourceBomIds.includes(item.id) && skus.length === 1))
    const sourceLines = sources.flatMap(source => source.lines.filter(line => line.woolOrderId === order.woolOrderId && line.material.sku === sku).map(line => ({ source, line })))
    const yarnMaterial = order.yarnMaterials?.find(item => item.sku === sku)
    const allocated = allocatedLines.filter(item => item.line.material.sku === sku)
    const name = lines[0]?.line.yarnName || sourceLines[0]?.line.material.name || allocated[0]?.line.material.name || yarnMaterial?.name || bom?.name || sku
    const qty = projection.yarnReceiptsBySku.get(sku)?.receivedQty || 0
    return `<div class="flex items-start gap-2">${renderWoolObjectImage(lines[0]?.line.imageUrl || sourceLines[0]?.line.material.imageUrl || allocated[0]?.line.material.imageUrl || yarnMaterial?.imageUrl || bom?.materialImageUrl, `${name} ${sku}`)}<div class="min-w-0">${field('纱线', name)}${field('SKU', sku)}${field('计划／交出', sourceLines.length ? `${sourceLines.reduce((sum, item) => sum + item.line.plannedQty, 0)} kg / ${sourceLines.reduce((sum, item) => sum + item.line.sentQty, 0)} kg` : '来源未记录')}${field('实收', formatQty(qty, 'kg'))}${allocated.length ? field('其中备料分配', formatQty(allocated.reduce((sum, item) => sum + item.allocation.qty, 0), 'kg')) : ''}${field('上游', [...new Set([...sourceLines.map(item => item.source.origin.name), ...allocated.map(item => item.line.origin.name)])].join('、') || '来源未记录')}${field('上游单据', [...new Set([...sourceLines.map(item => item.source.documentNo), ...lines.map(item => item.line.sourceDocumentNo), ...allocated.map(item => item.line.sourceDocumentNo)].filter(Boolean))].join('、') || '尚未形成交接')}</div></div>`
  }), order) || '<div class="text-amber-700">技术包必需纱线关系待完善</div>'}</div>`
}

export function renderWoolStageRequirements(order: WoolWorkOrder, expanded = false): string {
  const plans = order.outputPlanLines.map(line => field(`${line.colorName} / ${line.sizeCode}`, formatQty(line.plannedQty, '件')))
  return `<div class="divide-y text-xs">${block('绑定技术包', order.demoSource ? `${field('演示冻结版本', order.sourceTechPackVersionCode)}<a class="text-blue-700 hover:underline" href="${escapeHtml(woolStageDetailPath(order))}">查看本单冻结资料及片路线</a>` : `<a class="text-blue-700 hover:underline" href="${escapeHtml(buildProductionOrderLink(order.productionOrderId))}/tech-pack">查看版本 ${escapeHtml(order.sourceTechPackVersionCode)}</a>`)}${block('SKU 计划', compact(plans, order))}${block('工艺要求', order.externalPieces.length ? compact(order.externalPieces.map(piece => `<div>${field(piece.pieceName, piece.routeNodes.map(node => node.craftName).join(' → ') || '路线待明确')}${expanded ? field('纸样包', piece.patternPackageId) : ''}</div>`), order) : field('外加工片', '无外加工'))}${woolOrderGenerationIssues(order).length ? `<div class="text-amber-700">${escapeHtml(woolOrderGenerationIssues(order).join('；'))}</div>` : ''}</div>`
}

export function renderWoolStageProgress(order: WoolWorkOrder): string {
  const completed = getWoolProcessingStatus(order.woolOrderId) === 'COMPLETED'
  const readiness = order.outputPlanLines.map(line => getWoolOutputReadiness(order.woolOrderId, line.outputSkuCode))
  const handovers = readWoolStore().handovers.filter(item => item.woolOrderId === order.woolOrderId && !item.automatic)
  const received = handovers.filter(item => item.downstreamReceipt?.status === 'CONFIRMED')
  return `<div class="space-y-2 text-xs">${renderStatusBadge(getWoolProcessingStatus(order.woolOrderId))}${field(order.stage === 'KNITTING' ? '纱线种类具备开工条件' : '当前可人工缝盘', `${readiness.filter(item => order.stage === 'KNITTING' ? item.isReady : !completed && item.canReport).length}/${readiness.length} 个 SKU`)}${compact(readiness.map(item => field(item.outputSkuCode, `已加工 ${item.reportedQty} 件；还可填报 ${!completed && item.canReport ? item.remainingReportQty : 0} 件`)), order)}${field('实际交出批次', `${handovers.length} 笔`)}${field('直接下游确认', `${received.length}/${handovers.length} 笔；差异 ${received.filter(item => item.downstreamReceipt?.differenceQty).length} 笔`)}${order.stage === 'LINKING' && !order.externalPieces.length ? '<div class="text-blue-700">加工数量来自横机自动衔接</div>' : ''}</div>`
}

export function renderWoolStageOutputs(order: WoolWorkOrder): string {
  return `<div class="space-y-2 text-xs">${order.stage === 'KNITTING' ? `${field('不外发片', '内部衔接至配对缝盘单；记录对应件数')}${order.externalPieces.length ? compact(order.externalPieces.map(piece => `<div>${field('外发片', piece.pieceName)}${field('首工艺', piece.routeNodes[0]?.craftName || '路线待明确')}${field('首工艺厂', piece.routeNodes[0]?.factoryName || '待派工')}</div>`), order) : field('外发片', '无外发片；横机填报自动衔接')}` : `${field('产出', order.kind === 'WHOLE_GARMENT' ? '整件毛织产物' : '缝盘后毛织部件')}${field('最终下游', order.downstreamTarget.receiverName || '待明确接收工厂')}`}</div>`
}

export function renderWoolStageTimes(order: WoolWorkOrder, expanded = false): string {
  const store = readWoolStore()
  const reports = store.processReports.filter(item => item.woolOrderId === order.woolOrderId)
  const handovers = store.handovers.filter(item => item.woolOrderId === order.woolOrderId)
  const receiving = readWoolReceivingQuerySnapshot()
  const allocations = receiving.allocations.filter(item => item.woolOrderId === order.woolOrderId)
  const allocatedLineIds = new Set(allocations.map(item => item.receiptLineId))
  const receiptTimes = [...new Map([
    ...store.yarnReceipts.filter(item => item.woolOrderId === order.woolOrderId).map(item => [item.factoryReceiptId || item.receiptId, item.receivedAt] as const),
    ...receiving.receipts.filter(item => item.lines.some(line => allocatedLineIds.has(line.id))).map(item => [item.id, item.receivedAt] as const),
  ]).values()]
  const internal = store.internalReceipts.filter(item => item.woolOrderId === order.woolOrderId)
  const pieces = store.pieceReceipts.filter(item => item.woolOrderId === order.woolOrderId)
  if (!expanded) {
    const receivedTimes = (order.stage === 'KNITTING' ? receiptTimes : [...internal.map(item => item.receivedAt), ...pieces.map(item => item.receivedAt)]).sort(compareTimes)
    const reportTimes = reports.map(item => item.reportedAt).sort(compareTimes)
    const handedTimes = handovers.map(item => item.handedOverAt).sort(compareTimes)
    return `<div class="space-y-2 text-xs">${field('单据创建', order.createdAt || '时间未记录')}${field('上游接收', receivedTimes.at(-1) ? `最近 ${receivedTimes.at(-1)} · ${receivedTimes.length} 笔` : '尚未接收')}${field('加工生产', reportTimes.at(-1) ? `最近 ${reportTimes.at(-1)} · ${reportTimes.length} 笔` : '尚未填报')}${field('下游交出', handedTimes.at(-1) ? `最近 ${handedTimes.at(-1)} · ${handedTimes.length} 笔` : '尚未交出')}<a class="block text-blue-700 hover:underline" href="${escapeHtml(woolStageDetailPath(order))}">查看完整时间明细</a></div>`
  }
  const completion = store.completions.find(item => item.woolOrderId === order.woolOrderId)
  const production = productionOrders.find(item => item.productionOrderId === order.productionOrderId)
  const sources = receiving.sources.filter(source => source.targetFactoryId === order.factoryId && source.lines.some(line => line.woolOrderId === order.woolOrderId))
  const reportIds = new Set(reports.map(item => item.reportId))
  const events = [...reports.map(item => ({ id: item.reportId, at: item.reportedAt, qty: item.reportedQty })), ...store.qtyChangeLogs.filter(item => item.recordType === 'PROCESS_REPORT' && reportIds.has(item.recordId)).map(item => ({ id: item.recordId, at: item.changedAt, qty: item.afterQty }))].sort((a, b) => compareTimes(a.at, b.at))
  const quantities = new Map<string, number>()
  let reachedAt = ''
  for (const event of events) {
    quantities.set(event.id, event.qty)
    const reached = order.outputPlanLines.every(line => reports.filter(item => item.outputSkuCode === line.outputSkuCode).reduce((sum, item) => sum + (quantities.get(item.reportId) || 0), 0) >= line.plannedQty)
    if (!reached) reachedAt = ''
    else if (!reachedAt) reachedAt = event.at
  }
  const demandTimes = order.demoSource ? [order.demoSource.demandCreatedAt] : production?.sourceDemandIds.map(id => productionDemands.find(item => item.demandId === id)?.createdAt) || []
  return `<div class="divide-y text-xs">${block('单据创建', (demandTimes.length ? timeRange('需求单创建', demandTimes) : field('需求单创建', '时间未记录')) + field('生产单生成', order.demoSource?.productionOrderCreatedAt || production?.createdAt || '时间未记录') + field('本阶段创建', order.createdAt || '时间未记录'))}${block('上游接收', timeRange('待接收生成', sources.map(item => item.handedOutAt || item.approvedAt)) + timeRange('上游实际发出', sources.map(item => item.handedOutAt)) + (order.stage === 'KNITTING' ? timeRange('纱线实收', receiptTimes) + (allocations.length ? timeRange('备料分配到本单', allocations.map(item => item.at)) : '') : timeRange('内部自动接收', internal.map(item => item.receivedAt)) + timeRange('外厂实际回货', pieces.map(item => item.receivedAt))))}${block('加工生产', field('计划开始', order.plannedStartAt || '未排期') + field('计划完成', order.plannedCompletionAt || '未排期') + timeRange('首次／最近填报', reports.map(item => item.reportedAt)) + field('达到计划', reachedAt || '尚未达到') + field('确认完单', completion?.completedAt || '尚未完单'))}${block('下游交出', timeRange('交出单创建', handovers.map(item => item.createdAt)) + timeRange('实际交出', handovers.map(item => item.handedOverAt)) + timeRange('下游实收', handovers.filter(item => item.downstreamReceipt?.status === 'CONFIRMED').map(item => item.downstreamReceipt?.receivedAt)))}</div>`
}

export function renderWoolStageQuantities(order: WoolWorkOrder): string {
  const planned = order.outputPlanLines.reduce((sum, line) => sum + line.plannedQty, 0)
  const reported = order.outputPlanLines.reduce((sum, line) => sum + getWoolOutputReportedQty(order.woolOrderId, line.outputSkuCode), 0)
  const handed = order.outputPlanLines.reduce((sum, line) => sum + getWoolOutputHandedOverQty(order.woolOrderId, line.outputSkuCode), 0)
  const store = readWoolStore()
  const completed = store.completions.some(item => item.woolOrderId === order.woolOrderId)
  const available = completed ? 0 : order.outputPlanLines.reduce((sum, line) => { const readiness = getWoolOutputReadiness(order.woolOrderId, line.outputSkuCode); return sum + (readiness.canReport ? readiness.remainingReportQty : 0) }, 0)
  const handedByUnit = store.handovers.filter(item => item.woolOrderId === order.woolOrderId).reduce<Record<string, number>>((sum, item) => { sum[item.qtyUnit] = (sum[item.qtyUnit] || 0) + getWoolHandoverEffectiveQty(store, item); return sum }, {})
  const downstreamReceived = store.handovers.filter(item => item.woolOrderId === order.woolOrderId && !item.automatic && !item.pieceKey).reduce((sum, item) => sum + (item.downstreamReceipt?.actualReceivedQty || 0), 0)
  const pieceQty = order.stage === 'KNITTING' ? order.externalPieces.reduce((sum, piece) => sum + pieceAvailableQty(store, order, piece.pieceKey), 0) : store.pieceReceipts.filter(item => item.woolOrderId === order.woolOrderId).reduce((sum, item) => sum + item.qty, 0)
  const stockKg = store.warehouseFlows.filter(item => item.woolOrderId === order.woolOrderId && item.unit === 'kg').reduce((sum, item) => sum + woolWarehouseFlowSignedQty(item), 0)
  return `<div class="space-y-1 text-xs">${field('需求计划', formatQty(planned, '件'))}${field('累计加工', formatQty(reported, '件'))}${field(order.stage === 'KNITTING' ? '当前可填报' : '当前可人工缝盘', formatQty(available, '件'))}${order.stage === 'KNITTING' ? field('不外发片', `对应 ${reported} 件`) + field('待交外发片', formatQty(pieceQty, '片')) + field('纱线库存', formatQty(stockKg, 'kg')) : field('待最终交出', formatQty(Math.max(0, reported - handed), '件')) + field('外加工片实收', formatQty(pieceQty, '片')) + field('下游实际接收', formatQty(downstreamReceived, '件'))}${Object.entries(handedByUnit).map(([unit, qty]) => field(unit === '片' ? '外发片已交出' : order.stage === 'KNITTING' ? '内部已衔接' : '最终已交出', formatQty(qty, unit))).join('') || field('已交出', '尚未交出')}</div>`
}

export function renderWoolPieceRoutes(order: WoolWorkOrder): string {
  const store = readWoolStore()
  const knitting = order.stage === 'KNITTING' ? order : store.workOrders[order.pairedWorkOrderId]
  const linking = order.stage === 'LINKING' ? order : store.workOrders[order.pairedWorkOrderId]
  const craftOrders = listWoolCraftTaskOrders()
  return `<div class="space-y-3"><div class="rounded border bg-blue-50 p-3 text-sm">不外发片统一记录对应件数，不维护逐片名称或物理片数。只有以下已维护外加工片按技术包路线交出、加工和回货。</div>${order.externalPieces.map(piece => {
    const handovers = store.handovers.filter(item => item.woolOrderId === knitting?.woolOrderId && item.pieceKey === piece.pieceKey)
    const returned = store.pieceReceipts.filter(item => item.woolOrderId === linking?.woolOrderId && item.pieceKey === piece.pieceKey)
    const produced = knitting ? stageReportedQty(store, knitting.woolOrderId, piece.skuCode) * piece.pieceCountPerGarment : 0
    const returnedQty = returned.reduce((sum, item) => sum + item.qty, 0)
    const route = piece.routeNodes.map((node, index) => {
      const task = knitting ? craftOrders.find(item => item.taskOrderId === woolCraftOrderId(knitting, piece, node)) : undefined
      return `<li class="text-sm"><strong>${index + 1}. ${escapeHtml(node.craftName)}</strong> · ${escapeHtml(node.factoryName || '未派工')}${task ? `<a class="block text-blue-700 hover:underline" href="${escapeHtml(buildSpecialCraftTaskDetailPath({ operationId: task.operationId }, task.taskOrderId))}">${escapeHtml(task.taskOrderNo)}</a>${field('实收／加工／交出', `${task.receivedQty} 片 / ${task.completedQty} 片 / ${task.returnedQty || 0} 片`)}${field('当前待加工／待交出', `${Math.max(0, task.receivedQty - task.completedQty)} 片 / ${task.waitHandoverQty} 片`)}` : field('工艺单', '资料或派工未具备')}${field('路线节点', node.sourceEntryId)}${field('下一站', piece.routeNodes[index + 1]?.factoryName || `返回 ${linking?.woolOrderNo || order.pairedWorkOrderId}`)}</li>`
    }).join('')
    return `<article class="rounded border p-3"><div class="flex gap-3">${renderWoolObjectImage(order.styleImageUrl, `${order.styleNo} 款式图，非片实拍`)}<div class="flex-1 text-sm"><strong>${escapeHtml(piece.pieceName)}</strong>${field('SKU', piece.skuCode)}${field('纸样包／片身份', `${piece.patternPackageId} / ${piece.pieceInstanceId}`)}${field('每件用量', `${piece.pieceCountPerGarment} 片`)}${field('横机产片／首厂交出／最终回货', `${produced} 片 / ${handovers.reduce((sum, item) => sum + getWoolHandoverEffectiveQty(store, item), 0)} 片 / ${returnedQty} 片`)}${field('相对已横机加工的回货缺口', formatQty(Math.max(0, produced - returnedQty), '片'))}</div></div><ol class="mt-3 space-y-2 border-l pl-3">${route}</ol>${piece.issues.length ? `<p class="mt-2 text-amber-700">${escapeHtml(piece.issues.join('；'))}</p>` : ''}<div class="mt-2 text-xs text-muted-foreground">实际回货：${returned.map(item => `${item.qty} 片 · ${item.receivedAt} · ${item.receivedBy}`).map(escapeHtml).join('；') || '尚未回货'}</div></article>`
  }).join('') || '<div class="rounded border p-4 text-sm text-muted-foreground">该单无外加工片，横机填报后自动衔接到缝盘。</div>'}</div>`
}
