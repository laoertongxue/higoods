import { renderCode128Barcode } from '../../components/real-barcode.ts'
import type { CentralPdaLanguage } from './frame.ts'
import { ce, centralFormalName } from './ui.ts'
import { ot, outputUnit } from './dye-output-text.ts'
import { centralDyeOutput } from './dye-output-model.ts'

/** The physical barcode remains exact in both languages. Screen sizing is
 * responsive; the existing Web label stock stays 100 × 100 mm when printed. */
export function renderCentralDyeRollLabel(orderId: string, rollId: string, factoryId: string, lang: CentralPdaLanguage) {
  const state = centralDyeOutput(orderId, factoryId), roll = state?.rolls.find(row => row.id === rollId)
  if (!state || !roll || !(roll.qty > 0)) throw new Error('DYE_OUTPUT_unavailable')
  const format = (value: number, digits: number) => new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value)
  return `<!doctype html><html lang="${lang === 'id' ? 'id' : 'zh-CN'}"><head><meta charset="utf-8"><title>${ce(roll.barcode)}</title><style>@page{size:100mm 100mm;margin:4mm}*{box-sizing:border-box}body{margin:0;font:14px Arial,sans-serif;color:#172033}section{width:calc(100% - 8px);max-width:90mm;margin:4px;padding:8px;border:1px solid #64748b;overflow-wrap:anywhere}img{width:58px;height:58px;object-fit:contain;float:right;margin:0 0 4px 8px}h1{font-size:18px;margin:0 0 6px}p{margin:7px 0}svg{width:100%;height:58px}strong{font-size:16px}@media print{section{width:90mm;height:90mm;margin:0;padding:4mm}body{font-size:12px}}</style></head><body><section><img src="${ce(state.material.imageUrl)}" alt="${ce(state.material.sku)}"><h1>${ce(state.fact.order.dyeOrderNo)} · ${ce(roll.rollNo)}</h1><p>${ce(centralFormalName(state.material.name, state.material.sku, lang))}</p><p>${ce(state.material.sku)}</p>${renderCode128Barcode(roll.barcode, roll.barcode)}<p><strong>${ce(roll.barcode)}</strong></p><p>${ot(lang, 'qty')}: ${format(roll.qty, 2)} ${ce(outputUnit(state.fact.order.qtyUnit, lang))}</p><p>${ot(lang, 'weight')}: ${format(roll.weightKg, 3)}</p><p>${ot(lang, 'width')}: ${ce(String(roll.widthCm).replace('.', lang === 'id' ? ',' : '.'))} · ${ot(lang, 'gsm')}: ${ce(String(roll.gsm).replace('.', lang === 'id' ? ',' : '.'))}</p><p>${ot(lang, 'vat')}: ${ce(roll.vatNo || '—')}</p>${roll.remark ? `<p>${ce(roll.remark)}</p>` : ''}</section></body></html>`
}
