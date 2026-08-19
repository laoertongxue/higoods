import { getBrowserLocalStorage, type BrowserStorageLike } from '../../browser-storage.ts'
import {
  listCuttingRuntimeEventsByType,
  type FeiTicketBagSnapshotItem,
  type FeiTicketBaggingPayload,
} from './cutting-runtime-event-ledger.ts'

export const TRANSFER_BAG_GOODS_LABEL_MAX_COLORS = 4
export const TRANSFER_BAG_GOODS_LABEL_MAX_SIZES_WITH_MANY_COLORS = 6
export const TRANSFER_BAG_GOODS_LABEL_MAX_SIZES_WITH_FEW_COLORS = 8

export interface TransferBagGoodsLabelSource {
  usageCycleId: string
  bagCode: string
  baggingAt: string
  tickets: FeiTicketBagSnapshotItem[]
}

export interface TransferBagGoodsLabelMatrixRow {
  color: string
  quantities: number[]
  pageTotal: number
}

export interface TransferBagGoodsLabelPage {
  usageCycleId: string
  bagCode: string
  productionOrderNo: string
  spuCodes: string[]
  partCount: number
  sizes: string[]
  rows: TransferBagGoodsLabelMatrixRow[]
  sizeTotals: number[]
  pagePieceQty: number
  totalPieceQty: number
  ticketCount: number
  totalColorCount: number
  totalSizeCount: number
  pageIndex: number
  pageCount: number
  baggingAt: string
}

