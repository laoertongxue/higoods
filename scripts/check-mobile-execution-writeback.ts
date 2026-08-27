import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
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

const writebackPath = 'src/data/fcs/process-action-writeback-service.ts'
const pdaExecDetailPath = 'src/pages/pda-exec-detail.ts'
const postDomainPath = 'src/data/fcs/post-finishing-domain.ts'
const routesPdaPath = 'src/router/routes-pda.ts'

assert(existsSync(join(root, writebackPath)), '缺少统一移动端执行写回模块')

const writeback = read(writebackPath)
const pdaExecDetail = read(pdaExecDetailPath)
const postDomain = read(postDomainPath)
const routesPda = read(routesPdaPath)

;[
  'executePrintAction',
  'executeDyeAction',
  'executeCuttingAction',
  'executeSpecialCraftAction',
  'executePostFinishingAction',
  'executeProcessAction',
  'executeMobileProcessAction',
].forEach((fn) => {
  assertIncludes(writeback, `function ${fn}`, `统一写回模块缺少函数 ${fn}`)
})

assertIncludes(pdaExecDetail, 'executeMobileProcessAction', '移动端执行页未调用统一移动端写回入口')

assertIncludes(writeback, 'getPrintWorkOrderById', '印花写回必须读取统一印花加工单')
assertIncludes(writeback, 'getDyeWorkOrderById', '染色写回必须读取统一染色加工单')
assertIncludes(writeback, 'submitPrintHandover', '印花交出必须写回统一印花加工单')
assertIncludes(writeback, 'submitDyeHandover', '染色交出必须写回统一染色加工单')
assertIncludes(writeback, 'applyWarehouseLinkageAfterAction', '统一写回必须触发仓储联动')
assertIncludes(writeback, 'confirmSpecialCraftTaskOrderCompletionBySku', '特殊工艺完工必须按 SKU 写回任务单')
assertIncludes(writeback, 'skuScrapQtyBySkuCode', '特殊工艺完工写回必须携带报废数量')
assertIncludes(writeback, 'skuDamageQtyBySkuCode', '特殊工艺完工写回必须携带货损数量')
assertIncludes(writeback, 'processActionResultsByConfirmationKey', '统一交出写回必须支持幂等确认键')
assertIncludes(writeback, 'restoreProcessWarehouseMutationState', '统一写回失败必须回滚仓储联动')
assertIncludes(postDomain, 'ensurePostFinishingHandoverWarehouseRecord', '复检完成必须生成后道交出仓记录')

;[
  '开始打印',
  '完成打印',
  '开始转印',
  '完成转印',
  '发起交出',
  '开始染色',
  '完成染色',
  '开始实际工序',
  '完成实际工序',
  '开始质检',
  '完成质检',
  '开始复检',
  '完成复检',
].forEach((label) => {
  assertIncludes(pdaExecDetail, label, `移动端缺少动作按钮：${label}`)
})

;[
  '染色完成面料米数',
  '本次交出',
  '报废数量',
  '货损数量',
  '完成成衣件数',
  '复检确认成衣件数',
  '待交出数量',
].forEach((label) => {
  assertIncludes(pdaExecDetail, label, `移动端数量字段必须带对象和单位：${label}`)
})

const postActionSection = pdaExecDetail.slice(
  pdaExecDetail.indexOf('function renderPostFinishingActionPanel'),
  pdaExecDetail.indexOf('function renderPdaPostFinishingExecutionPage'),
)
;['开扣眼', '装扣子', '烫包'].forEach((term) => {
  assertNotIncludes(postActionSection, term, `后道移动端动作不应出现 ${term}`)
})

assertIncludes(routesPda, '^\\/fcs\\/pda\\/exec\\/([^/]+)$', '移动端执行详情动态路由必须存在')
assertIncludes(pdaExecDetail, 'getPostFinishingWorkOrderForMobile', '后道单必须复用移动端执行详情路由')

console.log('mobile execution writeback checks passed')
