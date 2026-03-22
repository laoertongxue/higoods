import { state } from './context'

export function isProgressExceptionsDialogOpen(): boolean {
  return Boolean(
    state.detailCaseId ||
      state.closeDialogCaseId ||
      state.unblockDialogCaseId ||
      state.extendDialogCaseId ||
      state.pauseFollowUpCaseId,
  )
}
