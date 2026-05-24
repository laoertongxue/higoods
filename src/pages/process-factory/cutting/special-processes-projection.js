import { buildSystemSeedSpecialProcessLedger, buildSpecialProcessViewModel, } from './special-processes-model.ts';
import { buildExecutionPrepProjectionContext } from './execution-prep-projection-helpers.ts';
export function buildSpecialProcessesProjection(options = {}) {
    const context = buildExecutionPrepProjectionContext(options.snapshot);
    const seedLedger = buildSystemSeedSpecialProcessLedger(context.sources.cutOrderRows, context.sources.markerPlanRefs);
    return {
        snapshot: context.snapshot,
        viewModel: buildSpecialProcessViewModel({
            cutOrderRows: context.sources.cutOrderRows,
            markerPlanRefs: context.sources.markerPlanRefs,
            orders: options.orders ??
                context.snapshot.specialProcessState.orders,
            bindingPayloads: options.bindingPayloads ??
                context.snapshot.specialProcessState.bindingPayloads,
            scopeLines: options.scopeLines ??
                context.snapshot.specialProcessState.scopeLines,
            executionLogs: options.executionLogs ??
                context.snapshot.specialProcessState.executionLogs,
            followupActions: options.followupActions ??
                context.snapshot.specialProcessState.followupActions,
        }),
        seedAudits: seedLedger.audits,
    };
}
