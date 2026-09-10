import { state } from './context.ts'

export function isTechPackDialogOpen(): boolean {
  return (
    (typeof document !== 'undefined' && Boolean(document.querySelector('#tech-pack-pattern-image-preview-modal, #tech-pack-bom-color-copy-modal'))) ||
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
    state.patternDialogOpen ||
    state.patternTemplateDialogOpen
  )
}
