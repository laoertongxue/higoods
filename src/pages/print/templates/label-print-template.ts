import { renderRealQrPlaceholder } from '../../../components/real-qr.ts'
import { escapeHtml } from '../../../utils.ts'
import {
  buildPrintBarcodePayload,
  buildPrintQrPayload,
  createPrintDocumentId,
  formatPrintQty,
  getPrintGeneratedAt,
  type PrintBarcode,
  type PrintDocument,
  type PrintDocumentBuildInput,
  type PrintDocumentType,
  type PrintField,
  type PrintLabelItem,
  type PrintMode,
  type PrintPaperType,
  type PrintQrCode,
} from '../../../data/fcs/print-service.ts'
import { buildFeiTicketPrintProjection } from '../../process-factory/cutting/fei-ticket-print-projection.ts'
import { listGeneratedFeiTickets } from '../../../data/fcs/cutting/generated-fei-tickets.ts'
import { getCuttingOriginalOrderTaskPrintSourceById } from '../../../data/fcs/cutting-task-print-source.ts'
import { buildTransferBagsProjection } from '../../process-factory/cutting/transfer-bags-projection.ts'
import {
  getProcessHandoverRecordById,
  listProcessHandoverRecords,
  type ProcessHandoverRecord,
} from '../../../data/fcs/process-warehouse-domain.ts'

type AnyFeiTicket = Record<string, any>

type LabelKind = 'fei' | 'fei-reprint' | 'fei-void' | 'transfer-bag' | 'cutting-order' | 'handover'

const TEMPLATE_BY_DOCUMENT: Record<string, string> = {
  FEI_TICKET_LABEL: 'FEI_TICKET_LABEL',
  FEI_TICKET_REPRINT_LABEL: 'FEI_TICKET_REPRINT_LABEL',
  FEI_TICKET_VOID_LABEL: 'FEI_TICKET_VOID_LABEL',
  TRANSFER_BAG_LABEL: 'TRANSFER_BAG_LABEL',
  CUTTING_ORDER_QR_LABEL: 'CUTTING_ORDER_QR_LABEL',
  HANDOVER_QR_LABEL: 'HANDOVER_QR_LABEL',
}

function toText(value: string | number | undefined | null, fallback = '—'): string {
  if (value === undefined || value === null) return fallback
  const text = String(value).trim()
  return text || fallback
}

function now(): string {
  return getPrintGeneratedAt()
}

function fields(rows: Array<{ label: string; value: string | number | undefined | null; emphasis?: boolean }>): PrintField[] {
  return rows.map((row) => ({ label: row.label, value: toText(row.value), emphasis: row.emphasis }))
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>()
  const next: T[] = []
  items.forEach((item) => {
    const key = keyFn(item)
    if (!key || seen.has(key)) return
    seen.add(key)
    next.push(item)
  })
  return next
}

function generatedTicketToRecord(ticket: AnyFeiTicket): AnyFeiTicket {
  return {
    ...ticket,
    ticketRecordId: ticket.ticketRecordId || ticket.feiTicketId,
    ticketNo: ticket.ticketNo || ticket.feiTicketNo,
    quantity: ticket.quantity ?? ticket.actualCutPieceQty ?? ticket.qty,
    color: ticket.color || ticket.skuColor || ticket.garmentColor,
    size: ticket.size || ticket.skuSize,
    status: ticket.status || (ticket.printStatus === 'VOIDED' ? 'VOIDED' : 'PRINTED'),
    currentCraftStage: ticket.currentCraftStage || ticket.qrPayload?.currentCraftStage,
    processTags: ticket.processTags || ticket.secondaryCrafts || [],
  }
}

function listFeiRecords(): AnyFeiTicket[] {
  const projection = buildFeiTicketPrintProjection()
  const projected = (projection.ticketRecords || []) as AnyFeiTicket[]
  const generated = listGeneratedFeiTickets().map(generatedTicketToRecord)
  return uniqueBy([...projected, ...generated], (item) => toText(item.ticketRecordId || item.feiTicketId || item.ticketNo || item.feiTicketNo, ''))
}

