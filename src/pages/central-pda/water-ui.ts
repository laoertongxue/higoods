import type { CentralPdaLanguage } from './frame.ts'
import { ct, centralErrorText, ce } from './ui.ts'
import { dyeNumber } from './dye-ui.ts'
import type { centralWaterFact, CentralWaterAction } from './water-model.ts'
const labels = {
  zh: { water: '水溶', material: '水溶花边', order: '水溶加工单', cumulative: '累计完成', input: '累计投入', inputLeft: '待投入', ready: '可交出',
    received: '累计接收', plan: '计划数量', note: '本次说明', noteRequired: '填写本次说明', minimum: '不能少于已有累计完成数量',
    maximum: '不能超过实际投入数量', receiveNext: '接收下一笔', process: '加工填报', output: '产出卷', receipts: '实收查看',
    inputNew: '投入来料', continue: '继续加工', complete: '登记累计完成', pause: '暂停并登记', pauseChoice: '登记暂停', normal: '继续正常填报',
    paused: '加工暂停', actual: '按实际数量交出', rework: '重新加工', chooseDecision: '选择下一步',
    reworkWarning: '已有累计完成数量将清零；重新加工后再登记。', continueWarning: '保留已有累计完成数量，继续加工。',
    actualWarning: '保留实际完成数量，进入待交出。', noInput: '暂无可投入来料', noReceive: '暂无待接收来料',
    receiveQty: '本次实收', position: '实际库位', positionRequired: '选择实际库位', receivedAt: '接收时间', batch: '来料批次',
    wrongSource: '来料不属于当前加工单，请重扫', wrongActor: '账号或工厂已变化，重新打开本单', history: '本单记录',
    finished: '已完工', finish: '完工', finishWarning: '完工后本单只可查看，不能再接收、加工或交出。',
    overPlan: '核对累计完成数量', confirmOver: '确认登记', whole: '整单', thisBatch: '本批', awaiting: '待对方接收',
    receiveSource: '本次来料', zeroRemaining: '本笔已收完', receiving: '点收实物', chooseSource: '选择来料',
    workStatus: '加工中', waitInput: '待投入', waitReceive: '待来料', waitSend: '待交出', waitActual: '交出待实收',
    difference: '实收待核对', waitFinish: '待完工', stock: '库存', unlocated: '未记录库位',
  },
  id: { water: 'Larut air', material: 'Renda larut air', order: 'Order larut air', cumulative: 'Total hasil', input: 'Total bahan dipakai', inputLeft: 'Belum dipakai', ready: 'Siap kirim',
    received: 'Total diterima', plan: 'Jumlah rencana', note: 'Catatan kali ini', noteRequired: 'Isi catatan kali ini', minimum: 'Tidak boleh kurang dari total hasil sebelumnya',
    maximum: 'Tidak boleh melebihi bahan yang sudah dipakai', receiveNext: 'Terima berikutnya', process: 'Catat hasil', output: 'Rol hasil', receipts: 'Lihat penerimaan',
    inputNew: 'Pakai bahan', continue: 'Lanjut proses', complete: 'Simpan total hasil', pause: 'Simpan & jeda', pauseChoice: 'Catat jeda', normal: 'Lanjut catat hasil',
    paused: 'Proses dijeda', actual: 'Kirim hasil yang ada', rework: 'Proses ulang', chooseDecision: 'Pilih langkah berikutnya',
    reworkWarning: 'Total hasil sebelumnya menjadi nol. Catat hasil setelah proses ulang.', continueWarning: 'Total hasil tetap tersimpan. Lanjutkan proses.',
    actualWarning: 'Jumlah hasil tetap tersimpan dan siap dikirim.', noInput: 'Belum ada bahan yang dapat dipakai', noReceive: 'Belum ada kiriman untuk diterima',
    receiveQty: 'Diterima kali ini', position: 'Lokasi barang', positionRequired: 'Pilih lokasi barang', receivedAt: 'Waktu terima', batch: 'Lot bahan',
    wrongSource: 'Kiriman bukan untuk order ini. Pindai ulang.', wrongActor: 'Akun atau pabrik berubah. Buka ulang order ini.', history: 'Riwayat order',
    finished: 'Selesai', finish: 'Selesaikan order', finishWarning: 'Setelah selesai, order hanya dapat dilihat. Tidak dapat menerima, memproses, atau mengirim lagi.',
    overPlan: 'Periksa total hasil', confirmOver: 'Konfirmasi hasil', whole: 'Seluruh order', thisBatch: 'Lot ini', awaiting: 'Menunggu penerima',
    receiveSource: 'Kiriman ini', zeroRemaining: 'Kiriman sudah diterima semua', receiving: 'Hitung barang', chooseSource: 'Pilih kiriman',
    workStatus: 'Dalam proses', waitInput: 'Bahan siap dipakai', waitReceive: 'Menunggu bahan', waitSend: 'Siap dikirim', waitActual: 'Menunggu penerima',
    difference: 'Penerimaan perlu diperiksa', waitFinish: 'Siap diselesaikan', stock: 'Stok', unlocated: 'Lokasi belum tercatat',
  },
} as const
export const wt = (lang: CentralPdaLanguage, key: keyof typeof labels.zh): string => labels[lang][key]
export function waterUnit(unit: string) { return ['米', 'm'].includes(unit) ? 'm' : unit }
/** Whole-order completion has no extra decimal cap in the current domain. */
export function waterNumber(value:number,lang:CentralPdaLanguage){return new Intl.NumberFormat(lang==='id'?'id-ID':'zh-CN',{maximumFractionDigits:20}).format(value)}
export function waterStatus(status: string, lang: CentralPdaLanguage) {
  const key = ({ WAIT_MATERIAL: 'waitReceive', WAIT_WATER_SOLUBLE: 'waitInput', WATER_SOLUBLE_IN_PROGRESS: 'workStatus', PRODUCTION_PAUSED: 'paused', WAIT_HANDOVER: 'waitSend', HANDOVER_WAIT_RECEIVE: 'waitActual', RECEIPT_DIFFERENCE: 'difference', WAIT_MANUAL_COMPLETION: 'waitFinish', DONE: 'finished' } as const)[status]
  return key ? wt(lang, key) : '—'
}
export function waterErrorText(error: unknown, lang: CentralPdaLanguage) {
  const message = error instanceof Error ? error.message : ''
  const account=({WATER_loginFail:'loginFail',WATER_locked:'locked',WATER_centralOnly:'centralOnly'} as const)[message]
  if(account)return ct(lang,account)
  const outputErrors: Array<[RegExp,string,string]> = [
    [/原交出记录无法定位/,'找不到上游交出记录，核对上游单据后重试','Catatan kiriman asal tidak ditemukan. Periksa dokumen asal, lalu coba lagi.'],
    [/此交接已在其他接收入口登记/,'此笔已在其他入口接收，核对原接收记录','Kiriman ini sudah diterima melalui halaman lain. Periksa catatan penerimaan.'],
    [/原交出单位与实收单位无法换算/,'交出与实收单位无法换算，核对原单单位','Satuan kirim dan terima tidak dapat dikonversi. Periksa satuan dokumen asal.'],
    [/接收人与当前账号不一致/,'接收账号已变化，重新登录后继续','Akun penerima berubah. Masuk kembali untuk melanjutkan.'],
    [/已有实际交出，不能清空完成数量/,'已有实际交出，不能清空完成数量。可继续加工或按实际数量交出。','Sudah ada barang dikirim. Total hasil tidak dapat dihapus. Pilih lanjut proses atau kirim hasil yang ada.'],
    [/WATER_wrongRoll|此卷不在本单|卷码不存在/,'卷码不属于本次可交实物，请重扫','Kode rol tidak cocok. Pindai ulang.'],
    [/此卷已扫码/,'此卷已扫码，继续扫下一卷','Rol ini sudah dipindai. Pindai rol berikutnya.'],
    [/已被交出单占用|所选卷未打印、已占用/,'此卷未打印或已加入交出单，重新选择','Label belum dicetak atau rol sudah dipilih. Pilih rol lain.'],
    [/待交卷合计|超过可交数量/,'卷长合计超过剩余可交数量，核对卷长','Total panjang rol melebihi sisa yang dapat dikirim. Periksa panjang rol.'],
    [/卷长至少|QUANTITY_PRECISION/,'卷长至少0.01，最多两位小数','Panjang rol minimal 0,01, maksimal 2 angka desimal.'],
    [/逐卷扫码/,'先逐卷扫码核对','Pindai setiap rol terlebih dahulu.'],
    [/司机、车型和车牌|运输信息/,'填写司机、车型和车牌','Isi pengemudi, jenis kendaraan, dan nomor kendaraan.'],
    [/WATER_wrongDocument|只能合入|只有草稿|当前单据已处理/,'交出单已变化，重新打开','Dokumen kirim berubah. Buka ulang.'],
    [/WATER_closed|水溶加工单已完工/,'加工单已完工，只可查看','Order sudah selesai. Hanya dapat dilihat.'],
    [/当前水溶加工单尚不能交出/,'本单暂无可交出数量','Belum ada hasil yang dapat dikirim.'],
    [/不同加工厂/,'不同工厂的实物分别交出','Kirim barang dari pabrik berbeda secara terpisah.'],
  ]
  const output=outputErrors.find(([pattern])=>pattern.test(message))
  if(output)return output[lang==='id'?2:1]
  const key = ({ WATER_noteRequired: 'noteRequired', WATER_minimum: 'minimum', WATER_maximum: 'maximum', WATER_wrongSource: 'wrongSource', WATER_wrongActor: 'wrongActor', WATER_position: 'positionRequired', WATER_decision: 'chooseDecision' } as const)[message]
  if (key) return wt(lang, key)
  if (/库位|库区/.test(message)) return wt(lang, 'positionRequired')
  return centralErrorText(error, lang)
}
export interface WaterWorkDraft { raw: string; reason: string; pause: boolean; decision: '' | 'CONTINUE_PROCESSING' | 'CONTINUE_WITH_ACTUAL_QTY' | 'RETURN_FOR_REWORK'; revision: string; operationId: string }
export function waterCompletionInput(fact: NonNullable<ReturnType<typeof centralWaterFact>>, draft: WaterWorkDraft, lang: CentralPdaLanguage): CentralWaterAction {
  const qty = dyeNumber(draft.raw, lang, null, true)
  if (qty + 0.000001 < fact.order.completedQty) throw new Error('WATER_minimum')
  if (qty > fact.input + 0.000001) throw new Error('WATER_maximum')
  const reason = draft.pause || qty === 0 || qty > fact.order.plannedQty ? draft.reason.trim() : ''
  if ((draft.pause || qty === 0 || qty > fact.order.plannedQty) && !reason) throw new Error('WATER_noteRequired')
  return { action: 'COMPLETE', completedQty: qty, reason }
}
const inputClass = 'mt-2 min-h-14 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-xl font-bold'
export function waterNumberField(label: string, value: string, field: string, mode: 'decimal' | 'text' = 'decimal') {
  return `<label class="my-3 block min-w-0 flex-1 text-base font-semibold">${ce(label)}<input class="${inputClass}" data-central-water-field="${field}" inputmode="${mode}" autocomplete="off" value="${ce(value)}"></label>`
}
export function waterNeedsNote(fact: NonNullable<ReturnType<typeof centralWaterFact>>, draft: WaterWorkDraft) {
  const amount = Number(draft.raw.replace(',', '.'))
  return draft.pause || amount === 0 && !!draft.raw.trim() || amount > fact.order.plannedQty
}
export function waterNoteField(reason: string, lang: CentralPdaLanguage) {
  return `<label class="my-3 block font-semibold">${wt(lang, 'note')}<textarea class="mt-2 min-h-20 w-full rounded-xl border border-slate-300 bg-white p-3 text-base" data-central-water-field="reason">${ce(reason)}</textarea></label>`
}
export function waterFactsSummary(fact: NonNullable<ReturnType<typeof centralWaterFact>>, lang: CentralPdaLanguage) {
  const rows = [['received', fact.received], ['input', fact.input], ['cumulative', fact.order.completedQty], ['ready', fact.availableOutput]] as const
  return `<div class="my-3 grid grid-cols-2 gap-2">${rows.map(([key, qty]) => `<div class="rounded-xl border border-slate-200 bg-white p-3"><span class="block text-sm text-slate-600">${wt(lang, key)}</span><strong class="mt-1 block break-words text-lg">${waterNumber(qty, lang)} ${ce(waterUnit(fact.order.qtyUnit))}</strong></div>`).join('')}</div>`
}
