import { ce } from './ui.ts'
export const printCard = (content: string) => `<article class="my-3 rounded-xl border border-slate-200 bg-white p-3">${content}</article>`
export function printPhoto(url: string, label: string) { return url ? `<button type="button" class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border" data-central-action="print-photo" data-central-value="${ce(url)}" aria-label="${ce(label)}"><img data-central-print-photo src="${ce(url)}" alt="${ce(label)}" class="h-full w-full object-contain"></button>` : '' }
