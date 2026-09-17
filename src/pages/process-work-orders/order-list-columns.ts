import { escapeHtml } from '../../utils.ts'
import { renderBadge } from '../../components/ui/badge.ts'
import type { StandardListColumn } from '../../components/ui/list-table.ts'
import { dyeFactoryTabLabel, dyePartnerFields } from '../../data/fcs/dye-work-order-demo-details.ts'
import type { DyeWorkOrderOnlineRow } from '../../data/fcs/dye-work-order-online-view.ts'
import { renderDyeWorkOrderTimes } from '../process-factory/dyeing/work-order-times.ts'
import { renderPrintingObjectImage as renderFactoryPrintingObjectImage, printingProductionStage, printingIsOverdue, renderPrintingDemandSource, renderPrintingQuantityGroups } from '../process-factory/printing/presentation.ts'
import { renderPrintingWorkOrderTimes } from '../process-factory/printing/work-order-times.ts'
import { renderPrintingRelations, printingPatternLabel, printingMaterialCode, printingSpecification, printingInputIdentity } from '../process-factory/printing/relations.ts'
import { PRINTING_HANDOVER_STATUS_LABEL, PRINTING_RECEIPT_STATUS_LABEL, PRINTING_PROCESSING_STATUS_LABEL, type PrintingWorkOrderBusinessRecord, type PrintingProcessingStatus, type PrintingReceiptStatus, type PrintingHandoverStatus } from '../../data/fcs/printing-work-order-business.ts'

// List images use the global preview so the same columns work on both systems' routes.
function renderPrintingObjectImage(image: { imageUrl: string; imageAlt: string }, size = 'h-12 w-12'): string {
  return renderFactoryPrintingObjectImage(image, size)
    .replace('data-printing-action="preview-image"', 'data-skip-page-rerender="true"')
    .replace('data-image-url=', 'data-pda-image-preview-url=')
    .replace('data-image-alt=', 'data-pda-image-preview-title=')
}

