import type {
  CutPieceWarehouseRecord,
} from '../../../data/fcs/cutting/warehouse-runtime.ts'
import type { CutPieceWarehouseWritebackRecord } from '../../../data/fcs/cutting/warehouse-writeback-ledger.ts'
import type { CuttingDomainSnapshot } from '../../../domain/fcs-cutting-runtime/index.ts'
import { buildCutPieceWarehouseViewModel } from './cut-piece-warehouse-model'
import { buildExecutionPrepProjectionContext } from './execution-prep-projection-helpers'

export interface CutPieceWarehouseProjection {
  snapshot: CuttingDomainSnapshot
  records: CutPieceWarehouseRecord[]
  viewModel: ReturnType<typeof buildCutPieceWarehouseViewModel>
}

export function buildCutPieceWarehouseProjection(options: {
  snapshot?: CuttingDomainSnapshot
  records?: CutPieceWarehouseRecord[]
  warehouseWritebacks?: CutPieceWarehouseWritebackRecord[]
} = {}): CutPieceWarehouseProjection {
  const context = buildExecutionPrepProjectionContext(options.snapshot)
  const records = options.records ?? context.snapshot.warehouseState.cutPieceRecords
  return {
    snapshot: context.snapshot,
    records,
    viewModel: buildCutPieceWarehouseViewModel(context.sources.originalRows, records, {
      inboundWritebacks: context.snapshot.pdaExecutionState.inboundWritebacks as never[],
      handoverWritebacks: context.snapshot.pdaExecutionState.handoverWritebacks as never[],
      warehouseWritebacks: options.warehouseWritebacks ?? context.snapshot.warehouseState.cutPieceWritebacks,
    }),
  }
}
