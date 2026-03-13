import type { FactoryPerformance, FactoryPerformanceRecord } from './factory-performance-types'
import { calculateScore } from './factory-performance-types'
import { indonesiaFactories } from './indonesia-factories'

// 预设绩效数据
const performanceData = [
  { onTimeRate: 95.2, defectRate: 2.1, rejectRate: 1.5, disputeRate: 0.8 },
  { onTimeRate: 88.5, defectRate: 3.8, rejectRate: 2.2, disputeRate: 1.2 },
  { onTimeRate: 72.3, defectRate: 8.5, rejectRate: 5.0, disputeRate: 3.2 },
  { onTimeRate: 91.8, defectRate: 2.8, rejectRate: 1.8, disputeRate: 1.0 },
  { onTimeRate: 65.0, defectRate: 12.0, rejectRate: 8.5, disputeRate: 6.0 },
  { onTimeRate: 93.5, defectRate: 2.5, rejectRate: 1.2, disputeRate: 0.9 },
  { onTimeRate: 86.0, defectRate: 4.2, rejectRate: 2.8, disputeRate: 1.5 },
  { onTimeRate: 79.5, defectRate: 5.8, rejectRate: 3.5, disputeRate: 2.2 },
  { onTimeRate: 97.0, defectRate: 1.5, rejectRate: 0.8, disputeRate: 0.5 },
  { onTimeRate: 89.2, defectRate: 3.2, rejectRate: 2.0, disputeRate: 1.1 },
]

export const mockFactoryPerformanceList: FactoryPerformance[] = indonesiaFactories.slice(0, 10).map((f, i) => {
  const perf = performanceData[i % performanceData.length]
  return {
    factoryId: f.id,
    factoryName: f.name,
    factoryCode: f.code,
    status: f.status,
    onTimeRate: perf.onTimeRate,
    defectRate: perf.defectRate,
    rejectRate: perf.rejectRate,
    disputeRate: perf.disputeRate,
    score: calculateScore(perf),
    updatedAt: f.updatedAt,
  }
})

export const mockPerformanceRecordsByFactory: Record<string, FactoryPerformanceRecord[]> = {
  'ID-F001': [
    {
      id: 'PR001',
      factoryId: 'ID-F001',
      periodType: 'MONTHLY',
      period: '2024-02',
      onTimeRate: 95.2,
      defectRate: 2.1,
      rejectRate: 1.5,
      disputeRate: 0.8,
      score: calculateScore({ onTimeRate: 95.2, defectRate: 2.1, rejectRate: 1.5, disputeRate: 0.8 }),
      updatedAt: '2024-03-01 10:00:00',
      updatedBy: 'Budi Santoso',
    },
    {
      id: 'PR002',
      factoryId: 'ID-F001',
      periodType: 'MONTHLY',
      period: '2024-01',
      onTimeRate: 93.8,
      defectRate: 2.5,
      rejectRate: 1.8,
      disputeRate: 1.0,
      score: calculateScore({ onTimeRate: 93.8, defectRate: 2.5, rejectRate: 1.8, disputeRate: 1.0 }),
      updatedAt: '2024-02-01 09:30:00',
      updatedBy: 'Budi Santoso',
    },
  ],
  'ID-F002': [
    {
      id: 'PR003',
      factoryId: 'ID-F002',
      periodType: 'MONTHLY',
      period: '2024-02',
      onTimeRate: 88.5,
      defectRate: 3.8,
      rejectRate: 2.2,
      disputeRate: 1.2,
      score: calculateScore({ onTimeRate: 88.5, defectRate: 3.8, rejectRate: 2.2, disputeRate: 1.2 }),
      updatedAt: '2024-03-05 11:20:00',
      updatedBy: 'Dewi Lestari',
    },
  ],
  'ID-F003': [
    {
      id: 'PR004',
      factoryId: 'ID-F003',
      periodType: 'MONTHLY',
      period: '2024-01',
      onTimeRate: 72.3,
      defectRate: 8.5,
      rejectRate: 5.0,
      disputeRate: 3.2,
      score: calculateScore({ onTimeRate: 72.3, defectRate: 8.5, rejectRate: 5.0, disputeRate: 3.2 }),
      updatedAt: '2024-02-20 15:00:00',
      updatedBy: 'Ahmad Wijaya',
      note: 'Keterlambatan pengiriman karena kapasitas tidak mencukupi',
    },
  ],
  'ID-F005': [
    {
      id: 'PR005',
      factoryId: 'ID-F005',
      periodType: 'MONTHLY',
      period: '2024-01',
      onTimeRate: 65.0,
      defectRate: 12.0,
      rejectRate: 8.5,
      disputeRate: 6.0,
      score: calculateScore({ onTimeRate: 65.0, defectRate: 12.0, rejectRate: 8.5, disputeRate: 6.0 }),
      updatedAt: '2024-01-28 16:00:00',
      updatedBy: 'Hendra Kusuma',
      note: 'Masalah kualitas serius, sudah masuk daftar hitam',
    },
  ],
  'ID-F009': [
    {
      id: 'PR006',
      factoryId: 'ID-F009',
      periodType: 'MONTHLY',
      period: '2024-02',
      onTimeRate: 97.0,
      defectRate: 1.5,
      rejectRate: 0.8,
      disputeRate: 0.5,
      score: calculateScore({ onTimeRate: 97.0, defectRate: 1.5, rejectRate: 0.8, disputeRate: 0.5 }),
      updatedAt: '2024-03-02 09:00:00',
      updatedBy: 'Dian Putra',
    },
    {
      id: 'PR007',
      factoryId: 'ID-F009',
      periodType: 'MONTHLY',
      period: '2024-01',
      onTimeRate: 96.5,
      defectRate: 1.8,
      rejectRate: 1.0,
      disputeRate: 0.6,
      score: calculateScore({ onTimeRate: 96.5, defectRate: 1.8, rejectRate: 1.0, disputeRate: 0.6 }),
      updatedAt: '2024-02-01 10:30:00',
      updatedBy: 'Dian Putra',
    },
  ],
}
