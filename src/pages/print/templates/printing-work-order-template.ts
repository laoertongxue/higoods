import {
  PRINTING_DEMAND_SOURCE_LABEL,
  PRINTING_HANDOVER_STATUS_LABEL,
  PRINTING_PROCESSING_STATUS_LABEL,
  formatPrintingQty,
  formatPrintingUsage,
  formatPrintingWeightKg,
  getPrintingWorkOrderById,
  metersFromYards,
  type PrintingRollBarcode,
  type PrintingWorkOrderBusinessRecord,
} from '../../../data/fcs/printing-work-order-business.ts'
import {
  buildPrintQrPayload,
  createPrintDocumentId,
  getPrintGeneratedAt,
  type PrintDocument,
  type PrintDocumentBuildInput,
  type PrintField,
} from '../../../data/fcs/print-service.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderLabelPrintTemplate } from './label-print-template.ts'
import { renderTaskRouteCardTemplate } from './task-route-card-template.ts'

const INFO_TEMPLATE = 'PRINTING_INFO_SHEET_V2'
const CONFIRMATION_TEMPLATE = 'PRINTING_CONFIRMATION_V2'
const ROLL_LABEL_TEMPLATE = 'PRINTING_ROLL_LABEL_V2'

function parseOrderIds(sourceId: string): string[] {
  return sourceId.split(',').map((item) => decodeURIComponent(item.trim())).filter(Boolean)
}

function requireOrders(sourceId: string): PrintingWorkOrderBusinessRecord[] {
  const orders = parseOrderIds(sourceId).map((id) => getPrintingWorkOrderById(id)).filter((item): item is PrintingWorkOrderBusinessRecord => Boolean(item))
  if (!orders.length) throw new Error('未找到印花加工单，无法生成打印单据')
  return orders
}

function fields(rows: Array<[string, string, boolean?]>): PrintField[] {
  return rows.map(([label, value, emphasis]) => ({ label, value, emphasis }))
}

function qrPayload(order: PrintingWorkOrderBusinessRecord, documentType: 'PRINTING_INFO_SHEET' | 'PRINTING_CONFIRMATION'): string {
  return buildPrintQrPayload({
    documentType,
    sourceType: 'PRINTING_WORK_ORDER',
    sourceId: order.workOrderId,
    businessNo: order.printOrderNo,
    targetRoute: `/fcs/craft/printing/work-orders/${encodeURIComponent(order.workOrderId)}`,
    extra: { taskNo: order.taskNo, outputSku: order.output.sku },
  })
}

function sharedImageBlocks(order: PrintingWorkOrderBusinessRecord): PrintDocument['imageBlocks'] {
  return [
    { title: '商品图片', imageUrl: order.product.imageUrl, imageLabel: order.product.imageAlt, sourceLabel: order.product.spu, fallbackLabel: '商品图片加载失败' },
    { title: '加工投入', imageUrl: order.plannedInput.imageUrl, imageLabel: order.plannedInput.imageAlt, sourceLabel: order.plannedInput.sku, fallbackLabel: '投入面料图片加载失败' },
    { title: '加工产出', imageUrl: order.output.imageUrl, imageLabel: order.output.imageAlt, sourceLabel: order.output.sku, fallbackLabel: '产出面料图片加载失败' },
    { title: '正面花型', imageUrl: order.requirement.frontPattern.imageUrl, imageLabel: order.requirement.frontPattern.imageAlt, sourceLabel: order.requirement.frontPattern.patternNo, fallbackLabel: '正面花型图片加载失败' },
    ...(order.requirement.insidePattern ? [{ title: '里面花型', imageUrl: order.requirement.insidePattern.imageUrl, imageLabel: order.requirement.insidePattern.imageAlt, sourceLabel: order.requirement.insidePattern.patternNo, fallbackLabel: '里面花型图片加载失败' }] : []),
  ]
}

