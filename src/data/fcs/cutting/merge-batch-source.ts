import { listOriginalCutOrderSourceRecords, normalizeMergeBatchId } from './original-cut-order-source.ts'

export const CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY = 'cuttingMergeBatchLedger'

export interface MergeBatchSourceRecord {
  mergeBatchId: string
  mergeBatchNo: string
  sourceOriginalCutOrderIds: string[]
  sourceOriginalCutOrderNos: string[]
  sourceProductionOrderIds: string[]
  sourceProductionOrderNos: string[]
}

interface StoredMergeBatchItem {
  originalCutOrderId?: string
  originalCutOrderNo?: string
  productionOrderId?: string
  productionOrderNo?: string
}

interface StoredMergeBatchRecord {
  mergeBatchId?: string
  mergeBatchNo?: string
  items?: StoredMergeBatchItem[]
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)))
}

function readStoredMergeBatchSourceRecords(): MergeBatchSourceRecord[] {
  if (typeof localStorage === 'undefined') return []

  try {
    const raw = localStorage.getItem(CUTTING_MERGE_BATCH_LEDGER_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []

    return parsed
      .filter((item): item is StoredMergeBatchRecord => Boolean(item && typeof item === 'object'))
      .map((item) => {
        const mergeBatchNo = typeof item.mergeBatchNo === 'string' ? item.mergeBatchNo.trim() : ''
        const mergeBatchId = typeof item.mergeBatchId === 'string' && item.mergeBatchId.trim() ? item.mergeBatchId.trim() : normalizeMergeBatchId(mergeBatchNo)
        const rows = Array.isArray(item.items) ? item.items : []
        return {
          mergeBatchId,
          mergeBatchNo,
          sourceOriginalCutOrderIds: unique(rows.map((row) => (row.originalCutOrderId || '').trim() || (row.originalCutOrderNo || '').trim())),
          sourceOriginalCutOrderNos: unique(rows.map((row) => (row.originalCutOrderNo || '').trim())),
          sourceProductionOrderIds: unique(rows.map((row) => (row.productionOrderId || '').trim())),
          sourceProductionOrderNos: unique(rows.map((row) => (row.productionOrderNo || '').trim())),
        }
      })
      .filter((item) => item.mergeBatchId && item.mergeBatchNo)
  } catch {
    return []
  }
}

function buildSystemMergeBatchSourceRecords(): MergeBatchSourceRecord[] {
  const grouped = new Map<string, MergeBatchSourceRecord>()
  const sourceRecords = listOriginalCutOrderSourceRecords()

  sourceRecords.forEach((record) => {
    if (!record.mergeBatchNo) return
    const mergeBatchId = record.mergeBatchId || normalizeMergeBatchId(record.mergeBatchNo)
    const current = grouped.get(mergeBatchId)
    if (current) {
      current.sourceOriginalCutOrderIds = unique([...current.sourceOriginalCutOrderIds, record.originalCutOrderId])
      current.sourceOriginalCutOrderNos = unique([...current.sourceOriginalCutOrderNos, record.originalCutOrderNo])
      current.sourceProductionOrderIds = unique([...current.sourceProductionOrderIds, record.productionOrderId])
      current.sourceProductionOrderNos = unique([...current.sourceProductionOrderNos, record.productionOrderNo])
      return
    }

    grouped.set(mergeBatchId, {
      mergeBatchId,
      mergeBatchNo: record.mergeBatchNo,
      sourceOriginalCutOrderIds: [record.originalCutOrderId],
      sourceOriginalCutOrderNos: [record.originalCutOrderNo],
      sourceProductionOrderIds: [record.productionOrderId],
      sourceProductionOrderNos: [record.productionOrderNo],
    })
  })

  const rowsBySpuAndFabric = new Map<string, typeof sourceRecords>()
  sourceRecords.forEach((record) => {
    const spuKey = record.spuCode || record.styleCode || record.productionOrderId
    const fabricKey = record.materialSku || record.fabricSku || record.colorName || '默认面料'
    const key = [spuKey, fabricKey].join('::')
    const rows = rowsBySpuAndFabric.get(key) || []
    rows.push(record)
    rowsBySpuAndFabric.set(key, rows)
  })

  Array.from(rowsBySpuAndFabric.values())
    .filter((rows) => rows.length >= 2)
    .slice(0, 2)
    .forEach((rows, index) => {
      const picked = rows.slice(0, Math.min(rows.length, 3))
      const first = picked[0]
      if (!first) return
      const productionNoSuffix = (first.productionOrderNo || first.productionOrderId || 'PO').replace(/[^0-9]/g, '').slice(-6) || String(index + 1).padStart(6, '0')
      const mergeBatchNo = 'MB-' + productionNoSuffix + '-' + String(index + 1).padStart(2, '0')
      const mergeBatchId = normalizeMergeBatchId(mergeBatchNo)
      if (grouped.has(mergeBatchId)) return
      grouped.set(mergeBatchId, {
        mergeBatchId,
        mergeBatchNo,
        sourceOriginalCutOrderIds: unique(picked.map((row) => row.originalCutOrderId)),
        sourceOriginalCutOrderNos: unique(picked.map((row) => row.originalCutOrderNo)),
        sourceProductionOrderIds: unique(picked.map((row) => row.productionOrderId)),
        sourceProductionOrderNos: unique(picked.map((row) => row.productionOrderNo)),
      })
    })

  return Array.from(grouped.values())
}

type FormalOriginalCutOrderRow = ReturnType<typeof listOriginalCutOrderSourceRecords>[number]

function normalizeRecordToFormalCuttingSources(
  record: MergeBatchSourceRecord,
  rowById: Map<string, FormalOriginalCutOrderRow>,
  rowByNo: Map<string, FormalOriginalCutOrderRow>,
): MergeBatchSourceRecord | null {
  const matchedRows = unique([
    ...record.sourceOriginalCutOrderIds,
    ...record.sourceOriginalCutOrderNos,
  ])
    .map((key) => rowById.get(key) || rowByNo.get(key) || null)
    .filter((row): row is NonNullable<typeof row> => row !== null)

  if (!matchedRows.length) return null

  return {
    mergeBatchId: record.mergeBatchId,
    mergeBatchNo: record.mergeBatchNo,
    sourceOriginalCutOrderIds: unique(matchedRows.map((row) => row.originalCutOrderId)),
    sourceOriginalCutOrderNos: unique(matchedRows.map((row) => row.originalCutOrderNo)),
    sourceProductionOrderIds: unique(matchedRows.map((row) => row.productionOrderId)),
    sourceProductionOrderNos: unique(matchedRows.map((row) => row.productionOrderNo)),
  }
}

export function listMergeBatchSourceRecords(): MergeBatchSourceRecord[] {
  const merged = new Map<string, MergeBatchSourceRecord>()
  const formalOriginalRows = listOriginalCutOrderSourceRecords()
  const rowById = new Map(formalOriginalRows.map((row) => [row.originalCutOrderId, row] as const))
  const rowByNo = new Map(formalOriginalRows.map((row) => [row.originalCutOrderNo, row] as const))
  const sourceRecords = [...buildSystemMergeBatchSourceRecords(), ...readStoredMergeBatchSourceRecords()]
    .map((record) => normalizeRecordToFormalCuttingSources(record, rowById, rowByNo))
    .filter((record): record is MergeBatchSourceRecord => record !== null)

  sourceRecords.forEach((record) => {
    const key = record.mergeBatchId || normalizeMergeBatchId(record.mergeBatchNo)
    if (!key) return
    const current = merged.get(key)
    if (current) {
      current.sourceOriginalCutOrderIds = unique([...current.sourceOriginalCutOrderIds, ...record.sourceOriginalCutOrderIds])
      current.sourceOriginalCutOrderNos = unique([...current.sourceOriginalCutOrderNos, ...record.sourceOriginalCutOrderNos])
      current.sourceProductionOrderIds = unique([...current.sourceProductionOrderIds, ...record.sourceProductionOrderIds])
      current.sourceProductionOrderNos = unique([...current.sourceProductionOrderNos, ...record.sourceProductionOrderNos])
      current.mergeBatchNo = current.mergeBatchNo || record.mergeBatchNo
      return
    }
    merged.set(key, {
      ...record,
      mergeBatchId: key,
      mergeBatchNo: record.mergeBatchNo,
      sourceOriginalCutOrderIds: unique(record.sourceOriginalCutOrderIds),
      sourceOriginalCutOrderNos: unique(record.sourceOriginalCutOrderNos),
      sourceProductionOrderIds: unique(record.sourceProductionOrderIds),
      sourceProductionOrderNos: unique(record.sourceProductionOrderNos),
    })
  })

  return Array.from(merged.values())
}
