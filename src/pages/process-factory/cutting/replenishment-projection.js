import { buildReplenishmentViewModel, } from './replenishment-model.ts';
import { buildExecutionPrepProjectionContext } from './execution-prep-projection-helpers.ts';
export function buildReplenishmentProjection(options = {}) {
    const context = buildExecutionPrepProjectionContext(options.snapshot);
    return {
        snapshot: context.snapshot,
        viewModel: buildReplenishmentViewModel({
            materialPrepRows: context.sources.materialPrepRows,
            cutOrderRows: context.sources.cutOrderRows,
            markerPlanRefs: context.sources.markerPlanRefs,
            markerStore: context.sources.markerStore,
            reviews: options.reviews ??
                context.snapshot.replenishmentState.reviews,
            impactPlans: options.impactPlans ??
                context.snapshot.replenishmentState.impactPlans,
            actions: options.actions ??
                context.snapshot.replenishmentState.actions,
            pdaFeedbackWritebacks: context.snapshot.pdaExecutionState.replenishmentFeedbackWritebacks,
        }),
    };
}
