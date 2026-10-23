import type { CentralPdaFrameInput, CentralPdaLanguage } from './frame.ts'
import { centralDyeWater, type CentralDyeWaterInput } from './dye-water-model.ts'
import { ce, cn, ct, centralFormalName, centralTime } from './ui.ts'
import { dyeNumber } from './dye-ui.ts'
import { outputUnit } from './dye-output-text.ts'

const labels = {
  zh: { title: '水溶', start: '开始水溶', complete: '记录本批水溶', paused: '水溶已暂停', input: '本批投入', planned: '水溶计划', total: '累计水溶完成',
    quantity: '本批累计完成', previous: '本批已记录', reason: '本批说明', reasonRequired: '填写本批说明', next: '下一步', choose: '选择下一步',
    CONTINUE_PROCESSING: '继续补做', CONTINUE_WITH_ACTUAL_QTY: '按已完成数量染色', RETURN_FOR_REWORK: '重新水溶',
    continueWarning: '保留已完成数量，继续补做。', actualWarning: '按已记录的水溶完成数量继续染色。', reworkWarning: '本单水溶完成数量将清零，之后重新开始水溶。',
    confirm: '确认下一步', newInput: '水溶新增来料', back: '返回染色', history: '水溶记录', batch: '批次', starter: '开始人', finisher: '完成人', decidedBy: '操作人',
    minimum: '本批累计完成不能少于已记录数量', maximum: '本批完成不能超过本批投入', noActual: '当前没有可继续染色的水溶产出',
  },
  id: { title: 'Pelarutan', start: 'Mulai pelarutan', complete: 'Catat hasil lot ini', paused: 'Pelarutan dijeda', input: 'Bahan lot ini', planned: 'Rencana pelarutan', total: 'Total hasil pelarutan',
    quantity: 'Total hasil lot ini', previous: 'Sudah dicatat pada lot ini', reason: 'Catatan lot ini', reasonRequired: 'Isi catatan lot ini', next: 'Langkah berikutnya', choose: 'Pilih langkah',
    CONTINUE_PROCESSING: 'Lanjutkan pengerjaan', CONTINUE_WITH_ACTUAL_QTY: 'Celupkan hasil yang ada', RETURN_FOR_REWORK: 'Ulangi pelarutan',
    continueWarning: 'Hasil yang tercatat tetap disimpan. Lanjutkan pengerjaan.', actualWarning: 'Lanjutkan pencelupan sesuai hasil pelarutan yang tercatat.', reworkWarning: 'Jumlah hasil pelarutan order ini akan direset ke 0. Mulai pelarutan lagi.',
    confirm: 'Konfirmasi langkah', newInput: 'Larutkan bahan baru', back: 'Kembali ke pencelupan', history: 'Riwayat pelarutan', batch: 'Lot', starter: 'Dimulai oleh', finisher: 'Diselesaikan oleh', decidedBy: 'Dicatat oleh',
    minimum: 'Total hasil lot ini tidak boleh kurang dari yang sudah dicatat', maximum: 'Hasil lot tidak boleh melebihi bahan lot ini', noActual: 'Belum ada hasil pelarutan yang dapat dicelupkan',
  },
} as const
export const dwt = (lang: CentralPdaLanguage, key: keyof typeof labels.zh) => labels[lang][key]
export type DyeWaterUi = { raw: string; reason: string; decision: string; operationId?: string; revision?: string }
export const waterDecisions = ['CONTINUE_PROCESSING', 'CONTINUE_WITH_ACTUAL_QTY', 'RETURN_FOR_REWORK'] as const
export function dyeWaterReasonNeeded(state: NonNullable<ReturnType<typeof centralDyeWater>>, raw: string, lang: CentralPdaLanguage) {
  try { return state.previousOutput + dyeNumber(raw, lang, null, true) !== state.planned } catch { return false }
}
export function dyeWaterInput(state: NonNullable<ReturnType<typeof centralDyeWater>>, ui: DyeWaterUi, lang: CentralPdaLanguage): CentralDyeWaterInput {
  if (state.phase === 'START') return { action: 'START' }
  if (state.phase === 'PAUSE') {
    if (!waterDecisions.includes(ui.decision as typeof waterDecisions[number])) throw new Error('DYE_WATER_choose')
    if (ui.decision === 'CONTINUE_WITH_ACTUAL_QTY' && !(state.fact.order.waterSolubleCompletedQty! > 0)) throw new Error('DYE_WATER_noActual')
    return { action: 'RESOLVE_PAUSE', decision: ui.decision as typeof waterDecisions[number] }
  }
  if (state.phase !== 'COMPLETE') throw new Error('CHANGED')
  const qty = dyeNumber(ui.raw, lang, null, true)
  if (qty < state.currentMinimum) throw new Error('DYE_WATER_minimum')
  if (qty > (state.node?.inputQty || 0)) throw new Error('DYE_WATER_maximum')
  const reason = dyeWaterReasonNeeded(state, ui.raw, lang) ? ui.reason.trim() : ''
  if (dyeWaterReasonNeeded(state, ui.raw, lang) && !reason) throw new Error('DYE_WATER_reasonRequired')
  return { action: 'COMPLETE', outputQty: qty, reason }
}
export function dyeWaterError(error: unknown, lang: CentralPdaLanguage) {
  const message = error instanceof Error ? error.message : ''
  if (message.startsWith('DYE_WATER_')) return dwt(lang, message.slice(10) as 'choose')
  if (lang === 'id') {
    if (/数量不足|计划数量.*原因|填写原因/.test(message)) return dwt(lang, 'reasonRequired')
    if (/累计水溶完成数量不能少于/.test(message)) return dwt(lang, 'minimum')
    if (/超过已记录的实际投入/.test(message)) return dwt(lang, 'maximum')
  }
  return ''
}
function input(name: string, label: string, raw: string, numeric = false) {
  return `<label class="mb-2 mt-3 block font-semibold" for="water-${name}">${ce(label)}</label><input id="water-${name}" data-central-water-field="${name}" value="${ce(raw)}" autocomplete="off" enterkeyhint="next" inputmode="${numeric ? 'decimal' : 'text'}" class="min-h-14 w-full rounded-xl border border-slate-400 bg-white px-3 py-3 ${numeric ? 'text-2xl font-bold' : 'text-lg'}">`
}
export function renderCentralDyeWater(state: NonNullable<ReturnType<typeof centralDyeWater>>, ui: DyeWaterUi, lang: CentralPdaLanguage) {
  const unit = outputUnit(state.unit, lang)
  let html = `<h2 data-central-dye-water-phase="${state.phase}" class="my-3 text-lg font-bold">${dwt(lang, state.phase === 'START' ? 'start' : state.phase === 'COMPLETE' ? 'complete' : 'paused')} · ${dwt(lang, 'batch')} ${cn(state.batchNo, lang)}</h2><dl class="my-3 grid grid-cols-2 gap-2 rounded-xl border bg-white p-3"><dt>${dwt(lang, 'input')}</dt><dd class="font-bold">${cn(state.phase === 'START' ? state.availableInput : state.node?.inputQty || 0, lang)} ${ce(unit)}</dd><dt>${dwt(lang, 'planned')}</dt><dd>${cn(state.planned, lang)} ${ce(unit)}</dd><dt>${dwt(lang, 'total')}</dt><dd>${cn(state.fact.order.waterSolubleCompletedQty || 0, lang)} ${ce(unit)}</dd></dl>`
  if (state.phase === 'COMPLETE') {
    if (state.currentMinimum > 0) html += `<p class="mb-3">${dwt(lang, 'previous')} ${cn(state.currentMinimum, lang)} ${ce(unit)}</p>`
    html += input('quantity', `${dwt(lang, 'quantity')} · ${unit}`, ui.raw, true)
    html += `<div data-central-water-reason${dyeWaterReasonNeeded(state, ui.raw, lang) ? '' : ' hidden'}>${input('reason', dwt(lang, 'reason'), ui.reason)}</div>`
  } else if (state.phase === 'PAUSE') html += `<label class="mb-2 block font-semibold" for="water-decision">${dwt(lang, 'next')}</label><select id="water-decision" data-central-water-field="decision" class="min-h-14 w-full rounded-xl border border-slate-400 bg-white p-3"><option value="">${dwt(lang, 'choose')}</option>${waterDecisions.map(decision => `<option value="${decision}"${decision === ui.decision ? ' selected' : ''}>${dwt(lang, decision)}</option>`).join('')}</select>`
  return html + '<p data-central-water-error role="alert" class="my-3 text-red-700"></p>'
}
export function centralDyeWaterFooter(state: NonNullable<ReturnType<typeof centralDyeWater>>, ui: DyeWaterUi, lang: CentralPdaLanguage, busy: boolean, photoReady: boolean): CentralPdaFrameInput['primary'] {
  let valid = !!state.phase && (state.phase !== 'START' || state.availableInput > 0)
  try { dyeWaterInput(state, ui, lang) } catch { valid = false }
  return { action: state.phase === 'PAUSE' ? 'water-decision-request' : 'water-save', label: busy ? ct(lang, 'saving') : dwt(lang, state.phase === 'START' ? 'start' : state.phase === 'COMPLETE' ? 'complete' : 'confirm'), disabled: busy || !photoReady || !valid }
}
export function renderDyeWaterHistory(state: NonNullable<ReturnType<typeof centralDyeWater>>, lang: CentralPdaLanguage) {
  const nodes = [...state.archived, ...(state.node?.startedAt ? [state.node] : [])]
  if (!nodes.length && !state.fact.order.waterSolublePauseHistory?.length) return ''
  return `<details class="my-3"><summary class="min-h-12 py-3 font-bold">${dwt(lang, 'history')}</summary>${nodes.map((node, i) => `<article class="my-3 rounded-xl border bg-white p-3"><strong>${dwt(lang, 'batch')} ${cn(i + 1, lang)}</strong><p>${dwt(lang, 'input')} ${cn(node.inputQty || 0, lang)} ${ce(outputUnit(node.qtyUnit, lang))}</p>${node.finishedAt ? `<p>${ct(lang, 'produced')} ${cn(node.outputQty || 0, lang)} ${ce(outputUnit(node.qtyUnit, lang))}</p>` : ''}<p class="mt-2">${dwt(lang, 'starter')} · ${ce(centralFormalName(node.startedByName || node.operatorName, node.startedByUserId || node.operatorUserId, lang))}</p><p class="text-sm">${ce(centralTime(node.startedAt || '', lang))}</p>${node.finishedAt ? `<p class="mt-2">${dwt(lang, 'finisher')} · ${ce(centralFormalName(node.finishedByName || node.operatorName, node.finishedByUserId || node.operatorUserId, lang))}</p><p class="text-sm">${ce(centralTime(node.finishedAt, lang))}</p>` : ''}</article>`).join('')}${state.fact.order.waterSolublePauseHistory?.map(row => `<article class="my-3 rounded-xl border bg-white p-3"><strong>${dwt(lang, row.decision)}</strong><p>${dwt(lang, 'batch')} ${cn(row.batch, lang)} · ${cn(row.completedQty, lang)} ${ce(outputUnit(state.unit, lang))}</p>${row.beforeNode?.finishedAt ? `<p>${dwt(lang, 'finisher')} · ${ce(centralFormalName(row.beforeNode.finishedByName || row.beforeNode.operatorName, row.beforeNode.finishedByUserId || row.beforeNode.operatorUserId, lang))}</p><p>${ce(centralTime(row.beforeNode.finishedAt, lang))}</p>` : ''}<p>${dwt(lang, 'decidedBy')} · ${ce(centralFormalName(row.name, row.userId || row.name, lang))}</p><p class="text-sm">${ce(centralTime(row.at, lang))}</p></article>`).join('') || ''}</details>`
}
