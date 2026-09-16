// @page-pattern: pda
import { renderPdaFrame } from './pda-shell.ts'
import { renderPdaLoginRedirect, getPdaRuntimeContext } from './pda-runtime.ts'
import { renderSimpleCutPieceContent, prepareSimpleCutPiecePage, handleSimpleCutPieceUiEvent } from './simple-cut-piece-handover-ui.ts'
import { PDA_PAGE_HANDLED_LOCALLY, type PdaPageEventResult } from '../main-handlers/pda-local-action-result.ts'

export function renderPdaCuttingSimpleCutPieceHandoverPage(): string {
  if (!getPdaRuntimeContext()) return renderPdaLoginRedirect()
  const raw = typeof location === 'undefined' ? '' : new URLSearchParams(location.search).get('taskSheetNo') || ''
  prepareSimpleCutPiecePage('PDA', raw)
  return renderPdaFrame(`<main data-simple-cut-root="PDA" class="flex min-w-0 flex-col overflow-hidden bg-white" style="height:calc(100dvh - 128px)">${renderSimpleCutPieceContent('PDA')}</main>`, 'warehouse', { headerTitle: '简易裁片交出', disableTodoAutoOpen: true })
}
export function handlePdaCuttingSimpleCutPieceHandoverEvent(target: HTMLElement): PdaPageEventResult {
  return handleSimpleCutPieceUiEvent(target) ? PDA_PAGE_HANDLED_LOCALLY : false
}
