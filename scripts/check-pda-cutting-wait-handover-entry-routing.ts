import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const source = fs.readFileSync(path.join(ROOT, 'src/pages/pda-cutting-handover.ts'), 'utf8')

function assertContains(token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotContains(token: string, message: string): void {
  assert(!source.includes(token), message)
}

assertContains(
  "routeAction === 'handover-bagging-confirm' || routeAction === 'transfer-bag-handover'",
  '中转袋交出 action 必须明确复用现有交出装袋确认模式',
)
assertContains(
  "routeAction === 'transfer-bag-handover' ? '中转袋交出'",
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

console.log('[check-pda-cutting-wait-handover-entry-routing] 新 action 识别与返回根入口检查通过')