function findFeiRecord(sourceId: string): AnyFeiTicket | null {
  const records = listFeiRecords()
  return records.find((item) => [
    item.ticketRecordId,
    item.feiTicketId,
    item.ticketNo,
    item.feiTicketNo,
  ].some((value) => value === sourceId)) || null
}

function listFeiRecordsForSource(sourceId: string): AnyFeiTicket[] {
  const records = listFeiRecords()
  if (sourceId.includes(',')) {
    const ids = sourceId.split(',').map((item) => item.trim()).filter(Boolean)
    return ids.map((id) => findFeiRecord(id)).filter(Boolean) as AnyFeiTicket[]
  }
  const exact = findFeiRecord(sourceId)
  if (exact) return [exact]

  const printableUnitKey = sourceId.startsWith('cut-order:') ? sourceId.replace(/^cut-order:/, '') : sourceId
  const byOriginal = records.filter((item) =>
    item.printableUnitId === sourceId
    || item.originalCutOrderId === printableUnitKey
    || item.originalCutOrderNo === printableUnitKey
    || item.sourceMergeBatchId === sourceId.replace(/^batch:/, '')
    || item.sourceMergeBatchNo === sourceId.replace(/^batch:/, '')
    || item.printableUnitNo === printableUnitKey,
  )
  if (byOriginal.length) return byOriginal.slice(0, 12)

  return records.slice(0, 1)
}

function resolveFeiTicketTargetRoute(record: AnyFeiTicket): string {
  const id = toText(record.ticketRecordId || record.feiTicketId || record.ticketNo)
  return `/fcs/craft/cutting/fei-tickets?feiTicketId=${encodeURIComponent(id)}`
}

function feiQr(record: AnyFeiTicket, documentType: PrintDocumentType, mode: PrintMode, isVoid = false): PrintQrCode {
  const sourceId = toText(record.ticketRecordId || record.feiTicketId || record.ticketNo)
  const businessNo = toText(record.ticketNo || record.feiTicketNo)
  const value = buildPrintQrPayload({
    documentType,
    sourceType: 'FEI_TICKET_RECORD',
    sourceId,
    businessNo,
    targetRoute: resolveFeiTicketTargetRoute(record),
    printVersionNo: toText(record.version || record.printVersionNo || (mode === '补打' ? `R${Math.max(Number(record.reprintCount || 0), 1)}` : 'V1')),
    isReprint: mode === '补打',
    isVoid,
    extra: {
      originalCutOrderId: record.originalCutOrderId,
      originalCutOrderNo: record.originalCutOrderNo,
      reprintVersionNo: mode === '补打' ? `R${Math.max(Number(record.reprintCount || 0), 1)}` : '',
    },
  })
  return { title: '菲票二维码', value, description: isVoid ? '扫码查看作废记录' : '扫码查看菲票', sizeMm: 30 }
}

function feiBarcode(record: AnyFeiTicket, documentType: PrintDocumentType): PrintBarcode {
  const sourceId = toText(record.ticketRecordId || record.feiTicketId || record.ticketNo)
  const businessNo = toText(record.ticketNo || record.feiTicketNo)
  return {
    title: '菲票条码',
    value: buildPrintBarcodePayload({ documentType, sourceType: 'FEI_TICKET_RECORD', sourceId, businessNo, printVersionNo: toText(record.version || 'V1') }),
    description: businessNo,
  }
}