function buildInfoDocumentForOrder(input: PrintDocumentBuildInput, order: PrintingWorkOrderBusinessRecord): PrintDocument {
  const generatedAt = getPrintGeneratedAt()
  return {
    printDocumentId: createPrintDocumentId({ ...input, sourceId: order.workOrderId }, INFO_TEMPLATE),
    documentType: 'PRINTING_INFO_SHEET', documentTitle: '印花信息单', sourceType: 'PRINTING_WORK_ORDER', sourceId: order.workOrderId,
    templateCode: INFO_TEMPLATE, paperType: 'A4', orientation: 'portrait', printTitle: '印花信息单', printSubtitle: '需求来源 · 加工投入 · 印花要求 · 固定加工产出',
    headerFields: fields([
      ['印花单号', order.printOrderNo, true], ['任务单号', order.taskNo], ['下单时间', order.orderedAt],
      ['需求来源', PRINTING_DEMAND_SOURCE_LABEL[order.demandSource.type]], ['来源单据', order.demandSource.sourceLabel], ['商品 SPU', order.product.spu],
    ]),
    imageBlocks: sharedImageBlocks(order),
    qrCodes: [{ title: '印花加工单二维码', value: qrPayload(order, 'PRINTING_INFO_SHEET'), description: '扫码查看印花加工单详情', sizeMm: 30 }],
    barcodes: [],
    sections: [
      { sectionId: 'source', title: '需求来源', fields: fields([
        ['需求单', order.demandSource.demandNo || '—'], ['生产单', order.demandSource.productionOrderNo || order.demandSource.originalProductionOrderNo || '—'],
        ['采购单', order.demandSource.purchaseOrderNo || '—'], ['备货计划', order.demandSource.stockPlanNo || '—'], ['补料单', order.demandSource.supplementOrderNo || '—'], ['投入供料来源', order.plannedInput.supplySource],
      ]) },
      { sectionId: 'usage', title: '用量依据', fields: fields([
        ['需求基数', `${formatPrintingQty(order.usage.demandBaseQty)} ${order.usage.demandBaseUnit}`],
        ['标准单位用量', `${formatPrintingUsage(order.usage.standardUnitUsage)}${order.usage.standardUnitUsage === null ? '' : ` ${order.usage.usageUnit}`}`],
        ['加工单单位用量', `${formatPrintingUsage(order.usage.orderUnitUsage)}${order.usage.orderUnitUsage === null ? '' : ` ${order.usage.usageUnit}`}`],
        ['计算依据', order.usage.formulaLabel], ['计划投入', `${formatPrintingQty(order.plannedInput.plannedQty)} Yard`],
      ]) },
      { sectionId: 'input', title: '加工投入', fields: fields([
        ['对象类型', order.plannedInput.objectType], ['面料', order.plannedInput.materialName], ['面料 SPU', order.plannedInput.spu],
        ['计划投入 SKU', order.plannedInput.sku, true], ['实际投入 SKU', order.actualInput.actualSku || '未接收'],
        ['实际接收', `${formatPrintingQty(order.actualInput.receivedQty)} Yard / ${order.actualInput.receivedRollCount} 卷`],
        ['实际使用', `${formatPrintingQty(order.actualInput.usedQty)} Yard / ${order.actualInput.usedRollCount} 卷`], ['接收人', order.actualInput.receiverName],
      ]) },
      { sectionId: 'requirement', title: '印花要求与加工产出', fields: fields([
        ['工艺', `${order.requirement.craftName} / ${order.requirement.type}`], ['深浅/温度', `${order.requirement.shade} / ${order.requirement.temperature}`], ['印花面别', order.requirement.printSide],
        ['正面花型', `${order.requirement.frontPattern.patternNo} ${order.requirement.frontPattern.patternVersion}`], ['里面花型', order.requirement.insidePattern ? `${order.requirement.insidePattern.patternNo} ${order.requirement.insidePattern.patternVersion}` : '—'],
        ['加工产出对象', `[${order.output.objectType}] ${order.output.materialName}`], ['加工产出 SKU', order.output.sku, true],
        ['完成数量', `${formatPrintingQty(order.output.completedQty)} Yard / ${order.output.completedRollCount} 卷`],
      ]) },
      { sectionId: 'factory', title: '加工与交出', fields: fields([
        ['加工厂', order.printFactoryName], ['打印机', order.printerNo], ['加工状态', PRINTING_PROCESSING_STATUS_LABEL[order.processingStatus]],
        ['交出状态', PRINTING_HANDOVER_STATUS_LABEL[order.handoverStatus]], ['下游接收人', order.handover.receiverName], ['备注', order.remark || '—'],
      ]) },
    ],
    tables: [], signatureBlocks: [{ label: '加工厂接收', signerRole: '接收人' }, { label: '加工完成', signerRole: '执行人' }, { label: '交出确认', signerRole: '交出人' }], differenceBlocks: [],
    footerFields: fields([['打印时间', generatedAt], ['打印版本', `V${order.inputChanges.length + 1}`], ['投入变更', order.inputChanges.length ? `已变更 ${order.inputChanges.length} 次` : '无']]),
    printMeta: { generatedAt, generatedBy: 'Web 打印操作员', printNotice: '请核对加工投入和固定产出 SKU；投入变更后须重新打印。', returnHref: `/fcs/craft/printing/work-orders/${encodeURIComponent(order.workOrderId)}` },
  }
}

