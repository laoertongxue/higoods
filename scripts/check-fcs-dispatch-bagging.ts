import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  buildDispatchBaggingSnapshotFromSourceBags,
  evaluateDispatchBagSelection,
  selectionMatchesRecommendationGroups,
  type DispatchBaggingSourceBag,
} from '../src/data/fcs/dispatch-bagging-snapshot.ts'
import type { RuntimeProcessTask } from '../src/data/fcs/runtime-process-tasks.ts'

const task = {
  taskId: 'TASK-SEW-1', taskNo: 'TASK-SEW-1', productionOrderId: 'PO-1', productionOrderNo: 'PO-1', scopeQty: 400,
  scopeSkuLines: [
    { skuCode: 'SKU-S', color: '白色', size: 'S', qty: 100 },
    { skuCode: 'SKU-M', color: '白色', size: 'M', qty: 100 },
    { skuCode: 'SKU-L', color: '白色', size: 'L', qty: 100 },
    { skuCode: 'SKU-XL', color: '白色', size: 'XL', qty: 100 },
  ],
} as RuntimeProcessTask

function ticket(no: string, skuCode: string, size: string, qty: number, productionOrderNo = 'PO-1', taskEquivalentQty: number | null = qty) {
  return {
    feiTicketId: no, feiTicketNo: no, productionOrderId: productionOrderNo, productionOrderNo,
    cutOrderId: 'CUT-1', cutOrderNo: 'CUT-1', color: '白色', size, partCode: 'BUNDLE', partName: '整扎裁片', pieceQty: qty,
    sewingTaskId: task.taskId, sewingTaskNo: task.taskNo, receiverFactoryId: '', receiverFactoryName: '', skuCode, taskEquivalentQty,
  }
}

const bags: DispatchBaggingSourceBag[] = [
  { bagCode: 'BAG-1', status: '待交出', location: 'A / 01', updatedAt: '2026-08-05 10:00', tickets: [ticket('FT-S', 'SKU-S', 'S', 100), ticket('FT-M1', 'SKU-M', 'M', 40)] },
  { bagCode: 'BAG-2', status: '入仓暂存中', location: 'A / 02', updatedAt: '2026-08-05 10:05', tickets: [ticket('FT-M2', 'SKU-M', 'M', 60), ticket('FT-L', 'SKU-L', 'L', 100)] },
  { bagCode: 'BAG-3', status: '菲票已装袋', location: '装袋台', updatedAt: '2026-08-05 10:10', tickets: [ticket('FT-XL', 'SKU-XL', 'XL', 70)] },
]

const snapshot = buildDispatchBaggingSnapshotFromSourceBags(task, bags, '现场事件账')
assert.equal(snapshot.recommendationGroups.length, 2, '跨袋关联的 S/M/L 应合并为一个推荐组，XL 独立成组')
assert.deepEqual(snapshot.recommendationGroups[0].skuCodes.sort(), ['SKU-L', 'SKU-M', 'SKU-S'])
assert.equal(snapshot.crossBagSkuCount, 1)
assert.equal(snapshot.unbaggedQty, 30, '部分装袋差异只作为提示')
assert.equal(selectionMatchesRecommendationGroups(snapshot, new Set(['SKU-S', 'SKU-M'])), false, '按袋模式不能拆开推荐组')
assert.equal(selectionMatchesRecommendationGroups(snapshot, new Set(['SKU-S', 'SKU-M', 'SKU-L'])), true)

const freeImpact = evaluateDispatchBagSelection(snapshot, new Set(['SKU-M']))
assert.deepEqual(freeImpact.affectedBagCodes.sort(), ['BAG-1', 'BAG-2'], '自由选择 M 必须展示两个受影响袋')

const abnormalSnapshot = buildDispatchBaggingSnapshotFromSourceBags(task, [
  ...bags,
  { bagCode: 'BAG-MIXED', status: '待交出', location: '异常区', updatedAt: '2026-08-05 10:20', tickets: [ticket('FT-MIX-1', 'SKU-S', 'S', 10), ticket('FT-MIX-2', '', 'S', 10, 'PO-2')] },
  { bagCode: 'BAG-HANDED', status: '已交出待回收', location: '三方工厂', updatedAt: '2026-08-05 10:30', tickets: [ticket('FT-HAND', 'SKU-XL', 'XL', 30)] },
], '现场事件账')
assert.equal(abnormalSnapshot.validBagCount, 3, '混装袋和已交出袋不得计入有效推荐袋')
assert.ok(abnormalSnapshot.warnings.some((item) => item.includes('跨生产单混装袋')))
assert.ok(abnormalSnapshot.warnings.some((item) => item.includes('已交出袋')))
const abnormalImpact = evaluateDispatchBagSelection(abnormalSnapshot, new Set(['SKU-S']))
assert.deepEqual(abnormalImpact.abnormalBagCodes, ['BAG-MIXED'])
assert.deepEqual(abnormalImpact.handedOverBagCodes, ['BAG-HANDED'])

const empty = buildDispatchBaggingSnapshotFromSourceBags(task, [], '暂无装袋记录')
assert.equal(empty.validBagCount, 0)
assert.equal(empty.recommendationGroups.length, 4, '无装袋记录时每个完整 SKU 仍可独立分配')
assert.ok(empty.warnings.some((item) => item.includes('不阻断派单')))

const pieceOnlySnapshot = buildDispatchBaggingSnapshotFromSourceBags(task, [
  { bagCode: 'BAG-PIECE-ONLY', status: '待交出', location: 'A / 03', updatedAt: '2026-08-05 10:40', tickets: [ticket('FT-PIECE', 'SKU-S', 'S', 360, 'PO-1', null)] },
], '现场事件账')
assert.equal(pieceOnlySnapshot.baggedPieceQty, 360, '现场裁片数应保持“片”的原始口径')
assert.equal(pieceOnlySnapshot.unbaggedQty, null, '没有齐套换算依据时不得用裁片片数扣减任务件数')
assert.ok(pieceOnlySnapshot.warnings.some((item) => item.includes('待齐套换算')))

const page = readFileSync(new URL('../src/pages/unified-dispatch-workbench.ts', import.meta.url), 'utf8')
for (const literal of ['当前菲票装袋情况', '按装袋关系推荐（整组选择）', '自由选择SKU', '刷新装袋情况', '不生成拆袋重装待办', '谨慎确认价格，一经提交确认不得修改。']) {
  assert.ok(page.includes(literal), `任务分配页面缺少：${literal}`)
}
assert.ok(!page.includes('当前有 2 个菲票袋'), '旧固定袋数 Mock 文案必须清理')
assert.ok(!page.includes('appendCuttingRuntimeEvent('), '任务分配不得生成裁床拆袋或袋事件')
assert.ok(page.includes("policy.startsWithSewing ? (dialog.distributionMode === 'BAG_AWARE'"), '只有车缝及车缝为首工序的任务可进入菲票分配模式')
assert.ok(page.includes("policy.startsWithSewing ? `${baggingDecisionSummary"), '非车缝任务派单备注不得写入菲票决策')

console.log('FCS 任务分配菲票装袋推荐检查通过：连通推荐、自由影响、异常排除、已交出、无记录、完整SKU和页面契约全部通过。')
