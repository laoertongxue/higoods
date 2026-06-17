import { state } from './context.ts'

export function isProgressBoardDialogOpen(): boolean {
  return Boolean(state.detailTaskId || state.blockDialogTaskId || state.confirmDialogType)
}
