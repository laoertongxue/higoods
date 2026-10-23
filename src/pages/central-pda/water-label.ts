import { renderCode128Barcode } from '../../components/real-barcode.ts'
import type { CentralPdaLanguage } from './frame.ts'
import { ce, cn } from './ui.ts'
import { wt, waterUnit } from './water-ui.ts'
import { centralWaterOutput } from './water-output-model.ts'
export function renderCentralWaterLabel(orderId: string, rollIds: string[], factoryId: string, lang: CentralPdaLanguage) {
  const state = centralWaterOutput(orderId, factoryId)
  if (!state || !rollIds.length) throw new Error('WATER_wrongDocument')
  const rolls = rollIds.map(id => state.rolls.find(roll => roll.id === id))
  if (rolls.some(roll => !roll || roll.qty <= 0) || !state.fact.image?.material) throw new Error('WATER_wrongDocument')
  return `<!doctype html><html lang="${lang === 'id' ? 'id' : 'zh-CN'}"><head><meta charset="utf-8"><title>${ce(wt(lang, 'water'))}</title><style>
  @page{size:100mm 70mm;margin:4mm}*{box-sizing:border-box}body{margin:0;font:13px Arial,sans-serif;color:#14283b}article{width:92mm;height:62mm;padding:4mm;border:1px solid #ddd;break-after:page}article:last-child{break-after:auto}img{float:right;width:40px;height:40px;object-fit:contain}p{margin:6px 0;overflow-wrap:anywhere}svg{width:100%;height:44px}.amount{font-size:20px;font-weight:bold}@media print{article{border:0}}</style></head><body>${rolls.map(roll => `<article>
  <img src="${ce(state.fact.image!.material)}" alt="${ce(state.fact.order.materialCode)}"><strong>${ce(wt(lang, 'material'))}</strong>
  <p>${ce(state.fact.order.materialCode)}</p><p>${ce(state.fact.order.waterOrderNo)} · ${ce(roll!.rollNo)}</p>
  <p class="amount">${cn(roll!.qty, lang)} ${ce(waterUnit(state.fact.order.qtyUnit))}</p>${renderCode128Barcode(roll!.barcode, roll!.barcode)}<p>${ce(roll!.barcode)}</p></article>`).join('')}</body></html>`
}
