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

  listOriginalCutOrderSourceRecords().forEach((record) => {
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

  const seedRecords: MergeBatchSourceRecord[] = [
    {
      mergeBatchId: normalizeMergeBatchId('MB-260403-081-LINING'),
      mergeBatchNo: 'MB-260403-081-LINING',
      sourceOriginalCutOrderIds: [
        'CUT-260308-081-02',
        'CUT-260314-087-02',
        'CUT-260315-088-02',
      ],
      sourceOriginalCutOrderNos: [
        'CUT-260308-081-02',
        'CUT-260314-087-02',
        'CUT-260315-088-02',
      ],
      sourceProductionOrderIds: [
        'PO-202603-081',
        'PO-202603-087',
        'PO-202603-088',
      ],
      sourceProductionOrderNos: [
        'PO-202603-081',
        'PO-202603-087',
        'PO-202603-088',
      ],
    },
    {
      mergeBatchId: normalizeMergeBatchId('MB-260403-081-PRINT'),
      mergeBatchNo: 'MB-260403-081-PRINT',
      sourceOriginalCutOrderIds: [
        'CUT-260308-081-01',
        'CUT-260314-087-01',
        'CUT-260315-088-01',
      ],
      sourceOriginalCutOrderNos: [
        'CUT-260308-081-01',
        'CUT-260314-087-01',
        'CUT-260315-088-01',
      ],
      sourceProductionOrderIds: [
        'PO-202603-081',
        'PO-202603-087',
        'PO-202603-088',
      ],
      sourceProductionOrderNos: [
        'PO-202603-081',
        'PO-202603-087',
        'PO-202603-088',
      ],
    },
    {
      mergeBatchId: normalizeMergeBatchId('MB-260403-081-SOLID'),
      mergeBatchNo: 'MB-260403-081-SOLID',
      sourceOriginalCutOrderIds: [
        'CUT-260308-081-03',
        'CUT-260314-087-03',
        'CUT-260315-088-03',
      ],
      sourceOriginalCutOrderNos: [
        'CUT-260308-081-03',
        'CUT-260314-087-03',
        'CUT-260315-088-03',
      ],
      sourceProductionOrderIds: [
        'PO-202603-081',
        'PO-202603-087',
        'PO-202603-088',
      ],
      sourceProductionOrderNos: [
        'PO-202603-081',
        'PO-202603-087',
        'PO-202603-088',
      ],
    },
    {
      mergeBatchId: normalizeMergeBatchId('MB-260403-083-PRINT'),
      mergeBatchNo: 'MB-260403-083-PRINT',
      sourceOriginalCutOrderIds: [
        'CUT-260310-083-02',
      ],
      sourceOriginalCutOrderNos: [
        'CUT-260310-083-02',
      ],
      sourceProductionOrderIds: [
        'PO-202603-083',
      ],
      sourceProductionOrderNos: [
        'PO-202603-083',
      ],
    },
  ]

  seedRecords.forEach((record) => {
    grouped.set(record.mergeBatchId, {
      ...record,
      sourceOriginalCutOrderIds: unique(record.sourceOriginalCutOrderIds),
      sourceOriginalCutOrderNos: unique(record.sourceOriginalCutOrderNos),
      sourceProductionOrderIds: unique(record.sourceProductionOrderIds),
      sourceProductionOrderNos: unique(record.sourceProductionOrderNos),
    })
  })

  return Array.from(grouped.values())
}

export function listMergeBatchSourceRecords(): MergeBatchSourceRecord[] {
  const merged = new Map<string, MergeBatchSourceRecord>()
  const sourceRecords = [...buildSystemMergeBatchSourceRecords(), ...readStoredMergeBatchSourceRecords()]

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
