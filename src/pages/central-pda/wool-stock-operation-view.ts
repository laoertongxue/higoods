import type { CentralPdaLanguage } from './frame.ts'
import type { WoolStockPosition } from './wool-stock-operation-model.ts'
import { getFactoryMasterRecordById } from '../../data/fcs/factory-master-store.ts'
import { dyeLocationLabel } from './dye-ui.ts'
import { centralFormalName, centralErrorText } from './ui.ts'

const words = {
  zh: { adjust: '库存调整', transfer: '库存移库', transferBack: '转回默认库位', confirmAdjust: '确认库存调整', confirmTransfer: '确认移库', confirmBack: '确认转回',
    reason: '操作原因', after: '调整后数量', before: '当前库存', destination: '目标库位', choose: '选择目标库位', search: '扫库位 / 输编号或名称',
    operations: '调整与移库记录', publicStock: '转出库存', left: '可转回', quantity: '填写有效数量；调整可填0，其余须大于0。',
    integer: '片、件数量须为整数。', requiredReason: '填写操作原因。', same: '调整前后数量不能相同。', invalidTarget: '选择启用的有效库位；实际物位移库只能选择本厂其他待加工库位。',
    physical: '实际库位不支持直接调整库存。', source: '原库位', noTarget: '未找到对应库位，请重新扫码或选择。' },
  id: { adjust: 'Sesuaikan stok', transfer: 'Pindahkan stok', transferBack: 'Kembali ke lokasi bawaan', confirmAdjust: 'Konfirmasi penyesuaian', confirmTransfer: 'Konfirmasi pindah', confirmBack: 'Konfirmasi kembali',
    reason: 'Alasan', after: 'Stok setelah penyesuaian', before: 'Stok saat ini', destination: 'Lokasi tujuan', choose: 'Pilih lokasi tujuan', search: 'Pindai / ketik kode atau nama lokasi',
    operations: 'Riwayat penyesuaian & pindah', publicStock: 'Stok di lokasi tujuan', left: 'Bisa dikembalikan', quantity: 'Isi jumlah yang valid. Penyesuaian boleh 0; tindakan lain harus lebih dari 0.',
    integer: 'Jumlah potong dan pcs harus bilangan bulat.', requiredReason: 'Isi alasan.', same: 'Stok sebelum dan sesudah tidak boleh sama.', invalidTarget: 'Pilih lokasi aktif. Stok di lokasi nyata hanya dapat dipindah ke lokasi bahan masuk lain di pabrik ini.',
    physical: 'Stok di lokasi nyata tidak dapat disesuaikan langsung.', source: 'Lokasi asal', noTarget: 'Lokasi tidak ditemukan. Pindai ulang atau pilih lokasi.' },
} as const
export const wot = (l: CentralPdaLanguage, key: keyof typeof words.zh): string => words[l][key]
export function woolStockPositionLabel(p: WoolStockPosition, l: CentralPdaLanguage) {
  return [centralFormalName(p.warehouse.factoryName, getFactoryMasterRecordById(p.warehouse.factoryId)?.code || p.warehouse.factoryId, l),
    l === 'id' ? p.warehouse.warehouseKind === 'WAIT_PROCESS' ? 'Bahan masuk' : 'Siap kirim' : p.warehouse.warehouseShortName,
    dyeLocationLabel(p.area.areaName, l), dyeLocationLabel(p.shelf.shelfNo, l), dyeLocationLabel(p.location.locationNo, l)].join(' / ')
}
export function woolStockOperationError(error: unknown, l: CentralPdaLanguage) {
  const m = error instanceof Error ? error.message : ''
  const key = ({ WOP_quantity: 'quantity', WOP_integer: 'integer', WOP_reason: 'requiredReason', WOP_sameQuantity: 'same',
    WOP_target: 'invalidTarget', WOP_physicalAdjustment: 'physical', WOP_scan: 'noTarget' } as const)[m as 'WOP_quantity']
  if (key) return wot(l, key)
  if (l === 'id' && /库位|仓库|启用/.test(m)) return wot(l, 'invalidTarget')
  if (l === 'id' && /整数/.test(m)) return wot(l, 'integer')
  if (l === 'id' && /原因/.test(m)) return wot(l, 'requiredReason')
  return centralErrorText(error, l)
}