// Both management and factory execution pages render the same work-order facts and visual columns.
// Actions stay with their owning page.
export function createDyeOrderDisplayColumns(renderDetail: (row: DyeWorkOrderOnlineRow) => string): StandardListColumn<DyeWorkOrderOnlineRow>[] {
function formatQty(value: number, unit: string): string {
  return `${value.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${escapeHtml(unit)}`
}


function renderListImage(url: string, alt: string): string {
  return `<button type="button" class="relative h-10 w-10 shrink-0 cursor-zoom-in overflow-hidden rounded border bg-white" data-pda-image-preview-url="${escapeHtml(url)}" data-pda-image-preview-title="${escapeHtml(alt)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(alt)}大图"><img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"><span class="absolute inset-0 flex items-center justify-center bg-white px-1 text-center text-[10px] text-muted-foreground">图片加载中</span></button>`
}


function renderDyeResultAttachments(row: Pick<DyeWorkOrderOnlineRow, 'professionalResultAttachments'>): string {
  if (!row.professionalResultAttachments.length) return ''
  return `<div class="mt-2 space-y-1 border-t pt-2"><p class="text-muted-foreground">调色结果附件</p><div class="flex flex-wrap gap-2">${row.professionalResultAttachments.map(file => file.mimeType.startsWith('image/')
    ? renderListImage(file.dataUrl, file.fileName)
    : `<span class="max-w-[140px] truncate rounded border bg-slate-50 px-2 py-1" title="${escapeHtml(file.fileName)}">${escapeHtml(file.fileName)}</span>`).join('')}</div></div>`
}


function axisTone(status: string): 'success' | 'warning' | 'danger' | 'info' | 'neutral' {
  if (['RECEIVED', 'COMPLETED', 'FULL_HANDOVER'].includes(status)) return 'success'
  if (['RECEIPT_DIFFERENCE', 'CANCELLED'].includes(status)) return 'danger'
  if (['PARTIAL_RECEIVED', 'PARTIAL_HANDOVER', 'PROCESSING'].includes(status)) return 'info'
  if (['WAIT_SOURCE', 'WAIT_RECEIVE', 'WAIT_HANDOVER'].includes(status)) return 'warning'
  return 'neutral'
}


function field(label: string, value: string): string {
  return `<div class="leading-5"><span class="text-muted-foreground">${escapeHtml(label)}：</span><span class="break-words">${escapeHtml(value)}</span></div>`
}


function materialItem(item: {imageUrl: string; name: string; sku: string}): string {
  return `<div class="flex items-start gap-2" data-dye-material-item>${renderListImage(item.imageUrl, `${item.name} ${item.sku}`)}<div class="min-w-0 flex-1"><div class="font-medium leading-5">${escapeHtml(item.name)}</div><div class="break-all text-muted-foreground leading-5">${escapeHtml(item.sku)}</div></div></div>`
}


function renderMaterialItem(item: DyeWorkOrderOnlineRow['inputMaterials'][number]): string {
  return `<div data-dye-material-spec>${materialItem(item)}<div class="mt-2">${field('物料类型',item.materialType)}${field('成分',item.composition)}${field('幅宽',item.materialType==='纱线'?'不适用（筒装纱线）':item.width)}${field('克重',item.materialType==='纱线'?'不适用（按净重 kg 计量）':item.weightGsm === null ? '待维护' : `${item.weightGsm} g/m²`)}</div></div>`
}


function renderOrderProduct(row: DyeWorkOrderOnlineRow): string {
  const tags = [row.isOverdue ? renderBadge('超期', 'danger') : '', row.isReplenishment ? renderBadge('补料', 'warning') : ''].filter(Boolean)
  const factoryName = row.factoryId ? dyeFactoryTabLabel(row.factoryId, row.factoryName) : '待分配工厂'
  return `<div class="divide-y divide-gray-200 text-xs" data-dye-cell="order-product">
    <section class="space-y-1 pb-3" data-dye-section="documents">${field('加工厂',factoryName)}<div class="rounded border border-blue-100 bg-blue-50 px-2 py-1 leading-5 text-blue-800" data-dye-demand-source><span>需求来源：</span><span class="font-medium">${escapeHtml(row.sourceLabel)}</span></div><div><span class="text-muted-foreground">染色加工单：</span>${renderDetail(row)}</div>${field('任务单',row.taskNo)}${row.productionDemandId ? field('生产需求单', row.productionDemandId) : ''}${field('生产单',row.matchedProductionOrderNo || row.productionOrderNo || '待匹配')}${row.matchStatus ? `<div class="pt-1">${renderBadge(row.matchStatusLabel, row.matchStatus === 'MATCHED' ? 'success' : row.matchStatus === 'MATCH_FAILED' ? 'danger' : row.matchStatus === 'CANCELLED' ? 'neutral' : 'warning')}</div>` : ''}${field('售卖类型',row.salesType)}</section>
    <section class="py-3" data-dye-section="product">${materialItem({imageUrl:row.productImageUrl, name:row.productName, sku:row.productCode})}</section>
    ${tags.length ? `<section class="flex flex-wrap gap-1 pt-3" data-dye-section="tags">${tags.join('')}</section>` : ''}
  </div>`
}


function renderInputUpstream(row: DyeWorkOrderOnlineRow): string {
  return `<div class="divide-y divide-gray-200 text-xs" data-dye-cell="input-upstream"><section class="space-y-3 pb-3" data-dye-section="inputs">${row.inputMaterials.map(renderMaterialItem).join('')}</section><section class="space-y-3 pt-3" data-dye-section="upstream">${row.upstreamPartners.map(partner=>`<div data-dye-upstream-partner data-partner-kind="${partner.kind}"><div class="mb-1 font-medium text-muted-foreground">上游</div>${dyePartnerFields(partner).map(([label,value])=>field(label,value)).join('')}<div class="mt-2 space-y-2">${row.upstreamDocuments.filter(doc=>doc.partner.kind===partner.kind&&doc.partner.id===partner.id).map(doc=>`<div data-dye-upstream-document><div class="flex flex-wrap items-baseline gap-x-2 leading-5"><span class="break-all text-blue-700">${doc.href ? `<a href="${escapeHtml(doc.href)}" class="hover:underline">${escapeHtml(doc.documentNo)}</a>` : escapeHtml(doc.documentNo)}</span><span class="shrink-0 text-muted-foreground">${doc.documentType}</span></div>${field('单据状态',doc.status)}${field('计划数量',formatQty(doc.plannedQty,doc.unit))}${field(doc.documentType === '调拨单' ? '调拨数量' : doc.documentType==='出库单'?'出库数量':'交出数量',formatQty(doc.sentQty,doc.unit))}</div>`).join('')}</div></div>`).join('')}</section></div>`
}


function renderOutputDownstream(row: DyeWorkOrderOnlineRow): string {
  const downstream = row.matchStatus && row.matchStatus !== 'MATCHED'
    ? '<p class="text-amber-700">待匹配生产单后确认下游</p>'
    : row.downstreamPartner ? dyePartnerFields(row.downstreamPartner).map(([label,value])=>field(label,value)).join('') : field('接收方',row.receiverName || row.receiverWarehouseName)
  return `<div class="divide-y divide-gray-200 text-xs" data-dye-cell="output-downstream"><section class="space-y-2 pb-3" data-dye-section="output">${renderMaterialItem({imageUrl:row.outputImageUrl,name:row.materialName,sku:row.colorSku,materialType:row.materialType,composition:row.composition,width:row.width,weightGsm:row.weightGsm})}${field('色号',row.colorNo)}${field('颜色',row.targetColorName)}</section><section class="pt-3" data-dye-section="downstream"><div class="mb-1 font-medium text-muted-foreground">下游</div>${downstream}</section></div>`
}


function renderQuantities(row: DyeWorkOrderOnlineRow): string {
  const yarnText=(weights:NonNullable<DyeWorkOrderOnlineRow['yarnQuantities']>['received'],fallback:string)=>weights.length?`${weights.reduce((n,w)=>n+w.pcs,0)} pcs / 毛重 ${(weights.reduce((n,w)=>n+w.grossGrams,0)/1000).toFixed(3)} kg / 净重 ${(weights.reduce((n,w)=>n+w.netGrams,0)/1000).toFixed(3)} kg`:fallback
  const upstreamByUnit = new Map<string, number>()
  for (const doc of row.upstreamDocuments) upstreamByUnit.set(doc.unit, (upstreamByUnit.get(doc.unit) || 0) + doc.sentQty)
  const groups: Array<[string, Array<[string, string]>]> = [
    ['plan', [['计划数量',formatQty(row.plannedQty,row.qtyUnit)]]],
    ['receipt', [
      ['上游交出数量',row.yarnQuantities?yarnText(row.yarnQuantities.upstream,'历史三项计量未采集'):[...upstreamByUnit].map(([unit,qty])=>formatQty(qty,unit)).join(' / ') || '尚未交出'],
      ['接收数量',row.yarnQuantities?yarnText(row.yarnQuantities.received,row.receivedInputQty>0?'历史三项计量未采集':'0 pcs / 毛重 0.000 kg / 净重 0.000 kg'):row.receiptKnown ? formatQty(row.receivedInputQty,row.qtyUnit) : '历史接收未登记'],
    ]],
    ['processing', [
      ['加工用料',row.usageKnown ? formatQty(row.rawMaterialQty,row.qtyUnit) : '历史用量未登记'],
      ['备料数量',formatQty(row.preparedQty,row.qtyUnit)],
      ['备料卷数',row.isYarn?'不适用（纱线按筒）':`${row.preparedRollCount} 卷`],
      [row.isYarn?'备料净重':'备料重量（理论）',formatQty(row.isYarn?row.preparedQty:row.preparedWeightKg,'kg')],
      ['完成数量',row.isYarn?formatQty(row.completedQty,'kg 净重'):`${row.completedRollCount} 卷 / ${formatQty(row.completedQty,row.qtyUnit)}`],
      ['损耗数量',row.lossKnown ? formatQty(row.lossQty,row.qtyUnit) : '尚未完工核算'],
    ]],
    ['handover', [
      ['交出数量',row.yarnQuantities?yarnText(row.yarnQuantities.shipped,row.handedOverQty>0?'历史三项计量未采集':'0 pcs / 毛重 0.000 kg / 净重 0.000 kg'):`${row.handedOverRollCount} 卷 / ${formatQty(row.handedOverQty,row.qtyUnit)}`],
      ['下游接收数量',row.yarnQuantities?yarnText(row.yarnQuantities.downstream,row.downstreamReceivedQty>0?'历史三项计量未采集':'0 pcs / 毛重 0.000 kg / 净重 0.000 kg'):formatQty(row.downstreamReceivedQty,row.qtyUnit)],
      ['下游待接收',row.isYarn?`${row.pendingInboundQty.toFixed(3)} kg 净重`:formatQty(row.pendingInboundQty,row.qtyUnit)],
    ]],
  ]
  return `<div class="divide-y divide-gray-200 text-xs" data-dye-cell="quantities">${groups.map(([key,items])=>`<section class="py-3 first:pt-0 last:pb-0" data-dye-quantity-section="${key}">${items.map(([label,value])=>field(label,value)).join('')}</section>`).join('')}</div>`
}


return [
  {
    key: 'dyeInfo', title: '加工单／商品', width: 245, required: true, freezeable: true, sortable: true,
    sortValue: row => row.workOrderNo,
    render: renderOrderProduct,
  },
  {
    key: 'material', title: '加工投入／上游', width: 280, required: true, freezeable: true, sortable: true,
    sortValue: row => row.rawMaterialSku,
    render: renderInputUpstream,
  },
  {
    key: 'requirement', title: '加工要求', width: 260, freezeable: true, sortable: true,
    sortValue: row => row.processName,
    render: row => `<div class="text-xs space-y-1" data-dye-cell="requirements">${field('工艺',row.processName)}${field('类型',row.headVatOrRedye)}${field('染色要求',row.targetColorName || '按调色任务执行')}${field('深浅',row.shade || '工艺未指定')}${field('温度',row.temperature ? `${row.temperature}℃` : '工艺未指定')}${field('包含水溶',row.requiresWaterSoluble ? '是' : '否')}${row.professionalTaskNo ? field('调色任务', row.professionalTaskNo) : ''}${row.professionalResultVersion ? field('调色结果', `${row.professionalResultId || '成果'} · ${row.professionalResultVersion}`) : ''}${renderDyeResultAttachments(row)}${typeof row.estimatedUnitConsumption === 'number' ? field('预估单耗', String(row.estimatedUnitConsumption)) : ''}${typeof row.estimatedLossRate === 'number' ? field('损耗率', `${(row.estimatedLossRate * 100).toFixed(2)}%`) : ''}${row.matchFailureReason ? `<p class="text-red-700">${escapeHtml(row.matchFailureReason)}</p>` : ''}</div>`,
  },
  {
    key: 'status', title: '处理进度', width: 132, required: true, freezeable: true,
    render: row => `<div class="space-y-2"><div><span class="mr-1 text-xs text-muted-foreground">接收</span>${renderBadge(row.receiptKnown ? row.receiptStatusLabel : '历史待补录', axisTone(row.receiptStatus))}</div><div><span class="mr-1 text-xs text-muted-foreground">加工</span>${renderBadge(row.processingStatusLabel, axisTone(row.processingStatus))}</div><div><span class="mr-1 text-xs text-muted-foreground">交出</span>${renderBadge(row.handoverStatusLabel, axisTone(row.handoverStatus))}</div></div>`,
  },
  {
    key: 'output', title: '加工产出／下游', width: 245, required: true, freezeable: true, sortable: true,
    sortValue: row => row.completedQty,
    render: renderOutputDownstream,
  },
  {
    key: 'time', title: '时间', width: 275, freezeable: true, sortable: true,
    sortValue: row => row.plannedFinishAt,
    render: row => renderDyeWorkOrderTimes(row.timeSections),
  },
  { key: 'quantity', title: '数量', width: 235, freezeable: true, sortable: true, sortValue: row=>row.plannedQty, render:renderQuantities },
]
}

