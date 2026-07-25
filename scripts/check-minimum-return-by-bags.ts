import assert from 'node:assert/strict'
import { calculateMinimumReturnQtyByBags } from '../src/data/fcs/cutting/handover-orders.ts'

// 默认 1:1
const result = calculateMinimumReturnQtyByBags('sew-factory-01')
assert.ok(result.length > 0, '必须返回至少一个生产单的最低应回结果')

const po101 = result.find((r) => r.productionOrderNo === 'PO-202603-0101')
assert.ok(po101, '必须能查到生产单的最低应回')
assert.ok(po101.minimumReturnQty >= 0, '最低应回数量必须为非负')
assert.ok(po101.totalHandedOverPieceQty > 0, '必须有累计交出裁片数量')
assert.ok(po101.transferBagCount > 0, '必须有中转袋数量')

// BOM 部位用量折算：假设袖口 2 片/件
const resultWithBom = calculateMinimumReturnQtyByBags('sew-factory-01', {
  'cuff': 2,
})
const poWithBom = resultWithBom.find((r) => r.productionOrderNo === 'PO-202603-0101')
assert.ok(poWithBom, 'BOM折算后仍须查到生产单')
// 袖口折算后最低应回应 <= 原值（袖口按 2 片/件折算后不会多于原值）
assert.ok(poWithBom.minimumReturnQty <= po101!.minimumReturnQty,
  '袖口按 2 片/件折算后最低应回应不超过默认 1:1')

console.log('[check-minimum-return-by-bags] 车缝最低应回累计计算检查通过（含 BOM 折算）')
