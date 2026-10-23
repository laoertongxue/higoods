import { escapeHtml } from '../../utils.ts'
import type { CentralPdaLanguage } from './frame.ts'

const text = {
  zh: {
    receive: '确认接收', work: '加工填报', handoff: '发起交出', finish: '完工', receipt: '实收查看',
    detail: '加工单详情', pending: '待接收', processing: '加工中', closed: '已完工',
    scan: '扫实物 / 输编号', scanHint: '加工单、SKU 或菲票号', identify: '识别',
    source: '上游', target: '下游', received: '已接收', produced: '已加工', handed: '已交出',
    thisQty: '本次数量', remaining: '剩余可操作', clear: '清空', record: '操作记录',
    quantityRequired: '填写本次数量', quantityPositive: '本次数量须大于0',
    quantityPrecision: '数量精度不正确', quantityMax: '本次数量超过当前余量',
    notAvailable: '当前没有可执行的动作', empty: '当前没有单据', noRows: '当前没有可操作实物',
    noScan: '输入或扫描实物编号', wrongScan: '未找到本工厂、本工序的实物，请重扫',
    noPhoto: '实物图片缺失，暂不能确认', photoFailed: '图片未加载，点此重试', photo: '查看实物图片',
    close: '关闭', back: '返回', next: '下一笔', saved: '本次已保存', saving: '正在保存…',
    finishWarning: '完工后不能再接收、加工；剩余已加工实物仍可交出。',
    changed: '单据已变化，本次未保存。重新读取后核对数量再提交。', reload: '重新读取',
    notSaved: '本次未保存，填写内容已保留。重新读取后可重试。',
    storageFull: '本机存储空间不足，本次未保存，填写内容已保留。',
    committed: '本次已保存，页面未更新。重新读取查看结果。',
    locations: '库区库位', receiveRecords: '接收记录', handoffRecords: '交出记录',
    waitProcess: '待加工仓', waitHandover: '待交出仓', area: '库区', shelf: '货架', location: '库位',
    noStock: '此库位暂无本工序库存', noRecords: '暂无记录', receiver: '接收人', sender: '交出人',
    actual: '对方实收', awaiting: '待对方接收', stock: '库存', factory: '工厂', account: '账号',
    login: '登录', password: '密码', loginFail: '账号或密码不正确', locked: '账号已停用',
    centralOnly: '此账号不属于中央工厂', logout: '退出账号', discard: '放弃填写并退出',
    unsent: '还有未提交的填写，退出将放弃这些内容。', cancel: '继续填写',
    keepInput: '返回后可继续填写', continueTask: '继续本单', choose: '选择实物',
    all: '全部', current: '本单', locationStopped: '已停用', more: '继续查看',
  },
  id: {
    receive: 'Konfirmasi terima', work: 'Catat hasil', handoff: 'Kirim barang', finish: 'Selesaikan order', receipt: 'Lihat penerimaan',
    detail: 'Detail order', pending: 'Belum diterima', processing: 'Dalam proses', closed: 'Selesai',
    scan: 'Pindai / ketik kode', scanHint: 'Kode order, SKU, atau tiket', identify: 'Cari',
    source: 'Dari', target: 'Tujuan', received: 'Diterima', produced: 'Hasil proses', handed: 'Dikirim',
    thisQty: 'Jumlah kali ini', remaining: 'Sisa tersedia', clear: 'Kosongkan', record: 'Riwayat kerja',
    quantityRequired: 'Isi jumlah kali ini', quantityPositive: 'Jumlah harus lebih dari 0',
    quantityPrecision: 'Periksa angka desimal', quantityMax: 'Jumlah melebihi sisa tersedia',
    notAvailable: 'Belum ada tindakan yang tersedia', empty: 'Belum ada order', noRows: 'Tidak ada barang yang dapat diproses',
    noScan: 'Pindai atau ketik kode barang', wrongScan: 'Barang tidak ditemukan untuk pabrik dan proses ini. Pindai ulang.',
    noPhoto: 'Foto barang belum tersedia. Belum dapat dikonfirmasi.', photoFailed: 'Foto gagal dimuat. Ketuk untuk mencoba lagi.', photo: 'Lihat foto barang',
    close: 'Tutup', back: 'Kembali', next: 'Barang berikutnya', saved: 'Tersimpan', saving: 'Menyimpan…',
    finishWarning: 'Setelah selesai, terima dan proses tidak dapat dilakukan lagi. Sisa hasil proses masih dapat dikirim.',
    changed: 'Order berubah. Belum tersimpan. Muat ulang lalu periksa jumlah.', reload: 'Muat ulang',
    notSaved: 'Belum tersimpan. Isian tetap ada. Muat ulang untuk mencoba lagi.',
    storageFull: 'Penyimpanan perangkat penuh. Belum tersimpan. Isian tetap ada.',
    committed: 'Sudah tersimpan, tetapi layar belum diperbarui. Muat ulang untuk melihat hasil.',
    locations: 'Area & lokasi', receiveRecords: 'Riwayat terima', handoffRecords: 'Riwayat kirim',
    waitProcess: 'Gudang bahan masuk', waitHandover: 'Gudang siap kirim', area: 'Area', shelf: 'Rak', location: 'Lokasi',
    noStock: 'Tidak ada stok proses ini di lokasi tersebut', noRecords: 'Belum ada catatan', receiver: 'Penerima', sender: 'Pengirim',
    actual: 'Diterima tujuan', awaiting: 'Menunggu penerima', stock: 'Stok', factory: 'Pabrik', account: 'Akun',
    login: 'Masuk', password: 'Kata sandi', loginFail: 'Akun atau kata sandi salah', locked: 'Akun dinonaktifkan',
    centralOnly: 'Akun ini bukan akun pabrik pusat', logout: 'Keluar akun', discard: 'Buang isian & keluar',
    unsent: 'Ada isian yang belum dikirim. Keluar akan membuang isian tersebut.', cancel: 'Lanjut isi',
    keepInput: 'Isian tersedia saat kembali', continueTask: 'Lanjut order ini', choose: 'Pilih barang',
    all: 'Semua', current: 'Order ini', locationStopped: 'Nonaktif', more: 'Lihat berikutnya',
  },
} as const
export type CentralTextKey = keyof typeof text.zh
export function ct(lang: CentralPdaLanguage, key: CentralTextKey): string { return text[lang][key] }
export const ce = escapeHtml
export function cn(value: number, lang: CentralPdaLanguage) {
  return new Intl.NumberFormat(lang === 'id' ? 'id-ID' : 'zh-CN', { maximumFractionDigits: 4 }).format(value)
}
export function centralTime(value: string, lang: CentralPdaLanguage): string {
  if (!value) return '—'
  const parsed = new Date(value.includes('T') ? value : value.replace(' ', 'T'))
  if (!Number.isFinite(parsed.getTime())) return '—'
  return new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(parsed)
}
export const centralButtonClass = 'min-h-12 rounded-xl border border-slate-300 bg-white px-3 py-3 text-base font-semibold leading-6 disabled:text-slate-400'
export function cb(label: string, action: string, value?: string, primary = false): string {
  return `<button type="button" class="${centralButtonClass} ${primary ? '!border-blue-600 !bg-blue-600 text-white' : ''}" data-central-action="${ce(action)}"${value === undefined ? '' : ` data-central-value="${ce(value)}"`}>${ce(label)}</button>`
}
export function centralNotice(message: string, error = false): string {
  return `<p role="${error ? 'alert' : 'status'}" class="rounded-xl border p-3 text-base leading-6 ${error ? 'border-red-200 bg-red-50 text-red-800' : 'border-blue-200 bg-blue-50 text-blue-900'}">${ce(message)}</p>`
}
export function centralErrorText(error: unknown, lang: CentralPdaLanguage): string {
  const message = error instanceof Error ? error.message : ''
  const key = ({ QUANTITY_REQUIRED: 'quantityRequired', QUANTITY_POSITIVE: 'quantityPositive', QUANTITY_PRECISION: 'quantityPrecision', QUANTITY_MAX: 'quantityMax', CHANGED: 'changed' } as const)[message]
  if (key) return ct(lang, key)
  if (/已保存.*(?:未能更新|未更新)/.test(message)) return ct(lang, 'committed')
  if (/空间|quota|QuotaExceededError/.test(message)) return ct(lang, 'storageFull')
  if (/版本|变化|冲突|更新|已被其他页面修改/.test(message)) return ct(lang, 'changed')
  return lang === 'zh' && message ? message : ct(lang, 'notSaved')
}
/** Business IDs remain exact when no authoritative translated name exists. */
export function centralFormalName(name: string | undefined, code: string, lang: CentralPdaLanguage): string {
  return name && (lang === 'zh' || !/[\u3400-\u9fff]/.test(name)) ? name : code
}
