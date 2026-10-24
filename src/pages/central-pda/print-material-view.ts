import { ce } from './ui.ts'
import { pdaUi } from '../pda-mobile-ui.ts'
export const printCard = (content: string) => `<article class="${pdaUi.card} my-3 p-3">${content}</article>`
export function printPhoto(url: string, label: string) { return url ? `<button type="button" class="h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-[#e2e6ec] bg-[#f1f3f6]" data-central-action="print-photo" data-central-value="${ce(url)}" aria-label="${ce(label)}"><img data-central-print-photo src="${ce(url)}" alt="${ce(label)}" class="h-full w-full object-contain"></button>` : '' }
