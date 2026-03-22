import { state } from './context'

export function isSettlementDialogOpen(): boolean {
  return state.dialog.type !== 'none'
}
