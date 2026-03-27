import type { CuttingDomainSnapshot } from '../../../domain/fcs-cutting-runtime/index.ts'
import {
  buildSystemSeedSpecialProcessLedger,
  buildSpecialProcessViewModel,
  type BindingStripProcessPayload,
  type SpecialProcessAuditTrail,
  type SpecialProcessExecutionLog,
  type SpecialProcessFollowupAction,
  type SpecialProcessOrder,
  type SpecialProcessScopeLine,
} from './special-processes-model'
import { buildExecutionPrepProjectionContext } from './execution-prep-projection-helpers'

export interface SpecialProcessesProjection {
  snapshot: CuttingDomainSnapshot
  viewModel: ReturnType<typeof buildSpecialProcessViewModel>
  seedAudits: SpecialProcessAuditTrail[]
}

export function buildSpecialProcessesProjection(options: {
  snapshot?: CuttingDomainSnapshot
  orders?: SpecialProcessOrder[]
  bindingPayloads?: BindingStripProcessPayload[]
  scopeLines?: SpecialProcessScopeLine[]
  executionLogs?: SpecialProcessExecutionLog[]
  followupActions?: SpecialProcessFollowupAction[]
} = {}): SpecialProcessesProjection {
  const context = buildExecutionPrepProjectionContext(options.snapshot)
  const seedLedger = buildSystemSeedSpecialProcessLedger(
    context.sources.originalRows,
    context.sources.mergeBatches,
  )
  return {
    snapshot: context.snapshot,
    viewModel: buildSpecialProcessViewModel({
      originalRows: context.sources.originalRows,
      mergeBatches: context.sources.mergeBatches,
      orders:
        options.orders ??
        (context.snapshot.specialProcessState.orders as unknown as SpecialProcessOrder[]),
      bindingPayloads:
        options.bindingPayloads ??
        (context.snapshot.specialProcessState.bindingPayloads as unknown as BindingStripProcessPayload[]),
      scopeLines:
        options.scopeLines ??
        (context.snapshot.specialProcessState.scopeLines as unknown as SpecialProcessScopeLine[]),
      executionLogs:
        options.executionLogs ??
        (context.snapshot.specialProcessState.executionLogs as unknown as SpecialProcessExecutionLog[]),
      followupActions:
        options.followupActions ??
        (context.snapshot.specialProcessState.followupActions as unknown as SpecialProcessFollowupAction[]),
    }),
    seedAudits: seedLedger.audits,
  }
}
