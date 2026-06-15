import type { GeneratedCutOrderSourceRecord } from '../../data/fcs/cutting/generated-cut-orders.ts'
import type { MarkerPlanCutOrderSourceRecord } from '../../data/fcs/cutting/marker-plan-source.ts'
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
import type { CuttingRuntimeEvent } from '../../data/fcs/cutting/cutting-runtime-event-ledger.ts'

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

export interface CuttingSpecialProcessRuntimeInput {
  orders: Array<Record<string, unknown>>
  bindingPayloads: Array<Record<string, unknown>>
  scopeLines: Array<Record<string, unknown>>
  executionLogs: Array<Record<string, unknown>>
  followupActions: Array<Record<string, unknown>>
}

export interface CuttingPdaExecutionRuntimeInput {
  pickupEvents: Array<Record<string, unknown>>
  inboundEvents: Array<Record<string, unknown>>
  handoverEvents: Array<Record<string, unknown>>
}

export interface CuttingRuntimeEventLedgerInput {
  events: CuttingRuntimeEvent[]
}

export interface CuttingMarkerPlanSourceRuntimeInput {
  sourceRecords: MarkerPlanCutOrderSourceRecord[]
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
  markerPlanSourceState: CuttingMarkerPlanSourceRuntimeInput
  progressRecords: CuttingOrderProgressRecord[]
  warehouseState: CuttingWarehouseRuntimeInput
  markerSpreadingState: CuttingMarkerStoreInput
  feiTicketState: CuttingFeiRuntimeInput
  transferBagState: CuttingTransferBagRuntimeInput
  specialProcessState: CuttingSpecialProcessRuntimeInput
  pdaExecutionState: CuttingPdaExecutionRuntimeInput
  runtimeEventState: CuttingRuntimeEventLedgerInput
}

export interface CuttingDomainSnapshot extends CuttingRuntimeInputs {
  generatedAt: string
  registry: CuttingCoreRegistry
}
