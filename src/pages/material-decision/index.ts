import { enter } from './events'
import { sections, businessSections } from './views'
export function renderMaterialDecisionPage(pathname:string):string {
 const section=pathname.split('/').at(-1)??'overview'
 return `<div id="md-page" class="min-w-0 max-w-full">${enter((sections[section]||businessSections[section])?section:'overview')}</div>`
}
export { handleMaterialDecisionClick, handleMaterialDecisionInput, handleMaterialDecisionChange, handleMaterialDecisionKey } from './events'
