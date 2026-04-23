import type { CuttingNavigationTarget } from './navigation-context.ts'

export interface CuttingNavigationSpecItem {
  sourcePageKey: string
  target: CuttingNavigationTarget
  carries: string[]
  supportsAutoOpenDetail: boolean
}

export const CUTTING_NAVIGATION_SPEC: CuttingNavigationSpecItem[] = [
  {
    sourcePageKey: 'cutting-summary',
    target: 'replenishment',
    carries: ['productionOrderNo', 'originalCutOrderNo', 'mergeBatchNo', 'materialSku', 'suggestionId', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'cutting-summary',
    target: 'specialProcesses',
    carries: ['productionOrderNo', 'originalCutOrderNo', 'mergeBatchNo', 'materialSku', 'processOrderId', 'processOrderNo', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'cutting-summary',
    target: 'originalOrders',
    carries: ['productionOrderNo', 'originalCutOrderNo', 'mergeBatchNo', 'materialSku', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'cutting-summary',
    target: 'materialPrep',
    carries: ['productionOrderNo', 'originalCutOrderNo', 'mergeBatchNo', 'materialSku', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'cutting-summary',
    target: 'markerSpreading',
    carries: ['productionOrderNo', 'originalCutOrderNo', 'mergeBatchNo', 'materialSku', 'markerId', 'markerNo', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'cutting-summary',
    target: 'feiTickets',
    carries: ['productionOrderNo', 'originalCutOrderNo', 'mergeBatchNo', 'materialSku', 'printableUnitId', 'printableUnitNo', 'ticketId', 'ticketNo', 'focusTab', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'cutting-summary',
    target: 'transferBags',
    carries: ['productionOrderNo', 'originalCutOrderNo', 'bagCode', 'usageNo', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'cutting-summary',
    target: 'cutPieceWarehouse',
    carries: ['productionOrderNo', 'originalCutOrderNo', 'mergeBatchNo', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'cutting-summary',
    target: 'fabricWarehouse',
    carries: ['productionOrderNo', 'originalCutOrderNo', 'materialSku', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'professional-page',
    target: 'summary',
    carries: ['sourcePageKey', 'productionOrderNo', 'blockerSection', 'issueType', 'originalCutOrderNo', 'mergeBatchNo', 'materialSku', 'suggestionId', 'processOrderNo', 'printableUnitNo', 'bagCode', 'usageNo', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
]