function buildFeiLabelItem(record: AnyFeiTicket, input: PrintDocumentBuildInput, mode: PrintMode): PrintLabelItem {
  const documentType = input.documentType
  const isVoid = documentType === 'FEI_TICKET_VOID_LABEL' || record.status === 'VOIDED'
  const isReprint = documentType === 'FEI_TICKET_REPRINT_LABEL'
  const reprintCount = Math.max(Number(record.reprintCount || 1), 1)
  const ticketNo = toText(record.ticketNo || record.feiTicketNo)
  const title = isVoid ? '菲票作废标识' : isReprint ? '菲票补打标签' : '菲票'
  const subtitle = isVoid ? '已作废 · 不可流转' : isReprint ? `补打 · 第 ${reprintCount} 次补打` : '菲票归属原始裁片单'
  const warnings = isVoid
    ? ['已作废', '不可流转', '作废二维码只进入作废记录或菲票详情']
    : isReprint
      ? ['补打', `第 ${reprintCount} 次补打`, '补打不改变菲票归属']
      : ['菲票归属原始裁片单']

  const baseFields = fields([
    { label: '菲票号', value: ticketNo, emphasis: true },
    { label: '原始裁片单', value: record.originalCutOrderNo || record.originalCutOrderId, emphasis: true },
    { label: '生产单', value: record.productionOrderNo || record.sourceProductionOrderNo },
    { label: '款号', value: record.styleCode || record.spuCode },
    { label: 'SKU / 颜色 / 尺码', value: `${toText(record.materialSku)} / ${toText(record.color || record.fabricColor || record.garmentColor)} / ${toText(record.size || record.skuSize)}` },
    { label: '裁片部位', value: record.partName || record.pieceGroup },
    { label: '裁片数量', value: formatPrintQty(record.quantity ?? record.actualCutPieceQty ?? record.qty, '片'), emphasis: true },
    { label: '扎号', value: record.bundleNo || record.bundleScope },
    { label: '面料 SKU', value: record.materialSku },
    { label: '面料颜色', value: record.fabricColor || record.color || record.garmentColor },
    { label: '当前所在位置', value: record.boundPocketNo ? `中转袋 ${record.boundPocketNo}` : '裁片仓待流转' },
    { label: '当前状态', value: isVoid ? '已作废' : '有效流转' },
    { label: '是否已绑定中转袋', value: record.boundPocketNo ? '是' : '否' },
    { label: '中转袋号', value: record.boundPocketNo || '未绑定' },
    { label: '车缝任务号', value: record.boundUsageNo || '未分配' },
    { label: '特殊工艺', value: Array.isArray(record.processTags) ? record.processTags.join('、') : toText(record.currentCraftStage || '无') },
    { label: '菲票归属', value: '菲票归属原始裁片单', emphasis: true },
  ])

  const extraFields = isVoid
    ? fields([
      { label: '作废标识', value: '已作废 / 不可流转', emphasis: true },
      { label: '作废原因', value: record.voidReason || '二维码污损或现场作废' },
      { label: '作废人', value: record.voidedBy || '打票员' },
      { label: '作废时间', value: record.voidedAt || now() },
    ])
    : isReprint
      ? fields([
        { label: '补打标识', value: `补打 / 第 ${reprintCount} 次补打`, emphasis: true },
        { label: '补打版本', value: `R${reprintCount}` },
        { label: '补打原因', value: record.voidReason || '二维码污损，现场补打' },
        { label: '补打人', value: record.printedBy || '打票员' },
        { label: '补打时间', value: now() },
        { label: '原菲票号', value: ticketNo, emphasis: true },
      ])
      : []

  return {
    labelTitle: title,
    labelSubtitle: subtitle,
    labelFields: [...baseFields, ...extraFields],
    labelWarnings: warnings,
    qrCode: feiQr(record, documentType, mode, isVoid),
    barcode: feiBarcode(record, documentType),
    isVoid,
    isReprint,
    printMode: mode,
  }
}

