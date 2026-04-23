import type {
  HighLowCuttingRow,
  HighLowPatternRow,
  MarkerAllocationLine,
  MarkerLineItem,
  MarkerRecord,
  SpreadingOperatorRecord,
  SpreadingRollRecord,
  SpreadingSession,
} from './marker-spreading-model.ts'
import { DEFAULT_HIGH_LOW_PATTERN_KEYS } from './marker-spreading-utils.ts'
import type { MarkerAllocationSourceRow } from './marker-piece-explosion.ts'

export interface MarkerSpreadingDraftActionContext {
  action: string
  actionNode: HTMLElement
  markerDraft: MarkerRecord | null
  spreadingDraft: SpreadingSession | null
  getMarkerSourceRows: (draft: MarkerRecord) => MarkerAllocationSourceRow[]
  createMarkerAllocationLine: (draft: MarkerRecord, sourceRow: MarkerAllocationSourceRow | null, index: number) => MarkerAllocationLine
  createMarkerLineItem: (index: number) => MarkerLineItem
  createHighLowCuttingRow: (markerId: string, index: number) => HighLowCuttingRow
  createHighLowPatternRow: (markerId: string, index: number, patternKeys: string[]) => HighLowPatternRow
  createRollDraft: (draft: SpreadingSession) => SpreadingRollRecord
  createOperatorDraft: (draft: SpreadingSession) => SpreadingOperatorRecord
  createOperatorDraftForRoll: (draft: SpreadingSession, rollRecordId: string) => SpreadingOperatorRecord
}

export interface MarkerSpreadingDraftActionResult {
  handled: boolean
  feedbackMessage?: string
}

export function addMarkerSizeRow(draft: MarkerRecord): void {
  draft.sizeDistribution = [...draft.sizeDistribution, { sizeLabel: '', quantity: 0 }]
}

export function removeMarkerSizeRow(draft: MarkerRecord, index: number): void {
  draft.sizeDistribution = draft.sizeDistribution.filter((_, itemIndex) => itemIndex !== index)
}

export function addMarkerAllocationLine(
  draft: MarkerRecord,
  sourceRows: MarkerAllocationSourceRow[],
  createMarkerAllocationLine: MarkerSpreadingDraftActionContext['createMarkerAllocationLine'],
): void {
  draft.allocationLines = [
    ...(draft.allocationLines || []),
    createMarkerAllocationLine(draft, sourceRows.length === 1 ? sourceRows[0] : null, draft.allocationLines?.length || 0),
  ]
}

export function removeMarkerAllocationLine(draft: MarkerRecord, index: number): void {
  draft.allocationLines = (draft.allocationLines || []).filter((_, itemIndex) => itemIndex !== index)
}

export function addMarkerLineItem(draft: MarkerRecord, createMarkerLineItem: MarkerSpreadingDraftActionContext['createMarkerLineItem']): void {
  draft.lineItems = [...(draft.lineItems || []), createMarkerLineItem(draft.lineItems?.length || 0)]
}

export function removeMarkerLineItem(draft: MarkerRecord, index: number): void {
  draft.lineItems = (draft.lineItems || []).filter((_, itemIndex) => itemIndex !== index)
}

export function addHighLowCuttingRow(
  draft: MarkerRecord,
  createHighLowCuttingRow: MarkerSpreadingDraftActionContext['createHighLowCuttingRow'],
): void {
  const nextIndex = draft.highLowCuttingRows?.length || 0
  draft.highLowCuttingRows = [...(draft.highLowCuttingRows || []), createHighLowCuttingRow(draft.markerId, nextIndex)]
}

export function removeHighLowCuttingRow(draft: MarkerRecord, index: number): void {
  draft.highLowCuttingRows = (draft.highLowCuttingRows || []).filter((_, itemIndex) => itemIndex !== index)
}

export function addHighLowPatternKey(draft: MarkerRecord): void {
  const patternKeys = draft.highLowPatternKeys?.length ? [...draft.highLowPatternKeys] : [...DEFAULT_HIGH_LOW_PATTERN_KEYS]
  const nextKey = `自定义列${patternKeys.length + 1}`
  draft.highLowPatternKeys = [...patternKeys, nextKey]
  draft.highLowPatternRows = (draft.highLowPatternRows || []).map((row) => ({
    ...row,
    patternValues: {
      ...row.patternValues,
      [nextKey]: 0,
    },
  }))
}

export function removeHighLowPatternKey(draft: MarkerRecord, index: number): void {
  const patternKeys = draft.highLowPatternKeys || []
  const removedKey = patternKeys[index]
  if (!removedKey) return
  draft.highLowPatternKeys = patternKeys.filter((_, itemIndex) => itemIndex !== index)
  draft.highLowPatternRows = (draft.highLowPatternRows || []).map((row) => {
    const nextValues = { ...row.patternValues }
    delete nextValues[removedKey]
    return { ...row, patternValues: nextValues }
  })
}

export function addHighLowPatternRow(
  draft: MarkerRecord,
  createHighLowPatternRow: MarkerSpreadingDraftActionContext['createHighLowPatternRow'],
): void {
  const nextIndex = draft.highLowPatternRows?.length || 0
  const patternKeys = draft.highLowPatternKeys?.length ? draft.highLowPatternKeys : [...DEFAULT_HIGH_LOW_PATTERN_KEYS]
  draft.highLowPatternRows = [...(draft.highLowPatternRows || []), createHighLowPatternRow(draft.markerId, nextIndex, patternKeys)]
}

