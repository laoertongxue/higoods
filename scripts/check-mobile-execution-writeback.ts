import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  listPostFinishingWaitHandoverWarehouseRecords,
  listPostFinishingWorkOrders,
} from '../src/data/fcs/post-finishing-domain.ts'
import {
  finishPostFinishingAction,
  startPostFinishingAction,
} from '../src/data/fcs/process-execution-writeback.ts'

const root = process.cwd()

function read(path: string): string {
  return readFileSync(join(root, path), 'utf8')
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message)
}

function assertIncludes(source: string, needle: string, message: string): void {
  assert(source.includes(needle), message)
}

function assertNotIncludes(source: string, needle: string, message: string): void {
  assert(!source.includes(needle), message)
}

const writebackPath = 'src/data/fcs/process-execution-writeback.ts'
const pdaExecDetailPath = 'src/pages/pda-exec-detail.ts'
const postDomainPath = 'src/data/fcs/post-finishing-domain.ts'
const routesPdaPath = 'src/router/routes-pda.ts'

assert(existsSync(join(root, writebackPath)), '缺少统一移动端执行写回模块')

const writeback = read(writebackPath)
const pdaExecDetail = read(pdaExecDetailPath)
const postDomain = read(postDomainPath)
const routesPda = read(routesPdaPath)

;[
  'startPrintNode',
  'finishPrintNode',
  'submitPrintDelivery',
  'submitPrintHandover',
  'createPrintReviewRecord',
  'startDyeNode',
  'finishDyeNode',
  'submitDyeDelivery',
  'submitDyeHandover',
  'createDyeReviewRecord',
  'startSpecialCraftTask',
  'finishSpecialCraftTask',
  'bindSpecialCraftFeiTicket',
  'reportSpecialCraftDifference',
  'submitSpecialCraftHandover',
  'startPostFinishingAction',
  'finishPostFinishingAction',
  'transferPostFinishedGarmentsToManagedPostFactory',
  'receivePostFinishedGarmentsAtManagedPostFactory',
  'createPostFinishingHandoverWarehouseRecord',
  'submitPostFinishingHandover',
].forEach((fn) => {
  assertIncludes(writeback, `function ${fn}`, `统一写回模块缺少函数 ${fn}`)
})

;[
  'startPrintNode',
  'finishPrintNode',
  'submitPrintHandover',
  'startDyeNode',
  'finishDyeNode',
  'submitDyeHandover',
  'startSpecialCraftTask',
  'finishSpecialCraftTask',
  'bindSpecialCraftFeiTicket',
  'reportSpecialCraftDifference',
  'submitSpecialCraftHandover',
  'startPostFinishingAction',
  'finishPostFinishingAction',
  'transferPostFinishedGarmentsToManagedPostFactory',
  'receivePostFinishedGarmentsAtManagedPostFactory',
  'createPostFinishingHandoverWarehouseRecord',
  'submitPostFinishingHandover',
].forEach((fn) => {
  assertIncludes(pdaExecDetail, fn, `移动端执行页未调用统一写回函数 ${fn}`)
})

assertIncludes(writeback, 'getPrintWorkOrderByTaskId', '印花写回必须按 taskId 找到统一印花加工单')
assertIncludes(writeback, 'getDyeWorkOrderByTaskId', '染色写回必须按 taskId 找到统一染色加工单')
assertIncludes(writeback, 'createFactoryHandoverRecord', '交出写回必须生成交出记录')
assertIncludes(writeback, 'writeBackHandoverRecord', '交出写回必须触发接收方回写与审核同步')
assertIncludes(writeback, 'linkSpecialCraftCompletionToReturnWaitHandoverStock', '特殊工艺完工必须写回待交出仓')
assertIncludes(writeback, 'recordSpecialCraftFeiTicketLossAndDamage', '特殊工艺差异必须写回菲票数量和差异记录')
assertIncludes(postDomain, 'assertPostActionAllowed', '后道写回必须校验动作权限')
assertIncludes(postDomain, '非专门工厂只能执行后道', '非专门后道工厂必须禁止本厂质检和复检')
assertIncludes(postDomain, 'ensurePostFinishingHandoverWarehouseRecord', '复检完成必须生成后道交出仓记录')

;[
  '开始打印',
  '完成打印',
  '开始转印',
  '完成转印',
  '发起交出',
  '开始染色',
  '完成染色',
  '开始后道',
  '完成后道',
  '开始质检',
  '完成质检',
  '开始复检',
  '完成复检',
].forEach((label) => {
  assertIncludes(pdaExecDetail, label, `移动端缺少动作按钮：${label}`)
})

;[
  '完成面料米数',
  '交出面料米数',
  '报废裁片数量',
  '货损裁片数量',
  '完成成衣件数',
  '复检确认成衣件数',
  '交出成衣件数',
].forEach((label) => {
  assertIncludes(pdaExecDetail, label, `移动端数量字段必须带对象和单位：${label}`)
})

const postActionSection = pdaExecDetail.slice(
  pdaExecDetail.indexOf('function renderPostFinishingActionPanel'),
  pdaExecDetail.indexOf('function renderPdaPostFinishingExecutionPage'),
)
;['开扣眼', '装扣子', '熨烫', '包装'].forEach((term) => {
  assertNotIncludes(postActionSection, term, `后道移动端动作不应出现 ${term}`)
})

assertIncludes(routesPda, '^\\/fcs\\/pda\\/exec\\/([^/]+)$', '移动端执行详情动态路由必须存在')
assertIncludes(pdaExecDetail, 'getPostFinishingWorkOrderForMobile', '后道单必须复用移动端执行详情路由')

const nonDedicated = listPostFinishingWorkOrders().find((order) => order.routeMode === '非专门工厂含后道')
assert(nonDedicated, '后道 mock 缺少非专门工厂含后道场景')
let blockedNonDedicatedQc = false
try {
  startPostFinishingAction(nonDedicated!.postOrderId, '质检', { operatorName: '检查脚本' })
} catch (error) {
  blockedNonDedicatedQc = error instanceof Error && /非专门工厂只能执行后道/.test(error.message)
}
assert(blockedNonDedicatedQc, '非专门后道工厂不应能执行质检')

const recheckRunning = listPostFinishingWorkOrders().find((order) => order.recheckAction?.status === '复检中')
assert(recheckRunning, '后道 mock 缺少复检中数据，无法验证复检完成生成交出仓')
finishPostFinishingAction(recheckRunning!.postOrderId, '复检', {
  submittedQty: recheckRunning!.plannedGarmentQty,
  acceptedQty: recheckRunning!.plannedGarmentQty,
  operatorName: '检查脚本',
})
assert(
  listPostFinishingWaitHandoverWarehouseRecords().some((record) => record.postOrderId === recheckRunning!.postOrderId),
  '复检完成后未生成后道交出仓记录',
)

console.log('mobile execution writeback checks passed')
