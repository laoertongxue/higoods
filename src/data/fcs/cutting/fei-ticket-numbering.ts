import {
  getBrowserLocalStorage,
  type BrowserStorageLike,
} from '../../browser-storage.ts'
import {
  listSpreadingResultGeneratedFeiTickets,
  type GeneratedFeiTicketSourceRecord,
} from './generated-fei-tickets.ts'

export const CUTTING_FEI_TICKET_NUMBERING_STORAGE_KEY = 'cuttingFeiTicketNumberingLedger'
export const FEI_TICKET_NUMBERING_BLOCK_MESSAGE = '该菲票尚未完成打编号，请完成打编后再装袋。'

export type FeiTicketNumberingStatus = '未打编号' | '已完成' | '免打编号' | '缺少编号区间'
export type FeiTicketNumberingSource = 'WEB' | 'PDA' | 'MOCK'

export interface FeiTicketNumberingRecord {
  recordId: string
  feiTicketId: string
  feiTicketNo: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  spreadingOrderId: string
  spreadingOrderNo: string
  materialSku: string
  color: string
  size: string
  partCode: string
  partName: string
  pieceSequenceStartNo: number
  pieceSequenceEndNo: number
  pieceSequenceLabel: string
  numberCount: number
  operatorId: string
  operatorName: string
  operatorRole: string
  completedAt: string
  source: FeiTicketNumberingSource
  remark?: string
}

export interface FeiTicketNumberingScanResult {
  ok: boolean
  status: FeiTicketNumberingStatus
  message: string
  ticket: GeneratedFeiTicketSourceRecord | null
  record: FeiTicketNumberingRecord | null
  numberCount: number
  pieceSequenceLabel: string
}

export interface FeiTicketNumberingOperatorSummary {
  operatorId: string
  operatorName: string
  ticketCount: number
  numberCount: number
  latestCompletedAt: string
}

export interface FeiTicketNumberingFilters {
  keyword?: string
  operatorName?: string
  status?: FeiTicketNumberingStatus | '全部'
  date?: string
}

interface FeiTicketNumberingStore {
  records: FeiTicketNumberingRecord[]
}

const fallbackStore: FeiTicketNumberingStore = createEmptyStore()

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function normalizeUpper(value: unknown): string {
  return normalizeText(value).toUpperCase()
}

function toNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function nowText(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ')
}

function compactDate(value: string): string {
  return value.replace(/[^0-9]/g, '').slice(0, 14) || String(Date.now())
}

function uniqueRecords(records: FeiTicketNumberingRecord[]): FeiTicketNumberingRecord[] {
  const seen = new Set<string>()
  return records.filter((record) => {
    const key = record.feiTicketId || record.feiTicketNo || record.recordId
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function sortRecords(records: FeiTicketNumberingRecord[]): FeiTicketNumberingRecord[] {
  return records.slice().sort((left, right) => right.completedAt.localeCompare(left.completedAt, 'zh-CN'))
}

function normalizeRecord(raw: unknown): FeiTicketNumberingRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const feiTicketNo = normalizeText(value.feiTicketNo)
  if (!feiTicketNo) return null
  const startNo = toNumber(value.pieceSequenceStartNo)
  const endNo = toNumber(value.pieceSequenceEndNo)
  const numberCount = toNumber(value.numberCount) || calculateNumberCount(startNo, endNo)
  return {
    recordId: normalizeText(value.recordId) || `NUM-${compactDate(normalizeText(value.completedAt))}-${feiTicketNo}`,
    feiTicketId: normalizeText(value.feiTicketId),
    feiTicketNo,
    productionOrderId: normalizeText(value.productionOrderId),
    productionOrderNo: normalizeText(value.productionOrderNo),
    cutOrderId: normalizeText(value.cutOrderId),
    cutOrderNo: normalizeText(value.cutOrderNo),
    spreadingOrderId: normalizeText(value.spreadingOrderId),
    spreadingOrderNo: normalizeText(value.spreadingOrderNo),
    materialSku: normalizeText(value.materialSku),
    color: normalizeText(value.color),
    size: normalizeText(value.size),
    partCode: normalizeText(value.partCode),
    partName: normalizeText(value.partName),
    pieceSequenceStartNo: startNo,
    pieceSequenceEndNo: endNo,
    pieceSequenceLabel: normalizeText(value.pieceSequenceLabel),
    numberCount,
    operatorId: normalizeText(value.operatorId) || normalizeText(value.operatorName),
    operatorName: normalizeText(value.operatorName) || '打编号员工',
    operatorRole: normalizeText(value.operatorRole) || '打编号员工',
    completedAt: normalizeText(value.completedAt) || nowText(),
    source: value.source === 'WEB' || value.source === 'PDA' ? value.source : value.source === 'MOCK' ? 'MOCK' : 'WEB',
    remark: normalizeText(value.remark),
  }
}

function createEmptyStore(): FeiTicketNumberingStore {
  return { records: [] }
}

function deserializeStore(raw: string | null): FeiTicketNumberingStore {
  if (!raw) return createEmptyStore()
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      records: sortRecords(
        uniqueRecords(
          (Array.isArray(parsed.records) ? parsed.records : [])
            .map((item) => normalizeRecord(item))
            .filter((item): item is FeiTicketNumberingRecord => Boolean(item)),
        ),
      ),
    }
  } catch {
    return createEmptyStore()
  }
}

