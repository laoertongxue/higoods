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
import {
  buildFeiTicketLabelPrintProjection,
} from '../../process-factory/cutting/fei-ticket-print-projection.ts'
import {
  listSpreadingResultGeneratedFeiTickets,
} from '../../../data/fcs/cutting/generated-fei-tickets.ts'
import { listWoolFeiTicketPrintRecords } from '../../../data/fcs/wool-task-domain.ts'
import { getCuttingCutOrderTaskPrintSourceById } from '../../../data/fcs/cutting-task-print-source.ts'
import { buildBindingProcessOrders } from '../../process-factory/cutting/binding-strip-orders.ts'
import { buildTransferBagsProjection } from '../../process-factory/cutting/transfer-bags-projection.ts'
import {
  getProcessHandoverRecordById,
  listProcessHandoverRecords,
  type ProcessHandoverRecord,
} from '../../../data/fcs/process-warehouse-domain.ts'

type AnyFeiTicket = Record<string, any>

type LabelKind = 'fei' | 'fei-reprint' | 'transfer-bag' | 'cutting-order' | 'handover'

const TEMPLATE_BY_DOCUMENT: Record<string, string> = {
  FEI_TICKET_LABEL: 'FEI_TICKET_LABEL',
  FEI_TICKET_REPRINT_LABEL: 'FEI_TICKET_REPRINT_LABEL',
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

function bindingDetailToFeiRecord(order: ReturnType<typeof buildBindingProcessOrders>[number], detail: AnyFeiTicket): AnyFeiTicket {
  return {
    ticketSourceType: 'BINDING_STRIP',
    ticketRecordId: detail.feiTicketId,
    feiTicketId: detail.feiTicketId,
    ticketNo: detail.feiTicketNo,
    feiTicketNo: detail.feiTicketNo,
    bindingOrderId: order.bindingOrderId,
    bindingOrderNo: order.bindingOrderNo,
    bindingStripName: detail.bindingStripName,
    bindingStripNo: detail.bindingStripNo,
    bindingWidth: detail.bindingWidth,
    bindingWidthLabel: `${detail.bindingWidth} cm`,
    requiredLength: detail.requiredLength,
    requiredLengthLabel: `${Number(detail.requiredLength || 0).toFixed(2)} m`,
    actualLength: detail.actualLength,
    actualLengthLabel: detail.actualLength ? `${Number(detail.actualLength || 0).toFixed(2)} m` : '待回写',
    partName: detail.bindingStripName,
    size: `${detail.bindingWidth} cm`,
    businessSizeLabel: `${detail.bindingWidth} cm`,
    quantity: detail.requiredLength,
    qty: detail.requiredLength,
    productionOrderId: order.sourceProductionOrderId,
    productionOrderNo: order.sourceProductionOrderNo,
    cutOrderId: order.sourceCutOrderId,
    cutOrderNo: order.sourceCutOrderNo,
    markerPlanId: order.sourceMarkerPlanId,
    markerPlanNo: order.sourceMarkerPlanNo,
    sourceMarkerPlanNo: order.sourceMarkerPlanNo,
    sourceTechPackSpuCode: order.patternIdentity.patternFileName || order.sourcePatternPackageName,
    materialSku: order.materialIdentity.materialSku,
    materialName: order.materialIdentity.materialName,
    fabricColor: order.materialIdentity.materialColor,
    color: order.materialIdentity.materialColor,
    materialIdentity: {
      materialSku: order.materialIdentity.materialSku,
      materialName: order.materialIdentity.materialName,
      materialAlias: order.materialIdentity.materialAlias,
      materialColor: order.materialIdentity.materialColor,
      materialImageUrl: order.materialIdentity.materialImageUrl,
    },
    patternIdentity: {
      patternFileName: order.patternIdentity.patternFileName || order.sourcePatternPackageName,
      patternVersion: order.patternIdentity.patternVersion,
    },
    issuedAt: order.startedAt || order.completedAt,
    version: 1,
    printVersionNo: 'V1',
    hasSpecialCraft: false,
    specialCrafts: [],
  }
}

function listBindingFeiRecords(): AnyFeiTicket[] {
  return buildBindingProcessOrders().flatMap((order) =>
    order.status === '已取消'
      ? []
      : order.bindingDetails
        .filter((detail) => detail.printStatus !== '未生成')
        .map((detail) => bindingDetailToFeiRecord(order, detail)),
  )
}

function joinLabelLines(lines: string[], maxLines: number): string {
  const visible = lines.filter(Boolean).slice(0, maxLines)
  const hiddenCount = Math.max(lines.filter(Boolean).length - visible.length, 0)
  return hiddenCount ? `${visible.join('；')}；另 ${hiddenCount} 项见二维码` : visible.join('；')
}

function stripFeiTicketLabelPrefix(value: string): string {
  return value.replace(/^(裁片数量|部位数量|编号范围|编号区间|本票裁片)：/, '')
}

function listFeiRecords(documentType?: PrintDocumentType): AnyFeiTicket[] {
  const projection = buildFeiTicketPrintProjection()
  const projected = (projection.ticketRecords || []) as AnyFeiTicket[]
  const generated = listSpreadingResultGeneratedFeiTickets().map(generatedTicketToRecord)
  const wool = listWoolFeiTicketPrintRecords()
  const binding = listBindingFeiRecords()
  const cuttingRecords = documentType === 'FEI_TICKET_LABEL' ? generated : [...projected, ...generated]
  return uniqueBy([...cuttingRecords, ...binding, ...wool], (item) => toText(item.ticketRecordId || item.feiTicketId || item.ticketNo || item.feiTicketNo, ''))
}

function findFeiRecord(sourceId: string, documentType?: PrintDocumentType): AnyFeiTicket | null {
  const records = listFeiRecords(documentType)
  return records.find((item) => [
    item.ticketRecordId,
    item.feiTicketId,
    item.ticketNo,
    item.feiTicketNo,
  ].some((value) => value === sourceId)) || null
}

function listFeiRecordsForSource(sourceId: string, documentType?: PrintDocumentType): AnyFeiTicket[] {
  const records = listFeiRecords(documentType)
  if (sourceId.includes(',')) {
    const ids = sourceId.split(',').map((item) => item.trim()).filter(Boolean)
    return ids.map((id) => findFeiRecord(id, documentType)).filter(Boolean) as AnyFeiTicket[]
  }
  const exact = findFeiRecord(sourceId, documentType)
  if (exact) return [exact]

  const printableUnitKey = sourceId.startsWith('cut-order:') ? sourceId.replace(/^cut-order:/, '') : sourceId
  const byCutOrder = records.filter((item) =>
    item.printableUnitId === sourceId
    || item.cutOrderId === printableUnitKey
    || item.cutOrderNo === printableUnitKey
    || item.sourceMarkerPlanId === sourceId.replace(/^batch:/, '')
    || item.sourceMarkerPlanNo === sourceId.replace(/^batch:/, '')
    || item.printableUnitNo === printableUnitKey,
  )
  if (byCutOrder.length) return byCutOrder

  return []
}

function resolveFeiTicketTargetRoute(record: AnyFeiTicket): string {
  const id = toText(record.ticketRecordId || record.feiTicketId || record.ticketNo)
  if (record.ticketSourceType === 'WOOL_PART_PANEL') {
    return `/fcs/craft/wool/work-orders/${encodeURIComponent(toText(record.cutOrderId || id))}?tab=fei`
  }
  return `/fcs/craft/cutting/fei-tickets?feiTicketId=${encodeURIComponent(id)}`
}

function feiQr(record: AnyFeiTicket): PrintQrCode {
  const projection = buildFeiTicketLabelPrintProjection(record)
  const value = projection.qrDisplayValue
  return { title: '菲票二维码', value, description: '扫码查看菲票', sizeMm: 30 }
}

function resolveFeiPrintVersion(record: AnyFeiTicket, mode: PrintMode): string {
  const numericVersion = Number(record.version || 0)
  if (Number.isFinite(numericVersion) && numericVersion > 0) return `V${numericVersion}`
  if (mode === '补打') return `R${Math.max(Number(record.reprintCount || 0), 1)}`
  return toText(record.printVersionNo, 'V1')
}

function resolveFeiMarkerPlanNo(record: AnyFeiTicket): string {
  return toText(
    record.sourceMarkerPlanNo ||
    record.markerPlanNo ||
    record.batchNo,
  )
}

function resolveFeiSpreadingSessionNo(record: AnyFeiTicket): string {
  return toText(
    record.sourceSpreadingSessionNo ||
    record.spreadingSessionNo ||
    record.sourceSpreadingNo ||
    record.spreadingNo,
  )
}

function needsWideFeiLabel(item: PrintLabelItem): boolean {
  return item.labelFields.some((field) => String(field.value || '').length > 34)
    || item.labelFields.some((field) => field.label === '承接工厂' && String(field.value || '').includes('；'))
}

function buildFeiLabelItem(record: AnyFeiTicket, input: PrintDocumentBuildInput, mode: PrintMode): PrintLabelItem {
  const documentType = input.documentType
  const isWoolTicket = record.ticketSourceType === 'WOOL_PART_PANEL'
  const isBindingTicket = record.ticketSourceType === 'BINDING_STRIP'
  const isReprint = documentType === 'FEI_TICKET_REPRINT_LABEL'
  const ticketNo = toText(record.ticketNo || record.feiTicketNo)
  const title = isReprint ? '菲票补打标签' : isBindingTicket ? '捆条菲票' : isWoolTicket ? '毛织菲票' : '菲票'
  const printProjection = buildFeiTicketLabelPrintProjection(record)
  const version = resolveFeiPrintVersion(record, mode)
  const maxCraftPrintLines = printProjection.templateSize === '15cm x 10cm' ? 4 : 2
  const craftLines = printProjection.specialCraftDisplayLines.filter((line) => line && line !== '无')
  const craftPrintValue = craftLines.length
    ? `${printProjection.hasSpecialCraftLabel}：${joinLabelLines(craftLines, maxCraftPrintLines)}`
    : printProjection.hasSpecialCraftLabel
  const handoverCraftValue = joinLabelLines(printProjection.specialCraftHandoverLines, maxCraftPrintLines)

  const baseFields = isBindingTicket
    ? fields([
        { label: '菲票标题', value: '捆条菲票', emphasis: true },
        { label: '菲票号', value: printProjection.feiTicketNo || ticketNo, emphasis: true },
        { label: '捆条加工单', value: record.bindingOrderNo, emphasis: true },
        { label: '生产单', value: printProjection.productionOrderNo },
        { label: '裁片单', value: printProjection.cutOrderNo, emphasis: true },
        { label: '面料/颜色', value: printProjection.materialWithColorLabel, emphasis: true },
        { label: '捆条名称', value: record.bindingStripName || printProjection.partName, emphasis: true },
        { label: '捆条宽度', value: record.bindingWidthLabel || printProjection.businessSizeLabel, emphasis: true },
        { label: '计划长度', value: record.requiredLengthLabel, emphasis: true },
        { label: '实际长度', value: record.actualLengthLabel },
        { label: '纸样', value: record.patternIdentity?.patternFileName || printProjection.spuCode },
        { label: '版本', value: version },
      ])
    : fields([
        { label: '菲票标题', value: printProjection.titleLabel, emphasis: true },
        { label: '菲票号', value: printProjection.feiTicketNo || ticketNo, emphasis: true },
        { label: '生产单', value: printProjection.productionOrderNo },
        { label: isWoolTicket ? '毛织单' : '裁片单', value: printProjection.cutOrderNo, emphasis: true },
        { label: 'SPU', value: printProjection.spuCode },
        { label: '面料', value: printProjection.materialDisplayLabel, emphasis: true },
        { label: '面料/颜色', value: printProjection.materialWithColorLabel, emphasis: true },
        { label: '颜色', value: printProjection.color },
        { label: '尺码', value: printProjection.businessSizeLabel, emphasis: true },
        { label: '部位', value: printProjection.partName, emphasis: true },
        { label: '部位数量', value: stripFeiTicketLabelPrefix(printProjection.partQuantityLabel), emphasis: true },
        { label: '本票裁片', value: stripFeiTicketLabelPrefix(printProjection.actualCutPieceQtyLabel) },
        { label: '编号区间', value: stripFeiTicketLabelPrefix(printProjection.pieceSequenceLabel), emphasis: true },
        { label: '适用SKU', value: printProjection.applicableSkuLabel, emphasis: true },
        { label: '唛架方案', value: printProjection.markerPlanNo },
        { label: '唛架编号+铺布单号', value: printProjection.markerSpreadingLabel, emphasis: true },
        { label: '版本', value: version },
        { label: '特殊工艺', value: craftPrintValue },
        { label: '特殊工艺交出', value: handoverCraftValue },
        { label: '承接工厂', value: joinLabelLines(printProjection.receiverFactoryDisplayLines, maxCraftPrintLines) },
        { label: '特殊工艺 / 承接工厂', value: handoverCraftValue },
      ])

  return {
    labelTitle: title,
    labelSubtitle: '',
    labelFields: baseFields,
    labelBusinessLayout: 'FEI_TICKET_BUSINESS',
    labelWarnings: [],
    qrCode: feiQr(record),
    isVoid: false,
    isReprint,
    printMode: undefined,
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
  return '首次打印'
}

export function buildFeiTicketLabelPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const mode = resolveFeiMode(input.documentType)
  const records = listFeiRecordsForSource(input.sourceId, input.documentType)
  const items = records.map((record) => buildFeiLabelItem(record, input, mode))
  const paperType: PrintPaperType = items.length > 1
    ? 'A4_LABEL_GRID'
    : items.some(needsWideFeiLabel)
      ? 'LABEL_150_100'
      : 'LABEL_100_100'
  const isWoolTicket = records.some((record) => record.ticketSourceType === 'WOOL_PART_PANEL')
  const isBindingTicket = records.some((record) => record.ticketSourceType === 'BINDING_STRIP')
  const bindingOrderId = toText(records.find((record) => record.ticketSourceType === 'BINDING_STRIP')?.bindingOrderId, '')
  const bindingRouteToken = bindingOrderId.startsWith('binding:') ? bindingOrderId : `binding:${bindingOrderId}`
  return buildBaseLabelDocument(input, {
    title: isBindingTicket && mode === '首次打印' ? '捆条菲票标签' : isWoolTicket && mode === '首次打印' ? '毛织菲票标签' : mode === '补打' ? '菲票补打标签' : '菲票标签',
    subtitle: mode === '补打'
      ? '补打标签'
        : isBindingTicket
          ? '捆条菲票。'
        : isWoolTicket
          ? '毛织菲票。'
          : '菲票。',
    templateCode: TEMPLATE_BY_DOCUMENT[input.documentType] || 'FEI_TICKET_LABEL',
    sourceType: 'FEI_TICKET_RECORD',
    paperType,
    mode,
    labelItems: items,
    returnHref: isBindingTicket && bindingOrderId ? `/fcs/craft/cutting/fei-tickets/${encodeURIComponent(bindingRouteToken)}` : isWoolTicket ? '/fcs/craft/wool/fei-tickets' : '/fcs/craft/cutting/fei-tickets',
  })
}

export const buildFeiTicketReprintLabelPrintDocument = buildFeiTicketLabelPrintDocument

export function buildTransferBagLabelPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const projection = buildTransferBagsProjection()
  const matchedMaster = projection.viewModel.mastersById[input.sourceId]
    || projection.viewModel.masters.find((item) =>
      item.bagId === input.sourceId
      || item.bagCode === input.sourceId
      || item.carrierId === input.sourceId
      || item.carrierCode === input.sourceId,
    )
    || null
  const matchedUsage = projection.viewModel.usagesById[input.sourceId]
    || projection.viewModel.usages.find((item) => item.usageNo === input.sourceId)
    || matchedMaster?.currentUsage
    || null
  const usage = matchedUsage
  const master = matchedMaster || (usage ? projection.viewModel.mastersById[usage.bagId] : null) || projection.viewModel.masters[0]
  const carrierTypeLabel = master?.bagType === 'box' || master?.carrierType === 'box' ? '周转箱' : '中转袋'
  const sourceId = master?.bagId || master?.carrierId || input.sourceId
  const businessNo = master?.bagCode || master?.carrierCode || sourceId
  const ownershipFactoryName = master?.ownershipFactoryName || '裁床厂'
  const qrValue = buildPrintQrPayload({
    documentType: 'TRANSFER_BAG_LABEL',
    sourceType: 'TRANSFER_BAG_RECORD',
    sourceId,
    businessNo,
    targetRoute: `/fcs/craft/cutting/transfer-bags?transferBagId=${encodeURIComponent(sourceId)}&bagCode=${encodeURIComponent(businessNo)}`,
    printVersionNo: 'V1',
    extra: {
      carrierId: master?.carrierId || master?.bagId || sourceId,
      carrierCode: businessNo,
      bagCode: businessNo,
      carrierType: master?.carrierType || (carrierTypeLabel === '周转箱' ? 'box' : 'bag'),
      ownershipFactoryId: master?.ownershipFactoryId || '',
      ownershipFactoryName,
    },
  })
  const item: PrintLabelItem = {
    labelTitle: `${carrierTypeLabel}二维码`,
    labelSubtitle: '扫码查看中转袋档案',
    labelFields: fields([
      { label: '载具类型', value: carrierTypeLabel, emphasis: true },
      { label: '中转袋编号', value: businessNo, emphasis: true },
      { label: '所属工厂', value: ownershipFactoryName, emphasis: true },
      { label: '容量', value: master?.capacity ? `${master.capacity} 张菲票` : '' },
      { label: '规格', value: master?.bagSpec },
      { label: '材质', value: master?.bagMaterial },
      { label: '是否启用', value: master?.enabled === false ? '停用' : '启用' },
      { label: '是否可复用', value: master?.reusable === false ? '不可复用' : '可复用' },
      { label: '建档时间', value: master?.createdAt },
    ]),
    labelWarnings: ['本码只代表中转袋档案，不代表当前流转记录。'],
    qrCode: { title: '中转袋档案二维码', value: qrValue, description: '扫码查看中转袋档案', sizeMm: 32 },
    barcode: { title: '中转袋档案条码', value: buildPrintBarcodePayload({ documentType: 'TRANSFER_BAG_LABEL', sourceType: 'TRANSFER_BAG_RECORD', sourceId, businessNo }), description: businessNo },
    printMode: '普通打印',
  }
  return buildBaseLabelDocument(input, {
    title: `${carrierTypeLabel}二维码`,
    subtitle: '中转袋档案标签用于识别载具主档。',
    templateCode: 'TRANSFER_BAG_LABEL',
    sourceType: 'TRANSFER_BAG_RECORD',
    paperType: 'LABEL_100_60',
    mode: '普通打印',
    labelItems: [item],
    returnHref: '/fcs/craft/cutting/transfer-bags',
  })
}