function buildBaseLabelDocument(input: PrintDocumentBuildInput, options: {
  title: string
  subtitle: string
  templateCode: string
  sourceType: PrintDocument['sourceType']
  paperType: PrintPaperType
  mode: PrintMode
  labelItems: PrintLabelItem[]
  returnHref: string
}): PrintDocument {
  const firstItem = options.labelItems[0]
  const qr = firstItem?.qrCode
  const barcode = firstItem?.barcode
  return {
    printDocumentId: createPrintDocumentId(input, options.templateCode),
    documentType: input.documentType,
    documentTitle: options.title,
    sourceType: options.sourceType,
    sourceId: input.sourceId,
    templateCode: options.templateCode,
    paperType: options.paperType,
    orientation: 'portrait',
    printTitle: options.title,
    printSubtitle: options.subtitle,
    headerFields: firstItem?.labelFields.slice(0, 8) || [],
    imageBlocks: [],
    qrCodes: qr ? [qr] : [],
    barcodes: barcode ? [barcode] : [],
    sections: [],
    tables: [],
    signatureBlocks: [],
    differenceBlocks: [],
    footerFields: fields([
      { label: '打印模式', value: options.mode },
      { label: '打印时间', value: now() },
    ]),
    printMeta: {
      generatedAt: now(),
      generatedBy: 'FCS 打印服务',
      printNotice: '标签打印请确认标签纸规格、二维码清晰度和打印方向。',
      returnHref: options.returnHref,
    },
    labelSize: options.paperType,
    labelLayout: options.paperType === 'A4_LABEL_GRID' ? 'A4 多列标签' : '单张标签',
    printMode: options.mode,
    batchPrintId: `LABEL-BATCH-${input.sourceId}`.replace(/[^A-Za-z0-9_-]/g, '-'),
    printVersionNo: options.mode === '补打' ? 'R1' : 'V1',
    qrPayload: qr?.value || '',
    barcodePayload: barcode?.value || '',
    labelTitle: firstItem?.labelTitle || options.title,
    labelFields: firstItem?.labelFields || [],
    labelWarnings: firstItem?.labelWarnings || [],
    relatedObjectIds: options.labelItems.map((item) => item.labelFields.find((field) => field.label.includes('号'))?.value || '').filter(Boolean),
    isVoid: options.labelItems.some((item) => item.isVoid),
    isReprint: options.labelItems.some((item) => item.isReprint),
    copyIndex: 1,
    totalCopies: options.labelItems.length,
    labelItems: options.labelItems,
  }
}

function resolveFeiMode(documentType: PrintDocumentType): PrintMode {
  if (documentType === 'FEI_TICKET_REPRINT_LABEL') return '补打'
  if (documentType === 'FEI_TICKET_VOID_LABEL') return '作废'
  return '首次打印'
}

export function buildFeiTicketLabelPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const mode = resolveFeiMode(input.documentType)
  const records = listFeiRecordsForSource(input.sourceId)
  const items = records.map((record) => buildFeiLabelItem(record, input, mode))
  const paperType: PrintPaperType = items.length > 1 ? 'A4_LABEL_GRID' : 'LABEL_80_50'
  return buildBaseLabelDocument(input, {
    title: mode === '补打' ? '菲票补打标签' : mode === '作废' ? '菲票作废标识' : '菲票标签',
    subtitle: mode === '作废' ? '已作废 · 不可流转' : mode === '补打' ? '补打不改变菲票归属' : '菲票归属原始裁片单，合并裁剪批次仅作为执行上下文。',
    templateCode: TEMPLATE_BY_DOCUMENT[input.documentType] || 'FEI_TICKET_LABEL',
    sourceType: 'FEI_TICKET_RECORD',
    paperType,
    mode,
    labelItems: items,
    returnHref: '/fcs/craft/cutting/fei-tickets',
  })
}

export const buildFeiTicketReprintLabelPrintDocument = buildFeiTicketLabelPrintDocument
export const buildFeiTicketVoidLabelPrintDocument = buildFeiTicketLabelPrintDocument

