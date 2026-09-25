import { readCuttingTicketSourceSnapshot } from '../../../data/fcs/cutting/runtime-inputs.ts'
import { buildCutOrderViewModel } from './cut-orders-model.ts'
import { buildMaterialPrepViewModel } from './material-prep-model.ts'
import { buildRuntimeMarkerPlanSourceRecords } from './runtime-projections.ts'
import { type MarkerSpreadingStore } from './marker-spreading-model.ts'
import { buildMarkerSpreadingPrototypeStore } from './marker-spreading-utils.ts'

import {
  type CuttingDomainSnapshot,
} from '../../../domain/fcs-cutting-runtime/index.ts'
import {
  buildCraftTraceProjection,
} from './craft-trace-projection.ts'
import {
  buildCuttingTraceabilityProjectionContext,
} from './traceability-projection-helpers.ts'

export function buildFeiTicketsProjection(
  snapshot?: CuttingDomainSnapshot,
) {
  const effectiveSnapshot = snapshot || readCuttingTicketSourceSnapshot()
  // 打印对象的资格与阶段以铺布/裁剪来源为准；不把物料收料汇总用作打印前置条件。
  let context
  if (snapshot) context = buildCuttingTraceabilityProjectionContext(snapshot)
  else {
    const sourceOptions = {sourceIdentityOnly: true}
    const seedRows = buildCutOrderViewModel(effectiveSnapshot.progressRecords, [], sourceOptions).rows
    const markerPlanSources = buildRuntimeMarkerPlanSourceRecords(effectiveSnapshot, seedRows)
    const cutOrderRows = buildCutOrderViewModel(effectiveSnapshot.progressRecords, markerPlanSources, sourceOptions).rows
    const materialPrepRows = buildMaterialPrepViewModel(effectiveSnapshot.progressRecords, markerPlanSources, {...sourceOptions, includeClaimDisputes:false}).rows
    const markerStore = effectiveSnapshot.markerSpreadingState.store as unknown as MarkerSpreadingStore
    const printingSessions = buildMarkerSpreadingPrototypeStore({rows: materialPrepRows, markerPlanSources, stored: markerStore}).sessions
    for (const row of cutOrderRows) {
      const sessions = printingSessions.filter(session => session.cutOrderIds.includes(row.cutOrderId))
      const label = sessions.some(session => session.cuttingStatus === 'CUTTING_DONE' || session.cuttingFinishedAt) ? '已裁剪'
        : sessions.some(session => session.cuttingStatus === 'CUTTING' || session.cuttingStartedAt) ? '裁剪中'
        : sessions.some(session => session.status === 'DONE') ? '已铺布'
        : sessions.some(session => session.status === 'IN_PROGRESS') ? '铺布中' : '待铺布'
      row.currentStage = {...row.currentStage, key: label === '待铺布' ? 'NOT_STARTED' : 'STARTED', label, detailText: '依据铺布单与裁剪记录显示打印来源阶段。'}
      row.currentStageLabel = label
    }
    context = buildCuttingTraceabilityProjectionContext(effectiveSnapshot, undefined, {cutOrderRows, materialPrepRows, markerPlanSources, markerStore})
  }
  return {
    snapshot: effectiveSnapshot,
    cutOrderRows: context.cutOrderRows,
    materialPrepRows: context.materialPrepRows,
    markerPlanSources: context.markerPlanSources,
    markerStore: context.markerStore,
    ticketRecords: context.ticketRecords,
    printJobs: context.printJobs,
    transferBagStore: context.transferBagStore,
    printableViewModel: context.printableViewModel,
    craftTraceProjection: buildCraftTraceProjection(effectiveSnapshot, {
      context,
      transferBagStore: context.transferBagStore,
      ticketRecords: context.ticketRecords,
    }),
  }
}
