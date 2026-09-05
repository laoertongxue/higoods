import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolveFactoryMobileTodoActionRoute } from '../src/data/fcs/factory-mobile-todo-routes.ts'
import {
  getWoolAllowedActions,
  listWoolWorkOrders,
} from '../src/data/fcs/wool-task-domain.ts'
import {
  resolveWoolPdaScan,
  type WoolPdaScanPurpose,
} from '../src/data/fcs/wool-pda-scan.ts'

function readSource(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

const warehouseHomeSource = readSource('../src/pages/pda-warehouse.ts')
const waitProcessSource = readSource('../src/pages/pda-warehouse-wait-process.ts')
const waitHandoverSource = readSource('../src/pages/pda-warehouse-wait-handover.ts')
const woolFactSource = readSource('../src/pages/pda-wool-fact-execution.ts')
const execSource = readSource('../src/pages/pda-exec.ts')
const execDetailSource = readSource('../src/pages/pda-exec-detail.ts')
const handoverSource = readSource('../src/pages/pda-handover.ts')
const mainSource = readSource('../src/main.ts')

const retiredWarehouseSource = [warehouseHomeSource, waitProcessSource, waitHandoverSource].join('\n')
for (const removedText of [
  "from '../data/fcs/wool-task-domain.ts'",
  'WoolWaitProcessAction',
  'WoolWaitHandoverAction',
  'renderWoolWaitProcessPage',
  'renderWoolWaitHandoverPage',
  'resolveWoolWaitProcessStockSelection',
  'confirm-wool-',
  'open-wool-',
  'cancel-wool-',
  'wool-receive-',
  'wool-issue-',
  'wool-return-',
  'wool-stock-',
  'wool-action-',
  'wool-transfer-',
  'PDA 毛织仓管',
  '纱线确认接收',
  '纱线领用',
  '纱线退回',
  '查看待交出库存',
  '查看交出记录',
  '毛织待加工仓',
  '毛织待交出仓',
]) {
  assert(!retiredWarehouseSource.includes(removedText), `毛织 PDA 仓管第二套逻辑必须完整删除：${removedText}`)
}

const suppressedWarehouseGroups = warehouseHomeSource.match(/if \(isWoolWarehouseRuntime\(runtime\) \|\| isCraftWarehouseRuntime\(runtime\)\) return ''/g) ?? []
assert.equal(suppressedWarehouseGroups.length, 2, '毛织仓管首页必须同时隐藏待加工仓和待交出仓操作组')

const receiveRedirect = "return renderRouteRedirect('/fcs/pda/handover?tab=pickup', '毛织确认接收已统一到交接')"
const handoutRedirect = "return renderRouteRedirect('/fcs/pda/handover?tab=handout', '毛织发起交出已统一到交接')"
assert(waitProcessSource.includes(receiveRedirect), '毛织待加工仓旧 URL 必须跳转交接待接收')
assert(waitHandoverSource.includes(handoutRedirect), '毛织待交出仓旧 URL 必须跳转交接待交出')
assert(
  waitProcessSource.indexOf(receiveRedirect) < waitProcessSource.indexOf("getMobileWarehouseSearchParams().get('scope') === 'cutting'"),
  '毛织待加工仓退役守卫必须早于 query scope 分流',
)
assert(
  waitHandoverSource.indexOf(handoutRedirect) < waitHandoverSource.indexOf("getMobileWarehouseSearchParams().get('scope') === 'cutting'"),
  '毛织待交出仓退役守卫必须早于 query scope 分流',
)

assert(
  woolFactSource.includes("EXECUTION: ['COMPLETE', 'REPORT_PROCESS', 'ASSOCIATE_MACHINE']"),
  '执行表面只允许加工填报、关联横机设备、完成加工单',
)
assert(
  woolFactSource.includes("HANDOVER_RECEIVE: ['RECEIVE_YARN']")
    && woolFactSource.includes("HANDOVER_HANDOUT: ['HANDOVER']"),
  '交接表面必须分别只允许确认接收和发起交出',
)
for (const command of [
  'addWoolYarnReceipt',
  'addWoolProcessReport',
  'addWoolHandover',
  'replaceWoolMachineAssociations',
  'completeWoolWorkOrder',
]) {
  assert(woolFactSource.includes(command), `共享毛织事实处理器缺少领域命令：${command}`)
}
assert(execDetailSource.includes('renderPdaWoolExecutionContent'), 'PDA 执行详情必须接入执行表面')
assert(handoverSource.includes('renderPdaWoolHandoverContent'), 'PDA 交接页必须接入交接表面')
assert(
  execSource.includes("(['COMPLETE', 'REPORT_PROCESS', 'ASSOCIATE_MACHINE'] as const)"),
  '执行卡片主动作不得回退为确认接收或发起交出',
)
assert(mainSource.includes('[data-pda-scan-enter="true"]'), '扫码枪回车必须进入统一 PDA 页面事件处理')
assert(execSource.includes('data-pda-scan-enter="true"'), '加工填报必须提供扫码回车入口')
assert(handoverSource.includes('data-pda-scan-enter="true"'), '确认接收和发起交出必须提供扫码回车入口')

assert.equal(
  resolveFactoryMobileTodoActionRoute({ todoType: '待确认接收', executionProcessType: 'WOOL', relatedTaskId: 'TASK-WOOL-1' }),
  '/fcs/pda/handover?tab=pickup&taskId=TASK-WOOL-1',
  '毛织待确认接收待办必须进入交接待接收',
)
assert.equal(
  resolveFactoryMobileTodoActionRoute({ todoType: '待交出', executionProcessType: 'WOOL', relatedTaskId: 'TASK-WOOL-1' }),
  '/fcs/pda/handover?tab=handout&taskId=TASK-WOOL-1',
  '毛织待交出待办必须进入交接待交出',
)
assert.equal(
  resolveFactoryMobileTodoActionRoute({ todoType: '待加工填报', executionProcessType: 'WOOL', relatedTaskId: 'TASK-WOOL-1' }),
  '/fcs/pda/exec/TASK-WOOL-1',
  '毛织待加工填报待办必须进入执行详情',
)
assert.equal(
  resolveFactoryMobileTodoActionRoute({ todoType: '待完工', executionProcessType: 'WOOL', relatedTaskId: 'TASK-WOOL-1' }),
  '/fcs/pda/exec/TASK-WOOL-1',
  '毛织待完工待办必须进入执行详情',
)

const purposeActions: Record<WoolPdaScanPurpose, string[]> = {
  EXECUTION: ['REPORT_PROCESS', 'ASSOCIATE_MACHINE', 'COMPLETE'],
  RECEIVE: ['RECEIVE_YARN'],
  HANDOVER: ['HANDOVER'],
}
const orders = listWoolWorkOrders()
assert(orders.every((order) => order.styleImageUrl), '所有毛织加工单扫码结果必须具备真实款式图片')
for (const purpose of Object.keys(purposeActions) as WoolPdaScanPurpose[]) {
  const order = orders.find((item) =>
    getWoolAllowedActions(item.woolOrderId).some((action) => purposeActions[purpose].includes(action)),
  )
  assert(order, `Mock 必须包含可用于 ${purpose} 扫码的毛织加工单`)
  const result = resolveWoolPdaScan(order.woolOrderNo, order.factoryId, purpose)
  assert.equal(result.status, 'MATCH', `${purpose} 扫加工单号必须唯一命中`)
  assert.equal(result.candidates[0].order.woolOrderId, order.woolOrderId)
  assert(result.candidates[0].order.styleImageUrl, `${purpose} 扫码结果必须有真实款式图片`)
}

const firstOrder = orders[0]
assert(firstOrder, '必须存在毛织加工单 Mock')
assert.equal(
  resolveWoolPdaScan(firstOrder.woolOrderNo, 'OTHER_FACTORY', 'RECEIVE').status,
  'FORBIDDEN',
  '扫码不得操作其他工厂加工单',
)
assert.equal(resolveWoolPdaScan('NOT-A-WOOL-ORDER', firstOrder.factoryId, 'RECEIVE').status, 'NOT_FOUND')

const productionGroups = new Map<string, typeof orders>()
for (const order of orders) {
  const group = productionGroups.get(order.productionOrderNo) || []
  group.push(order)
  productionGroups.set(order.productionOrderNo, group)
}
const multipleResolution = [...productionGroups.entries()]
  .map(([productionOrderNo, group]) => ({
    group,
    result: resolveWoolPdaScan(productionOrderNo, group[0].factoryId, 'RECEIVE'),
  }))
  .find(({ result }) => result.status === 'MULTIPLE')
assert(multipleResolution, '同一生产单存在多张可接收毛织加工单时必须返回候选')
assert(multipleResolution.result.candidates.length > 1, '多加工单场景不得自动选择第一张')
assert(
  multipleResolution.result.candidates.every((candidate) => candidate.order.styleImageUrl),
  '毛织生产单多候选必须全部展示真实款式图片',
)

console.log('毛织 PDA 单一事实、Tab 分工与扫码入口检查通过')