export function createPrintingOrderDisplayColumns(renderDetail: (row: PrintingWorkOrderBusinessRecord) => string): StandardListColumn<PrintingWorkOrderBusinessRecord>[] {
function imageButton(image: { imageUrl: string; imageAlt: string }, size = 'h-12 w-12'): string {
  return renderPrintingObjectImage(image, size)
}


function statusBadge(label: string, tone: 'blue' | 'amber' | 'green' | 'slate' | 'red'): string {
  return renderBadge(label, ({blue: 'info', amber: 'warning', green: 'success', slate: 'neutral', red: 'danger'} as const)[tone])
}


function processingBadge(status: PrintingProcessingStatus): string {
  return statusBadge(PRINTING_PROCESSING_STATUS_LABEL[status], status === 'PROCESS_COMPLETED' ? 'green' : status === 'PROCESSING' ? 'blue' : status === 'CANCELLED' ? 'red' : 'amber')
}


function receiptBadge(status: PrintingReceiptStatus): string {
  return statusBadge(PRINTING_RECEIPT_STATUS_LABEL[status], status === 'RECEIVED' ? 'green' : status === 'RECEIPT_DIFFERENCE' ? 'red' : status === 'WAIT_SOURCE' ? 'amber' : 'amber')
}


function handoverBadge(status: PrintingHandoverStatus): string {
  return statusBadge(PRINTING_HANDOVER_STATUS_LABEL[status], status === 'FULL_HANDOVER' ? 'green' : status === 'NOT_READY' ? 'slate' : status === 'PARTIAL_HANDOVER' ? 'amber' : 'blue')
}


function renderInputMaterial(order: PrintingWorkOrderBusinessRecord): string {
  const material = printingInputIdentity(order)
  return `<div class="flex gap-2">${imageButton(material, 'h-10 w-10')}<div class="min-w-0"><p class="text-muted-foreground">${material.identityLabel}</p><p class="line-clamp-2 font-medium" title="${escapeHtml(material.materialName)}">${escapeHtml(material.materialName)}</p><p class="text-muted-foreground">${escapeHtml(printingMaterialCode(material.sku))}</p><p>物料类型：${escapeHtml(material.objectType)}</p><p>成分：${escapeHtml(material.composition || '资料待补充')}</p><p>${escapeHtml(printingSpecification(material))}</p></div></div>`
}

function renderOrderProduct(order: PrintingWorkOrderBusinessRecord): string {
  if (order.demandSource.type === 'STOCK') {
    const actual = printingInputIdentity(order)
    const material = actual.identityLabel === '实际投入' && actual.imageUrl ? actual : { ...order.plannedInput, identityLabel: '计划备货物料' }
    return `<div class="space-y-1"><p class="font-medium">备货物料</p><div class="flex gap-2">${imageButton(material, 'h-10 w-10')}<div class="min-w-0"><p class="line-clamp-2">${escapeHtml(material.materialName)}</p><p class="text-muted-foreground">${escapeHtml(printingMaterialCode(material.sku))}</p><p class="text-muted-foreground">${material.identityLabel}</p></div></div>${order.historicalInputQuantityUnknown ? '<p class="text-amber-700">实际投入待补录</p>' : ''}</div>`
  }
  return `<div class="flex gap-2">${imageButton(order.product, 'h-10 w-10')}<div class="min-w-0"><p class="line-clamp-2 font-medium" title="${escapeHtml(order.product.productName)}">${escapeHtml(order.product.productName)}</p><p class="truncate" title="${escapeHtml(order.product.spu)}">${escapeHtml(order.product.spu)}</p></div></div>`
}


function renderPattern(pattern: PrintingWorkOrderBusinessRecord['requirement']['frontPattern'], label: string): string {
  return `<div class="flex gap-2">${imageButton(pattern, 'h-10 w-10')}<div class="min-w-0"><p class="text-muted-foreground">${label}</p><p>${escapeHtml(printingPatternLabel(pattern.patternNo))}</p><p>${escapeHtml(pattern.patternVersion || '版本待确认')}</p></div></div>`
}


function renderArtworkTaskOutput(order: PrintingWorkOrderBusinessRecord): string {
  if (!order.professionalResultAttachments.length) return ''
  const imageCount = order.professionalResultAttachments.filter(file => file.mimeType.startsWith('image/')).length
  const fileCount = order.professionalResultAttachments.length - imageCount
  return `<div class="space-y-2 border-t pt-2"><p class="font-medium text-slate-600">花型任务产出 · ${imageCount} 张图 / ${fileCount} 个文件</p><div class="grid gap-2">${order.professionalResultAttachments.map(file => `<div class="flex items-center gap-2">${file.mimeType.startsWith('image/') ? imageButton({ imageUrl: file.dataUrl, imageAlt: file.fileName }, 'h-10 w-10') : '<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-slate-50 text-[10px]">文件</span>'}<span class="min-w-0 truncate" title="${escapeHtml(file.fileName)}">${escapeHtml(file.fileName)}</span></div>`).join('')}</div></div>`
}


return [
  { key: 'order', title: '加工单／商品', width: 245, required: true, freezeable: true, sortable: true, sortValue: order => order.printOrderNo,
    render: order => `<div class="divide-y divide-slate-200 text-xs"><div class="space-y-1 pb-2"><p>加工厂：${escapeHtml(order.printFactoryName || '待分配')}</p>${renderPrintingDemandSource(order)}<p>印花加工单：${renderDetail(order)}</p><p>任务单：${escapeHtml(order.taskNo)}</p>${order.productionDemandId ? `<p>生产需求单：${escapeHtml(order.productionDemandId)}</p>` : ''}<p>生产单：${escapeHtml(order.matchedProductionOrderNo || order.demandSource.productionOrderNo || '待匹配')}</p>${order.matchStatus ? `<div>${statusBadge(order.matchStatusLabel, order.matchStatus === 'MATCHED' ? 'green' : order.matchStatus === 'MATCH_FAILED' ? 'red' : order.matchStatus === 'CANCELLED' ? 'slate' : 'amber')}</div>` : ''}<p>售卖类型：${escapeHtml(order.salesType || '不适用')}</p><p>创建方式：${escapeHtml(order.creationMethod || '历史未记录')}</p></div><div class="py-2">${renderOrderProduct(order)}</div><div class="flex flex-wrap gap-1 pt-2">${printingIsOverdue(order) ? statusBadge('超期', 'red') : ''}${order.historicalSupplement || order.demandSource.supplementOrderNo || order.demandSource.type === 'SUPPLEMENT' ? statusBadge('补料', 'amber') : ''}${order.inputChanges.length ? statusBadge('已换料', 'amber') : ''}</div></div>` },
  { key: 'input', title: '加工投入／上游', freezeable: true, width: 250, required: true, sortable: true, sortValue: order => order.plannedInput.sku,
    render: order => `<div class="divide-y divide-slate-200 text-xs"><div class="pb-2">${renderInputMaterial(order)}</div><div class="pt-2">${renderPrintingRelations(order, 'upstream')}</div></div>` },
  { key: 'requirement', title: '加工要求', freezeable: true, width: 290, sortable: true, sortValue: order => order.requirement.craftName,
    render: order => `<div class="space-y-2 text-xs"><p>工艺：<strong>${escapeHtml(order.requirement.craftName || '待确认')}</strong></p><p>加工方式：${escapeHtml(order.requirement.type || '待确认')}</p><p>印花面别：${escapeHtml(order.requirement.printSide)}</p>${order.professionalTaskNo ? `<p>花型任务：${escapeHtml(order.professionalTaskNo)}</p>` : ''}${order.professionalResultVersion ? `<p>花型成果：${escapeHtml(order.professionalResultId || '成果')} · ${escapeHtml(order.professionalResultVersion)}</p>` : ''}${typeof order.estimatedUnitConsumption === 'number' ? `<p>预估单耗：${order.estimatedUnitConsumption}</p>` : ''}${typeof order.estimatedLossRate === 'number' ? `<p>损耗率：${(order.estimatedLossRate * 100).toFixed(2)}%</p>` : ''}${order.matchFailureReason ? `<p class="text-red-700">${escapeHtml(order.matchFailureReason)}</p>` : ''}${order.requirement.shade ? `<p>深浅：${escapeHtml(order.requirement.shade)}</p>` : ''}${order.requirement.temperature ? `<p>温度：${escapeHtml(order.requirement.temperature)}</p>` : ''}<p>设备：${escapeHtml(order.printerNo || '尚未安排')}</p>${renderArtworkTaskOutput(order)}<div class="space-y-2 border-t pt-2">${renderPattern(order.requirement.frontPattern, '正面花型')}${order.requirement.printSide === '双面' ? order.requirement.insidePattern ? renderPattern(order.requirement.insidePattern, '反面花型') : '<p class="text-amber-700">反面花型待补充</p>' : ''}</div></div>` },
  { key: 'progress', title: '处理进度', freezeable: true, width: 150, required: true,
    render: order => `<div class="space-y-2 text-xs"><p>接收 ${order.historicalInputQuantityUnknown ? statusBadge('历史待补录', 'amber') : receiptBadge(order.receiptStatus)}</p><p>加工 ${processingBadge(order.processingStatus)}</p><p class="text-muted-foreground">${escapeHtml(printingProductionStage(order))}</p><p>交出 ${handoverBadge(order.handoverStatus)}</p>${order.confirmedReceiptDifference || order.handover.objectionQty ? statusBadge('接收差异', 'amber') : ''}</div>` },
  { key: 'output', title: '加工产出／下游', freezeable: true, width: 250, required: true, sortable: true, sortValue: order => order.output.sku,
    render: order => `<div class="divide-y divide-slate-200 text-xs"><div class="flex gap-2 pb-2">${imageButton(order.output, 'h-10 w-10')}<div class="min-w-0"><p class="font-medium">${escapeHtml(order.output.materialName)}</p><p class="break-all text-muted-foreground">${escapeHtml(printingMaterialCode(order.output.sku, true))}</p><p>物料类型：${escapeHtml(order.output.objectType)}</p><p>成分：${escapeHtml(order.output.composition || '资料待补充')}</p><p>${escapeHtml(printingSpecification(order.output))}</p></div></div><div class="pt-2">${order.matchStatus && order.matchStatus !== 'MATCHED' ? '<p class="font-medium text-slate-500">下游</p><p class="mt-1 text-amber-700">待匹配生产单后确认下游</p>' : renderPrintingRelations(order, 'downstream')}</div></div>` },
  { key: 'time', title: '时间', freezeable: true, width: 250, sortable: true, sortValue: order => order.orderedAt, render: renderPrintingWorkOrderTimes },
  { key: 'quantity', title: '数量', freezeable: true, width: 210, sortable: true, sortValue: order => order.plannedInput.plannedQty, render: renderPrintingQuantityGroups },
]
}
