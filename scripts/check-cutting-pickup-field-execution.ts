import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  assertPickupNodeHasNoOpenDiscrepancy,
  listPickupDiscrepancies,
  reportPickupDiscrepancy,
  resolvePickupDiscrepancy,
  requestPickupDiscrepancySupervisor,
} from '../src/data/fcs/cutting/pickup-discrepancy.ts'

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

const storage = new MemoryStorage()
assert.throws(
  () => reportPickupDiscrepancy({
    productionOrderId: 'PO-ID-001',
    productionOrderNo: 'PO-001',
    pickupNodeId: 'pickup-node:1',
    pickupNodeVersion: 3,
    demandLineId: 'LINE-1',
    materialSku: 'MAT-001',
    materialName: '黑色主布',
    differenceQty: 2,
    unit: 'yard',
    carrierType: 'WAREHOUSE_LOCATIONS',
    carrierLabel: '中转仓 / B 区 / B-03-01',
    palletUnnumbered: false,
    operatorName: '裁床仓管',
    note: '实物少 2 yard',
    photoName: '',
  }, storage),
  /缺少当前待领节点解析器/,
  '领域写入必须强制使用当前有效节点解析器',
)
const discrepancy = reportPickupDiscrepancy({
  productionOrderId: 'PO-ID-001',
  productionOrderNo: 'PO-001',
  pickupNodeId: 'pickup-node:1',
  pickupNodeVersion: 3,
  demandLineId: 'LINE-1',
  materialSku: 'MAT-001',
  materialName: '黑色主布',
  differenceQty: 2,
  unit: 'yard',
  carrierType: 'WAREHOUSE_LOCATIONS',
  carrierLabel: '中转仓 / B 区 / B-03-01',
  palletUnnumbered: false,
  operatorName: '裁床仓管',
  note: '实物少 2 yard',
  photoName: '现场差异.jpg',
}, storage, (nodeId) => nodeId === 'pickup-node:1' ? {
  nodeId,
  version: 3,
  items: [{ prepLineId: 'LINE-1', materialSku: 'MAT-001', unit: 'yard' }],
} : null)

assert.throws(
  () => reportPickupDiscrepancy({
    ...discrepancy,
    pickupNodeVersion: 99,
  }, storage, (nodeId) => ({
    nodeId,
    version: 3,
    items: [{ prepLineId: 'LINE-1', materialSku: 'MAT-001', unit: 'yard' }],
  })),
  /节点版本已更新/,
  '写入层必须拒绝伪造或过期节点版本',
)
assert.throws(
  () => reportPickupDiscrepancy({
    ...discrepancy,
    discrepancyId: undefined,
  }, storage, () => ({
    nodeId: 'pickup-node:other',
    version: 3,
    items: [{ prepLineId: 'LINE-1', materialSku: 'MAT-001', unit: 'yard' }],
  })),
  /节点身份不一致/,
  '解析器返回同版本的其他节点也必须拒绝',
)
assert.throws(
  () => reportPickupDiscrepancy({
    ...discrepancy,
    demandLineId: 'FAKE-LINE',
    materialSku: 'FAKE-SKU',
  }, storage, (nodeId) => ({
    nodeId,
    version: 3,
    items: [{ prepLineId: 'LINE-1', materialSku: 'MAT-001', unit: 'yard' }],
  })),
  /物料不属于当前待领节点/,
  '伪造物料行必须在领域写入层被拒绝',
)

assert.equal(discrepancy.status, '待主管处理', '差异上报后必须进入待主管处理')
assert.equal(listPickupDiscrepancies(storage).length, 1, '差异必须可追溯')
assert.throws(
  () => assertPickupNodeHasNoOpenDiscrepancy('pickup-node:1', 3, storage),
  /差异待主管处理/,
  '同一有效节点版本存在差异时必须阻断确认',
)
assert.doesNotThrow(
  () => assertPickupNodeHasNoOpenDiscrepancy('pickup-node:1', 4, storage),
  '差异必须绑定上报时的节点版本',
)
const supervised = requestPickupDiscrepancySupervisor(discrepancy.discrepancyId, '裁床主管 王芳', storage)
assert.equal(supervised?.supervisorRequestedBy, '裁床主管 王芳', '叫主管处理必须留人和时间')
const resolved = resolvePickupDiscrepancy(discrepancy.discrepancyId, {
  handledBy: '裁床主管 王芳',
  resolution: '已现场复核并补齐差异物料',
}, storage)
assert.equal(resolved?.status, '已处理', '主管处理后必须关闭差异')
assert.equal(resolved?.handledBy, '裁床主管 王芳', '主管处理必须记录处理人')
assert(resolved?.handledAt, '主管处理必须记录处理时间')
assert.doesNotThrow(
  () => assertPickupNodeHasNoOpenDiscrepancy('pickup-node:1', 3, storage),
  '差异关闭后必须解除同一节点版本的差异阻断',
)

const pda = readFileSync(new URL('../src/pages/pda-warehouse-wait-process.ts', import.meta.url), 'utf8')
const runtime = readFileSync(new URL('../src/runtime/fcs/cutting/pickup-management-runtime.ts', import.meta.url), 'utf8')
assert(
  runtime.includes('assertPickupNodeHasNoOpenDiscrepancy(input.pickupNodeId, input.pickupNodeVersion, storage)'),
  '统一领料写入口必须阻断未处理差异，不能只依赖 PDA',
)
for (const text of [
  '上报领料差异',
  '叫主管处理',
  '现场照片',
  '现场说明',
  '待领托盘（暂未编号）',
  'assertPickupNodeHasNoOpenDiscrepancy',
]) {
  assert(pda.includes(text), `PDA 必须包含现场执行能力：${text}`)
}
assert(pda.includes("node.carrierType === 'PALLET'"), 'PDA 必须按承载方式区分托盘与库位')

const listPage = readFileSync(new URL('../src/pages/process-factory/cutting/pickup-management-list.ts', import.meta.url), 'utf8')
for (const text of [
  '款式 / SPU',
  '最近领料人',
  '当前节点状态',
  '本轮可领',
  '领后仍缺',
  '查看领料记录',
  '上报领料差异',
  '领料记录',
  '去处理当前待领',
  '异常证据',
  '主管处理完成',
]) {
  assert(listPage.includes(text), `三列表必须直接展示或提供：${text}`)
}
for (const key of ['readyStyle', 'incompleteStyle', 'historyStyle']) {
  assert(listPage.includes(`key: '${key}'`), `列表列键必须唯一：${key}`)
}

console.log('✓ 领料现场差异、PDA 承载方式、列表字段与领料记录检查通过')
