import { state } from './context'

export function isProgressBoardDialogOpen(): boolean {
  return Boolean(state.detailTaskId || state.detailOrderId || state.blockDialogTaskId || state.confirmDialogType)
}