export function removeHighLowPatternRow(draft: MarkerRecord, index: number): void {
  draft.highLowPatternRows = (draft.highLowPatternRows || []).filter((_, itemIndex) => itemIndex !== index)
}

export function addSpreadingRoll(draft: SpreadingSession, createRollDraft: MarkerSpreadingDraftActionContext['createRollDraft']): void {
  draft.rolls = [...draft.rolls, createRollDraft(draft)]
}

export function removeSpreadingRoll(draft: SpreadingSession, index: number): string | undefined {
  const targetRoll = draft.rolls[index]
  draft.rolls = draft.rolls
    .filter((_, itemIndex) => itemIndex !== index)
    .map((roll, itemIndex) => ({ ...roll, sortOrder: itemIndex + 1 }))
  if (!targetRoll) return undefined
  draft.operators = draft.operators
    .filter((operator) => operator.rollRecordId !== targetRoll.rollRecordId)
    .map((operator, itemIndex) => ({ ...operator, sortOrder: itemIndex + 1 }))
  return `已删除卷 ${targetRoll.rollNo || index + 1}，并同步移除其下人员记录。`
}

export function addSpreadingOperator(
  draft: SpreadingSession,
  createOperatorDraft: MarkerSpreadingDraftActionContext['createOperatorDraft'],
): void {
  draft.operators = [...draft.operators, createOperatorDraft(draft)]
}

export function addSpreadingOperatorForRoll(
  draft: SpreadingSession,
  rollRecordId: string,
  createOperatorDraftForRoll: MarkerSpreadingDraftActionContext['createOperatorDraftForRoll'],
): void {
  draft.operators = [...draft.operators, createOperatorDraftForRoll(draft, rollRecordId)]
}

export function removeSpreadingOperator(draft: SpreadingSession, index: number): void {
  draft.operators = draft.operators
    .filter((_, itemIndex) => itemIndex !== index)
    .map((operator, itemIndex) => ({ ...operator, sortOrder: itemIndex + 1 }))
}

export function handleMarkerSpreadingDraftAction(
  context: MarkerSpreadingDraftActionContext,
): MarkerSpreadingDraftActionResult {
  const { action, actionNode, markerDraft, spreadingDraft } = context

  if (action === 'add-size-row' && markerDraft) {
    addMarkerSizeRow(markerDraft)
    return { handled: true }
  }

  if (action === 'remove-size-row' && markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return { handled: false }
    removeMarkerSizeRow(markerDraft, index)
    return { handled: true }
  }

  if (action === 'add-allocation-line' && markerDraft) {
    addMarkerAllocationLine(markerDraft, context.getMarkerSourceRows(markerDraft), context.createMarkerAllocationLine)
    return { handled: true }
  }

  if (action === 'remove-allocation-line' && markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return { handled: false }
    removeMarkerAllocationLine(markerDraft, index)
    return { handled: true }
  }

  if (action === 'add-line-item' && markerDraft) {
    addMarkerLineItem(markerDraft, context.createMarkerLineItem)
    return { handled: true }
  }

  if (action === 'remove-line-item' && markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return { handled: false }
    removeMarkerLineItem(markerDraft, index)
    return { handled: true }
  }

  if (action === 'add-highlow-cutting-row' && markerDraft) {
    addHighLowCuttingRow(markerDraft, context.createHighLowCuttingRow)
    return { handled: true }
  }

  if (action === 'remove-highlow-cutting-row' && markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return { handled: false }
    removeHighLowCuttingRow(markerDraft, index)
    return { handled: true }
  }

  if (action === 'add-highlow-pattern-key' && markerDraft) {
    addHighLowPatternKey(markerDraft)
    return { handled: true }
  }

  if (action === 'remove-highlow-pattern-key' && markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return { handled: false }
    removeHighLowPatternKey(markerDraft, index)
    return { handled: true }
  }

  if (action === 'add-highlow-pattern-row' && markerDraft) {
    addHighLowPatternRow(markerDraft, context.createHighLowPatternRow)
    return { handled: true }
  }

  if (action === 'remove-highlow-pattern-row' && markerDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return { handled: false }
    removeHighLowPatternRow(markerDraft, index)
    return { handled: true }
  }

  if (action === 'add-roll' && spreadingDraft) {
    addSpreadingRoll(spreadingDraft, context.createRollDraft)
    return { handled: true }
  }

  if (action === 'remove-roll' && spreadingDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return { handled: false }
    return { handled: true, feedbackMessage: removeSpreadingRoll(spreadingDraft, index) }
  }

  if (action === 'add-operator' && spreadingDraft) {
    addSpreadingOperator(spreadingDraft, context.createOperatorDraft)
    return { handled: true }
  }

  if (action === 'add-operator-for-roll' && spreadingDraft) {
    const rollRecordId = actionNode.dataset.rollRecordId
    if (!rollRecordId) return { handled: false }
    addSpreadingOperatorForRoll(spreadingDraft, rollRecordId, context.createOperatorDraftForRoll)
    return { handled: true }
  }

  if (action === 'remove-operator' && spreadingDraft) {
    const index = Number(actionNode.dataset.index)
    if (Number.isNaN(index)) return { handled: false }
    removeSpreadingOperator(spreadingDraft, index)
    return { handled: true }
  }

  return { handled: false }
}
