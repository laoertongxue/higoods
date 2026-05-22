import type { GeneratedCutOrderSourceRecord } from '../../data/fcs/cutting/generated-cut-orders.ts'
import type { MarkerPlanRefSourceRecord } from '../../data/fcs/cutting/marker-plan-ref-source.ts'
import type {
  CutPieceWarehouseRecord,
  CuttingFabricStockRecord,
  SampleWarehouseRecord,
} from '../../data/fcs/cutting/warehouse-runtime.ts'
import type {
  CutPieceWarehouseWritebackRecord,
  SampleWarehouseWritebackRecord,
} from '../../data/fcs/cutting/warehouse-writeback-ledger.ts'
import type { CuttingOrderProgressRecord } from '../../data/fcs/cutting/types.ts'
import type { ProductionOrder } from '../../data/fcs/production-orders.ts'
import type { CuttingCoreRegistry } from '../cutting-core/types.ts'

export interface CuttingMarkerStoreInput {
  store: Record<string, unknown>
}

export interface CuttingFeiRuntimeInput {
  drafts: Record<string, unknown>
  ticketRecords: Array<Record<string, unknown>>
  printJobs: Array<Record<string, unknown>>
}

export interface CuttingTransferBagRuntimeInput {
  store: Record<string, unknown>
}

export interface CuttingReplenishmentRuntimeInput {
  reviews: Array<Record<string, unknown>>
  impactPlans: Array<Record<string, unknown>>
  actions: Array<Record<string, unknown>>
}

export interface CuttingSpecialProcessRuntimeInput {
  orders: Array<Record<string, unknown>>
  bindingPayloads: Array<Record<string, unknown>>
  scopeLines: Array<Record<string, unknown>>
  executionLogs: Array<Record<string, unknown>>
  followupActions: Array<Record<string, unknown>>
}

export interface CuttingPdaExecutionRuntimeInput {
  pickupWritebacks: Array<Record<string, unknown>>
  inboundWritebacks: Array<Record<string, unknown>>
  handoverWritebacks: Array<Record<string, unknown>>
  replenishmentFeedbackWritebacks: Array<Record<string, unknown>>
}

export interface CuttingMarkerPlanRefRuntimeInput {
  sourceRecords: MarkerPlanRefSourceRecord[]
  storedRecords: Array<Record<string, unknown>>
}

export interface CuttingWarehouseRuntimeInput {
  fabricStocks: CuttingFabricStockRecord[]
  cutPieceRecords: CutPieceWarehouseRecord[]
  sampleRecords: SampleWarehouseRecord[]
  cutPieceWritebacks: CutPieceWarehouseWritebackRecord[]
  sampleWritebacks: SampleWarehouseWritebackRecord[]
}

export interface CuttingRuntimeInputs {
  productionOrders: ProductionOrder[]
  cutOrders: GeneratedCutOrderSourceRecord[]
  markerPlanRefState: CuttingMarkerPlanRefRuntimeInput
  progressRecords: CuttingOrderProgressRecord[]
  warehouseState: CuttingWarehouseRuntimeInput
  markerSpreadingState: CuttingMarkerStoreInput
  feiTicketState: CuttingFeiRuntimeInput
  transferBagState: CuttingTransferBagRuntimeInput
  replenishmentState: CuttingReplenishmentRuntimeInput
  specialProcessState: CuttingSpecialProcessRuntimeInput
  pdaExecutionState: CuttingPdaExecutionRuntimeInput
}

export interface CuttingDomainSnapshot extends CuttingRuntimeInputs {
  generatedAt: string
  registry: CuttingCoreRegistry
}
