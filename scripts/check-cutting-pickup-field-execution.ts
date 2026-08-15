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
  '统一接收写入口必须阻断未处理差异，不能只依赖 PDA',
)
for (const text of [
  '上报接收差异',
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
  '当前节点状态',
  '本轮可接收',
  '接收后仍缺',
  '位置 / 载体',
  '当前配料',
  '累计接收',
  '上报接收差异',
  '接收记录',
  '确认接收',
  '异常证据',
  '主管处理完成',
  '需求来源',
  '加工路线',
  '配齐方式',
  '托盘是否编号',
  '最近配齐时间',
  '库区 / 库位',
  '仍缺物料',
  '最近配料时间',
  '接收路径',
  '最终结果',
  '最近接收时间',
  '一次直接配齐',
  '从未配齐升级',
  '当前未编号托盘',
  '当前占用库位',
  '可整批接收生产单',
  '含补料生产单',
  '已配齐后接收',
  '未配齐先领',
  '尚未全部领完',
  '新增补料待领',
  'data-pickup-card-header',
  'data-pickup-card-summary-band',
  'data-pickup-receipt-readonly-items',
  'buildCuttingWarehouseMapProjectionForWarehouse',
  'confirmPickupNodeReceiptRuntime',
  "eventSource: 'WEB'",
]) {
  assert(listPage.includes(text), `三列表必须直接展示或提供：${text}`)
}
const materialColumns = listPage.match(/function materialColumnsFor[\s\S]*?\n}\n/)?.[0] || ''
for (const text of ['加工状态', '加工可供', '已到仓', '超配异常']) {
  assert(!materialColumns.includes(text), `物料明细不得保留已删除列：${text}`)
}
assert(materialColumns.includes("title: '位置 / 载体', width: 180"), '位置 / 载体必须收窄为 180px')
assert(!listPage.includes('一次接收本节点全部物料'), '卡片不得保留重复的一次接收说明')
assert(!listPage.includes('>生产单信息<'), '卡头不得保留重复的生产单信息标题')

console.log('✓ 接收现场差异、Web/PDA 共用接收、紧凑字段与接收记录检查通过')
