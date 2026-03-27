import type { CuttingDomainSnapshot } from '../../../domain/fcs-cutting-runtime/index.ts'
import {
  buildReplenishmentViewModel,
  type ReplenishmentFollowupAction,
  type ReplenishmentImpactPlan,
  type ReplenishmentReview,
} from './replenishment-model'
import { buildExecutionPrepProjectionContext } from './execution-prep-projection-helpers'

export interface ReplenishmentProjection {
  snapshot: CuttingDomainSnapshot
  viewModel: ReturnType<typeof buildReplenishmentViewModel>
}

export function buildReplenishmentProjection(options: {
  snapshot?: CuttingDomainSnapshot
  reviews?: ReplenishmentReview[]
  impactPlans?: ReplenishmentImpactPlan[]
  actions?: ReplenishmentFollowupAction[]
} = {}): ReplenishmentProjection {
  const context = buildExecutionPrepProjectionContext(options.snapshot)
  return {
    snapshot: context.snapshot,
    viewModel: buildReplenishmentViewModel({
      materialPrepRows: context.sources.materialPrepRows,
      originalRows: context.sources.originalRows,
      mergeBatches: context.sources.mergeBatches,
      markerStore: context.sources.markerStore,
      reviews:
        options.reviews ??
        (context.snapshot.replenishmentState.reviews as unknown as ReplenishmentReview[]),
      impactPlans:
        options.impactPlans ??
        (context.snapshot.replenishmentState.impactPlans as unknown as ReplenishmentImpactPlan[]),
      actions:
        options.actions ??
        (context.snapshot.replenishmentState.actions as unknown as ReplenishmentFollowupAction[]),
      pdaFeedbackWritebacks:
        context.snapshot.pdaExecutionState.replenishmentFeedbackWritebacks as never[],
    }),
  }
}

