import { state } from './context.ts'

export function isProgressBoardDialogOpen(): boolean {
  return Boolean(state.blockDialogTaskId)
}