function hydrateStore(storage: BrowserStorageLike | null = getBrowserLocalStorage()): FeiTicketNumberingStore {
  if (!storage) return { records: fallbackStore.records.slice() }
  return deserializeStore(storage?.getItem(CUTTING_FEI_TICKET_NUMBERING_STORAGE_KEY) ?? null)
}

function persistStore(store: FeiTicketNumberingStore, storage: BrowserStorageLike | null = getBrowserLocalStorage()): FeiTicketNumberingStore {
  fallbackStore.records = store.records.slice()
  storage?.setItem?.(CUTTING_FEI_TICKET_NUMBERING_STORAGE_KEY, JSON.stringify(store))
  return store
}

function calculateNumberCount(startNo: number, endNo: number): number {
  if (startNo <= 0 || endNo <= 0 || endNo < startNo) return 0
  return endNo - startNo + 1
}

function hasPieceSequenceRange(ticket: GeneratedFeiTicketSourceRecord | null | undefined): boolean {
  if (!ticket?.pieceSequenceRange) return false
  return calculateNumberCount(ticket.pieceSequenceRange.startNo, ticket.pieceSequenceRange.endNo) > 0
}

export function isBindingStripFeiTicketNo(value: string | null | undefined): boolean {
  const text = normalizeUpper(value)
  return text.startsWith('FT-BT-') || text.includes('-BIND-') || text.includes('BINDING')
}

export function isBindingStripFeiTicket(ticket: Pick<GeneratedFeiTicketSourceRecord, 'feiTicketNo' | 'partName' | 'pieceSequenceRange'> | null | undefined): boolean {
  if (!ticket) return false
  return isBindingStripFeiTicketNo(ticket.feiTicketNo) || (!ticket.pieceSequenceRange && /捆条/.test(ticket.partName || ''))
}

export function calculateFeiTicketNumberingCount(ticket: GeneratedFeiTicketSourceRecord): number {
  const range = ticket.pieceSequenceRange
  return range ? calculateNumberCount(range.startNo, range.endNo) : 0
}

export function listFeiTicketNumberingTickets(): GeneratedFeiTicketSourceRecord[] {
  const tickets = listSpreadingResultGeneratedFeiTickets()
  const base = tickets.find((ticket) => ticket.printStatus !== 'VOIDED') || tickets[0]
  const missingRangeDemo = base
    ? [{
        ...base,
        feiTicketId: 'ticket-numbering-missing-range-demo',
        feiTicketNo: 'FT-CUT-NUMBERING-MISSING-001',
        partName: '缺编号区间演示片',
        pieceSequenceRange: null,
        pieceSequenceLabel: '',
        pieceSequenceCannotGenerateReason: '演示：菲票缺少部位裁片编号区间',
        printStatus: 'PRINTED' as const,
      }]
    : []
  return [...tickets, ...missingRangeDemo]
}

