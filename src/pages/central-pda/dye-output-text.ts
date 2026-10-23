import type { CentralPdaLanguage } from './frame.ts'
import { dyeErrorText } from './dye-ui.ts'
const labels = {
  zh: {
    output: '产出卷', stage: '移到待出库区', staged: '待出库区', scanEmpty: '先扫描实物标签', alreadySent: '此卷已经交出，请扫描下一卷', scanDone: '已扫', scanPending: '待扫', voided: '已作废', add: '新增一卷', edit: '修改本卷', save: '保存本卷', qty: '本卷数量', weight: '实称重量 · kg',
    dimensions: '幅宽、克重', width: '幅宽 · cm', gsm: '克重 · g/m²', vat: '缸号', remark: '备注',
    print: '打印标签', printPreview: '标签预览', printResult: '标签已成功打印', printCancelled: '取消打印',
    printingCheck: '确认本卷标签已成功打印。', printLoading: '标签仍在加载，请稍后打印',
    printed: '已打印', notPrinted: '待打印', ready: '可交出', reserved: '已在交出单', handed: '已交出',
    startDispatch: '发起交出', dispatch: '本次交出', confirmDispatch: '确认交出', scanned: '已扫卷',
    scan: '扫产出卷码', scanHint: '扫描实物标签上的条码', identify: '识别', lastScan: '本次已扫',
    driver: '司机', vehicle: '车型', plate: '车牌', note: '送货备注', transport: '运输信息',
    documents: '本单交出', openDocument: '继续本次交出', void: '作废草稿', voidConfirm: '作废并解除占用',
    voidWarning: '作废此草稿后，所含卷可重新建交出单。已交出记录不能作废。',
    delete: '删除本卷', deleteConfirm: '删除未交出卷', deleteWarning: '删除本卷条码；已交出或已占用的卷不能删除。',
    wrongRoll: '此卷不属于当前交出，请核对后重扫', duplicate: '此卷已经扫码，不用重复扫描',
    wrongDocument: '未找到本厂交出单，请重新读取', scanRequired: '先扫完本次全部卷',
    unavailable: '此卷尚未打印、已被占用或超过当前可交量', noDestination: '下游尚未明确，暂不能交出',
    yarnSeparate: '纱线按整单称重交出', empty: '暂无产出卷', drafts: '待交出草稿', printChanged: '标签内容已变化，请重新预览并打印',
    selectRoll: '选择本卷', rolls: '卷', createdBy: '建单人', handoverBy: '实际交出人', continue: '返回产出卷',
  },
  id: {
    output: 'Hasil rol', stage: 'Pindahkan ke area siap kirim', staged: 'Area siap kirim', scanEmpty: 'Pindai label barang dahulu', alreadySent: 'Rol ini sudah dikirim. Pindai rol berikutnya.', scanDone: 'Sudah dipindai', scanPending: 'Belum dipindai', voided: 'Dibatalkan', add: 'Tambah satu rol', edit: 'Ubah rol ini', save: 'Simpan rol', qty: 'Jumlah rol ini', weight: 'Berat timbang · kg',
    dimensions: 'Lebar & gramasi', width: 'Lebar · cm', gsm: 'Gramasi · g/m²', vat: 'Nomor mesin celup', remark: 'Catatan',
    print: 'Cetak label', printPreview: 'Pratinjau label', printResult: 'Label berhasil dicetak', printCancelled: 'Batal cetak',
    printingCheck: 'Konfirmasi bahwa label rol ini berhasil dicetak.', printLoading: 'Label masih dimuat. Coba cetak lagi.',
    printed: 'Sudah dicetak', notPrinted: 'Belum dicetak', ready: 'Siap kirim', reserved: 'Dalam surat jalan', handed: 'Dikirim',
    startDispatch: 'Buat surat jalan', dispatch: 'Pengiriman ini', confirmDispatch: 'Konfirmasi kirim', scanned: 'Rol dipindai',
    scan: 'Pindai kode rol hasil', scanHint: 'Pindai barcode pada label barang', identify: 'Cari', lastScan: 'Baru dipindai',
    driver: 'Sopir', vehicle: 'Jenis kendaraan', plate: 'Nomor polisi', note: 'Catatan kirim', transport: 'Transportasi',
    documents: 'Surat jalan order ini', openDocument: 'Lanjut pengiriman ini', void: 'Batalkan draf', voidConfirm: 'Batalkan & lepas rol',
    voidWarning: 'Rol dalam draf ini dapat dimasukkan ke surat jalan lain. Pengiriman yang sudah dikonfirmasi tidak dapat dibatalkan.',
    delete: 'Hapus rol ini', deleteConfirm: 'Hapus rol belum dikirim', deleteWarning: 'Hapus barcode rol ini. Rol yang sudah dikirim atau masuk surat jalan tidak dapat dihapus.',
    wrongRoll: 'Rol bukan bagian pengiriman ini. Periksa lalu pindai ulang.', duplicate: 'Rol sudah dipindai. Tidak perlu diulang.',
    wrongDocument: 'Surat jalan pabrik ini tidak ditemukan. Muat ulang.', scanRequired: 'Pindai semua rol pengiriman ini dahulu',
    unavailable: 'Rol belum dicetak, sudah dipakai surat jalan lain, atau melebihi sisa siap kirim', noDestination: 'Tujuan belum ditetapkan. Belum dapat dikirim.',
    yarnSeparate: 'Benang dikirim per order dengan penimbangan', empty: 'Belum ada rol hasil', drafts: 'Draf siap kirim', printChanged: 'Isi label berubah. Buka pratinjau dan cetak ulang.',
    selectRoll: 'Pilih rol ini', rolls: 'rol', createdBy: 'Pembuat surat', handoverBy: 'Pengirim aktual', continue: 'Kembali ke rol hasil',
  },
} as const
export function ot(lang: CentralPdaLanguage, key: keyof typeof labels.zh) { return labels[lang][key] }
export function outputUnit(unit: string, lang: CentralPdaLanguage) {
  const count = ({ '件': 'pcs', '片': 'panel', '条': 'potong', '个': 'buah', '只': 'buah', '对': 'pasang', '套': 'set', '卷': 'rol', '筒': 'tabung', '颗': 'butir', '朵': 'kuntum' } as Record<string, string>)[unit]
  return count ? lang === 'id' ? count : unit : ({ m: 'm', '米': 'm', Yard: 'Yard', yard: 'Yard', '码': 'Yard', kg: 'kg', '公斤': 'kg', '千克': 'kg' } as Record<string, string>)[unit] || unit
}
export function outputError(error: unknown, lang: CentralPdaLanguage) {
  const message = error instanceof Error ? error.message : '', key = message.replace(/^DYE_OUTPUT_/, '') as keyof typeof labels.zh
  if (message.startsWith('DYE_OUTPUT_') && key in labels.zh) return ot(lang, key)
  if (lang === 'zh') return dyeErrorText(error, lang)
  if (/条码已被|已被交出单占用|未维护、未打印/.test(message)) return ot(lang, 'unavailable')
  if (/已经扫码|重复扫描/.test(message)) return ot(lang, 'duplicate')
  if (/此卷不在|卷码/.test(message)) return ot(lang, 'wrongRoll')
  if (/全部扫卷|逐卷扫码/.test(message)) return ot(lang, 'scanRequired')
  if (/司机|车型|车牌/.test(message)) return 'Isi sopir, jenis kendaraan, dan nomor polisi.'
  if (/卷记录已变化|接收方或单位已变化/.test(message)) return ot(lang, 'printChanged')
  return dyeErrorText(error, lang)
}
