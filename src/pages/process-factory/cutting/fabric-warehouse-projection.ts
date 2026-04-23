import type {
  CuttingFabricStockRecord,
} from '../../../data/fcs/cutting/warehouse-runtime.ts'
import type { CuttingDomainSnapshot } from '../../../domain/fcs-cutting-runtime/index.ts'
import { buildFabricWarehouseViewModel } from './fabric-warehouse-model.ts'
import { buildExecutionPrepProjectionContext } from './execution-prep-projection-helpers.ts'

export interface FabricWarehouseProjection {
  snapshot: CuttingDomainSnapshot
  records: CuttingFabricStockRecord[]
  viewModel: ReturnType<typeof buildFabricWarehouseViewModel>
}

export function buildFabricWarehouseProjection(options: {
  snapshot?: CuttingDomainSnapshot
  records?: CuttingFabricStockRecord[]
} = {}): FabricWarehouseProjection {
  const context = buildExecutionPrepProjectionContext(options.snapshot)
  const records = options.records ?? context.snapshot.warehouseState.fabricStocks
  return {
    snapshot: context.snapshot,
    records,
    viewModel: buildFabricWarehouseViewModel(context.sources.originalRows, records),
  }
}
