import type { CentralPdaLanguage } from './frame.ts'
import { getFactoryMasterRecordById } from '../../data/fcs/factory-master-store.ts'
import { centralErrorText } from './ui.ts'

const labels = {
  zh: {
    readFailed: '资料未能读取，重新读取后重试。', targetMaterial: '目标产出', inputMaterial: '投入物料',
    completeDocument: '完成单据', completedDocument: '单据已完成', completedBy: '完单人', completionWarning: '完成后不能继续加工或交出。', completionNotReady: '收方尚未确认全部加工产出，请重新读取实收记录',
    dye: '染色', origin: '原卷', batch: '批次', specification: '规格', receivedRoll: '本卷已接收',
    actualYard: '本卷实收 · Yard', gross: '毛重 · kg', net: '净重 · kg', weight: '实收重量 · kg',
    paper: '纸管 · 筒', conical: '锥形管 · 筒', pagoda: '宝塔管 · 筒', meters: '实收长度 · m',
    businessQty: '原单实收数量', sourceLine: '本次来货', received: '累计接收', used: '已投入',
    inputLeft: '剩余可投入', outputLeft: '剩余可交出', order: '加工单', rollCount: '未收原卷',
    emptyIncoming: '当前没有可接收来货', scanHint: '原卷码、来货单或加工单号', locationRequired: '选择实际库位',
    quantityRequired: '填写实际接收数量', invalidQuantity: '核对数量和小数位数', invalidYarn: '核对毛重、筒数和管型',
    wrongRoll: '原卷码不属于本次来货，请重扫', duplicateRoll: '本卷已接收，请扫下一卷',
    wrongPosition: '库位不属于本厂待加工仓，请重新选择', sourceChanged: '来货已变化，请重新读取后核对',
    wrongActor: '账号或工厂已变化，请重新打开本单', noReceiving: '当前加工单不能继续接收',
    wrongBusiness: '核对原单数量和单位', noWeight: '填写有效重量，最多三位小数',
    chooseSource: '选择来货', chooseRoll: '选择原卷', onlyReceive: '确认接收', receiptDetails: '接收明细',
    auxSpecial: '辅助 / 特种工艺', history: '历史批次', currentBatch: '当前批次',
    vat: '染缸', batchInput: '本批投入', batchOutput: '本次完成', waitPreparation: '等待样衣、打样或前道准备',
  },
  id: {
    readFailed: 'Data tidak dapat dibaca. Muat ulang untuk mencoba lagi.', targetMaterial: 'Target hasil', inputMaterial: 'Bahan masuk',
    completeDocument: 'Selesaikan order', completedDocument: 'Order selesai', completedBy: 'Diselesaikan oleh', completionWarning: 'Setelah selesai, order tidak dapat diproses atau dikirim lagi.', completionNotReady: 'Penerima belum mengonfirmasi seluruh hasil. Muat ulang riwayat penerimaan.',
    dye: 'Pencelupan', origin: 'Rol asal', batch: 'Lot', specification: 'Spesifikasi', receivedRoll: 'Rol ini sudah diterima',
    actualYard: 'Diterima rol ini · Yard', gross: 'Berat kotor · kg', net: 'Berat bersih · kg', weight: 'Berat diterima · kg',
    paper: 'Tabung kertas · buah', conical: 'Tabung kerucut · buah', pagoda: 'Tabung pagoda · buah', meters: 'Panjang diterima · m',
    businessQty: 'Jumlah sesuai satuan asal', sourceLine: 'Kiriman ini', received: 'Total diterima', used: 'Sudah dipakai',
    inputLeft: 'Sisa bahan tersedia', outputLeft: 'Sisa siap kirim', order: 'Order', rollCount: 'Rol belum diterima',
    emptyIncoming: 'Belum ada kiriman untuk diterima', scanHint: 'Kode rol, kiriman, atau order', locationRequired: 'Pilih lokasi barang',
    quantityRequired: 'Isi jumlah yang diterima', invalidQuantity: 'Periksa jumlah dan angka desimal', invalidYarn: 'Periksa berat kotor, jumlah, dan jenis tabung',
    wrongRoll: 'Rol bukan bagian kiriman ini. Pindai ulang.', duplicateRoll: 'Rol sudah diterima. Pindai rol berikutnya.',
    wrongPosition: 'Lokasi bukan gudang bahan masuk pabrik ini. Pilih lagi.', sourceChanged: 'Kiriman berubah. Muat ulang lalu periksa.',
    wrongActor: 'Akun atau pabrik berubah. Buka ulang order ini.', noReceiving: 'Order ini tidak dapat menerima lagi',
    wrongBusiness: 'Periksa jumlah dan satuan pada kiriman asal', noWeight: 'Isi berat yang valid, maksimal 3 desimal',
    chooseSource: 'Pilih kiriman', chooseRoll: 'Pilih rol asal', onlyReceive: 'Konfirmasi terima', receiptDetails: 'Rincian penerimaan',
    auxSpecial: 'Proses tambahan / khusus', history: 'Lot sebelumnya', currentBatch: 'Lot saat ini',
    vat: 'Mesin celup', batchInput: 'Bahan lot ini', batchOutput: 'Hasil kali ini', waitPreparation: 'Menunggu sampel atau proses sebelumnya',
  },
} as const
export function dt(lang: CentralPdaLanguage, key: keyof typeof labels.zh) { return labels[lang][key] }
export function dyeProcessingLabel(lang: CentralPdaLanguage, node: string, phase: string) {
  const names: Record<string, [string, string]> = { DYE: ['染色', 'pencelupan'], DEHYDRATE: ['脱水', 'pemerasan'], DRY: ['烘干', 'pengeringan'], SET: ['定型', 'pembentukan'], ROLL: ['打卷', 'penggulungan'], PACK: ['包装', 'pengemasan'] }
  const label = names[node]?.[lang === 'id' ? 1 : 0] || node
  return lang === 'id' ? `${phase === 'START' ? 'Mulai' : 'Selesaikan'} ${label}` : `${phase === 'START' ? '开始' : '完成'}${label}`
}
/** Display labels only: location IDs, scan values and saved source identities stay exact. */
export function dyeLocationLabel(value: string, lang: CentralPdaLanguage) {
  if (lang === 'zh') return value
  return value.replace(/^AREA-/, '').replace(/待确认区|待确认/g, 'Konfirmasi').replace(/异常区|异常/g, 'Karantina').replace(/([A-Z])区/g, '$1')
}
export function dyeSpecification(value: string, fallback: string, lang: CentralPdaLanguage) {
  if (lang === 'zh' || !/[\u3400-\u9fff]/.test(value)) return value
  return ({ '卷码见逐卷清单': 'Kode rol ada di daftar rol' } as Record<string, string>)[value] || fallback
}
export function dyeSourcePerson(value: string, lang: CentralPdaLanguage) {
  return lang === 'id' ? value.replace(/仓管\s*/g, '· ') : value
}
export function dyePartnerLabel(partner: { name: string; id: string }, lang: CentralPdaLanguage) {
  if (lang === 'zh') return partner.name
  const name = partner.name.replace(/面料中央仓/g, 'Gudang kain pusat').replace(/纱线中央仓/g, 'Gudang benang pusat')
    .replace(/辅料中央仓/g, 'Gudang aksesori pusat').replace(/中转仓/g, 'Gudang transit')
    .replace(/新裁床/g, 'Pemotongan baru').replace(/特种工艺厂|特殊工艺厂/g, 'Pabrik proses khusus')
    .replace(/辅助工艺厂/g, 'Pabrik proses tambahan').replace(/[（]/g, ' (').replace(/[）]/g, ')')
  const factory = getFactoryMasterRecordById(partner.id)
  return /[\u3400-\u9fff]/.test(name) ? factory?.factoryShortName && !/[\u3400-\u9fff]/.test(factory.factoryShortName) ? factory.factoryShortName : factory?.code || partner.id : name
}
export function dyeErrorText(error: unknown, lang: CentralPdaLanguage) {
  const message = error instanceof Error ? error.message : ''
  const code = message.replace(/^DYE_/, '') as keyof typeof labels.zh
  if (message.startsWith('DYE_') && code in labels.zh) return dt(lang, code)
  if (lang === 'zh') return centralErrorText(error, lang)
  if (/已经接收|重复入库/.test(message)) return dt(lang, 'duplicateRoll')
  if (/卷码不属于|原单.*卷码/.test(message)) return dt(lang, 'wrongRoll')
  if (/库位|仓库位/.test(message)) return dt(lang, 'wrongPosition')
  if (/账号|接收工厂|本厂/.test(message)) return dt(lang, 'wrongActor')
  if (/重量|毛重|管重|筒数|管型|pcs/.test(message)) return dt(lang, 'invalidYarn')
  if (/单位|换算|原单数量|业务数量/.test(message)) return dt(lang, 'wrongBusiness')
  if (/数量|小数|长度|Yard|米数/.test(message)) return dt(lang, 'invalidQuantity')
  if (/来源|来货|停用|已完结|不能继续接收/.test(message)) return dt(lang, 'sourceChanged')
  return centralErrorText(error, lang)
}
/** Localized decimal entry accepts the selected UI's decimal separator only.
 * Mixed separators, thousands grouping, exponents and truncated values are rejected. */
export function dyeNumber(raw: string, lang: CentralPdaLanguage, decimals: number | null = 3, allowZero = false) {
  const value = raw.trim()
  if (!value) throw new Error('DYE_quantityRequired')
  const separator = lang === 'id' ? ',' : '\\.'
  if (!(decimals === 0 ? /^\d+$/ : new RegExp(`^\\d+(?:${separator}\\d${decimals === null ? '+' : `{1,${decimals}}`})?$`)).test(value)) throw new Error('DYE_invalidQuantity')
  const number = Number(lang === 'id' ? value.replace(',', '.') : value)
  if (!Number.isFinite(number) || number < 0 || (!allowZero && number === 0)) throw new Error('DYE_invalidQuantity')
  return number
}
/** Preserve the exact numeric value when changing language; never parse a prefix. */
export function translateDyeNumber(raw: string, from: CentralPdaLanguage, to: CentralPdaLanguage) {
  if (!raw.trim() || from === to) return raw
  try { dyeNumber(raw, from, null, true); return to === 'id' ? raw.replace('.', ',') : raw.replace(',', '.') }
  catch { return raw }
}