function buildConfirmationDocumentForOrder(input: PrintDocumentBuildInput, order: PrintingWorkOrderBusinessRecord): PrintDocument {
  const generatedAt = getPrintGeneratedAt()
  return {
    printDocumentId: createPrintDocumentId({ ...input, sourceId: order.workOrderId }, CONFIRMATION_TEMPLATE),
    documentType: 'PRINTING_CONFIRMATION', documentTitle: '印花确认单', sourceType: 'PRINTING_WORK_ORDER', sourceId: order.workOrderId,
    templateCode: CONFIRMATION_TEMPLATE, paperType: 'A4', orientation: 'portrait', printTitle: 'Printing order / 印花确认单', printSubtitle: `${order.printOrderNo} · ${order.product.spu}`,
    headerFields: fields([
      ['Printing order', order.printOrderNo, true], ['Printing order time', order.orderedAt], ['SPU', order.product.spu],
      ['Requirement / Need', `${formatPrintingQty(order.plannedInput.plannedQty)} Yard / ${formatPrintingQty(metersFromYards(order.plannedInput.plannedQty))} Meter`],
      ['Fabric', order.plannedInput.materialName], ['需求来源', `${PRINTING_DEMAND_SOURCE_LABEL[order.demandSource.type]} · ${order.demandSource.sourceNo}`],
      ['加工投入 SKU', order.plannedInput.sku], ['加工产出 SKU', order.output.sku, true],
    ]),
    imageBlocks: [
      { title: 'Photo', imageUrl: order.product.imageUrl, imageLabel: order.product.imageAlt, sourceLabel: order.product.spu, fallbackLabel: '商品图片加载失败' },
      { title: 'Output fabric', imageUrl: order.output.imageUrl, imageLabel: order.output.imageAlt, sourceLabel: order.output.sku, fallbackLabel: '产出面料图片加载失败' },
    ],
    qrCodes: [{ title: 'QR', value: qrPayload(order, 'PRINTING_CONFIRMATION'), description: '扫码查看印花加工单', sizeMm: 30 }], barcodes: [],
    sections: [{ sectionId: 'facts', title: '印花单信息', fields: fields([
      ['印花来源', PRINTING_DEMAND_SOURCE_LABEL[order.demandSource.type]], ['工艺名称', order.requirement.craftName], ['印花面别', order.requirement.printSide], ['接收人', order.actualInput.receiverName],
      ['实际接收投入', `${formatPrintingQty(order.actualInput.receivedQty)} Yard / ${order.actualInput.receivedRollCount} 卷`], ['实际使用投入', `${formatPrintingQty(order.actualInput.usedQty)} Yard / ${order.actualInput.usedRollCount} 卷`],
    ]) }],
    tables: [
      { tableId: 'print-confirmation', title: 'Print confirmation', headers: ['Confirmation time', 'Printing length (M)', 'Printing width (CM)', 'Qty (roll)'], rows: [['', '', '', '']], minRows: 2 },
      { tableId: 'pattern-transfer-confirmation', title: 'Pattern transfer confirmation', headers: ['Confirmation time', 'Completion time', 'Printing length (M)', 'Printing width (CM)', 'Qty (roll)'], rows: [['', '', '', '', '']], minRows: 2 },
      { tableId: 'storage', title: 'Storage / Gudang', headers: ['Storage time', 'Gudang', 'M'], rows: [['', '', '']], minRows: 2 },
      { tableId: 'remark', title: 'Remark', headers: ['Remark'], rows: [[order.remark || '']], minRows: 3 },
    ],
    signatureBlocks: [], differenceBlocks: [],
    footerFields: fields([['打印时间', generatedAt], ['打印版本', `V${order.inputChanges.length + 1}`]]),
    printMeta: { generatedAt, generatedBy: 'Web 打印操作员', printNotice: 'Print/Pattern transfer/Storage 为线下纸面填写区，不驱动系统加工状态。', returnHref: `/fcs/craft/printing/work-orders/${encodeURIComponent(order.workOrderId)}` },
  }
}

function buildBatchDocument(input: PrintDocumentBuildInput, documentType: 'PRINTING_INFO_SHEET' | 'PRINTING_CONFIRMATION'): PrintDocument {
  const orders = requireOrders(input.sourceId)
  const first = documentType === 'PRINTING_INFO_SHEET' ? buildInfoDocumentForOrder(input, orders[0]) : buildConfirmationDocumentForOrder(input, orders[0])
  return { ...first, sourceId: input.sourceId, relatedObjectIds: orders.map((order) => order.workOrderId), documentTitle: orders.length > 1 ? `${first.documentTitle}（批量 ${orders.length} 张）` : first.documentTitle }
}

export function buildPrintingInfoSheetDocument(input: PrintDocumentBuildInput): PrintDocument {
  return buildBatchDocument(input, 'PRINTING_INFO_SHEET')
}

