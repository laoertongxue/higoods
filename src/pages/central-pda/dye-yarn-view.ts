import type { CentralPdaLanguage, CentralPdaFrameInput } from './frame.ts'
import { centralDyeYarn, prepareCentralDyeYarn, type CentralDyeYarnInput } from './dye-yarn-model.ts'
import { ce, cn, ct, centralNotice, centralFormalName, centralTime } from './ui.ts'
import { dyeNumber, dyePartnerLabel } from './dye-ui.ts'
import { calculateYarnWeight } from '../../data/fcs/yarn-weight.ts'
import { renderCode128Barcode } from '../../components/real-barcode.ts'
import { outputButton } from './dye-output-view.ts'

const labels = {
  zh: { labelChanged: '交出记录已更新，重新查看标签后再打印', shipment: '交出', totalGross: '累计毛重 · kg', totalNet: '累计净重 · kg', totalPcs: '累计筒数', title: '纱线交出', gross: '本次毛重 · kg', paper: '纸管 · 62 g/个', conical: '锥形管 · 80 g/个', pagoda: '宝塔管 · 121 g/个',
    pcs: '本次筒数', tare: '本次管重', net: '本次净重', grossLeft: '剩余毛重额度', netLeft: '可交净重', send: '确认交出', history: '逐次交出与实收',
    label: '整单累计标签', version: '累计版本', print: '打印整单标签', back: '返回称重', latest: '最新累计', noRecords: '暂无交出记录',
    notReady: '完成染色及后处理后再交出', wrongTarget: '核对本单接收工厂后重新读取', kgPrecision: '毛重最多填写三位 kg 小数',
    tubeInteger: '管型数量填写 0 或正整数', tubeRequired: '填写本次实际管型数量', tareTooHeavy: '管重超过毛重，核对称重和管型数量',
    grossLimit: '本次毛重超过剩余额度', netLimit: '本次净重超过可交库存', positive: '筒数和净重必须大于 0', loadingLabel: '标签仍在加载，稍后再打印' },
  id: { labelChanged: 'Data pengiriman berubah. Muat ulang label sebelum mencetak.', shipment: 'Pengiriman', totalGross: 'Total berat kotor · kg', totalNet: 'Total berat bersih · kg', totalPcs: 'Total tabung', title: 'Kirim benang', gross: 'Berat kotor kali ini · kg', paper: 'Tabung kertas · 62 g/pcs', conical: 'Tabung kerucut · 80 g/pcs', pagoda: 'Tabung pagoda · 121 g/pcs',
    pcs: 'Jumlah tabung', tare: 'Berat tabung', net: 'Berat bersih', grossLeft: 'Sisa batas berat kotor', netLeft: 'Stok bersih siap kirim', send: 'Konfirmasi kirim', history: 'Riwayat kirim & terima',
    label: 'Label total order', version: 'Versi total', print: 'Cetak label total', back: 'Kembali ke timbang', latest: 'Total terbaru', noRecords: 'Belum ada pengiriman',
    notReady: 'Selesaikan pencelupan dan proses akhir dahulu', wrongTarget: 'Periksa tujuan pabrik order ini, lalu muat ulang', kgPrecision: 'Berat memakai maksimal 3 angka desimal dalam kg',
    tubeInteger: 'Jumlah tabung memakai bilangan bulat 0 atau lebih', tubeRequired: 'Isi jumlah dan jenis tabung kali ini', tareTooHeavy: 'Berat tabung melebihi berat kotor. Periksa timbang dan jumlah tabung.',
    grossLimit: 'Berat kotor kali ini melebihi sisa batas pengiriman', netLimit: 'Berat bersih melebihi stok siap kirim', positive: 'Jumlah tabung dan berat bersih harus lebih dari 0', loadingLabel: 'Label masih dimuat. Coba cetak lagi.' },
} as const
export const yt = (lang: CentralPdaLanguage, key: keyof typeof labels.zh) => labels[lang][key]
export type YarnUi = { fields: Record<'gross' | 'PAPER' | 'CONICAL' | 'PAGODA', string>; operationId?: string; handedOverAt?: string; showingLabel: boolean; labelVersion: number }
export function yarnInput(ui: YarnUi, lang: CentralPdaLanguage): CentralDyeYarnInput {
  const count = (key: 'PAPER' | 'CONICAL' | 'PAGODA') => { try { return dyeNumber(ui.fields[key] || '0', lang, 0, true) } catch { throw new Error('YARN_tubeInteger') } }
  return { grossKg: dyeNumber(ui.fields.gross, lang, 3, true), tubes: { PAPER: count('PAPER'), CONICAL: count('CONICAL'), PAGODA: count('PAGODA') } }
}
export function yarnError(error: unknown, lang: CentralPdaLanguage) {
  const message = error instanceof Error ? error.message : ''
  if (message.startsWith('YARN_')) return yt(lang, message.slice(5) as 'notReady' | 'wrongTarget' | 'loadingLabel' | 'tubeInteger' | 'labelChanged')
  if (lang === 'zh') return message || ct(lang, 'notSaved')
  if (/最多保留三位/.test(message)) return yt(lang, 'kgPrecision')
  if (/管重超过/.test(message)) return yt(lang, 'tareTooHeavy')
  if (/请填写纱线筒数|管型数量/.test(message)) return yt(lang, 'tubeRequired')
  if (/管.*非负整数|pcs 必须/.test(message)) return yt(lang, 'tubeInteger')
  if (/累计出货毛重|剩余额度/.test(message)) return yt(lang, 'grossLimit')
  if (/可交出净重|交出数量不能超过/.test(message)) return yt(lang, 'netLimit')
  if (/筒数和净重必须|交出数量必须/.test(message)) return yt(lang, 'positive')
  if (message === 'DYE_quantityRequired') return yt(lang, 'gross')
  if (message === 'DYE_invalidQuantity') return yt(lang, 'kgPrecision')
  return ''
}
export function yarnSummary(ui: YarnUi, lang: CentralPdaLanguage) {
  const input = yarnInput(ui, lang), weight = calculateYarnWeight(input.grossKg, input.tubes)
  return `<dl class="my-3 grid grid-cols-2 gap-2 rounded-xl border bg-white p-3"><dt>${yt(lang, 'pcs')}</dt><dd class="font-bold">${cn(weight.pcs, lang)} pcs</dd><dt>${yt(lang, 'tare')}</dt><dd class="font-bold">${cn(weight.tareGrams / 1000, lang)} kg</dd><dt>${yt(lang, 'net')}</dt><dd class="font-bold">${cn(weight.netGrams / 1000, lang)} kg</dd></dl>`
}
export function renderCentralDyeYarn(orderId: string, factoryId: string, ui: YarnUi, lang: CentralPdaLanguage) {
  const state = centralDyeYarn(orderId, factoryId)
  if (!state) return centralNotice(ct(lang, 'wrongScan'), true)
  let html = `<p class="mb-3 break-words">${ct(lang, 'target')} · <strong>${ce(dyePartnerLabel(state.partner, lang))}</strong></p><dl class="my-3 grid grid-cols-2 gap-2 rounded-xl border bg-white p-3"><dt>${yt(lang, 'grossLeft')}</dt><dd class="font-bold">${cn(state.grossLeftGrams / 1000, lang)} kg</dd><dt>${yt(lang, 'netLeft')}</dt><dd class="font-bold">${cn(state.availableNetKg, lang)} kg</dd></dl>`
  if (ui.showingLabel && state.records.length) {
    html += `<label class="my-2 block font-semibold" for="yarn-version">${yt(lang, 'version')}</label><select id="yarn-version" data-central-yarn-field="version" class="mb-3 min-h-12 w-full rounded-xl border bg-white p-3"><option value="0">${yt(lang, 'latest')}</option>${state.records.map((_, i) => `<option value="${i + 1}"${ui.labelVersion === i + 1 ? ' selected' : ''}>${yt(lang, 'version')} ${i + 1}</option>`).join('')}</select><iframe data-central-yarn-label title="${yt(lang, 'label')}" class="h-[440px] w-full rounded-xl border bg-white"></iframe><div class="my-3">${outputButton(yt(lang, 'back'), 'yarn-back')}</div>`
  } else if (state.canSend) {
    for (const [key, label] of [['gross', 'gross'], ['PAPER', 'paper'], ['CONICAL', 'conical'], ['PAGODA', 'pagoda']] as const) html += `<label class="mb-2 mt-3 block font-semibold" for="yarn-${key}">${yt(lang, label)}</label><input id="yarn-${key}" data-central-yarn-field="${key}" value="${ce(ui.fields[key])}" inputmode="${key === 'gross' ? 'decimal' : 'numeric'}" enterkeyhint="next" autocomplete="off" class="min-h-14 w-full rounded-xl border border-slate-400 bg-white px-3 py-3 text-2xl font-bold">`
    let summary = ''; try { summary = yarnSummary(ui, lang) } catch { /* Empty input has no calculated weight. */ }
    html += `<div data-central-yarn-summary>${summary}</div><p data-central-yarn-error role="alert" class="my-3 text-red-700"></p><div class="my-3">${outputButton(ct(lang, 'clear'), 'yarn-clear')}</div>`
  }
  if (state.records.length && !ui.showingLabel) html += `<div class="my-3">${outputButton(yt(lang, 'label'), 'yarn-label')}</div>`
  html += `<details class="my-3"><summary class="min-h-12 py-3 font-bold">${yt(lang, 'history')}</summary>${state.records.map(({ source, receipts }, index) => `<article class="my-3 rounded-xl border bg-white p-3"><strong class="break-all">${yt(lang, 'shipment')} ${cn(index + 1, lang)}</strong><p class="mt-2 break-words">${ct(lang, 'sender')} · ${ce(centralFormalName(source.createdBy, state.fact.records.find(r => (r.handoverRecordId || r.recordId) === source.originalRecordId)?.factorySubmittedByUserId || source.createdBy, lang))}</p><p class="text-sm">${ce(centralTime(source.handedOutAt || source.createdAt, lang))}</p>${source.lines.filter(line => line.yarn).map(line => `<p>${yt(lang, 'pcs')} ${cn(line.yarn!.pcs, lang)} pcs<br>${yt(lang, 'gross')} ${cn(line.yarn!.grossGrams / 1000, lang)}<br>${yt(lang, 'net')} ${cn(line.yarn!.netGrams / 1000, lang)} kg</p>`).join('')}${receipts.map(r => `<p class="mt-2 border-t pt-2">${ct(lang, 'actual')} ${cn(r.yarn ? r.yarn.netGrams / 1000 : r.qty, lang)} kg<br>${ct(lang, 'receiver')} · ${ce(centralFormalName(r.receivedBy, r.receivedById, lang))}<br>${ce(centralTime(r.receivedAt, lang))}</p>`).join('') || `<p class="mt-2">${ct(lang, 'awaiting')}</p>`}</article>`).join('') || centralNotice(yt(lang, 'noRecords'))}</details>`
  return html
}
export function centralDyeYarnFooter(orderId: string, factoryId: string, ui: YarnUi, lang: CentralPdaLanguage, busy: boolean, photoReady: boolean): CentralPdaFrameInput['primary'] {
  if (ui.showingLabel) return { action: 'output-yarn-print', label: yt(lang, 'print'), disabled: busy || !photoReady }
  const state = centralDyeYarn(orderId, factoryId)
  if (!state?.canSend) return undefined
  let valid = false, net = 0
  try { net = prepareCentralDyeYarn(orderId, yarnInput(ui, lang), factoryId).weight.netGrams / 1000; valid = true } catch { /* Guard shows beside current weight. */ }
  return { action: 'output-yarn-save', label: busy ? ct(lang, 'saving') : `${yt(lang, 'send')}${valid ? ` · ${cn(net, lang)} kg` : ''}`, disabled: busy || !photoReady || !valid }
}
export function renderCentralDyeYarnLabel(orderId: string, factoryId: string, version: number, lang: CentralPdaLanguage) {
  const state = centralDyeYarn(orderId, factoryId), records = state?.records.slice(0, version || undefined)
  if (!state || !records?.length || !Number.isInteger(version) || version < 0 || version > state.records.length) throw new Error('YARN_notReady')
  const weights = records.flatMap(r => r.source.lines.flatMap(line => line.yarn ? [line.yarn] : [])), sum = (key: 'pcs' | 'grossGrams' | 'netGrams') => weights.reduce((n, weight) => n + weight[key], 0)
  return `<!doctype html><html lang="${lang === 'id' ? 'id' : 'zh-CN'}"><head><meta charset="utf-8"><title>${ce(state.barcode)}</title><style>@page{size:100mm 120mm;margin:4mm}*{box-sizing:border-box}body{margin:0;font:14px Arial;color:#172033}section{width:calc(100% - 8px);max-width:90mm;margin:4px;padding:8px;border:1px solid #64748b;overflow-wrap:anywhere}img{width:58px;height:65px;object-fit:contain;float:right;margin:0 0 4px 8px}svg{width:100%;height:64px}h1{font-size:18px}p{margin:7px 0}@media print{section{width:90mm;margin:0;padding:4mm}}</style></head><body><section><img src="${ce(state.material.imageUrl)}" alt="${ce(state.material.sku)}"><h1>${ce(state.fact.order.dyeOrderNo)}</h1><p>${ce(centralFormalName(state.material.name, state.material.sku, lang))}</p>${centralFormalName(state.material.name, state.material.sku, lang) === state.material.sku ? '' : `<p>${ce(state.material.sku)}</p>`}${renderCode128Barcode(state.barcode, state.fact.order.dyeOrderNo)}<p>${ce(state.barcode)}</p><p>${yt(lang, 'totalPcs')}: ${cn(sum('pcs'), lang)} pcs</p><p>${yt(lang, 'totalGross')}: ${cn(sum('grossGrams') / 1000, lang)}</p><p>${yt(lang, 'totalNet')}: ${cn(sum('netGrams') / 1000, lang)}</p><p>${yt(lang, 'version')} ${cn(records.length, lang)}</p><p>${ce(centralTime(records.at(-1)!.source.handedOutAt || records.at(-1)!.source.createdAt, lang))}</p><p>${yt(lang, 'paper')}<br>${yt(lang, 'conical')}<br>${yt(lang, 'pagoda')}</p></section></body></html>`
}