export function buildTransferBagLabelPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const projection = buildTransferBagsProjection()
  const usage = projection.viewModel.usagesById[input.sourceId]
    || projection.viewModel.usages.find((item) => item.usageNo === input.sourceId || item.bagId === input.sourceId || item.bagCode === input.sourceId)
    || projection.viewModel.usages[0]
  const master = usage ? projection.viewModel.mastersById[usage.bagId] : projection.viewModel.masters[0]
  const usageExtra = usage as (typeof usage & { returnReceiptNo?: string; returnedFinishedQty?: number; returnStatusLabel?: string })
  const carrierTypeLabel = master?.bagType === 'box' || master?.carrierType === 'box' ? '周转箱' : '中转袋'
  const bindings = usage ? projection.viewModel.bindingsByUsageId[usage.usageId] || [] : []
  const sourceId = usage?.usageId || master?.bagId || input.sourceId
  const businessNo = usage?.usageNo || master?.bagCode || sourceId
  const qrValue = buildPrintQrPayload({
    documentType: 'TRANSFER_BAG_LABEL',
    sourceType: 'TRANSFER_BAG_RECORD',
    sourceId,
    businessNo,
    targetRoute: `/fcs/craft/cutting/transfer-bags?transferBagId=${encodeURIComponent(master?.bagId || '')}&usageId=${encodeURIComponent(usage?.usageId || '')}`,
    printVersionNo: 'V1',
    extra: {
      carrierCode: master?.bagCode || usage?.bagCode || '',
      bagCode: master?.bagCode || usage?.bagCode || '',
    },
  })
  const item: PrintLabelItem = {
    labelTitle: `${carrierTypeLabel}二维码`,
    labelSubtitle: '扫码查看载具与菲票绑定',
    labelFields: fields([
      { label: '载具类型', value: carrierTypeLabel, emphasis: true },
      { label: '载具编码', value: master?.bagCode || usage?.bagCode, emphasis: true },
      { label: '当前使用周期', value: usage?.usageNo || usage?.usageId },
      { label: '当前归属任务', value: usage?.sewingTaskNo || '待绑定车缝任务' },
      { label: '当前归属工厂', value: usage?.sewingFactoryName || '待绑定工厂' },
      { label: '绑定菲票数量', value: formatPrintQty(bindings.length || usage?.packedTicketCount, '张'), emphasis: true },
      { label: '绑定裁片数量', value: formatPrintQty(bindings.reduce((sum, binding) => sum + Number(binding.actualCutPieceQty || binding.qty || 0), 0), '片'), emphasis: true },
      { label: '当前状态', value: usage?.statusMeta?.label || master?.visibleStatusMeta?.label || '待装袋' },
      { label: '车缝任务号', value: usage?.sewingTaskNo || '未绑定' },
      { label: '车缝工厂', value: usage?.sewingFactoryName || '未绑定' },
      { label: '回仓任务', value: usageExtra?.returnReceiptNo || '待回仓' },
      { label: '成衣件数', value: usageExtra?.returnedFinishedQty ? formatPrintQty(usageExtra.returnedFinishedQty, '件') : '待回仓' },
      { label: '回仓状态', value: usageExtra?.returnStatusLabel || '待回仓' },
    ]),
    labelWarnings: ['一个载具在单次使用周期内只归属一个车缝任务。'],
    qrCode: { title: '载具二维码', value: qrValue, description: '扫码查看载具与菲票绑定', sizeMm: 32 },
    barcode: { title: '载具条码', value: buildPrintBarcodePayload({ documentType: 'TRANSFER_BAG_LABEL', sourceType: 'TRANSFER_BAG_RECORD', sourceId, businessNo }), description: businessNo },
    printMode: '普通打印',
  }
  return buildBaseLabelDocument(input, {
    title: `${carrierTypeLabel}二维码`,
    subtitle: '载具标签用于绑定多个菲票并追溯车缝任务与回仓。',
    templateCode: 'TRANSFER_BAG_LABEL',
    sourceType: 'TRANSFER_BAG_RECORD',
    paperType: 'LABEL_100_60',
    mode: '普通打印',
    labelItems: [item],
    returnHref: '/fcs/craft/cutting/transfer-bags',
  })
}

export function buildCuttingOrderQrLabelPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const source = getCuttingOriginalOrderTaskPrintSourceById(input.sourceId)
    || getCuttingOriginalOrderTaskPrintSourceById(input.sourceId.replace(/^cut-order:/, ''))
  const sourceId = source?.originalCutOrderId || input.sourceId.replace(/^cut-order:/, '')
  const businessNo = source?.originalCutOrderNo || sourceId
  const qrValue = buildPrintQrPayload({
    documentType: 'CUTTING_ORDER_QR_LABEL',
    sourceType: 'CUTTING_ORDER_RECORD',
    sourceId,
    businessNo,
    targetRoute: `/fcs/craft/cutting/original-orders?originalCutOrderId=${encodeURIComponent(sourceId)}`,
    printVersionNo: 'V1',
    extra: {
      originalCuttingOrderId: sourceId,
      originalCutOrderNo: businessNo,
    },
  })
  const item: PrintLabelItem = {
    labelTitle: '裁片单二维码',
    labelSubtitle: '裁片单二维码对应原始裁片单',
    labelFields: fields([
      { label: '原始裁片单号', value: businessNo, emphasis: true },
      { label: '生产单', value: source?.productionOrderNo },
      { label: '款号', value: source?.styleCode || source?.spuCode },
      { label: '面料 SKU', value: source?.materialSku },
      { label: '面料颜色', value: source?.materialLabel },
      { label: '计划裁片数量', value: formatPrintQty(source?.plannedQty, '片'), emphasis: true },
      { label: '配料状态', value: source?.prepStatusLabel },
      { label: '领料状态', value: source?.claimStatusLabel },
      { label: '当前裁剪状态', value: source?.currentStageLabel },
      { label: '裁片单二维码对应', value: '原始裁片单', emphasis: true },
      { label: '当前执行批次', value: source?.latestMergeBatchNo || '未合批' },
    ]),
    labelWarnings: ['菲票永远回落原始裁片单，合并裁剪批次只作为执行上下文。'],
    qrCode: { title: '裁片单二维码', value: qrValue, description: '扫码查看裁片单配料与领料信息', sizeMm: 32 },
    barcode: { title: '裁片单条码', value: buildPrintBarcodePayload({ documentType: 'CUTTING_ORDER_QR_LABEL', sourceType: 'CUTTING_ORDER_RECORD', sourceId, businessNo }), description: businessNo },
    printMode: '普通打印',
  }
  return buildBaseLabelDocument(input, {
    title: '裁片单二维码',
    subtitle: '用于配料、领料、裁床现场查询。',
    templateCode: 'CUTTING_ORDER_QR_LABEL',
    sourceType: 'CUTTING_ORDER_RECORD',
    paperType: 'LABEL_100_60',
    mode: '普通打印',
    labelItems: [item],
    returnHref: '/fcs/craft/cutting/original-orders',
  })
}

