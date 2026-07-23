import {
  derivePickupNodeType,
  resolvePickupNodeUpdate,
  type PickupCoverageLine,
} from '../src/data/fcs/cutting/pickup-node-domain.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const stillShort: PickupCoverageLine[] = [
  { key: 'FABRIC-BLACK-150', unit: 'yard', requiredQty: 1000, effectivePickedQty: 700, currentAvailableQty: 200 },
  { key: 'ZIP-BLACK', unit: '条', requiredQty: 2400, effectivePickedQty: 1400, currentAvailableQty: 1000 },
]
const nowComplete = stillShort.map((line) =>
  line.key === 'FABRIC-BLACK-150' ? { ...line, currentAvailableQty: 300 } : line,
)

assert(derivePickupNodeType(stillShort) === 'INCOMPLETE_PICKABLE', '任一物料未满足时必须是未配齐可领')
assert(derivePickupNodeType(nowComplete) === 'READY_TO_PICKUP', '全部物料满足时必须是已配齐待领')

const first = resolvePickupNodeUpdate({
  prepOrderId: 'prep-order-po-001',
  nextSequence: 1,
  existingNode: null,
  coverageLines: stillShort,
})
assert(first.nodeId === 'pickup-node:prep-order-po-001:1', '首轮节点编号错误')
assert(first.version === 1, '首轮节点版本必须为 1')
assert(first.nodeType === 'INCOMPLETE_PICKABLE', '未配齐物料节点类型必须是未配齐可领')
assert(first.status === 'OPEN', '新节点必须为 OPEN')
assert(first.locationPolicy === 'ASSIGN_INCOMPLETE_LOCATION', '未配齐新节点必须分配未配齐货位')

const upgraded = resolvePickupNodeUpdate({
  prepOrderId: 'prep-order-po-001',
  nextSequence: 2,
  existingNode: first,
  coverageLines: nowComplete,
})
assert(upgraded.nodeId === first.nodeId, '未领取前后续到货必须并入原节点')
assert(upgraded.version === 2, '节点更新后版本必须递增')
assert(upgraded.nodeType === 'READY_TO_PICKUP', '累计配齐后原节点必须升级')
assert(upgraded.locationPolicy === 'KEEP_CURRENT_LOCATION', '已有节点升级不得重新分配货位')

const directReady = resolvePickupNodeUpdate({
  prepOrderId: 'prep-order-po-001',
  nextSequence: 2,
  existingNode: null,
  coverageLines: nowComplete,
})
assert(directReady.locationPolicy === 'DIRECT_READY_AREA', '累计配齐的新节点不得进入未配齐货位')
assert(directReady.nodeType === 'READY_TO_PICKUP', '直接配齐节点类型必须是已配齐待领')
assert(directReady.nodeId === 'pickup-node:prep-order-po-001:2', '后续序列号编号正确')

const closedNode: typeof first = { ...first, status: 'CLOSED', version: 1 }
const afterClosed = resolvePickupNodeUpdate({
  prepOrderId: 'prep-order-po-001',
  nextSequence: 2,
  existingNode: closedNode,
  coverageLines: stillShort,
})
assert(afterClosed.nodeId === 'pickup-node:prep-order-po-001:2', '已关闭节点后创建新节点')
assert(afterClosed.version === 1, '新节点版本从头计数')
assert(afterClosed.status === 'OPEN', '新节点状态为 OPEN')

console.log('裁床待领节点领域检查通过')
