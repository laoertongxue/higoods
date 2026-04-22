import { state } from './context.ts'

export function isTechPackDialogOpen(): boolean {
  return (
    state.releaseDialogOpen ||
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