export function resolveFeiTicketForNumbering(input: string): GeneratedFeiTicketSourceRecord | null {
  const normalized = normalizeUpper(input)
  if (!normalized || isBindingStripFeiTicketNo(normalized)) return null
  return listFeiTicketNumberingTickets().find((ticket) =>
    [ticket.feiTicketNo, ticket.feiTicketId, ticket.sourceOutputLineId].some((value) => normalizeUpper(value) === normalized),
  ) || null
}

export function buildFeiTicketNumberingSeedRecords(): FeiTicketNumberingRecord[] {
  const tickets = listSpreadingResultGeneratedFeiTickets()
    .filter((ticket) => ticket.printStatus !== 'VOIDED' && hasPieceSequenceRange(ticket))
    .slice(0, 2)
  const operators = [
    { operatorId: 'CUT-NUM-OP-001', operatorName: 'Siti Aminah' },
    { operatorId: 'CUT-NUM-OP-002', operatorName: 'Budi Santoso' },
  ]
  return tickets.map((ticket, index) => {
    const range = ticket.pieceSequenceRange!
    const operator = operators[index % operators.length]
    return {
      recordId: `NUM-SEED-${String(index + 1).padStart(3, '0')}`,
      feiTicketId: ticket.feiTicketId,
      feiTicketNo: ticket.feiTicketNo,
      productionOrderId: ticket.productionOrderId,
      productionOrderNo: ticket.productionOrderNo,
      cutOrderId: ticket.cutOrderId,
      cutOrderNo: ticket.cutOrderNo,
      spreadingOrderId: ticket.spreadingOrderId || ticket.sourceSpreadingSessionId,
      spreadingOrderNo: ticket.spreadingOrderNo || ticket.sourceSpreadingSessionNo,
      materialSku: ticket.materialSku,
      color: ticket.skuColor || ticket.fabricColor,
      size: ticket.skuSize,
      partCode: ticket.partCode,
      partName: ticket.partName,
      pieceSequenceStartNo: range.startNo,
      pieceSequenceEndNo: range.endNo,
      pieceSequenceLabel: range.rangeLabel || ticket.pieceSequenceLabel,
      numberCount: calculateFeiTicketNumberingCount(ticket),
      operatorId: operator.operatorId,
      operatorName: operator.operatorName,
      operatorRole: '打编号员工',
      completedAt: `2026-06-05 ${index === 0 ? '09:18' : '10:42'}`,
      source: 'MOCK',
      remark: '演示计件记录',
    }
  })
}

export function listFeiTicketNumberingRecords(): FeiTicketNumberingRecord[] {
  return sortRecords(uniqueRecords([...buildFeiTicketNumberingSeedRecords(), ...hydrateStore().records]))
}

export function getFeiTicketNumberingRecord(feiTicketIdOrNo: string): FeiTicketNumberingRecord | null {
  const normalized = normalizeUpper(feiTicketIdOrNo)
  return listFeiTicketNumberingRecords().find((record) =>
    [record.feiTicketId, record.feiTicketNo].some((value) => normalizeUpper(value) === normalized),
  ) || null
}

export function getFeiTicketNumberingStatus(ticket: GeneratedFeiTicketSourceRecord | Pick<GeneratedFeiTicketSourceRecord, 'feiTicketId' | 'feiTicketNo' | 'partName' | 'pieceSequenceRange'> | null | undefined): FeiTicketNumberingStatus {
  if (!ticket) return '缺少编号区间'
  if (isBindingStripFeiTicket(ticket)) return '免打编号'
  if (!ticket.pieceSequenceRange) return '缺少编号区间'
  if (getFeiTicketNumberingRecord(ticket.feiTicketId) || getFeiTicketNumberingRecord(ticket.feiTicketNo)) return '已完成'
  return '未打编号'
}

