import type { CentralPdaLanguage } from './frame.ts'
import type { CentralPrintFact } from './print-model.ts'
import type { centralPrintCompletion } from './print-completion-model.ts'
import { cb, ce, ct } from './ui.ts'
import { printNumber, printUnit } from './print-ui.ts'
import { printPhoto } from './print-view.ts'

const labels={
 zh:{complete:'完单',confirm:'确认完单',consequence:'完单后只能查看'},
 id:{complete:'Selesaikan order',confirm:'Konfirmasi selesai',consequence:'Setelah selesai, order hanya dapat dilihat.'},
} as const
export const pct=(lang:CentralPdaLanguage,key:keyof typeof labels.zh)=>labels[lang][key]
export function renderPrintCompletionConfirmation(fact:CentralPrintFact,state:NonNullable<ReturnType<typeof centralPrintCompletion>>,lang:CentralPdaLanguage){
 const unit=printUnit(fact.order.output.qtyUnit,lang)
 return `<div class="flex items-center gap-3">${printPhoto(fact.order.output.imageUrl,fact.order.output.sku)}<div class="min-w-0"><strong class="block break-words text-lg">${ce(fact.order.printOrderNo)}</strong><span class="block break-words text-sm">${ce(fact.order.output.sku)}</span></div></div><dl class="my-3 grid grid-cols-2 gap-3">${([
  [ct(lang,'produced'),state.outputQty],[ct(lang,'handed'),state.handedQty],[ct(lang,'actual'),state.receivedQty],
 ] as const).map(([label,value])=>`<dt>${label}</dt><dd class="text-right font-bold">${printNumber(value,lang)} ${ce(unit)}</dd>`).join('')}</dl><p class="my-4">${pct(lang,'consequence')}</p>${cb(pct(lang,'confirm'),'print-complete-confirm',undefined,true)}`
}
