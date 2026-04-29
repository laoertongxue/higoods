import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { listPrepProcessOrders } from '../src/data/fcs/page-adapters/process-prep-pages-adapter.ts'
import {
  PLATFORM_PROCESS_STATUS_OPTIONS,
  getPlatformStatusForProcessWorkOrder,
  getPlatformStatusForRuntimeTask,
  listPlatformStatusOptions,
  mapCraftStatusToPlatformStatus,
  mapCuttingStatusToPlatformStatus,
  mapDyeStatusToPlatformStatus,
  mapPrintStatusToPlatformStatus,
  mapSpecialCraftStatusToPlatformStatus,
  type PlatformProcessStatus,
} from '../src/data/fcs/process-platform-status-adapter.ts'
import { listProcessWorkOrders } from '../src/data/fcs/process-work-order-domain.ts'
import { listTaskChainTasks } from '../src/data/fcs/page-adapters/task-chain-pages-adapter.ts'

const root = process.cwd()

function assert(condition: unknown, message: string): void {
  if (!condition) {
    throw new Error(`工艺细状态与平台聚合状态映射检查失败：${message}`)
  }
}

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assertIncludes(path: string, needles: string[]): void {
  const source = read(path)
  for (const needle of needles) {
    assert(source.includes(needle), `${path} 缺少 ${needle}`)
  }
}

function assertNotIncludes(path: string, needles: string[], scope: string): void {
  const source = read(path)
  for (const needle of needles) {
    assert(!source.includes(needle), `${scope} 不应直接包含细状态 ${needle}`)
  }
}

function assertAllowedStatus(status: string): void {
  assert(
    PLATFORM_PROCESS_STATUS_OPTIONS.includes(status as PlatformProcessStatus),
    `平台状态 ${status} 不在允许集合中`,
  )
}

function assertCoverage(
  name: string,
  statuses: string[],
  mapper: (status: string) => { platformStatusLabel: PlatformProcessStatus },
  required: PlatformProcessStatus[],
): void {
  const mapped = new Set(statuses.map((status) => mapper(status).platformStatusLabel))
  required.forEach((status) => assert(mapped.has(status), `${name} 缺少 ${status} 映射覆盖`))
  mapped.forEach((status) => assertAllowedStatus(status))
}

const modulePath = join(root, 'src/data/fcs/process-platform-status-adapter.ts')
assert(existsSync(modulePath), '缺少 src/data/fcs/process-platform-status-adapter.ts')
assert(typeof mapCraftStatusToPlatformStatus === 'function', '缺少 mapCraftStatusToPlatformStatus')
assert(typeof mapPrintStatusToPlatformStatus === 'function', '缺少 mapPrintStatusToPlatformStatus')
assert(typeof mapDyeStatusToPlatformStatus === 'function', '缺少 mapDyeStatusToPlatformStatus')
assert(typeof mapCuttingStatusToPlatformStatus === 'function', '缺少 mapCuttingStatusToPlatformStatus')
assert(typeof mapSpecialCraftStatusToPlatformStatus === 'function', '缺少 mapSpecialCraftStatusToPlatformStatus')
assert(typeof getPlatformStatusForProcessWorkOrder === 'function', '缺少 getPlatformStatusForProcessWorkOrder')
assert(typeof getPlatformStatusForRuntimeTask === 'function', '缺少 getPlatformStatusForRuntimeTask')
assert(listPlatformStatusOptions().join('|') === PLATFORM_PROCESS_STATUS_OPTIONS.join('|'), '平台状态选项必须集中来自统一 adapter')

assertCoverage(
  '印花',
  ['待花型', '等打印', '打印中', '转印中', '待送货', '待回写', '待审核', '审核驳回', '已完成'],
  (status) => mapPrintStatusToPlatformStatus(status),
  ['准备中', '加工中', '待送货', '待回写', '待审核', '异常', '已完成'],
)

assertCoverage(
  '染色',
  ['待样衣', '待原料', '打样中', '待排缸', '染色中', '脱水中', '烘干中', '定型中', '打卷中', '包装中', '包装完成', '待回写', '待审核', '数量差异', '已完成'],
  (status) => mapDyeStatusToPlatformStatus(status),
  ['准备中', '加工中', '待送货', '待回写', '待审核', '异常', '已完成'],
)

