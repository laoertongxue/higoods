import { state } from './context'
export function isDispatchBoardDialogOpen(): boolean {
  return Boolean(
    state.dispatchDialogTaskIds ||
      state.createTenderTaskId ||
      state.viewTenderTaskId ||
      state.priceSnapshotTaskId,
  )
}
