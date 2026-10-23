import type { CentralPdaLanguage } from './frame.ts'

export const centralIndonesianOperationNames: Record<string, string> = {
  '打揽': 'Smock', '打条': 'Jahit bis', '烫画': 'Transfer panas', '直喷': 'Cetak langsung', '布包扣': 'Kancing bungkus kain',
  '绣花': 'Bordir', '压褶': 'Pleats tekan', '缝边绣': 'Bordir tepi', '盘扣': 'Kancing simpul', '花朵': 'Bunga kain',
  '打褶': 'Jahit kerut', '烫钻': 'Pasang rhinestone', '模板工序': 'Jahit pola templat', '激光开袋': 'Saku laser',
  '特种车缝（花样机）': 'Jahit mesin pola', '橡筋定长切割': 'Potong karet sesuai panjang',
}
export function centralOperationLabel(name: string, lang: CentralPdaLanguage) {
  return lang === 'zh' ? name : centralIndonesianOperationNames[name] || 'Proses'
}
