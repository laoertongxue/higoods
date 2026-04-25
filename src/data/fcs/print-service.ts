import type { TaskRouteCardSourceType } from './task-print-cards.ts'

export type PrintDocumentType =
  | 'TASK_ROUTE_CARD'
  | 'TASK_DELIVERY_CARD'
  | 'PRODUCTION_CONFIRMATION'
  | 'MAKE_GOODS_CONFIRMATION'
  | 'MATERIAL_PREP_SLIP'
  | 'PICKUP_SLIP'
  | 'ISSUE_SLIP'
  | 'SUPPLEMENT_MATERIAL_SLIP'
  | 'FEI_TICKET_LABEL'
  | 'FEI_TICKET_REPRINT_LABEL'
  | 'FEI_TICKET_VOID_LABEL'
  | 'TRANSFER_BAG_LABEL'
  | 'CUTTING_ORDER_QR_LABEL'
  | 'HANDOVER_QR_LABEL'
  | 'TRANSFER_BAG_MANIFEST'
  | 'SETTLEMENT_CHANGE_REQUEST'
  | 'HANDOVER_DIFFERENCE_REQUEST'
  | 'QUALITY_DEDUCTION_CONFIRMATION'
  | 'QUALITY_DISPUTE_PROCESSING'
  | 'MASTER_DATA_CHANGE_REQUEST'

export type PrintSourceType =
  | TaskRouteCardSourceType
  | 'POST_FINISHING_WORK_ORDER'
  | 'HANDOVER_RECORD'
  | 'MATERIAL_PREP_RECORD'
  | 'PICKUP_SLIP_RECORD'
  | 'ISSUE_SLIP_RECORD'
  | 'SUPPLEMENT_MATERIAL_RECORD'
  | 'FEI_TICKET_RECORD'
  | 'TRANSFER_BAG_RECORD'
  | 'CUTTING_ORDER_RECORD'
  | 'PRODUCTION_ORDER'
  | 'SETTLEMENT_CHANGE_REQUEST_RECORD'
  | 'HANDOVER_DIFFERENCE_RECORD'
  | 'QUALITY_DEDUCTION_PENDING_RECORD'
  | 'QUALITY_DISPUTE_RECORD'
  | 'MASTER_DATA_CHANGE_REQUEST_RECORD'

export type PrintPaperType = 'A4' | 'LABEL_80_50' | 'LABEL_100_60' | 'LABEL_60_40' | 'A4_LABEL_GRID'
export type PrintOrientation = 'portrait'

export interface PrintField {
  label: string
  value: string
  emphasis?: boolean
}

export interface PrintImageBlock {
  title: string
  imageUrl?: string
  imageLabel: string
  sourceLabel: string
  fallbackLabel: string
}

export interface PrintQrCode {
  title: string
  value: string
  description: string
  sizeMm: number
}

export interface PrintBarcode {
  title: string
  value: string
  description?: string
}

export interface PrintTable {
  tableId: string
  title: string
  headers: string[]
  rows: string[][]
  minRows?: number
}

export interface PrintSection {
  sectionId: string
  title: string
  fields: PrintField[]
  note?: string
}

export interface PrintSignatureBlock {
  label: string
  signerRole: string
}

export interface PrintDifferenceBlock {
  title: string
  headers: string[]
  rows: string[][]
  minRows?: number
}

export type PrintMode = '首次打印' | '继续打印' | '补打' | '作废' | '普通打印'
export type PrintLabelLayout = '单张标签' | 'A4 多列标签' | 'A4 多行标签'

export interface PrintLabelItem {
  labelTitle: string
  labelSubtitle?: string
  labelFields: PrintField[]
  labelWarnings?: string[]
  qrCode?: PrintQrCode
  barcode?: PrintBarcode
  isVoid?: boolean
  isReprint?: boolean
  printMode?: PrintMode
}

export interface PrintMeta {
  generatedAt: string
  generatedBy: string
  printNotice: string
  returnHref?: string
}

export interface PrintDocument {
  printDocumentId: string
  documentType: PrintDocumentType
  documentTitle: string
  sourceType: PrintSourceType
  sourceId: string
  templateCode: string
  paperType: PrintPaperType
  orientation: PrintOrientation
  printTitle: string
  printSubtitle: string
  headerFields: PrintField[]
  imageBlocks: PrintImageBlock[]
  qrCodes: PrintQrCode[]
  barcodes: PrintBarcode[]
  sections: PrintSection[]
  tables: PrintTable[]
  signatureBlocks: PrintSignatureBlock[]
  differenceBlocks: PrintDifferenceBlock[]
  footerFields: PrintField[]
  printMeta: PrintMeta
  labelSize?: PrintPaperType
  labelLayout?: PrintLabelLayout
  printMode?: PrintMode
  batchPrintId?: string
  printVersionNo?: string
  qrPayload?: string
  barcodePayload?: string
  labelTitle?: string
  labelFields?: PrintField[]
  labelWarnings?: string[]
  relatedObjectIds?: string[]
  isVoid?: boolean
  isReprint?: boolean
  copyIndex?: number
  totalCopies?: number
  labelItems?: PrintLabelItem[]
}

export interface PrintDocumentBuildInput {
  documentType: PrintDocumentType
  sourceType: PrintSourceType
  sourceId: string
  handoverRecordId?: string
}

function encodeParam(value: string): string {
  return encodeURIComponent(value)
}

export function buildUnifiedPrintPreviewLink(input: PrintDocumentBuildInput): string {
  const params = new URLSearchParams({
    documentType: input.documentType,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
  })
  if (input.handoverRecordId) {
    params.set('handoverRecordId', input.handoverRecordId)
  }
  return `/fcs/print/preview?${params.toString()}`
}

export function buildLegacyTaskRouteCardPrintLink(sourceType: TaskRouteCardSourceType, sourceId: string): string {
  return `/fcs/print/task-route-card?sourceType=${encodeParam(sourceType)}&sourceId=${encodeParam(sourceId)}`
}

export function createPrintDocumentId(input: PrintDocumentBuildInput, templateCode: string): string {
  return `${templateCode}-${input.sourceType}-${input.sourceId}`.replace(/[^A-Za-z0-9_-]/g, '-')
}

export function buildPrintQrPayload(input: {
  documentType: PrintDocumentType
  sourceType: PrintSourceType
  sourceId: string
  businessNo: string
  targetRoute: string
  printVersionNo?: string
  isReprint?: boolean
  isVoid?: boolean
  extra?: Record<string, string | number | boolean | undefined | null>
}): string {
  return JSON.stringify({
    documentType: input.documentType,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    businessNo: input.businessNo,
    targetRoute: input.targetRoute,
    printVersionNo: input.printVersionNo || '',
    isReprint: Boolean(input.isReprint),
    isVoid: Boolean(input.isVoid),
    ...(input.extra || {}),
  })
}

export function buildPrintBarcodePayload(input: {
  documentType: PrintDocumentType
  sourceType: PrintSourceType
  sourceId: string
  businessNo: string
  printVersionNo?: string
}): string {
  return [
    input.documentType,
    input.sourceType,
    input.businessNo,
    input.printVersionNo || 'V1',
    input.sourceId,
  ].join('|')
}

export function formatPrintQty(value: number | undefined | null, unit = ''): string {
  const safeValue = Number.isFinite(value) ? Number(value) : 0
  return `${safeValue.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`.trim()
}

export function getPrintGeneratedAt(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}