export function resolveFeiTicketNumberingScan(input: string): FeiTicketNumberingScanResult {
  if (isBindingStripFeiTicketNo(input)) {
    return {
      ok: true,
      status: '免打编号',
      message: '捆条菲票免打编号，可直接进入入仓暂存或装袋交出。',
      ticket: null,
      record: null,
      numberCount: 0,
      pieceSequenceLabel: '捆条免编号',
    }
  }
  const ticket = resolveFeiTicketForNumbering(input)
  if (!ticket) {
    return {
      ok: false,
      status: '缺少编号区间',
      message: '当前票号不存在，请先确认菲票记录。',
      ticket: null,
      record: null,
      numberCount: 0,
      pieceSequenceLabel: '',
    }
  }
  if (!hasPieceSequenceRange(ticket)) {
    return {
      ok: false,
      status: '缺少编号区间',
      message: '该菲票缺少编号区间，不能完成打编号，请先核查菲票数据。',
      ticket,
      record: null,
      numberCount: 0,
      pieceSequenceLabel: ticket.pieceSequenceLabel || '',
    }
  }
  const record = getFeiTicketNumberingRecord(ticket.feiTicketId) || getFeiTicketNumberingRecord(ticket.feiTicketNo)
  const numberCount = calculateFeiTicketNumberingCount(ticket)
  return {
    ok: true,
    status: record ? '已完成' : '未打编号',
    message: record ? `该菲票已由 ${record.operatorName} 完成打编号。` : '请按编号区间完成实体打编号后点击完成。',
    ticket,
    record,
    numberCount,
    pieceSequenceLabel: ticket.pieceSequenceRange?.rangeLabel || ticket.pieceSequenceLabel,
  }
}

export function completeFeiTicketNumbering(input: {
  feiTicketNoOrId: string
  operatorId?: string
  operatorName: string
  operatorRole?: string
  completedAt?: string
  source?: FeiTicketNumberingSource
  remark?: string
}): FeiTicketNumberingScanResult {
  const scan = resolveFeiTicketNumberingScan(input.feiTicketNoOrId)
  if (!scan.ok || scan.status === '免打编号' || !scan.ticket) return scan
  if (scan.record) return scan
  const ticket = scan.ticket
  const range = ticket.pieceSequenceRange
  if (!range) return scan
  const completedAt = input.completedAt || nowText()
  const record: FeiTicketNumberingRecord = {
    recordId: `NUM-${compactDate(completedAt)}-${ticket.feiTicketNo}`,
    feiTicketId: ticket.feiTicketId,
    feiTicketNo: ticket.feiTicketNo,
    productionOrderId: ticket.productionOrderId,
    productionOrderNo: ticket.productionOrderNo,
    cutOrderId: ticket.cutOrderId,
    cutOrderNo: ticket.cutOrderNo,
    spreadingOrderId: ticket.spreadingOrderId || ticket.sourceSpreadingSessionId,
    spreadingOrderNo: ticket.spreadingOrderNo || ticket.sourceSpreadingSessionNo,
    materialSku: ticket.materialSku,
    color: ticket.skuColor || ticket.fabricColor,
    size: ticket.skuSize,
    partCode: ticket.partCode,
    partName: ticket.partName,
    pieceSequenceStartNo: range.startNo,
    pieceSequenceEndNo: range.endNo,
    pieceSequenceLabel: range.rangeLabel || ticket.pieceSequenceLabel,
    numberCount: calculateFeiTicketNumberingCount(ticket),
    operatorId: normalizeText(input.operatorId) || normalizeText(input.operatorName),
    operatorName: normalizeText(input.operatorName) || '打编号员工',
    operatorRole: normalizeText(input.operatorRole) || '打编号员工',
    completedAt,
    source: input.source || 'WEB',
    remark: normalizeText(input.remark),
  }
  persistStore({ records: sortRecords(uniqueRecords([...hydrateStore().records, record])) })
  return {
    ok: true,
    status: '已完成',
    message: `已完成打编号：${record.feiTicketNo}，编号 ${record.pieceSequenceLabel}，共 ${record.numberCount} 个。`,
    ticket,
    record,
    numberCount: record.numberCount,
    pieceSequenceLabel: record.pieceSequenceLabel,
  }
}

