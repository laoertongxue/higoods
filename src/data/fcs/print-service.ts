import type { TaskRouteCardSourceType } from './task-print-cards.ts'

export type PrintDocumentType =
  | 'TASK_ROUTE_CARD'
  | 'TASK_DELIVERY_CARD'
  | 'PRODUCTION_CONFIRMATION'
  | 'MATERIAL_PREP_SLIP'
  | 'PICKUP_SLIP'
  | 'FEI_TICKET_LABEL'
  | 'TRANSFER_BAG_MANIFEST'
  | 'SETTLEMENT_CHANGE_REQUEST'

export type PrintSourceType =
  | TaskRouteCardSourceType
  | 'POST_FINISHING_WORK_ORDER'
  | 'HANDOVER_RECORD'

export type PrintPaperType = 'A4'
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

export function formatPrintQty(value: number | undefined | null, unit = ''): string {
  const safeValue = Number.isFinite(value) ? Number(value) : 0
  return `${safeValue.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit}`.trim()
}

export function getPrintGeneratedAt(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}
