import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  assertPickupNodeHasNoOpenDiscrepancy,
  listPickupDiscrepancies,
  reportPickupDiscrepancy,
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
}, storage)

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

const pda = readFileSync(new URL('../src/pages/pda-warehouse-wait-process.ts', import.meta.url), 'utf8')
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
]) {
  assert(listPage.includes(text), `三列表必须直接展示或提供：${text}`)
}

console.log('✓ 领料现场差异、PDA 承载方式、列表字段与领料记录检查通过')
