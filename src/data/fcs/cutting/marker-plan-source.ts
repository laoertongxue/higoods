import { listCutOrderSourceRecords, normalizeMarkerPlanSourceId } from './cut-order-source.ts'

export const CUTTING_MARKER_PLAN_SOURCE_LEDGER_STORAGE_KEY = 'cuttingMarkerPlanSourceLedger'

export interface MarkerPlanCutOrderSourceRecord {
  markerPlanId: string
  markerPlanNo: string
  sourceCutOrderIds: string[]
  sourceCutOrderNos: string[]
  sourceProductionOrderIds: string[]
  sourceProductionOrderNos: string[]
}

interface StoredMarkerPlanSourceItem {
  cutOrderId?: string
  cutOrderNo?: string
  productionOrderId?: string
  productionOrderNo?: string
}

interface StoredMarkerPlanSourceRecord {
  markerPlanId?: string
  markerPlanNo?: string
  items?: StoredMarkerPlanSourceItem[]
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function readStoredMarkerPlanCutOrderSourceRecords(): MarkerPlanCutOrderSourceRecord[] {
  if (typeof localStorage === 'undefined') return []

  try {
    const raw = localStorage.getItem(CUTTING_MARKER_PLAN_SOURCE_LEDGER_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is StoredMarkerPlanSourceRecord => Boolean(item && typeof item === 'object'))
      .map((item) => {
        const markerPlanNo = typeof item.markerPlanNo === 'string' ? item.markerPlanNo.trim() : ''
        const markerPlanId = typeof item.markerPlanId === 'string' && item.markerPlanId.trim() ? item.markerPlanId.trim() : normalizeMarkerPlanSourceId(markerPlanNo)
        const rows = Array.isArray(item.items) ? item.items : []
        return {
          markerPlanId,
          markerPlanNo,
          sourceCutOrderIds: unique(rows.map((row) => (row.cutOrderId || '').trim() || (row.cutOrderNo || '').trim())),
          sourceCutOrderNos: unique(rows.map((row) => (row.cutOrderNo || '').trim())),
          sourceProductionOrderIds: unique(rows.map((row) => (row.productionOrderId || '').trim())),
          sourceProductionOrderNos: unique(rows.map((row) => (row.productionOrderNo || '').trim())),
        }
      })
      .filter((item) => item.markerPlanId && item.markerPlanNo)
  } catch {
    return []
  }
}

function buildSystemMarkerPlanCutOrderSourceRecords(): MarkerPlanCutOrderSourceRecord[] {
  const grouped = new Map<string, MarkerPlanCutOrderSourceRecord>()
  const sourceRecords = listCutOrderSourceRecords()

  sourceRecords.forEach((record) => {
    if (!record.markerPlanNo) return
    const markerPlanId = record.markerPlanId || normalizeMarkerPlanSourceId(record.markerPlanNo)
    const current = grouped.get(markerPlanId)
    if (current) {
      current.sourceCutOrderIds = unique([...current.sourceCutOrderIds, record.cutOrderId])
      current.sourceCutOrderNos = unique([...current.sourceCutOrderNos, record.cutOrderNo])
      current.sourceProductionOrderIds = unique([...current.sourceProductionOrderIds, record.productionOrderId])
      current.sourceProductionOrderNos = unique([...current.sourceProductionOrderNos, record.productionOrderNo])
      return
    }

    grouped.set(markerPlanId, {
      markerPlanId,
      markerPlanNo: record.markerPlanNo,
      sourceCutOrderIds: [record.cutOrderId],
      sourceCutOrderNos: [record.cutOrderNo],
      sourceProductionOrderIds: [record.productionOrderId],
      sourceProductionOrderNos: [record.productionOrderNo],
    })
  })

  const rowsBySpuAndProductionOrder = new Map<string, typeof sourceRecords>()
  sourceRecords.forEach((record) => {
    const spuKey = record.spuCode || record.styleCode || record.productionOrderId
    const productionKey = record.productionOrderId || record.productionOrderNo || '默认生产单'
    const key = [spuKey, productionKey].join('::')
    const rows = rowsBySpuAndProductionOrder.get(key) || []
    rows.push(record)
    rowsBySpuAndProductionOrder.set(key, rows)
  })

  Array.from(rowsBySpuAndProductionOrder.values())
    .filter((rows) => rows.length >= 2)
    .slice(0, 2)
    .forEach((rows, index) => {
      const picked = rows.slice(0, Math.min(rows.length, 3))
      const first = picked[0]
      if (!first) return
      const productionNoSuffix = (first.productionOrderNo || first.productionOrderId || 'PO').replace(/[^0-9]/g, '').slice(-6) || String(index + 1).padStart(6, '0')
      const markerPlanNo = 'MB-' + productionNoSuffix + '-' + String(index + 1).padStart(2, '0')
      const markerPlanId = normalizeMarkerPlanSourceId(markerPlanNo)
      if (grouped.has(markerPlanId)) return
      grouped.set(markerPlanId, {
        markerPlanId,
        markerPlanNo,
        sourceCutOrderIds: unique(picked.map((row) => row.cutOrderId)),
        sourceCutOrderNos: unique(picked.map((row) => row.cutOrderNo)),
        sourceProductionOrderIds: unique(picked.map((row) => row.productionOrderId)),
        sourceProductionOrderNos: unique(picked.map((row) => row.productionOrderNo)),
      })
    })

  return Array.from(grouped.values())
}

type FormalCutOrderRow = ReturnType<typeof listCutOrderSourceRecords>[number]

function normalizeRecordToFormalCuttingSources(
  record: MarkerPlanCutOrderSourceRecord,
  rowById: Map<string, FormalCutOrderRow>,
  rowByNo: Map<string, FormalCutOrderRow>,
): MarkerPlanCutOrderSourceRecord | null {
  const matchedRows = unique([
    ...record.sourceCutOrderIds,
    ...record.sourceCutOrderNos,
  ])
    .map((key) => rowById.get(key) || rowByNo.get(key) || null)
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (!matchedRows.length) return null

  return {
    markerPlanId: record.markerPlanId,
    markerPlanNo: record.markerPlanNo,
    sourceCutOrderIds: unique(matchedRows.map((row) => row.cutOrderId)),
    sourceCutOrderNos: unique(matchedRows.map((row) => row.cutOrderNo)),
    sourceProductionOrderIds: unique(matchedRows.map((row) => row.productionOrderId)),
    sourceProductionOrderNos: unique(matchedRows.map((row) => row.productionOrderNo)),
  }
}

export function listMarkerPlanCutOrderSourceRecords(): MarkerPlanCutOrderSourceRecord[] {
  const merged = new Map<string, MarkerPlanCutOrderSourceRecord>()
  const formalCutOrderRows = listCutOrderSourceRecords()
  const rowById = new Map(formalCutOrderRows.map((row) => [row.cutOrderId, row] as const))
  const rowByNo = new Map(formalCutOrderRows.map((row) => [row.cutOrderNo, row] as const))
  const sourceRecords = [...buildSystemMarkerPlanCutOrderSourceRecords(), ...readStoredMarkerPlanCutOrderSourceRecords()]
    .map((record) => normalizeRecordToFormalCuttingSources(record, rowById, rowByNo))
    .filter((record): record is MarkerPlanCutOrderSourceRecord => record !== null)

  sourceRecords.forEach((record) => {
    const key = record.markerPlanId || normalizeMarkerPlanSourceId(record.markerPlanNo)
    if (!key) return
    const current = merged.get(key)
    if (current) {
      current.sourceCutOrderIds = unique([...current.sourceCutOrderIds, ...record.sourceCutOrderIds])
      current.sourceCutOrderNos = unique([...current.sourceCutOrderNos, ...record.sourceCutOrderNos])
      current.sourceProductionOrderIds = unique([...current.sourceProductionOrderIds, ...record.sourceProductionOrderIds])
      current.sourceProductionOrderNos = unique([...current.sourceProductionOrderNos, ...record.sourceProductionOrderNos])
      current.markerPlanNo = current.markerPlanNo || record.markerPlanNo
      return
    }
    merged.set(key, {
      ...record,
      markerPlanId: key,
      markerPlanNo: record.markerPlanNo,
      sourceCutOrderIds: unique(record.sourceCutOrderIds),
      sourceCutOrderNos: unique(record.sourceCutOrderNos),
      sourceProductionOrderIds: unique(record.sourceProductionOrderIds),
      sourceProductionOrderNos: unique(record.sourceProductionOrderNos),
    })
  })

  return Array.from(merged.values())
}
