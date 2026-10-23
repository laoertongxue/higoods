import type { CentralPdaLanguage } from './frame.ts'
import { cb, ce, cn, ct, centralFormalName, centralTime, centralErrorText } from './ui.ts'
import { getTmfPurchaseState, getTmfTipMaterialBalance } from '../../data/pms/tmf-material-purchases.ts'
import { centralWebbingBaseLedger, webbingReturnBalance, type WebbingInput, type WebbingOrder, type WebbingTipIssue } from './webbing-model.ts'

const labels = {
  zh: {
    webbing: '织带', material: '半成品', production: '生产单', plan: '计划', input: '加工投入', issued: '上游发出', received: '本厂实收', remain: '未收', cut: '截断', pack: '装包', dispatch: '交出', return: '余料退回', balance: '剩余可加工', baseAccount: '半成品基础原料', rawLot: '原料批次', onHand: '在库', consumed: '已耗用', scrap: '报废', returned: '已退回', baseOutput: '半成品产出', tipPending: '待打头', tipping: '打头', tipReturn: '辅材退回', cutQty: '本次截断', length: '实际下料 mm', finished: '实际成品 mm', defective: '其中不良', loss: '切割损耗 米', reason: '原因', packageNo: '实物包号', package: '包', unpacked: '未装包', select: '选择', dispatchConfirm: '请核对包号与实物', returnQty: '本次退回米数',
    tip: '端头辅材', tipIssued: '发出', tipReceived: '实收', receive: '登记实收', thisQty: '本次实收', confirm: '确认实收', noInput: '当前没有待接收的上游来料',
    noTip: '当前没有待接收的端头辅材', done: '已接收', history: '接收记录', unitMeter: '米', scanHint: '扫描加工单、生产单或来源批次', noPhoto: '物料缺少可用实图，暂不能实收', receivedAt: '接收时间', operator: '接收人',
  },
  id: {
    webbing: 'Bis', material: 'Bahan setengah jadi', production: 'Order produksi', plan: 'Rencana', input: 'Bahan proses', issued: 'Dikirim', received: 'Diterima pabrik', remain: 'Belum diterima', cut: 'Potong', pack: 'Kemas', dispatch: 'Kirim', return: 'Kembalikan sisa', balance: 'Sisa dapat diproses', baseAccount: 'Bahan dasar setengah jadi', rawLot: 'Batch bahan', onHand: 'Di gudang', consumed: 'Terpakai', scrap: 'Rusak', returned: 'Dikembalikan', baseOutput: 'Hasil setengah jadi', tipPending: 'Menunggu ujung', tipping: 'Pasang ujung', tipReturn: 'Kembalikan bahan ujung', cutQty: 'Jumlah potong', length: 'Panjang potong mm', finished: 'Panjang jadi mm', defective: 'Cacat', loss: 'Susut potong m', reason: 'Alasan', packageNo: 'No. kemasan', package: 'Kemasan', unpacked: 'Belum dikemas', select: 'Pilih', dispatchConfirm: 'Periksa nomor kemasan dan barang', returnQty: 'Sisa dikembalikan m',
    tip: 'Bahan ujung', tipIssued: 'Dikirim', tipReceived: 'Diterima', receive: 'Catat penerimaan', thisQty: 'Jumlah diterima', confirm: 'Konfirmasi terima', noInput: 'Belum ada bahan kiriman yang menunggu diterima',
    noTip: 'Belum ada bahan ujung yang menunggu diterima', done: 'Sudah diterima', history: 'Riwayat penerimaan', unitMeter: 'm', scanHint: 'Pindai order atau batch sumber', noPhoto: 'Foto bahan tidak tersedia. Penerimaan belum dapat dicatat.', receivedAt: 'Waktu terima', operator: 'Penerima',
  },
} as const
export const wt = (lang: CentralPdaLanguage, key: keyof typeof labels.zh) => labels[lang][key]
const unit = (value: string, lang: CentralPdaLanguage) => value === '米' && lang === 'id' ? 'm' : value
export function webbingStatus(order: WebbingOrder, lang: CentralPdaLanguage) {
  const receipt = order.receiptStatus === '已接收' ? ct(lang, 'received')
    : order.receiptStatus === '部分接收' ? (lang === 'id' ? 'Sebagian diterima' : '部分接收')
    : ct(lang, 'pending')
  const processing = order.processingStatus === '待加工填报' ? (lang === 'id' ? 'Belum ada hasil proses' : '待加工填报')
    : order.processingStatus === '加工中' ? ct(lang, 'processing')
    : order.processingStatus === '合格产出达量' ? (lang === 'id' ? 'Hasil proses cukup' : '合格产出达量')
    : order.processingStatus
  return `${receipt} · ${processing}`
}
export function webbingIdentity(order: WebbingOrder, lang: CentralPdaLanguage) {
  const name = centralFormalName(order.material?.materialName, order.material?.materialSkuId || order.demands[0]?.materialSkuId || '', lang)
  return `<article class="mb-3 flex gap-3 rounded-xl border bg-white p-3">${order.material?.materialImageUrl
    ? `<button type="button" class="h-16 w-16 shrink-0 overflow-hidden rounded-lg border" data-central-action="webbing-photo" data-central-value="${ce(order.material.materialImageUrl)}" aria-label="${ct(lang, 'photo')}"><img class="h-full w-full object-contain" data-webbing-photo src="${ce(order.material.materialImageUrl)}" alt="${ce(name)}"></button>`
    : ''}<div class="min-w-0"><strong class="block break-words">${ce(name)}</strong><div class="break-words text-sm">${ce(order.material?.materialSkuId || '')}</div></div></article>`
}
export function webbingFacts(order: WebbingOrder, lang: CentralPdaLanguage) {
  const pieces = order.requiredPieces
  return `<div class="mb-3 space-y-1 text-sm"><div>${wt(lang, 'production')} · ${ce(order.productionOrderNo)}</div><div>${wt(lang, 'webbing')} · ${ce(order.workOrderNo)}</div><div>${wt(lang, 'plan')} ${cn(pieces, lang)} ${ce(order.material?.accessoryType === '绳子' ? (lang === 'id' ? 'buah' : '根') : (lang === 'id' ? 'buah' : '条'))} · ${ce(webbingStatus(order, lang))}</div></div>`
}
function inputRow(input: WebbingInput, lang: CentralPdaLanguage, selected: boolean) {
  return `<article class="mb-2 rounded-xl border bg-white p-3"><div class="text-sm break-words">${ce(input.materialSkuId)}</div><div class="mt-1 text-base">${wt(lang, 'issued')} ${cn(input.dispatchedMeters, lang)} ${wt(lang, 'unitMeter')} · ${wt(lang, 'received')} ${cn(input.receivedMeters, lang)} ${wt(lang, 'unitMeter')}</div><div class="mt-1 font-semibold text-amber-700">${wt(lang, 'remain')} ${cn(input.remainingMeters, lang)} ${wt(lang, 'unitMeter')}</div>${input.remainingMeters > 0 ? `<div class="mt-2">${cb(wt(lang, 'receive'), 'webbing-select-input', input.id, selected)}</div>` : ''}</article>`
}
function tipRow(issue: WebbingTipIssue, lang: CentralPdaLanguage, selected: boolean) {
  return `<article class="mb-2 rounded-xl border bg-white p-3"><div class="text-sm break-words">${ce(issue.materialSkuId)}</div><div class="mt-1 text-base">${wt(lang, 'tipIssued')} ${cn(issue.dispatchedQty, lang)} ${ce(unit(issue.unit, lang))} · ${wt(lang, 'tipReceived')} ${cn(issue.receivedQty, lang)} ${ce(unit(issue.unit, lang))}</div><div class="mt-1 font-semibold text-amber-700">${wt(lang, 'remain')} ${cn(issue.remainingQty, lang)} ${ce(unit(issue.unit, lang))}</div>${issue.remainingQty > 0 ? `<div class="mt-2">${cb(wt(lang, 'receive'), 'webbing-select-tip', issue.id, selected)}</div>` : ''}</article>`
}
export function webbingPending(order: WebbingOrder, tips: WebbingTipIssue[], lang: CentralPdaLanguage, selected?: string) {
  const inputs = order.inputs.map(input => ({ ...input, receivedQty: input.receivedMeters, remainingMeters: Math.round((input.dispatchedMeters - input.receivedMeters) * 1000) / 1000 }))
  return `<h2 class="mb-2 text-lg font-bold">${wt(lang, 'input')}</h2>${inputs.length
    ? inputs.map(input => inputRow(input, lang, selected === input.id)).join('') : `<p class="mb-3 rounded-xl border bg-white p-3 text-slate-600">${wt(lang, 'noInput')}</p>`}
    <h2 class="mb-2 mt-4 text-lg font-bold">${wt(lang, 'tip')}</h2>${tips.length
    ? tips.map(issue => tipRow(issue, lang, selected === issue.id)).join('') : `<p class="rounded-xl border bg-white p-3 text-slate-600">${wt(lang, 'noTip')}</p>`}`
}
export function webbingActionLabel(action: string, lang: CentralPdaLanguage) {
  return action === 'receive' ? wt(lang, 'receive') : action === 'cut' ? wt(lang, 'cut') : action === 'tip' ? wt(lang, 'tipping') : action === 'tipReturn' ? wt(lang, 'tipReturn') : action === 'pack' ? wt(lang, 'pack')
    : action === 'dispatch' ? wt(lang, 'dispatch') : action === 'return' ? wt(lang, 'return') : action
}
export function webbingExecutionRows(order: WebbingOrder, action: string, lang: CentralPdaLanguage, selected?: string) {
  if (action === 'cut' || action === 'return') {
    return order.inputs.map(input => {
      const balance = webbingReturnBalance(order, input.id)
      const demand = order.demands.find(row => row.id === input.demandId)!
      return `<article class="mb-2 rounded-xl border bg-white p-3"><div class="text-sm break-words">${ce(input.materialSkuId)}</div><div class="mt-1">${wt(lang, 'plan')} ${ce(demand.specification.garmentSize)} · ${demand.specification.cutLengthMm}mm · ${demand.specification.finishedLengthMm}mm</div><div class="mt-1 font-semibold text-amber-700">${wt(lang, 'balance')} ${cn(balance, lang)} ${wt(lang, 'unitMeter')}</div>${balance > 0 ? `<div class="mt-2">${cb(wt(lang, 'select'), `webbing-select-${action}`, input.id, selected === input.id)}</div>` : ''}</article>`
    }).join('') || `<p class="rounded-xl border bg-white p-3 text-slate-600">${wt(lang, 'noInput')}</p>`
  }
  if (action === 'tip') {
    const candidates = order.outputs.filter(output => output.specification.tippingRequired && output.pendingTipPieces > 0)
    return candidates.map(output => `<article class="mb-2 rounded-xl border bg-white p-3"><div>${ce(output.specification.garmentSize)} · ${output.actualCutLengthMm}mm · ${output.specification.finishedLengthMm}mm</div><div class="mt-1">${wt(lang, 'tipPending')} ${output.pendingTipPieces} ${ce(output.unit)}</div><div class="mt-1 text-sm">A: ${ce(output.specification.endA.method)} ${ce(output.specification.endA.specification)} · B: ${ce(output.specification.endB.method)} ${ce(output.specification.endB.specification)}</div><div class="mt-2">${cb(wt(lang, 'select'), 'webbing-select-tipping', output.id, selected === output.id)}</div></article>`).join('') || `<p class="rounded-xl border bg-white p-3 text-slate-600">${ct(lang, 'noRows')}</p>`
  }
  if (action === 'tipReturn') {
    const demandIds = new Set(order.demands.map(demand => demand.id))
    const issues = getTmfPurchaseState().tipMaterialIssues.filter(issue => demandIds.has(issue.demandId) && issue.stockLotId)
    return issues.map(issue => {
      const balance = Math.max(0, getTmfTipMaterialBalance(issue.id).availableQty)
      return `<article class="mb-2 rounded-xl border bg-white p-3"><div class="text-sm break-words">${ce(issue.materialSkuId)}</div><div class="mt-1">${wt(lang, 'tipReceived')} ${cn(issue.receivedQty, lang)} ${ce(unit(issue.unit, lang))} · ${wt(lang, 'balance')} ${cn(balance, lang)} ${ce(unit(issue.unit, lang))}</div>${balance > 0 ? `<div class="mt-2">${cb(wt(lang, 'select'), 'webbing-select-tipReturn', issue.id, selected === issue.id)}</div>` : ''}</article>`
    }).join('') || `<p class="rounded-xl border bg-white p-3 text-slate-600">${ct(lang, 'noRows')}</p>`
  }
  if (action === 'pack') {
    const candidates = order.outputs.filter(output => !output.specification.tippingRequired && output.goodPieces > order.packages.filter(pkg => !pkg.splitAt && pkg.cutOutputId === output.id).reduce((sum, pkg) => sum + pkg.pieces, 0))
    return candidates.map(output => {
      const packed = order.packages.filter(pkg => !pkg.splitAt && pkg.cutOutputId === output.id).reduce((sum, pkg) => sum + pkg.pieces, 0)
      return `<article class="mb-2 rounded-xl border bg-white p-3"><div>${ce(output.specification.garmentSize)} · ${output.actualCutLengthMm}mm · ${output.actualFinishedLengthMm ?? ''}mm</div><div class="mt-1">${output.goodPieces} ${ce(output.unit)} · ${wt(lang, 'unpacked')} ${output.goodPieces - packed}</div><div class="mt-2">${cb(wt(lang, 'select'), 'webbing-select-pack', output.id, selected === output.id)}</div></article>`
    }).join('') || `<p class="rounded-xl border bg-white p-3 text-slate-600">${ct(lang, 'noRows')}</p>`
  }
  const packages = order.packages.filter(pkg => !pkg.splitAt && !pkg.warehouseId && !order.handovers.some(handover => handover.packageId === pkg.id))
  return packages.map(pkg => `<article class="mb-2 rounded-xl border bg-white p-3"><div class="break-words font-semibold">${wt(lang, 'package')} ${ce(pkg.id)}</div><div>${pkg.pieces} ${ce(pkg.unit)} · ${pkg.actualFinishedLengthMm}mm</div><div class="mt-2">${cb(wt(lang, 'select'), 'webbing-select-dispatch', pkg.id, selected === pkg.id)}</div></article>`).join('') || `<p class="rounded-xl border bg-white p-3 text-slate-600">${ct(lang, 'noRows')}</p>`
}
export function webbingBaseLedger(lang: CentralPdaLanguage, limit = 15) {
  const rows = centralWebbingBaseLedger().filter(row => row.lots.length || row.issues.length)
  return `<section class="mt-4"><h2 class="mb-2 text-lg font-bold">${wt(lang, 'baseAccount')}</h2>${rows.slice(0, limit).map(row => `<article class="mb-2 rounded-xl border bg-white p-3"><strong class="block break-words">${ce(row.purchaseOrderNo)}</strong><div class="text-sm">${wt(lang, 'baseOutput')} ${cn(row.producedMeters, lang)} / ${cn(row.plannedMeters, lang)} ${wt(lang, 'unitMeter')}</div>${row.lots.map(lot => `<div class="mt-2 text-sm">${wt(lang, 'rawLot')} · ${ce(lot.materialSkuId)} · ${ce(lot.location)} · ${wt(lang, 'onHand')} ${cn(lot.onHandQty, lang)} ${ce(lot.unit)}</div>`).join('')}${row.issues.map(issue => `<div class="mt-2 border-t pt-2 text-sm">${ce(issue.materialSkuId)} · ${wt(lang, 'issued')} ${cn(issue.dispatchedQty, lang)} ${ce(issue.unit)} · ${wt(lang, 'received')} ${cn(issue.receivedQty, lang)} · ${wt(lang, 'consumed')} ${cn(issue.consumedQty, lang)} · ${wt(lang, 'scrap')} ${cn(issue.scrapQty, lang)} · ${wt(lang, 'returned')} ${cn(issue.returnedQty, lang)}</div>`).join('')}</article>`).join('') || `<p class="rounded-xl border bg-white p-3 text-slate-600">${ct(lang, 'noRecords')}</p>`}</section>`
}
export function webbingHistory(order: WebbingOrder, tips: WebbingTipIssue[], lang: CentralPdaLanguage, limit = 15) {
  const ids = new Set([...order.inputs.map(input => input.id), ...tips.map(issue => issue.id)])
  const rows = getTmfPurchaseState().operations.filter(operation => ids.has(operation.objectId)).sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
  return `<details class="mt-4 rounded-xl border bg-white p-3"><summary class="min-h-8 font-semibold">${wt(lang, 'history')}</summary><div class="space-y-2 pt-3">${rows.slice(0, limit).map(row => `<div><strong>${ce(historyAction(row.action, lang))}</strong> · ${ce(centralFormalName(row.actor.name, row.actor.id, lang))}<div class="text-sm text-slate-600">${wt(lang, 'receivedAt')} ${centralTime(row.occurredAt, lang)} · ${row.quantity ?? ''} ${ce(unit(row.unit || '', lang))}</div></div>`).join('') || `<p class="text-slate-600">${ct(lang, 'noRecords')}</p>`}</div></details>`
}
function historyAction(action: string, lang: CentralPdaLanguage) {
  if (lang === 'zh') return action
  if (/端头辅材/.test(action)) return 'Penerimaan bahan ujung'
  if (/实收/.test(action)) return 'Penerimaan bahan proses'
  return 'Catatan proses'
}
export function webbingError(error: unknown, lang: CentralPdaLanguage) {
  const message = error instanceof Error ? error.message : ''
  if (!message) return centralErrorText(error, lang)
  const known: Array<[RegExp, [string, string]]> = [
    [/实收超过|超过上游|超过分给|超过工厂/, ['本次实收超过尚未收到的数量', 'Jumlah terima melebihi sisa yang belum diterima']],
    [/须为大于 0|实收数量/, ['填写大于 0 的实收数量', 'Isi jumlah terima lebih dari 0']],
    [/不是本厂|不属于当前|本厂没有/, ['来源不属于本厂当前加工单', 'Sumber bukan milik order pabrik ini']],
    [/尚未读取完成/, ['资料尚未读取完成，请刷新后重试', 'Data belum selesai dibaca. Muat ulang lalu coba lagi.']],
    [/已被其他操作更新|已被其他操作创建/, ['记录已被其他操作更新，请重新读取', 'Data telah diperbarui di halaman lain. Baca ulang.']],
    [/缺少可用实图|实图/, ['物料缺少可用实图，暂不能实收', 'Foto bahan tidak tersedia. Penerimaan belum dapat dicatat.']],
  ]
  const hit = known.find(([pattern]) => pattern.test(message))
  return hit ? hit[1][lang === 'id' ? 1 : 0] : centralErrorText(error, lang)
}
