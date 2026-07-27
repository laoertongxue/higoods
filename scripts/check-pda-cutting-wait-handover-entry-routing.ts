import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderPdaCuttingInboundPage } from '../src/pages/pda-cutting-inbound.ts'
import { getPdaCuttingWaitHandoverActions } from '../src/pages/pda-cutting-wait-handover-actions.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const source = fs.readFileSync(path.join(ROOT, 'src/pages/pda-cutting-handover.ts'), 'utf8')
const CUTTING_WAIT_HANDOVER_ROOT = '/fcs/pda/warehouse/wait-handover?scope=cutting'

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

const inboundHtml = renderPdaCuttingInboundPage('CUTTING-DEMO')
const warehouseTabMarker = 'data-pda-tab="warehouse"'
const warehouseTabIndex = inboundHtml.indexOf(warehouseTabMarker)
assert.notEqual(warehouseTabIndex, -1, '裁片入仓页必须渲染仓管 Tab')
const warehouseTabStart = inboundHtml.lastIndexOf('<button', warehouseTabIndex)
const warehouseTabEnd = inboundHtml.indexOf('>', warehouseTabIndex)
const warehouseTabOpeningTag = inboundHtml.slice(warehouseTabStart, warehouseTabEnd + 1)
assert(
  warehouseTabOpeningTag.includes('text-primary'),
  '菲票装袋和中转袋入仓必须选中仓管 Tab',
)
assert(
  inboundHtml.includes(`data-nav="${CUTTING_WAIT_HANDOVER_ROOT}"`),
  '菲票装袋和中转袋入仓必须返回裁床待交出仓五入口根页',
)

const waitHandoverPage = await import('../src/pages/pda-warehouse-wait-handover.ts')
const renderCuttingRootContent = (
  waitHandoverPage as Record<string, unknown>
).renderPdaCuttingWaitHandoverRootContent
assert.equal(
  typeof renderCuttingRootContent,
  'function',
  '待交出仓必须导出可执行的裁床五入口根页内容渲染器',
)

const rootHtml = (renderCuttingRootContent as () => string)()
const actions = getPdaCuttingWaitHandoverActions()
assert.equal(
  (rootHtml.match(/data-pda-cutting-wait-handover-entry=/g) || []).length,
  5,
  '裁床待交出仓根页必须恰好渲染五个动作入口',
)
for (const action of actions) {
  assert.equal(
    rootHtml.split(action.title).length - 1,
    1,
    `裁床待交出仓根页必须恰好显示一次“${action.title}”`,
  )
  assert(
    rootHtml.includes(`data-nav="${action.route}"`),
    `裁床待交出仓根页动作“${action.title}”必须保留深链`,
  )
}
assert(rootHtml.includes('裁床待加工仓'), '裁床待交出仓根页必须保留仓库切换')
assert(!rootHtml.includes('交出装袋确认'), '裁床待交出仓根页不得渲染旧“交出装袋确认”内容')
assert(!rootHtml.includes('混装：'), '裁床待交出仓根页不得渲染旧混装信息')
assert(!rootHtml.includes('暂存袋'), '裁床待交出仓根页不得渲染具体袋卡')

console.log('[check-pda-cutting-wait-handover-entry-routing] 仓管导航、五入口根页与旧内容隔离检查通过')
