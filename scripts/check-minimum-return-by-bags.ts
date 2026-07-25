import assert from 'node:assert/strict'
import { calculateMinimumReturnQtyByBags } from '../src/data/fcs/cutting/handover-orders.ts'
import { getCutPieceReleaseSummaryForProductionOrder } from '../src/data/fcs/cut-piece-release.ts'
import { listSewingDispatchWorkbenchTasks } from '../src/data/fcs/sewing-dispatch-workbench.ts'

// 默认 1:1
const result = calculateMinimumReturnQtyByBags('sew-factory-01')
assert.ok(result.length > 0, '必须返回至少一个生产单的最低应回结果')

const po101 = result.find((r) => r.productionOrderNo === 'PO-202603-0101')
assert.ok(po101, '必须能查到生产单的最低应回')
assert.ok(po101.minimumReturnQty >= 0, '最低应回数量必须为非负')
assert.ok(po101.totalHandedOverPieceQty > 0, '必须有累计交出裁片数量')
assert.ok(po101.transferBagCount > 0, '必须有中转袋数量')

const ppicReleaseProductionOrderNos = new Set(
  listSewingDispatchWorkbenchTasks()
    .map((task) => getCutPieceReleaseSummaryForProductionOrder(task.productionOrderId)?.productionOrderNo)
    .filter((value): value is string => Boolean(value)),
)
const sameOrderMinimumReturns = result.filter((item) => ppicReleaseProductionOrderNos.has(item.productionOrderNo))
assert.ok(
  sameOrderMinimumReturns.length > 0,
  '放行 → PPIC → 交出最低应回必须至少有一个完全相同生产单号贯穿',
)
assert.ok(
  sameOrderMinimumReturns.some((item) => item.minimumReturnQty > 0 && item.transferBagCount > 0 && item.feiTicketCount > 0),
  '同一生产单贯穿样例必须有中转袋、菲票和最低应回数量',
)

const po14672 = sameOrderMinimumReturns.find((item) => item.productionOrderNo === 'PO14672')
assert.ok(po14672, '风险放行样例 PO14672 必须贯穿放行、PPIC 和交出最低应回')
const ppicPo14672Task = listSewingDispatchWorkbenchTasks().find((task) => {
  const summary = getCutPieceReleaseSummaryForProductionOrder(task.productionOrderId)
  return task.productionOrderNo === 'PO14672' && summary?.productionOrderNo === 'PO14672'
})
assert.ok(ppicPo14672Task, 'PPIC 工作台必须用展示生产单号 PO14672 承接裁床放行 PO14672')
assert.equal(po14672.transferBagCount, 2, 'PO14672 必须按 2 个中转袋累计')
assert.equal(po14672.feiTicketCount, 3, 'PO14672 必须按 3 张菲票累计')
assert.equal(po14672.totalHandedOverPieceQty, 630, 'PO14672 已交出裁片数量必须来自中转袋菲票累计')
assert.equal(po14672.minimumReturnQty, 210, 'PO14672 最低应回必须按前片、后片、袖片共同最小成衣数计算')

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
