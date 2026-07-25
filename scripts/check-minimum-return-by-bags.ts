import assert from 'node:assert/strict'
import { calculateMinimumReturnQtyByBags } from '../src/data/fcs/cutting/handover-orders.ts'

const result = calculateMinimumReturnQtyByBags('sew-factory-01')
assert.ok(result.length > 0, '必须返回至少一个生产单的最低应回结果')

const po101 = result.find((r) => r.productionOrderNo === 'PO-202603-0101')
assert.ok(po101, '必须能查到生产单的最低应回')
assert.ok(po101.minimumReturnQty >= 0, '最低应回数量必须为非负')
assert.ok(po101.totalHandedOverPieceQty > 0, '必须有累计交出裁片数量')
assert.ok(po101.transferBagCount > 0, '必须有中转袋数量')

console.log('[check-minimum-return-by-bags] 车缝最低应回累计计算检查通过')
