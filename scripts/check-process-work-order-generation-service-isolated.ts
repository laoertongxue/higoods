import assert from 'node:assert/strict'

import {
  bootstrapProcessWorkOrderGeneration,
  ensureProcessWorkOrders,
} from '../src/data/fcs/process-work-order-generation-service.ts'

bootstrapProcessWorkOrderGeneration()
bootstrapProcessWorkOrderGeneration()

const input = {
  source: {
    sourceType: 'PRODUCTION_ORDER' as const,
    productionOrderId: 'PO-SERVICE-ISOLATED-001',
    productionOrderNo: 'PO-SERVICE-ISOLATED-001',
    techPackVersionId: 'TPV-SERVICE-ISOLATED-001',
    techPackVersionLabel: '正式版 V1',
    bomItemIds: ['BOM-SERVICE-B', 'BOM-SERVICE-A'],
  },
  processCodes: ['DYE', 'PRINT'] as Array<'DYE' | 'PRINT'>,
  orderedAt: '2026-07-23 12:00:00',
  materialId: 'MAT-SERVICE-ISOLATED-001',
  materialName: '独立加载测试面料',
  materialItems: [
    { sourceBomItemId: 'BOM-SERVICE-A', materialId: 'MAT-A', materialName: '面料 A' },
    { sourceBomItemId: 'BOM-SERVICE-B', materialId: 'MAT-B', materialName: '面料 B' },
  ],
  targetColor: '黑色',
  plannedQty: 10,
  qtyUnit: '米',
  dyeProcessName: '匹染',
  printProcessName: '印花',
  factoryId: 'F090',
  factoryName: '全能力测试工厂',
  spuCode: 'SPU-SERVICE-ISOLATED-001',
  spuName: '独立加载测试款',
  requiredDeliveryDate: '2026-08-01',
}

const first = ensureProcessWorkOrders(input)
assert(first.dyeWorkOrderId, '仅导入公开 service 时必须能生成染色加工单')
assert(first.printWorkOrderId, '仅导入公开 service 时必须能生成印花加工单')

bootstrapProcessWorkOrderGeneration()
const second = ensureProcessWorkOrders(input)
assert.deepEqual(second, first, '重复 bootstrap 后同一来源仍必须幂等，不得重复注册或重复生成')

console.log('check:process-work-order-generation-service-isolated passed')
