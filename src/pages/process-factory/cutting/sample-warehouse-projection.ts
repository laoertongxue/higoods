import type {
  SampleWarehouseRecord,
} from '../../../data/fcs/cutting/warehouse-runtime.ts'
import type { SampleWarehouseWritebackRecord } from '../../../data/fcs/cutting/warehouse-writeback-ledger.ts'
import type { CuttingDomainSnapshot } from '../../../domain/fcs-cutting-runtime/index.ts'
import { buildSampleWarehouseViewModel } from './sample-warehouse-model.ts'
import { buildExecutionPrepProjectionContext } from './execution-prep-projection-helpers.ts'

export interface SampleWarehouseProjection {
  snapshot: CuttingDomainSnapshot
  records: SampleWarehouseRecord[]
  viewModel: ReturnType<typeof buildSampleWarehouseViewModel>
}

export function buildSampleWarehouseProjection(options: {
  snapshot?: CuttingDomainSnapshot
  records?: SampleWarehouseRecord[]
  sampleWritebacks?: SampleWarehouseWritebackRecord[]
} = {}): SampleWarehouseProjection {
  const context = buildExecutionPrepProjectionContext(options.snapshot)
  const records = options.records ?? context.snapshot.warehouseState.sampleRecords
  return {
    snapshot: context.snapshot,
    records,
    viewModel: buildSampleWarehouseViewModel(context.sources.originalRows, records, {
      sampleWritebacks: options.sampleWritebacks ?? context.snapshot.warehouseState.sampleWritebacks,
    }),
  }
}
