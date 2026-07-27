import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const source = fs.readFileSync(path.join(ROOT, 'src/pages/pda-cutting-handover.ts'), 'utf8')
const inboundSource = fs.readFileSync(path.join(ROOT, 'src/pages/pda-cutting-inbound.ts'), 'utf8')
const waitHandoverSource = fs.readFileSync(path.join(ROOT, 'src/pages/pda-warehouse-wait-handover.ts'), 'utf8')
const checkSource = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')
const CUTTING_WAIT_HANDOVER_ROOT = '/fcs/pda/warehouse/wait-handover?scope=cutting'
const CUTTING_FIXTURE_CUT_ORDER_NO = 'CUT-260304-008-01'

function buildExpectedEntries(taskId: string) {
  return [
    {
      title: '菲票装袋',
      route: `/fcs/pda/cutting/inbound/${taskId}`,
    },
    {
      title: '中转袋入仓',
      route: `/fcs/pda/cutting/inbound/${taskId}?action=inbound-location`,
    },
    {
      title: '中转袋交出',
      route: `/fcs/pda/cutting/handover/${taskId}?action=transfer-bag-handover`,
    },
    {
      title: '特殊工艺回仓',
      route: `/fcs/pda/cutting/handover/${taskId}?action=special-craft-return`,
    },
    {
      title: '菲票打编号',
      route: '/fcs/pda/cutting/fei-ticket-numbering',
    },
  ] as const
}

function assertContains(token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotContains(token: string, message: string): void {
  assert(!source.includes(token), message)
}

assertContains(
  "const isTransferBagHandoverAction = routeAction === 'transfer-bag-handover'",
  '中转袋交出 action 必须使用独立模式',
)
assertContains(
  "isTransferBagHandoverAction ? '中转袋交出'",
  '中转袋交出 action 必须显示“中转袋交出”标题',
)
assertContains(
  "const cuttingWaitHandoverBackHref = '/fcs/pda/warehouse/wait-handover?scope=cutting'",
  '裁床交出与特殊工艺回仓必须返回五入口根页',
)
assertNotContains(
  "const specialCraftReturnBackHref = '/fcs/pda/warehouse/wait-handover?scope=cutting&action=special-craft-return'",
  '特殊工艺回仓不得通过旧 action 返回自身',
)
assertNotContains(
  "const baggingConfirmBackHref = '/fcs/pda/warehouse/wait-handover?scope=cutting&action=handover-bagging-confirm'",
  '中转袋交出不得通过旧 action 返回自身',
)

const directWaitHandoverPageImport = [
  "import('../src/pages/",
  "pda-warehouse-wait-handover.ts')",
].join('')
assert(
  !checkSource.includes(directWaitHandoverPageImport),
  '快速路由契约检查不得直接导入待交出仓页面',
)
for (const forbiddenSource of [
  'export function renderPdaCuttingWaitHandoverRootContent',
  'const CUTTING_WAIT_HANDOVER_ACTIONS',
  'function getCuttingWaitHandoverAction(',
  'function renderCuttingWaitHandoverActionPage(',
  'buildWaitHandoverRuntimeProjection',
  'buildTransferBagsProjection',
  'buildInboundTempBagsFromTransferBagViewModel',
]) {
  assert(
    !waitHandoverSource.includes(forbiddenSource),
    `裁床待交出仓不得保留不可达旧子页链：${forbiddenSource}`,
  )
}

const { listPdaCuttingTaskSourceRecords } = await import('../src/data/fcs/cutting/pda-cutting-task-source.ts')
const taskFixture = listPdaCuttingTaskSourceRecords().find(
  (record) => record.cutOrderNos.includes(CUTTING_FIXTURE_CUT_ORDER_NO),
)
assert(taskFixture, `快速路由契约检查必须找到裁片单 ${CUTTING_FIXTURE_CUT_ORDER_NO} 对应的任务`)
const expectedEntries = buildExpectedEntries(taskFixture.taskId)
const expectedLegacyRedirects = [
  { action: 'inbound', target: expectedEntries[0].route },
  { action: 'inbound-location', target: expectedEntries[1].route },
  { action: 'handover-bagging-confirm', target: expectedEntries[2].route },
  { action: 'special-craft-return', target: expectedEntries[3].route },
  { action: 'numbering', target: expectedEntries[4].route },
] as const
const { routes: pdaRoutes } = await import('../src/router/routes-pda.ts')
const {
  getPdaCuttingWaitHandoverActions,
  resolvePdaCuttingWaitHandoverLegacyActionRoute,
} = await import('../src/pages/pda-cutting-wait-handover-actions.ts')

const inboundRoute = expectedEntries[1].route
const inboundPathname = new URL(inboundRoute, 'http://localhost').pathname
const inboundMatch = pdaRoutes.dynamicRoutes
  .map((route) => route.pattern.exec(inboundPathname))
  .find((match): match is RegExpExecArray => Boolean(match))
assert(inboundMatch, 'routes-pda 必须使用真实动态路由契约接住中转袋入仓深链')
assert.equal(inboundMatch[1], taskFixture.taskId, 'routes-pda 动态路由契约必须完整传递裁床任务 ID')
assert(
  inboundSource.includes("const pageTitle = mode === 'inbound-location' ? '中转袋入仓' : '菲票装袋'"),
  '中转袋入仓 query 模式必须保留独立标题',
)
assert(
  inboundSource.includes("backHref: '/fcs/pda/warehouse/wait-handover?scope=cutting'"),
  '菲票装袋和中转袋入仓必须返回裁床待交出仓五入口根页',
)

assert(
  pdaRoutes.exactRoutes['/fcs/pda/warehouse/wait-handover'],
  'routes-pda 必须注册裁床待交出仓根路由',
)
assert(
  waitHandoverSource.includes('renderCuttingWaitHandoverActionCards(getPdaCuttingWaitHandoverActions())'),
  '裁床待交出仓根页必须直接使用生产五入口契约',
)
const actualEntries = getPdaCuttingWaitHandoverActions()
assert.equal(actualEntries.length, 5, '裁床待交出仓生产路由契约必须恰好提供五个动作入口')
assert.deepEqual(
  actualEntries.map(({ title, route }) => ({ title, route })),
  expectedEntries.map(({ title, route }) => ({ title, route })),
  '裁床待交出仓生产五入口必须使用稳定业务任务对应的固定深链',
)
assert(
  waitHandoverSource.includes("renderCuttingWarehouseSwitch('wait-handover')"),
  '裁床待交出仓根页必须保留仓库切换',
)
for (const forbiddenText of ['候选袋', '交出装袋确认', '混装：', '暂存袋']) {
  assert(!waitHandoverSource.includes(forbiddenText), `裁床待交出仓根页不得保留旧内容“${forbiddenText}”`)
}

for (const legacy of expectedLegacyRedirects) {
  assert.equal(
    resolvePdaCuttingWaitHandoverLegacyActionRoute(legacy.action),
    legacy.target,
    `旧 action “${legacy.action}”的生产路由解析器必须返回固定目标`,
  )
}
assert(
  waitHandoverSource.includes('resolvePdaCuttingWaitHandoverLegacyActionRoute(activeAction)'),
  '裁床待交出仓根路由必须接入生产 legacy 路由解析器',
)
assert(
  waitHandoverSource.includes("renderRouteRedirect(legacyActionRoute, '正在进入裁床操作')"),
  '裁床待交出仓根路由必须将 legacy action 渲染为跳转占位页',
)
console.log('[check-pda-cutting-wait-handover-entry-routing] 快速路由契约与 legacy 解析检查通过')
