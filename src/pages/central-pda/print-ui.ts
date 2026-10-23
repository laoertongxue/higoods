import type { CentralPdaLanguage } from './frame.ts'
import type { CentralPrintChoice, CentralPrintFact } from './print-model.ts'
import type { CentralPrintingProductionInput } from '../../data/fcs/printing-task-domain.ts'
import { centralErrorText, ce, ct, type CentralTextKey } from './ui.ts'
import { dyeNumber, dyeErrorText } from './dye-ui.ts'

const labels = {
  zh: { print: '印花', order: '印花加工单', artwork: '核对花型', sample: '确认试样', input: '领料投入', 'print-start': '开始印制', 'print-finish': '登记印制完成', 'transfer-start': '开始转印', 'transfer-finish': '登记转印完成', output: '登记产出', incremental: '本次新增', inputLeft: '剩余可投入', printDone: '印制完成', transferDone: '转印完成', outputLeft: '待登记产出', outputCount: '本次新增卷数', packageCount: '本次新增包装数', waitWork: '待加工', loss: '本次损耗', printer: '印机', none: '未选择', direct: '直接印制', transfer: '热转印', front: '正面花型', inside: '反面花型', version: '花型版本', confirmArtwork: '确认花型一致', confirmSample: '确认试样完成', completePrint: '保存印制完成', completeTransfer: '保存转印完成', saveInput: '确认本次投入', saveOutput: '保存本次产出', historyRollsUnknown:'原单未记录历史卷数量', historyUnknown: '原单未记录实际投入数量', noAction: '当前没有可填报的加工动作', qty: '实收数量', weight: '实收重量 · kg', gross: '毛重 · kg', PAPER: '纸管 · 筒', CONICAL: '锥形管 · 筒', PAGODA: '宝塔管 · 筒', business: '原单实收数量', position: '实际库位', selectPosition: '选择库位', source: '本次来料', roll: '原卷', noIncoming: '当前没有可接收来料', nextRoll: '接收下一卷', rolls: '卷', outstanding: '未收原卷', batch: '批次', viewWork: '加工', viewOutput: '产出', viewReceipt: '实收', outputDraft: '待填写卷数量', outputConfirmed: '已确认卷数量', notLocated: '未记录库位', noInputStock: '暂无实收库存', noOutputStock: '暂无已确认产出卷', usage: '领用记录', newScan: '扫下一单', whole: '整单', thisBatch: '本次交出', readOnly: '单据已完成', reference: '来源单', wrongActor: '账号或工厂已变化，请重新打开本单', wrongSource: '来料不属于本单，请重扫', sourceChanged: '来料已变化，请重新读取', invalidOutput: '核对产出、卷数和损耗', stageNotReady: '前道尚未完成，请重新读取本单', artworkMissing: '花型资料或图片不完整', washGate: '尚未满足本卷洗水交出条件', wrongBatch:'本卷批次不存在或已有其他归属，重新核对',chooseBatch:'选择本卷所属的实际产出批次',wrongRoll:'产出卷不属于本单，请重扫', rollClosed:'本卷不能修改，重新读取查看', labelNotReady:'先核对卷数量、规格和产出图片，再打印标签', rollMeasure:'核对本卷实测单位', count: '卷数必须为大于0的整数' },
  id: { print: 'Pencetakan', order: 'Order cetak', artwork: 'Periksa pola', sample: 'Konfirmasi sampel', input: 'Ambil bahan', 'print-start': 'Mulai cetak', 'print-finish': 'Catat hasil cetak', 'transfer-start': 'Mulai transfer', 'transfer-finish': 'Catat hasil transfer', output: 'Catat hasil akhir', incremental: 'Tambahan kali ini', inputLeft: 'Sisa bahan tersedia', printDone: 'Selesai cetak', transferDone: 'Selesai transfer', outputLeft: 'Hasil belum dicatat', outputCount: 'Rol baru kali ini', packageCount: 'Kemasan baru kali ini', waitWork: 'Menunggu proses', loss: 'Susut kali ini', printer: 'Mesin cetak', none: 'Belum dipilih', direct: 'Cetak langsung', transfer: 'Transfer panas', front: 'Pola depan', inside: 'Pola belakang', version: 'Versi pola', confirmArtwork: 'Pola sudah sesuai', confirmSample: 'Sampel sudah selesai', completePrint: 'Simpan hasil cetak', completeTransfer: 'Simpan hasil transfer', saveInput: 'Konfirmasi ambil bahan', saveOutput: 'Simpan hasil akhir', historyRollsUnknown:'Jumlah rol lama belum tercatat', historyUnknown: 'Jumlah bahan masuk belum tercatat pada order asal', noAction: 'Belum ada proses yang dapat dicatat', qty: 'Jumlah diterima', weight: 'Berat diterima · kg', gross: 'Berat kotor · kg', PAPER: 'Tabung kertas · buah', CONICAL: 'Tabung kerucut · buah', PAGODA: 'Tabung pagoda · buah', business: 'Jumlah dalam satuan asal', position: 'Lokasi barang', selectPosition: 'Pilih lokasi', source: 'Kiriman ini', roll: 'Rol asal', noIncoming: 'Belum ada kiriman untuk diterima', nextRoll: 'Terima rol berikutnya', rolls: 'rol', outstanding: 'Rol belum diterima', batch: 'Lot', viewWork: 'Proses', viewOutput: 'Hasil', viewReceipt: 'Diterima', outputDraft: 'Jumlah rol belum diisi', outputConfirmed: 'Jumlah rol dikonfirmasi', notLocated: 'Lokasi belum tercatat', noInputStock: 'Belum ada stok diterima', noOutputStock: 'Belum ada rol hasil yang dikonfirmasi', usage: 'Riwayat pemakaian', newScan: 'Pindai order berikutnya', whole: 'Seluruh order', thisBatch: 'Kiriman ini', readOnly: 'Order selesai', reference: 'Dokumen asal', wrongActor: 'Akun atau pabrik berubah. Buka ulang order ini.', wrongSource: 'Kiriman bukan untuk order ini. Pindai ulang.', sourceChanged: 'Kiriman berubah. Muat ulang.', invalidOutput: 'Periksa hasil, jumlah rol, dan susut.', stageNotReady: 'Proses sebelumnya belum selesai. Muat ulang order.', artworkMissing: 'Data atau foto pola belum lengkap.', washGate: 'Syarat cuci rol ini belum terpenuhi.', wrongBatch:'Lot tidak ditemukan atau rol sudah milik lot lain. Periksa ulang.',chooseBatch:'Pilih lot hasil asal rol ini',wrongRoll:'Rol hasil bukan untuk order ini. Pindai ulang.', rollClosed:'Rol ini tidak dapat diubah. Muat ulang.', labelNotReady:'Periksa jumlah, spesifikasi, dan foto hasil sebelum mencetak label.', rollMeasure:'Periksa satuan ukur rol ini', count: 'Jumlah rol harus bilangan bulat lebih dari 0' },
} as const
export const pt = (lang: CentralPdaLanguage, key: keyof typeof labels.zh) => labels[lang][key]
export const printTaskWaiting=(lang:CentralPdaLanguage)=>lang==='id'?'Menunggu penyiapan order':'等待任务安排'
export const printUnit = (unit: string, lang: CentralPdaLanguage) => lang === 'id' ? ({ '米': 'm', '件': 'pcs', '片': 'lembar', '卷': 'rol', '公斤': 'kg' } as Record<string, string>)[unit] || unit : unit
export const printUsesRolls = (objectType: string) => ['面料', '花边', '织带'].includes(objectType)
export const printNumber = (value: number, lang: CentralPdaLanguage) => new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'zh-CN', { maximumFractionDigits: 6 }).format(value)
export function printError(error: unknown, lang: CentralPdaLanguage) {
  const message = error instanceof Error ? error.message : ''
  const code=message.match(/\bPRINT_[A-Za-z]+\b/)?.[0]||message
  const aliases: Record<string, CentralTextKey> = { PRINT_wrongScan: 'wrongScan', PRINT_noScan: 'noScan', PRINT_loginFail: 'loginFail', PRINT_locked: 'locked', PRINT_centralOnly: 'centralOnly', PRINT_closed:'closed' }
  if (aliases[code]) return ct(lang, aliases[code])
  if(code==='PRINT_allocationTarget') return lang === 'id' ? 'Pilih order cetak aktif dengan bahan dan asal yang sama.' : '选择本厂同物料、同上游的有效印花加工单'
  if(code==='PRINT_allocationQuantity') return lang === 'id' ? 'Isi jumlah lebih dari 0 dan tidak melebihi sisa yang belum dialokasikan.' : '填写大于0且不超过未分配量的数量'
  if(code==='PRINT_completionNotReady')return lang==='id'?'Order belum dapat diselesaikan. Muat ulang dan periksa.':'当前还不能完单，重新读取后核对'
  if (message.startsWith('DYE_')) return dyeErrorText(error, lang)
  const key = code.replace(/^PRINT_/, '') as keyof typeof labels.zh
  if (code.startsWith('PRINT_') && key in labels.zh) return pt(lang, key)
  if (lang === 'zh') return centralErrorText(error, lang)
  if (/历史完成卷数|历史.*卷数/.test(message)) return pt(lang, 'historyRollsUnknown')
  if (/花型|图案|打样|米样/.test(message)) return pt(lang, 'artworkMissing')
  if (/印制|转印|工序|前道|开始加工|未开工/.test(message)) return pt(lang, 'stageNotReady')
  if (/洗水|手感/.test(message)) return pt(lang, 'washGate')
  if (/产出|损耗|卷数|在制/.test(message)) return pt(lang, 'invalidOutput')
  return dyeErrorText(error, lang)
}
export interface PrintWorkDraft { raw: string; count: string; loss: string; printer: string; initialPrinter?:string;revision: string; operationId: string }
export const printFieldClass = 'mt-2 min-h-14 w-full rounded-xl border border-slate-300 bg-white p-3 text-lg'
export function printField(label: string, value: string, key: string, numeric = true) { return `<label class="my-3 block font-semibold">${ce(label)}<input class="${printFieldClass}" data-central-print-field="${ce(key)}" value="${ce(value)}" inputmode="${numeric ? 'decimal' : 'text'}" autocomplete="off"></label>` }
const rounded = (n: number) => Math.round(n * 100) / 100
/** The employee enters a delta; the current Web domain receives its cumulative facts. */
export function printProductionInput(fact: CentralPrintFact, choice: CentralPrintChoice, draft: PrintWorkDraft, lang: CentralPdaLanguage): CentralPrintingProductionInput {
  const number = () => { const n = dyeNumber(draft.raw, lang, 2, choice.kind === 'STAGE' && choice.action === 'FINISH'); if (choice.max === undefined || n > choice.max + .000001) throw new Error('QUANTITY_MAX'); return n }
  if (choice.kind === 'INPUT') return { kind: 'INPUT', qty: number() }
  if (choice.kind === 'STAGE') {
    const base = { kind: 'STAGE' as const, stage: choice.stage!, action: choice.action!, printerNo: draft.printer.trim() || undefined }
    return choice.action === 'FINISH' && ['PRINT', 'TRANSFER'].includes(choice.stage!) ? { ...base, qty: rounded((choice.stage === 'PRINT' ? fact.stages.print : fact.stages.transfer) + number()) } : base
  }
  const count = dyeNumber(draft.count, lang, 0)
  if (!Number.isSafeInteger(count) || count <= 0) throw new Error('PRINT_count')
  return {
    kind: 'OUTPUT', completedQty: rounded(fact.order.output.completedQty + number()), completedRollCount: fact.order.output.completedRollCount + count, usedRollCount: fact.order.actualInput.usedRollCount,
    ...(draft.loss.trim() ? { lossQty: dyeNumber(draft.loss, lang, 2, true) } : {}), printerNo: draft.printer.trim() || undefined
  }
}
export function printChoiceLabel(choice: CentralPrintChoice, lang: CentralPdaLanguage) { return pt(lang, choice.key as keyof typeof labels.zh) }
export function printPrimaryLabel(choice: CentralPrintChoice, lang: CentralPdaLanguage) { const keys: Record<string, keyof typeof labels.zh> = { artwork: 'confirmArtwork', sample: 'confirmSample', input: 'saveInput', 'print-finish': 'completePrint', 'transfer-finish': 'completeTransfer', output: 'saveOutput' }; return pt(lang, keys[choice.key] || choice.key as keyof typeof labels.zh) }
export function printFieldError() { return '<p data-central-print-field-error role="alert" class="my-2 break-words text-base text-red-700"></p>' }