export function buildCuttingOrderQrLabelPrintDocument(input: PrintDocumentBuildInput): PrintDocument {
  const source = getCuttingCutOrderTaskPrintSourceById(input.sourceId)
    || getCuttingCutOrderTaskPrintSourceById(input.sourceId.replace(/^cut-order:/, ''))
  const sourceId = source?.cutOrderId || input.sourceId.replace(/^cut-order:/, '')
  const businessNo = source?.cutOrderNo || sourceId
  const qrValue = buildPrintQrPayload({
    documentType: 'CUTTING_ORDER_QR_LABEL',
    sourceType: 'CUTTING_ORDER_RECORD',
    sourceId,
    businessNo,
    targetRoute: `/fcs/craft/cutting/cut-orders?cutOrderId=${encodeURIComponent(sourceId)}`,
    printVersionNo: 'V1',
    extra: {
      cutOrderId: sourceId,
      cutOrderNo: businessNo,
    },
  })
  const item: PrintLabelItem = {
    labelTitle: '裁片单二维码',
    labelSubtitle: '裁片单二维码对应裁片单',
    labelFields: fields([
      { label: '裁片单号', value: businessNo, emphasis: true },
      { label: '生产单', value: source?.productionOrderNo },
      { label: '款号', value: source?.styleCode || source?.spuCode },
      { label: '面料 SKU', value: source?.materialSku },
      { label: '面料颜色', value: source?.materialLabel },
      { label: '计划裁片数量', value: formatPrintQty(source?.plannedQty, '片'), emphasis: true },
      { label: '中转仓已配', value: source?.prepStatusLabel },
      { label: '裁床已领', value: source?.claimStatusLabel },
      { label: '裁片单状态', value: source?.currentStageLabel },
      { label: '裁片单二维码对应', value: '裁片单', emphasis: true },
      { label: '当前唛架方案', value: source?.latestMarkerPlanNo || '未进入唛架方案' },
    ]),
    labelWarnings: ['菲票永远回落裁片单，唛架方案只作为执行上下文。'],
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
    returnHref: '/fcs/craft/cutting/cut-orders',
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
      { label: `实收${noun}`, value: Number(record?.receiveObjectQty || 0) > 0 ? formatPrintQty(record?.receiveObjectQty, record?.qtyUnit) : '待确认收货', emphasis: true },
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
    subtitle: '用于交出、收货确认、差异追溯。',
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

function getLabelFieldValue(item: PrintLabelItem, label: string, fallback = '—'): string {
  return toText(item.labelFields.find((field) => field.label === label)?.value, fallback)
}

function renderFeiBusinessCell(label: string, value: string, options: { className?: string; emphasis?: boolean } = {}): string {
  return `
    <div class="fei-ticket-business-cell ${options.className || ''}">
      <span>${escapeHtml(label)}</span>
      <strong class="${options.emphasis ? 'fei-ticket-business-emphasis' : ''}">${escapeHtml(value || '—')}</strong>
    </div>
  `
}

function isBindingStripFeiLabelItem(item: PrintLabelItem): boolean {
  return getLabelFieldValue(item, '菲票标题', item.labelTitle) === '捆条菲票'
}

function renderBindingStripFeiBusinessLabelItem(item: PrintLabelItem, paperType: PrintPaperType): string {
  const qr = item.qrCode
  return `
    <section class="print-label-card fei-ticket-business-card ${item.isVoid ? 'print-label-card-void' : ''} ${item.isReprint ? 'print-label-card-reprint' : ''} label-paper-${paperType.toLowerCase().replace(/_/g, '-')}">
      <div class="fei-ticket-business-title">${escapeHtml(getLabelFieldValue(item, '菲票标题', item.labelTitle))}</div>
      <div class="fei-ticket-business-body">
        <div class="fei-ticket-business-grid">
          ${renderFeiBusinessCell('捆条加工单', getLabelFieldValue(item, '捆条加工单'), { emphasis: true })}
          ${renderFeiBusinessCell('生产单', getLabelFieldValue(item, '生产单'))}
          ${renderFeiBusinessCell('裁片单', getLabelFieldValue(item, '裁片单'), { emphasis: true })}
          ${renderFeiBusinessCell('面料 / 颜色', getLabelFieldValue(item, '面料/颜色'), { className: 'fei-ticket-business-span-2', emphasis: true })}
          ${renderFeiBusinessCell('捆条名称', getLabelFieldValue(item, '捆条名称'), { emphasis: true })}
          ${renderFeiBusinessCell('捆条宽度', getLabelFieldValue(item, '捆条宽度'), { emphasis: true })}
          ${renderFeiBusinessCell('计划长度', getLabelFieldValue(item, '计划长度'), { emphasis: true })}
          ${renderFeiBusinessCell('实际长度', getLabelFieldValue(item, '实际长度'))}
          ${renderFeiBusinessCell('纸样', getLabelFieldValue(item, '纸样'), { className: 'fei-ticket-business-span-2' })}
          ${renderFeiBusinessCell('菲票号', getLabelFieldValue(item, '菲票号'), { emphasis: true })}
        </div>
        <aside class="fei-ticket-business-qr-panel">
          <div class="fei-ticket-business-qr">
            ${qr ? renderRealQrPlaceholder({ value: qr.value, size: 112, title: qr.title, label: qr.title }) : ''}
          </div>
          <div class="fei-ticket-business-qr-title">捆条菲票二维码</div>
          <div class="fei-ticket-business-qr-desc">${escapeHtml(getLabelFieldValue(item, '版本', 'V1'))} / 扫码查看捆条菲票</div>
        </aside>
      </div>
    </section>
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

function renderFeiTicketBusinessLabelItem(item: PrintLabelItem, paperType: PrintPaperType): string {
  if (isBindingStripFeiLabelItem(item)) return renderBindingStripFeiBusinessLabelItem(item, paperType)

  const qr = item.qrCode
  return `
    <section class="print-label-card fei-ticket-business-card ${item.isVoid ? 'print-label-card-void' : ''} ${item.isReprint ? 'print-label-card-reprint' : ''} label-paper-${paperType.toLowerCase().replace(/_/g, '-')}">
      <div class="fei-ticket-business-title">${escapeHtml(getLabelFieldValue(item, '菲票标题', item.labelTitle))}</div>
      <div class="fei-ticket-business-body">
        <div class="fei-ticket-business-grid">
          ${renderFeiBusinessCell('面料 / 颜色', getLabelFieldValue(item, '面料/颜色', getLabelFieldValue(item, '面料')), { emphasis: true })}
          ${renderFeiBusinessCell('唛架编号+铺布单号', getLabelFieldValue(item, '唛架编号+铺布单号'), { emphasis: true })}
          ${renderFeiBusinessCell('部位', getLabelFieldValue(item, '部位'), { emphasis: true })}
          ${renderFeiBusinessCell('尺码', getLabelFieldValue(item, '尺码'), { emphasis: true })}
          ${renderFeiBusinessCell('部位数量', getLabelFieldValue(item, '部位数量'), { emphasis: true })}
          ${renderFeiBusinessCell('编号区间', getLabelFieldValue(item, '编号区间'), { emphasis: true })}
          ${renderFeiBusinessCell('适用SKU', getLabelFieldValue(item, '适用SKU'), { className: 'fei-ticket-business-span-2' })}
          ${renderFeiBusinessCell('特殊工艺 / 承接工厂', getLabelFieldValue(item, '特殊工艺 / 承接工厂', getLabelFieldValue(item, '特殊工艺交出', getLabelFieldValue(item, '特殊工艺'))), { className: 'fei-ticket-business-span-2', emphasis: true })}
          ${renderFeiBusinessCell('菲票号', getLabelFieldValue(item, '菲票号'), { emphasis: true })}
          ${renderFeiBusinessCell('本票裁片', getLabelFieldValue(item, '本票裁片'))}
        </div>
        <aside class="fei-ticket-business-qr-panel">
          <div class="fei-ticket-business-qr">
            ${qr ? renderRealQrPlaceholder({ value: qr.value, size: 112, title: qr.title, label: qr.title }) : ''}
          </div>
          <div class="fei-ticket-business-qr-title">菲票二维码</div>
          <div class="fei-ticket-business-qr-desc">${escapeHtml(getLabelFieldValue(item, '版本', 'V1'))} / 扫码查看菲票</div>
        </aside>
      </div>
    </section>
  `
}

function renderLabelItem(item: PrintLabelItem, paperType: PrintPaperType): string {
  if (item.labelBusinessLayout === 'FEI_TICKET_BUSINESS') return renderFeiTicketBusinessLabelItem(item, paperType)

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