function objectQtyNoun(record: ProcessHandoverRecord): string {
  if (record.objectType === '面料') return record.qtyUnit === '卷' ? '面料卷数' : '面料米数'
  if (record.objectType === '裁片') return '裁片数量'
  if (record.objectType === '成衣') return '成衣件数'
  return '对象数量'
}

export function buildHandoverQrLabelPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const record = getProcessHandoverRecordById(input.sourceId) || listProcessHandoverRecords()[0]
  const sourceId = record?.handoverRecordId || input.sourceId
  const businessNo = record?.handoverRecordNo || sourceId
  const noun = record ? objectQtyNoun(record) : '对象数量'
  const qrValue = buildPrintQrPayload({
    documentType: 'HANDOVER_QR_LABEL',
    sourceType: 'HANDOVER_RECORD',
    sourceId,
    businessNo,
    targetRoute: `/fcs/progress/handover?handoverRecordId=${encodeURIComponent(sourceId)}`,
    printVersionNo: 'V1',
    extra: {
      handoverRecordId: sourceId,
      sourceWorkOrderId: record?.sourceWorkOrderId || '',
    },
  })
  const item: PrintLabelItem = {
    labelTitle: '交出记录二维码',
    labelSubtitle: '扫码查看交出记录',
    labelFields: fields([
      { label: '交出记录号', value: businessNo, emphasis: true },
      { label: '来源单据号', value: record?.sourceWorkOrderNo },
      { label: '生产单', value: record?.sourceProductionOrderNo },
      { label: '交出方', value: record?.handoverFactoryName },
      { label: '接收方', value: record?.receiveFactoryName || record?.receiveWarehouseName },
      { label: '交出对象类型', value: record?.objectType },
      { label: `交出${noun}`, value: formatPrintQty(record?.handoverObjectQty, record?.qtyUnit), emphasis: true },
      { label: `实收${noun}`, value: Number(record?.receiveObjectQty || 0) > 0 ? formatPrintQty(record?.receiveObjectQty, record?.qtyUnit) : '待回写', emphasis: true },
      { label: `差异${noun}`, value: formatPrintQty(record?.diffObjectQty, record?.qtyUnit), emphasis: true },
      { label: '当前状态', value: record?.status },
    ]),
    labelWarnings: ['交出二维码必须关联统一交出记录。'],
    qrCode: { title: '交出记录二维码', value: qrValue, description: '扫码查看交出记录', sizeMm: 32 },
    barcode: { title: '交出记录条码', value: buildPrintBarcodePayload({ documentType: 'HANDOVER_QR_LABEL', sourceType: 'HANDOVER_RECORD', sourceId, businessNo }), description: businessNo },
    printMode: '普通打印',
  }
  return buildBaseLabelDocument(input, {
    title: '交出记录二维码',
    subtitle: '用于交出、回写、差异追溯。',
    templateCode: 'HANDOVER_QR_LABEL',
    sourceType: 'HANDOVER_RECORD',
    paperType: 'LABEL_100_60',
    mode: '普通打印',
    labelItems: [item],
    returnHref: '/fcs/progress/handover',
  })
}

