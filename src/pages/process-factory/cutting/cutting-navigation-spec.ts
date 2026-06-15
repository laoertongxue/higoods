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
    target: 'specialProcesses',
    carries: ['productionOrderNo', 'cutOrderNo', 'markerPlanNo', 'materialSku', 'processOrderId', 'processOrderNo', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'cutting-summary',
    target: 'cutOrders',
    carries: ['productionOrderNo', 'cutOrderNo', 'markerPlanNo', 'materialSku', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'cutting-summary',
    target: 'materialPrep',
    carries: ['productionOrderNo', 'cutOrderNo', 'markerPlanNo', 'materialSku', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'cutting-summary',
    target: 'markerSpreading',
    carries: ['productionOrderNo', 'cutOrderNo', 'markerPlanNo', 'materialSku', 'markerId', 'markerNo', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'cutting-summary',
    target: 'feiTickets',
    carries: ['productionOrderNo', 'cutOrderNo', 'markerPlanNo', 'materialSku', 'printableUnitId', 'printableUnitNo', 'ticketId', 'ticketNo', 'focusTab', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'cutting-summary',
    target: 'transferBags',
    carries: ['productionOrderNo', 'cutOrderNo', 'bagCode', 'usageNo', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'cutting-summary',
    target: 'cutPieceWarehouse',
    carries: ['productionOrderNo', 'cutOrderNo', 'markerPlanNo', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'cutting-summary',
    target: 'fabricWarehouse',
    carries: ['productionOrderNo', 'cutOrderNo', 'materialSku', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
  {
    sourcePageKey: 'professional-page',
    target: 'summary',
    carries: ['sourcePageKey', 'productionOrderNo', 'blockerSection', 'issueType', 'cutOrderNo', 'markerPlanNo', 'materialSku', 'suggestionId', 'processOrderNo', 'printableUnitNo', 'bagCode', 'usageNo', 'autoOpenDetail'],
    supportsAutoOpenDetail: true,
  },
]