assertCoverage(
  '裁片',
  ['待配料', '部分配料', '待领料', '待唛架', '待铺布', '裁剪中', '待菲票', '待入仓', '已入仓', '待交出', '待回写', '待审核', '有差异', '已完成'],
  (status) => mapCuttingStatusToPlatformStatus(status),
  ['准备中', '加工中', '待送货', '待回写', '待审核', '异常', '已完成'],
)

assertCoverage(
  '特殊工艺',
  ['待接收', '已接收', '待加工', '加工中', '加工完成', '待交出', '待回写', '待审核', '差异待处理', '已完成'],
  (status) => mapSpecialCraftStatusToPlatformStatus(status),
  ['准备中', '加工中', '待送货', '待回写', '待审核', '异常', '已完成'],
)

listProcessWorkOrders('PRINT').forEach((order) => {
  const mapped = getPlatformStatusForProcessWorkOrder(order)
  assertAllowedStatus(mapped.platformStatusLabel)
  assert(mapped.craftStatusLabel === order.statusLabel, `${order.workOrderNo} 必须保留工厂内部状态`)
})

listProcessWorkOrders('DYE').forEach((order) => {
  const mapped = getPlatformStatusForProcessWorkOrder(order)
  assertAllowedStatus(mapped.platformStatusLabel)
  assert(mapped.craftStatusLabel === order.statusLabel, `${order.workOrderNo} 必须保留工厂内部状态`)
})

for (const processCode of ['PRINT', 'DYE'] as const) {
  listPrepProcessOrders(processCode).forEach((order) => {
    assertAllowedStatus(order.status)
    assert(order.factoryInternalStatusLabel || order.statusLabel, `${order.orderNo} 缺少工厂内部状态辅助字段`)
    assert(order.platformRiskLabel, `${order.orderNo} 缺少风险提示`)
    assert(order.platformActionHint, `${order.orderNo} 缺少下一步动作`)
  })
}

listTaskChainTasks().forEach((task) => {
  const mapped = getPlatformStatusForRuntimeTask(task)
  assertAllowedStatus(mapped.platformStatusLabel)
})

assertIncludes('src/data/fcs/page-adapters/process-prep-pages-adapter.ts', [
  'getPlatformStatusForProcessWorkOrder',
  'platformStatusLabel',
  'platformRiskLabel',
  'platformActionHint',
])
assert(!read('src/data/fcs/page-adapters/process-prep-pages-adapter.ts').includes('function toPlatformOrderStatus'), 'process-prep-pages-adapter 不得保留冲突的独立平台状态映射函数')

assertIncludes('src/pages/process-print-orders.ts', [
  'listPlatformStatusOptions',
  '平台状态',
  '工厂内部状态',
  '风险提示',
  '下一步动作',
])
assertIncludes('src/pages/process-dye-orders.ts', [
  'listPlatformStatusOptions',
  '平台状态',
  '工厂内部状态',
  '风险提示',
  '下一步动作',
])
assertIncludes('src/pages/progress-board/task-domain.ts', [
  'getPlatformStatusForRuntimeTask',
  '平台状态',
  '工厂内部状态',
  '下一步动作',
])

assertNotIncludes('src/pages/process-print-orders.ts', ['待花型', '待调色测试', '等打印', '打印中', '转印中'], '平台侧印花页面主展示')
assertNotIncludes('src/pages/process-dye-orders.ts', ['待样衣', '待原料', '打样中', '待排缸', '染色中', '脱水中', '烘干中', '定型中', '打卷中', '包装中'], '平台侧染色页面主展示')

assertIncludes('src/pages/process-factory/printing/work-orders.ts', ['状态'])
assertIncludes('src/pages/process-factory/dyeing/work-orders.ts', ['状态'])
assertIncludes('src/pages/pda-exec.ts', ['待开工', '进行中', '已完工'])

console.log('process platform status mapping checks passed')