export function validateFeiTicketNumberingBeforeBagging(ticket: {
  feiTicketId?: string
  feiTicketNo?: string
  ticketNo?: string
  partName?: string
  pieceSequenceRange?: GeneratedFeiTicketSourceRecord['pieceSequenceRange']
  pieceSequenceLabel?: string
} | null | undefined): { ok: boolean; reason: string; status: FeiTicketNumberingStatus } {
  if (!ticket) return { ok: false, reason: '当前票号不存在，请先确认菲票记录。', status: '缺少编号区间' }
  const feiTicketNo = normalizeText(ticket.feiTicketNo || ticket.ticketNo)
  if (isBindingStripFeiTicketNo(feiTicketNo)) return { ok: true, reason: '', status: '免打编号' }
  const sourceTicket = ticket.pieceSequenceRange
    ? ticket as GeneratedFeiTicketSourceRecord
    : resolveFeiTicketForNumbering(feiTicketNo || ticket.feiTicketId || '')
  const status = getFeiTicketNumberingStatus(sourceTicket || {
    feiTicketId: normalizeText(ticket.feiTicketId),
    feiTicketNo,
    partName: normalizeText(ticket.partName),
    pieceSequenceRange: ticket.pieceSequenceRange || null,
  })
  if (status === '已完成' || status === '免打编号') return { ok: true, reason: '', status }
  return { ok: false, reason: FEI_TICKET_NUMBERING_BLOCK_MESSAGE, status }
}

export function filterFeiTicketNumberingRecords(filters: FeiTicketNumberingFilters = {}): FeiTicketNumberingRecord[] {
  const keyword = normalizeUpper(filters.keyword)
  const operatorName = normalizeUpper(filters.operatorName)
  const status = filters.status || '全部'
  const date = normalizeText(filters.date)
  return listFeiTicketNumberingRecords().filter((record) => {
    if (status !== '全部' && status !== '已完成') return false
    if (keyword) {
      const haystack = [
        record.feiTicketNo,
        record.productionOrderNo,
        record.cutOrderNo,
        record.spreadingOrderNo,
        record.partName,
        record.size,
        record.operatorName,
      ].map(normalizeUpper).join(' ')
      if (!haystack.includes(keyword)) return false
    }
    if (operatorName && !normalizeUpper(record.operatorName).includes(operatorName)) return false
    if (date && !record.completedAt.startsWith(date)) return false
    return true
  })
}

export function summarizeFeiTicketNumberingByOperator(records: FeiTicketNumberingRecord[] = listFeiTicketNumberingRecords()): FeiTicketNumberingOperatorSummary[] {
  const map = new Map<string, FeiTicketNumberingOperatorSummary>()
  records.forEach((record) => {
    const key = record.operatorId || record.operatorName
    const current = map.get(key) || {
      operatorId: record.operatorId,
      operatorName: record.operatorName,
      ticketCount: 0,
      numberCount: 0,
      latestCompletedAt: '',
    }
    current.ticketCount += 1
    current.numberCount += record.numberCount
    if (!current.latestCompletedAt || record.completedAt > current.latestCompletedAt) current.latestCompletedAt = record.completedAt
    map.set(key, current)
  })
  return Array.from(map.values()).sort((left, right) => right.numberCount - left.numberCount)
}

export function getFeiTicketNumberingDemoCases(): {
  completedTicket: GeneratedFeiTicketSourceRecord | null
  pendingTicket: GeneratedFeiTicketSourceRecord | null
  missingRangeTicket: GeneratedFeiTicketSourceRecord | null
  bindingStripFeiTicketNo: string
} {
  const tickets = listFeiTicketNumberingTickets().filter((ticket) => ticket.printStatus !== 'VOIDED')
  const completed = tickets.find((ticket) => getFeiTicketNumberingStatus(ticket) === '已完成') || null
  const pending = tickets.find((ticket) => getFeiTicketNumberingStatus(ticket) === '未打编号') || null
  const missing = tickets.find((ticket) => ticket.feiTicketId === 'ticket-numbering-missing-range-demo') || null
  return {
    completedTicket: completed,
    pendingTicket: pending,
    missingRangeTicket: missing,
    bindingStripFeiTicketNo: 'FT-BT-260604-001-001',
  }
}
