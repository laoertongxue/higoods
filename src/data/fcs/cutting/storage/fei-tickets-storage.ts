export const CUTTING_FEI_TICKET_DRAFTS_STORAGE_KEY = 'cuttingFeiTicketDrafts'
export const CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY = 'cuttingFeiTicketRecords'
export const CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY = 'cuttingFeiTicketPrintJobs'

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function normalizePrintableUnitRecord<T extends Record<string, unknown>>(record: T): T {
  const normalizedTraceRecord = {
    ...record,
    sourceSpreadingSessionId: typeof record.sourceSpreadingSessionId === 'string' ? record.sourceSpreadingSessionId : '',
    sourceSpreadingSessionNo: typeof record.sourceSpreadingSessionNo === 'string' ? record.sourceSpreadingSessionNo : '',
    sourceMarkerId: typeof record.sourceMarkerId === 'string' ? record.sourceMarkerId : '',
    sourceMarkerNo: typeof record.sourceMarkerNo === 'string' ? record.sourceMarkerNo : '',
    sourceMergeBatchId: typeof record.sourceMergeBatchId === 'string' ? record.sourceMergeBatchId : '',
    sourceMergeBatchNo: typeof record.sourceMergeBatchNo === 'string' ? record.sourceMergeBatchNo : '',
  } as T

  if (
    normalizedTraceRecord.printableUnitId &&
    normalizedTraceRecord.printableUnitNo &&
    normalizedTraceRecord.printableUnitType
  ) {
    return normalizedTraceRecord
  }

  if (
    normalizedTraceRecord.sourceContextType === 'merge-batch' &&
    typeof normalizedTraceRecord.sourceMergeBatchId === 'string' &&
    normalizedTraceRecord.sourceMergeBatchId
  ) {
    return {
      ...normalizedTraceRecord,
      printableUnitId: normalizedTraceRecord.printableUnitId || `batch:${normalizedTraceRecord.sourceMergeBatchId}`,
      printableUnitNo: normalizedTraceRecord.printableUnitNo || normalizedTraceRecord.sourceMergeBatchNo || '',
      printableUnitType: normalizedTraceRecord.printableUnitType || 'BATCH',
    }
  }

  const fallbackCutOrderId = typeof normalizedTraceRecord.originalCutOrderId === 'string'
    ? normalizedTraceRecord.originalCutOrderId
    : Array.isArray(normalizedTraceRecord.originalCutOrderIds)
      ? String(normalizedTraceRecord.originalCutOrderIds[0] || '')
      : ''
  const fallbackCutOrderNo = typeof normalizedTraceRecord.originalCutOrderNo === 'string'
    ? normalizedTraceRecord.originalCutOrderNo
    : Array.isArray(normalizedTraceRecord.originalCutOrderNos)
      ? String(normalizedTraceRecord.originalCutOrderNos[0] || '')
      : ''

  return {
    ...normalizedTraceRecord,
    printableUnitId: normalizedTraceRecord.printableUnitId || (fallbackCutOrderId ? `cut-order:${fallbackCutOrderId}` : ''),
    printableUnitNo: normalizedTraceRecord.printableUnitNo || fallbackCutOrderNo,
    printableUnitType: normalizedTraceRecord.printableUnitType || 'CUT_ORDER',
  }
}

export function deserializeFeiTicketDraftsStorage(raw: string | null): Record<string, Record<string, unknown>> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return isRecord(parsed) ? parsed as Record<string, Record<string, unknown>> : {}
  } catch {
    return {}
  }
}

export function deserializeFeiTicketRecordsStorage(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isRecord).map((item) => normalizePrintableUnitRecord(item)) : []
  } catch {
    return []
  }
}

export function deserializeFeiTicketPrintJobsStorage(raw: string | null): Array<Record<string, unknown>> {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isRecord).map((item) => normalizePrintableUnitRecord(item)) : []
  } catch {
    return []
  }
}

export function buildStoredFeiTicketTraceMatrix(records: Array<Record<string, unknown>>) {
  return records
    .map((record) => normalizePrintableUnitRecord(record))
    .map((record) => ({
      printableUnitId: String(record.printableUnitId || ''),
      feiTicketId: String(record.feiTicketId || record.ticketRecordId || ''),
      feiTicketNo: String(record.feiTicketNo || record.ticketNo || ''),
      sourceSpreadingSessionId: String(record.sourceSpreadingSessionId || ''),
      sourceSpreadingSessionNo: String(record.sourceSpreadingSessionNo || ''),
      sourceMarkerId: String(record.sourceMarkerId || ''),
      sourceMarkerNo: String(record.sourceMarkerNo || ''),
      originalCutOrderId: String(record.originalCutOrderId || ''),
      originalCutOrderNo: String(record.originalCutOrderNo || ''),
      sourceMergeBatchId: String(record.sourceMergeBatchId || ''),
      sourceWritebackId: String(record.sourceWritebackId || ''),
      color: String(record.color || record.skuColor || ''),
      size: String(record.size || record.skuSize || ''),
      garmentQty: Number(record.garmentQty || record.qty || 0),
    }))
}
