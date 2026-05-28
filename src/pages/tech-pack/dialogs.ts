import { state } from './context.ts'

export function isTechPackDialogOpen(): boolean {
  return (
    state.releaseDialogOpen ||
    state.versionLogDialogOpen ||
    state.reviewSubmitDialogOpen ||
    state.reviewDetailDrawerOpen ||
    state.reviewActionDialogOpen ||
    Boolean(state.reviewDiffDialogNodeKey) ||
    Boolean(state.reviewNotificationDialogNodeKey) ||
    state.designPreviewDialogOpen ||
    state.addPatternDialogOpen ||
    state.addBomDialogOpen ||
    state.addTechniqueDialogOpen ||
    state.addSizeDialogOpen ||
    state.addDesignDialogOpen ||
    state.addAttachmentDialogOpen ||
    state.patternDialogOpen
    || state.patternTemplateDialogOpen
  )
}