function renderField(field: PrintField): string {
  return `
    <div class="print-label-field${field.emphasis ? ' print-label-field-emphasis' : ''}">
      <span>${escapeHtml(field.label)}</span>
      <strong>${escapeHtml(field.value || '—')}</strong>
    </div>
  `
}

function renderBarcode(barcode?: PrintBarcode): string {
  if (!barcode) return ''
  return `
    <div class="print-label-barcode" aria-label="${escapeHtml(barcode.title)}">
      <div class="print-label-barcode-lines"></div>
      <div class="print-label-barcode-text">${escapeHtml(barcode.description || barcode.value)}</div>
    </div>
  `
}

function renderLabelItem(item: PrintLabelItem, paperType: PrintPaperType): string {
  const qr = item.qrCode
  return `
    <section class="print-label-card ${item.isVoid ? 'print-label-card-void' : ''} ${item.isReprint ? 'print-label-card-reprint' : ''} label-paper-${paperType.toLowerCase().replace(/_/g, '-')}">
      <div class="print-label-header">
        <div>
          <div class="print-label-title">${escapeHtml(item.labelTitle)}</div>
          ${item.labelSubtitle ? `<div class="print-label-subtitle">${escapeHtml(item.labelSubtitle)}</div>` : ''}
        </div>
        ${item.printMode ? `<div class="print-label-mode">${escapeHtml(item.printMode)}</div>` : ''}
      </div>
      <div class="print-label-body">
        <div class="print-label-fields">
          ${item.labelFields.map(renderField).join('')}
        </div>
        <aside class="print-label-qr-panel">
          <div class="print-label-qr">
            ${qr ? renderRealQrPlaceholder({ value: qr.value, size: 104, title: qr.title, label: qr.title }) : ''}
          </div>
          <div class="print-label-qr-desc">${escapeHtml(qr?.description || '扫码查看记录')}</div>
          ${renderBarcode(item.barcode)}
        </aside>
      </div>
      ${item.labelWarnings?.length ? `<div class="print-label-warnings">${item.labelWarnings.map((warning) => `<span>${escapeHtml(warning)}</span>`).join('')}</div>` : ''}
    </section>
  `
}

export function renderLabelPrintTemplate(doc: PrintDocument): string {
  const items = doc.labelItems?.length ? doc.labelItems : [{
    labelTitle: doc.labelTitle || doc.documentTitle,
    labelSubtitle: doc.printSubtitle,
    labelFields: doc.labelFields || doc.headerFields,
    labelWarnings: doc.labelWarnings || [],
    qrCode: doc.qrCodes[0],
    barcode: doc.barcodes[0],
    isVoid: doc.isVoid,
    isReprint: doc.isReprint,
    printMode: doc.printMode,
  }]
  const paperType = doc.paperType
  const isGrid = paperType === 'A4_LABEL_GRID'
  return `
    <article class="${isGrid ? 'print-paper-a4 print-label-grid-a4' : `print-label-paper label-paper-${paperType.toLowerCase().replace(/_/g, '-')}`}">
      <div class="${isGrid ? 'print-label-grid-sheet' : 'print-label-single-sheet'}">
        ${isGrid ? `<div class="print-label-grid-meta print-hidden">${escapeHtml(doc.documentTitle)} · ${escapeHtml(doc.printMeta.generatedAt)}</div>` : ''}
        ${items.map((item) => renderLabelItem(item, paperType)).join('')}
      </div>
    </article>
  `
}

export const FeiTicketLabelTemplate = renderLabelPrintTemplate
export const FeiTicketReprintLabelTemplate = renderLabelPrintTemplate
export const FeiTicketVoidLabelTemplate = renderLabelPrintTemplate
export const TransferBagLabelTemplate = renderLabelPrintTemplate
export const CuttingOrderQrLabelTemplate = renderLabelPrintTemplate
export const HandoverQrLabelTemplate = renderLabelPrintTemplate