export function buildPrintingConfirmationDocument(input: PrintDocumentBuildInput): PrintDocument {
  return buildBatchDocument(input, 'PRINTING_CONFIRMATION')
}

function renderBatch(document: PrintDocument, builder: (input: PrintDocumentBuildInput, order: PrintingWorkOrderBusinessRecord) => PrintDocument): string {
  const ids = document.relatedObjectIds?.length ? document.relatedObjectIds : [document.sourceId]
  return ids.map((id, index) => {
    const order = getPrintingWorkOrderById(id)
    if (!order) return ''
    const single = builder({ documentType: document.documentType, sourceType: 'PRINTING_WORK_ORDER', sourceId: id }, order)
    return `${index ? '<div style="break-before: page;"></div>' : ''}${renderTaskRouteCardTemplate(single)}`
  }).join('')
}

export function renderPrintingInfoSheetDocument(document: PrintDocument): string {
  return renderBatch(document, buildInfoDocumentForOrder)
}

export function renderPrintingConfirmationDocument(document: PrintDocument): string {
  return renderBatch(document, buildConfirmationDocumentForOrder)
}

function parseRollSource(sourceId: string): { order: PrintingWorkOrderBusinessRecord; barcodes: PrintingRollBarcode[] } {
  const separator = sourceId.indexOf(':')
  const workOrderId = separator >= 0 ? sourceId.slice(0, separator) : sourceId
  const requested = separator >= 0 ? sourceId.slice(separator + 1).split(',').filter(Boolean) : []
  const order = getPrintingWorkOrderById(workOrderId)
  if (!order) throw new Error('未找到印花加工单，无法打印产出卷条码')
  const barcodes = requested.length ? order.barcodes.filter((barcode) => requested.includes(barcode.id)) : order.barcodes
  if (!barcodes.length) throw new Error('未选择产出卷条码')
  return { order, barcodes }
}

export function buildPrintingRollLabelDocument(input: PrintDocumentBuildInput): PrintDocument {
  const { order, barcodes } = parseRollSource(input.sourceId)
  const generatedAt = getPrintGeneratedAt()
  return {
    printDocumentId: createPrintDocumentId(input, ROLL_LABEL_TEMPLATE), documentType: 'PRINTING_ROLL_LABEL', documentTitle: '加工产出卷条码', sourceType: 'PRINTING_ROLL_RECORD', sourceId: input.sourceId,
    templateCode: ROLL_LABEL_TEMPLATE, paperType: 'LABEL_100_60', orientation: 'portrait', printTitle: '加工产出卷条码', printSubtitle: `${order.printOrderNo} · ${order.output.sku}`,
    headerFields: [], imageBlocks: [], qrCodes: [], barcodes: [], sections: [], tables: [], signatureBlocks: [], differenceBlocks: [], footerFields: [],
    labelSize: 'LABEL_100_60', labelLayout: '单张标签', printMode: '普通打印', relatedObjectIds: barcodes.map((barcode) => barcode.id),
    labelItems: barcodes.map((barcode) => ({
      labelTitle: '印花加工产出卷', labelSubtitle: `${order.printOrderNo} · 卷号 ${barcode.rollNo}`,
      labelFields: fields([
        ['产出 SKU', barcode.sku, true], ['卷长', `${formatPrintingQty(barcode.lengthY)} Yard / ${formatPrintingQty(barcode.meters)} M`],
        ['重量', `${formatPrintingWeightKg(barcode.weightKg)} KG`], ['克重/幅宽', `${barcode.gsm.toFixed(2)} g/㎡ / ${barcode.widthCm} cm`],
        ['缸号', barcode.vatNo || '—'], ['入库仓库', barcode.warehouseName], ['备注', barcode.remark || '—'],
      ]),
      barcode: { title: '卷条码', value: barcode.barcode, description: `${order.output.sku} · ${barcode.rollNo}` },
      qrCode: { title: '卷二维码', value: JSON.stringify({ type: 'PRINTING_OUTPUT_ROLL', workOrderId: order.workOrderId, barcodeId: barcode.id, outputSku: order.output.sku }), description: '扫码识别印花产出卷', sizeMm: 22 },
      printMode: '普通打印',
    })),
    printMeta: { generatedAt, generatedBy: 'Web 打印操作员', printNotice: '一卷一个条码；条码只绑定加工产出 SKU；KG 保留 3 位小数。', returnHref: `/fcs/craft/printing/work-orders/${encodeURIComponent(order.workOrderId)}` },
  }
}

export function renderPrintingRollLabelDocument(document: PrintDocument): string {
  return renderLabelPrintTemplate(document)
}
