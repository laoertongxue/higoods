import type { InspectionReference } from '../../data/fcs/quality-management-types.ts'
import { escapeHtml as e } from '../../utils.ts'
/** Render only the already frozen reference, never look up a mutable source. */
export function renderInspectionReference(ref:InspectionReference, print=false):string {
  const url=ref.imageUrl || (ref.value && /^(\/|https?:\/\/|blob:)/.test(ref.value) ? ref.value : undefined)
  const description=ref.description || (ref.value!==url ? ref.value : undefined)
  return `<div class="mt-2 text-sm"><strong>${e(ref.name)}</strong>${ref.sourceVersion!==undefined?` · v${ref.sourceVersion}`:''}${ref.missing?'（资料缺失，按已有资料检查）':''}${description?`<p style="white-space:pre-wrap">${e(description)}</p>`:''}${url ? print ? `<div><img src="${e(url)}" alt="${e(ref.name)}" style="max-width:75mm;max-height:45mm;object-fit:contain"></div>` : `<a class="text-blue-700 underline" href="${e(url)}" target="_blank" rel="noopener">查看本次固定资料</a>` : ''}</div>`
}
