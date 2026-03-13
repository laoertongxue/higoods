import type { FactoryStatus, FactoryStatusHistory } from './factory-status-types'
import { indonesiaFactories } from './indonesia-factories'

// 从印尼工厂数据生成状态列表（全部20家）
export const mockFactoryStatusList: FactoryStatus[] = indonesiaFactories.map(f => ({
  factoryId: f.id,
  factoryName: f.name,
  factoryCode: f.code,
  status: f.status,
  reason: f.status === 'SUSPENDED' ? 'Kapasitas produksi tidak mencukupi' : 
          f.status === 'BLACKLISTED' ? 'Kualitas tidak memenuhi standar' :
          f.status === 'INACTIVE' ? 'Kontrak berakhir' : undefined,
  effectiveFrom: f.createdAt,
  updatedAt: f.updatedAt,
}))

export const mockStatusHistoryByFactory: Record<string, FactoryStatusHistory[]> = {
  'ID-F001': [
    {
      id: 'H001',
      factoryId: 'ID-F001',
      oldStatus: 'INACTIVE',
      newStatus: 'ACTIVE',
      reason: 'Penandatanganan kontrak kerjasama',
      changedAt: '2024-01-15 10:30:00',
      changedBy: 'Budi Santoso',
    },
  ],
  'ID-F003': [
    {
      id: 'H002',
      factoryId: 'ID-F003',
      oldStatus: 'ACTIVE',
      newStatus: 'SUSPENDED',
      reason: 'Kapasitas produksi tidak mencukupi',
      note: 'Diperkirakan pulih akhir bulan',
      changedAt: '2024-02-20 14:20:00',
      changedBy: 'Dewi Lestari',
    },
    {
      id: 'H003',
      factoryId: 'ID-F003',
      oldStatus: 'INACTIVE',
      newStatus: 'ACTIVE',
      reason: 'Penandatanganan kontrak',
      changedAt: '2024-01-05 09:00:00',
      changedBy: 'Ahmad Wijaya',
    },
  ],
  'ID-F005': [
    {
      id: 'H004',
      factoryId: 'ID-F005',
      oldStatus: 'SUSPENDED',
      newStatus: 'BLACKLISTED',
      reason: 'Kualitas gagal 3x berturut-turut',
      note: 'Perlu perbaikan sebelum evaluasi ulang',
      changedAt: '2024-01-28 16:45:00',
      changedBy: 'Siti Rahayu',
    },
    {
      id: 'H005',
      factoryId: 'ID-F005',
      oldStatus: 'ACTIVE',
      newStatus: 'SUSPENDED',
      reason: 'Perbaikan masalah kualitas',
      changedAt: '2024-01-10 11:30:00',
      changedBy: 'Hendra Kusuma',
    },
  ],
  'ID-F008': [
    {
      id: 'H006',
      factoryId: 'ID-F008',
      oldStatus: 'ACTIVE',
      newStatus: 'SUSPENDED',
      reason: 'Upgrade peralatan',
      note: 'Diperkirakan 2 minggu',
      changedAt: '2024-02-15 09:30:00',
      changedBy: 'Wulan Sari',
    },
  ],
  'ID-F013': [
    {
      id: 'H007',
      factoryId: 'ID-F013',
      oldStatus: 'ACTIVE',
      newStatus: 'INACTIVE',
      reason: 'Kontrak berakhir',
      changedAt: '2024-03-01 00:00:00',
      changedBy: 'System',
    },
  ],
}
