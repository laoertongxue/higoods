import type { PdaCuttingExecutionSourceRecord } from './cutting/pda-cutting-task-source.ts'

export interface PdaCuttingLegacySelectionLike {
  executionOrderId?: string | null
  executionOrderNo?: string | null
  cutPieceOrderNo?: string | null
  focusExecutionOrderNo?: string | null
  focusCutPieceOrderNo?: string | null
}

function clean(value?: string | null): string {
  return value?.trim() || ''
}

export function resolvePdaExecutionKeyFromSelection(selection: {
  executionOrderId?: string | null
  executionOrderNo?: string | null
  originalCutOrderId?: string | null
  originalCutOrderNo?: string | null
  legacyCutPieceOrderNo?: string | null
  cutPieceOrderNo?: string | null
}): string {
  return clean(selection.executionOrderId)
    || clean(selection.executionOrderNo)
    || clean(selection.originalCutOrderId)
    || clean(selection.originalCutOrderNo)
    || clean(selection.legacyCutPieceOrderNo)
    || clean(selection.cutPieceOrderNo)
}

export function resolvePdaExecutionOrderNoWithLegacy(options: PdaCuttingLegacySelectionLike): string | undefined {
  return clean(options.executionOrderNo)
    || clean(options.cutPieceOrderNo)
    || clean(options.focusExecutionOrderNo)
    || clean(options.focusCutPieceOrderNo)
    || undefined
}

export function readLegacyCutPieceOrderNo(params: URLSearchParams, key = 'cutPieceOrderNo'): string | undefined {
  return clean(params.get(key)) || undefined
}

export function matchPdaExecutionRecord(record: PdaCuttingExecutionSourceRecord, executionKey?: string | null): boolean {
  const key = clean(executionKey)
  if (!key) return false
  return record.executionOrderId === key || record.executionOrderNo === key || record.legacyCutPieceOrderNo === key
}

export function toLegacyCutPieceOrderNo(execution: Pick<PdaCuttingExecutionSourceRecord, 'executionOrderNo' | 'legacyCutPieceOrderNo'>): string {
  return clean(execution.legacyCutPieceOrderNo) || clean(execution.executionOrderNo)
}