function uniqueNonEmpty(values: readonly string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function toNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function normalizeSnapshotItem(value: unknown, fallback: { productionOrderId: string; productionOrderNo: string; cutOrderId: string; cutOrderNo: string }): FeiTicketBagSnapshotItem {
  const item = toRecord(value)
  const hasSpecialCraft = Boolean(item.hasSpecialCraft)
  return {
    feiTicketId: toText(item.feiTicketId),
    feiTicketNo: toText(item.feiTicketNo),
    productionOrderId: toText(item.productionOrderId) || fallback.productionOrderId,
    productionOrderNo: toText(item.productionOrderNo) || fallback.productionOrderNo,
    spreadingOrderId: toText(item.spreadingOrderId),
    spreadingOrderNo: toText(item.spreadingOrderNo),
    cutOrderId: toText(item.cutOrderId) || fallback.cutOrderId,
    cutOrderNo: toText(item.cutOrderNo) || fallback.cutOrderNo,
    spuCode: toText(item.spuCode) || '未记录',
    color: toText(item.color),
    size: toText(item.size),
    partCode: toText(item.partCode),
    partName: toText(item.partName) || '未记录',
    pieceQty: toNumber(item.pieceQty),
    unit: '片',
    pieceSequenceLabel: toText(item.pieceSequenceLabel) || '按菲票追踪',
    hasSpecialCraft,
    specialCraftCategory: toText(item.specialCraftCategory) || (hasSpecialCraft ? '特殊工艺待维护' : '无'),
    specialCraftDisplay: toText(item.specialCraftDisplay) || (hasSpecialCraft ? '特殊工艺待维护' : '无'),
    receiverFactoryDisplay: toText(item.receiverFactoryDisplay) || toText(item.receiverFactoryName) || (hasSpecialCraft ? '承接工厂待补充' : '无'),
    printStatus: toText(item.printStatus) || '已打印',
    voidStatus: toText(item.voidStatus) || '有效',
  }
}

function chunk<T>(values: readonly T[], size: number): T[][] {
  const groups: T[][] = []
  for (let index = 0; index < values.length; index += size) groups.push(values.slice(index, index + size))
  return groups
}

function apparelSizeRank(value: string): number {
  const normalized = value.trim().toUpperCase().replace(/\s+/g, '')
  const fixedOrder = ['XXXS', '3XS', 'XXS', '2XS', 'XS', 'S', 'M', 'L', 'XL', '1XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL']
  const fixedIndex = fixedOrder.indexOf(normalized)
  if (fixedIndex >= 0) return fixedIndex
  const numeric = Number(normalized)
  if (Number.isFinite(numeric)) return 1000 + numeric
  return 10000
}

function compareApparelSizes(left: string, right: string): number {
  return apparelSizeRank(left) - apparelSizeRank(right)
    || left.localeCompare(right, 'zh-CN', { numeric: true, sensitivity: 'base' })
}

function isVoidedTicket(ticket: FeiTicketBagSnapshotItem): boolean {
  return ticket.voidStatus.includes('作废') || ticket.printStatus.includes('作废')
}

function assertSourceCanPrint(source: TransferBagGoodsLabelSource): void {
  if (!source.usageCycleId.trim()) throw new Error('货物标识缺少中转袋使用周期，不能打印。')
  if (!source.bagCode.trim()) throw new Error('货物标识缺少中转袋编号，不能打印。')
  if (!source.tickets.length) throw new Error(`${source.bagCode} 没有菲票装袋快照，不能打印货物标识。`)
  const voided = source.tickets.filter(isVoidedTicket).map((ticket) => ticket.feiTicketNo || ticket.feiTicketId)
  if (voided.length) throw new Error(`${source.bagCode} 包含已作废菲票：${uniqueNonEmpty(voided).join('、')}。请先检查装袋内容。`)
  const invalidQty = source.tickets
    .filter((ticket) => !Number.isSafeInteger(Number(ticket.pieceQty)) || Number(ticket.pieceQty) <= 0)
    .map((ticket) => ticket.feiTicketNo || ticket.feiTicketId)
  if (invalidQty.length) throw new Error(`${source.bagCode} 包含非正整数裁片数量：${uniqueNonEmpty(invalidQty).join('、')}。请先检查装袋内容。`)
  const missingDimensions = source.tickets
    .filter((ticket) => !ticket.color.trim() || !ticket.size.trim())
    .map((ticket) => ticket.feiTicketNo || ticket.feiTicketId)
  if (missingDimensions.length) throw new Error(`${source.bagCode} 的菲票缺少颜色或尺码：${uniqueNonEmpty(missingDimensions).join('、')}。请先补齐后打印。`)
  const productionOrders = uniqueNonEmpty(source.tickets.map((ticket) => ticket.productionOrderNo))
  if (productionOrders.length !== 1) throw new Error(`${source.bagCode} 必须只包含一个生产单，当前为：${productionOrders.join('、') || '未记录'}。`)
}

export function resolveTransferBagGoodsLabelSource(
  usageCycleId: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): TransferBagGoodsLabelSource | null {
  const normalizedId = usageCycleId.trim()
  if (!normalizedId) return null
  const event = listCuttingRuntimeEventsByType('菲票装袋', storage)
    .filter((candidate) => candidate.eventStatus !== '已取消')
    .find((candidate) => (candidate.refs.usageCycleId || candidate.eventId) === normalizedId)
  if (!event) return null
  const payload = event.payload as FeiTicketBaggingPayload
  return {
    usageCycleId: event.refs.usageCycleId || event.eventId,
    bagCode: payload.bagCode || event.refs.transferBagCode || '',
    baggingAt: payload.baggingAt || event.occurredAt,
    tickets: (Array.isArray(payload.feiTicketItems) ? payload.feiTicketItems : []).map((item) => normalizeSnapshotItem(item, {
      productionOrderId: event.refs.productionOrderId || '',
      productionOrderNo: event.refs.productionOrderNo || '',
      cutOrderId: event.refs.cutOrderId || '',
      cutOrderNo: event.refs.cutOrderNo || '',
    })),
  }
}

export function buildTransferBagGoodsLabelPages(source: TransferBagGoodsLabelSource): TransferBagGoodsLabelPage[] {
  assertSourceCanPrint(source)
  const colors = uniqueNonEmpty(source.tickets.map((ticket) => ticket.color))
  const sizes = uniqueNonEmpty(source.tickets.map((ticket) => ticket.size)).sort(compareApparelSizes)
  const productionOrderNo = uniqueNonEmpty(source.tickets.map((ticket) => ticket.productionOrderNo))[0] || ''
  const spuCodes = uniqueNonEmpty(source.tickets.map((ticket) => ticket.spuCode))
  const partCount = uniqueNonEmpty(source.tickets.map((ticket) => ticket.partCode.trim() || ticket.partName.trim())).length
  const ticketCount = uniqueNonEmpty(source.tickets.map((ticket) => ticket.feiTicketId || ticket.feiTicketNo)).length
  const totalPieceQty = source.tickets.reduce((sum, ticket) => sum + Number(ticket.pieceQty), 0)
  const quantityByColorSize = new Map<string, number>()
  source.tickets.forEach((ticket) => {
    const key = `${ticket.color}\u0000${ticket.size}`
    quantityByColorSize.set(key, (quantityByColorSize.get(key) || 0) + Number(ticket.pieceQty))
  })
  const sizesPerPage = colors.length <= 3
    ? TRANSFER_BAG_GOODS_LABEL_MAX_SIZES_WITH_FEW_COLORS
    : TRANSFER_BAG_GOODS_LABEL_MAX_SIZES_WITH_MANY_COLORS
  const colorChunks = chunk(colors, TRANSFER_BAG_GOODS_LABEL_MAX_COLORS)
  const sizeChunks = chunk(sizes, sizesPerPage)
  const pageCount = colorChunks.length * sizeChunks.length
  let pageIndex = 0
  return colorChunks.flatMap((pageColors) => sizeChunks.map((pageSizes) => {
    pageIndex += 1
    const rows = pageColors.map((color) => {
      const quantities = pageSizes.map((size) => quantityByColorSize.get(`${color}\u0000${size}`) || 0)
      return { color, quantities, pageTotal: quantities.reduce((sum, qty) => sum + qty, 0) }
    })
    const sizeTotals = pageSizes.map((_, sizeIndex) => rows.reduce((sum, row) => sum + row.quantities[sizeIndex], 0))
    const pagePieceQty = sizeTotals.reduce((sum, qty) => sum + qty, 0)
    return {
      usageCycleId: source.usageCycleId,
      bagCode: source.bagCode,
      productionOrderNo,
      spuCodes,
      partCount,
      sizes: pageSizes,
      rows,
      sizeTotals,
      pagePieceQty,
      totalPieceQty,
      ticketCount,
      totalColorCount: colors.length,
      totalSizeCount: sizes.length,
      pageIndex,
      pageCount,
      baggingAt: source.baggingAt,
    }
  }))
}
