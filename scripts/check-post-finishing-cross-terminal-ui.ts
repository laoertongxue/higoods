#!/usr/bin/env node

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8')
}

const spec = read('../tests/post-finishing-full-flow-cross-terminal.spec.ts')
const packageJson = JSON.parse(read('../package.json')) as {
  scripts?: Record<string, string>
}

const requiredUiRoutes = [
  '/fcs/pda/handover/sewing-self-return',
  '/fcs/pda/post-finishing/return-confirm',
  '/fcs/craft/post-finishing/wait-process-warehouse',
  '/fcs/craft/post-finishing/qc-orders',
  '/fcs/craft/post-finishing/authorization-code',
  '/fcs/craft/post-finishing/work-orders',
  '/fcs/pda/post-finishing/execute',
  '/fcs/pda/post-finishing/recheck',
  '/fcs/craft/post-finishing/outbound-orders',
  '/fcs/pda/post-finishing/outbound-receive',
  '/fcs/craft/post-finishing/audit-records',
]

const requiredUiStages = [
  '公共PDA登记回货',
  'PDA回货确认',
  'Web回货确认并入待加工仓',
  'Web送检及送检单打印',
  'Web质检完成',
  'Web后道加工单打印',
  'PDA后道完成',
  'PDA复检完成',
  'Web出货核对及出货单打印',
  'PDA仓库收货',
  'Web收货结果回查',
]

const forbiddenDomainWrites = [
  'resetPostFinishingFullFlow',
  'registerPostFinishingFactoryReturn',
  'confirmPostFinishingFactoryReturn',
  'sendPostFinishingFactoryReturnToQc',
  'claimPostFinishingQcTask',
  'releasePostFinishingQcTask',
  'completePostFinishingQcTask',
  'startPostFinishingPostTask',
  'completePostFinishingPostTask',
  'claimPostFinishingRecheckOrder',
  'releasePostFinishingRecheckOrder',
  'scanPostFinishingRecheckSkuBarcode',
  'completePostFinishingRecheckOrderFullFlow',
  'receivePostFinishingOutboundOrder',
]

for (const route of requiredUiRoutes) {
  assert(spec.includes(route), `跨端验收缺少命名页面：${route}`)
}
for (const stage of requiredUiStages) {
  assert(spec.includes(stage), `跨端验收缺少业务阶段：${stage}`)
}
for (const write of forbiddenDomainWrites) {
  assert(!spec.includes(write), `跨端验收不得直接调用领域写入：${write}`)
}

assert(spec.includes("window.localStorage.clear()"), '跨端验收必须从空浏览器业务状态开始')
assert(spec.includes("window.localStorage.setItem('fcs_pda_session'"), '跨端验收必须明确设置PDA测试会话')
assert(spec.includes("window.localStorage.setItem('higood-fcs-post-finishing-demo-mode-v1', 'empty')"), '跨端验收必须关闭默认演示数据后再执行 UI 写入')
assert(spec.includes("window.localStorage.setItem('higood-fcs-post-finishing-current-authorizer-v1'"), '跨端验收必须通过当前授权身份打开独立授权码页')
assert.equal(
  [...spec.matchAll(/window\.localStorage\.setItem\(/g)].length,
  3,
  '测试准备阶段只允许写入 PDA 会话、演示数据开关和当前授权身份',
)

assert(spec.includes("'PO-QC-202608-001'"), '缺少第 1 个生产单')
assert(spec.includes("'PO-QC-202608-002'"), '缺少第 2 个生产单')
assert(spec.includes("'PO-QC-202608-003'"), '缺少第 3 个生产单')
assert(spec.includes('[1, 2, 3, 4, 5].map((returnIndex)'), '每个生产单必须逐一执行 5 次回货')
assert(spec.includes('[1, 2, 3, 4, 5].map((skuIndex)'), '每个生产单必须逐一核对 5 个 SKU')
assert(spec.includes("toHaveLength(15)"), '必须断言 15 条跨端业务链')
assert(spec.includes('POST_FINISHING_CROSS_TERMINAL_EVIDENCE_OUT'), '必须输出结构化验收证据')
assert(spec.includes('POST_FINISHING_CROSS_TERMINAL_SCREENSHOT_DIR'), '必须输出逐链截图证据')
assert(spec.includes('全部业务写入由 Web/PDA 页面操作产生'), '必须声明 UI 写入边界')
assert.equal(
  packageJson.scripts?.['test:post-finishing-full-flow:cross-terminal'],
  'PLAYWRIGHT_REUSE_EXISTING_SERVER=false CUTTING_E2E_EXPECT_TIMEOUT=45000 CUTTING_E2E_TEST_TIMEOUT=1800000 playwright test tests/post-finishing-full-flow-cross-terminal.spec.ts --workers=1 --reporter=line',
  'package.json 缺少固定的全量跨端 UI 验收入口',
)

console.log(JSON.stringify({
  suite: 'QC 后道全流程跨端 UI 验收静态门禁',
  productionOrders: 3,
  skuPerProductionOrder: 5,
  returnsPerProductionOrder: 5,
  chains: 15,
  namedRoutes: requiredUiRoutes.length,
  uiStages: requiredUiStages.length,
  forbiddenDomainWrites: forbiddenDomainWrites.length,
  setupWrites: '清空浏览器状态，写入PDA测试会话、关闭默认演示数据并切换指定授权测试身份',
  writeBoundary: 'UI-only',
}, null, 2))
