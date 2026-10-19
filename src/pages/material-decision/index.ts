import { enter, ui, handleMaterialDecisionClick, handleMaterialDecisionInput, handleMaterialDecisionChange, handleMaterialDecisionKey } from './events'
import { connectMaterialDecisionHandlers } from './events-bridge'
import { handleHealthClick } from './health'
import { handleWarningsClick, handleWarningsChange } from './warnings'
import { handleDailyClick } from './daily'
import { handlePreparationClick, handlePreparationChange } from './preparation'
import { handleProcessingClick } from './processing'
import { handlePackagingClick } from './packaging'
import { sections, businessSections } from './views'

// Preserve the existing guard and dispatch order; registration completes before the first route render.
connectMaterialDecisionHandlers({
 click(target) {
  const prepAction=target.closest<HTMLElement>('[data-md-prep-action]')?.dataset.mdPrepAction
  if (prepAction && ['add','edit','save','generate','raw-receive','produce','receive','cancel-record'].includes(prepAction) && ui.stale) {
   const feedback=document.querySelector('#md-notice'); if(feedback) feedback.textContent='数据已过期，禁止执行备料建议'
   return true
  }
  if (handleHealthClick(target) || handleWarningsClick(target) || handleDailyClick(target) || handlePreparationClick(target)) return true
  if (target.closest('[data-md-processing-action]') && handleProcessingClick(target)) return true
  if (target.closest('[data-md-packaging-action]') && handlePackagingClick(target)) return true
  return !!target.closest('[data-md-action]') && handleMaterialDecisionClick(target)
 },
 input(target) { return !!target.closest('[data-md-field]') && handleMaterialDecisionInput(target) },
 change(target) {
  if (handlePreparationChange(target) || handleWarningsChange(target)) return true
  return !!target.closest('[data-md-field]') && handleMaterialDecisionChange(target)
 },
 key:handleMaterialDecisionKey,
})

export function renderMaterialDecisionPage(pathname:string):string {
 const section=pathname.split('/').at(-1)??'overview'
 return `<div id="md-page" class="min-w-0 max-w-full">${enter((sections[section]||businessSections[section])?section:'overview')}</div>`
}
export { handleMaterialDecisionClick, handleMaterialDecisionInput, handleMaterialDecisionChange, handleMaterialDecisionKey } from './events'
