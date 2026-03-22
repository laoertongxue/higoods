import { state } from './context'

export function isProductionDialogOpen(): boolean {
  return (
    state.demandDetailId !== null ||
    state.demandBatchDialogOpen ||
    state.demandSingleGenerateId !== null ||
    state.demandGenerateConfirmOpen ||
    state.ordersDemandSnapshotId !== null ||
    state.ordersLogsId !== null ||
    state.materialDraftOrderId !== null ||
    state.materialDraftAddDraftId !== null ||
    state.planEditOrderId !== null ||
    state.deliveryEditOrderId !== null ||
    state.changesCreateOpen ||
    state.changesStatusOpen ||
    state.statusDialogOpen ||
    state.detailLogsOpen ||
    state.detailSimulateOpen ||
    state.detailConfirmSimulateOpen
  )
}
