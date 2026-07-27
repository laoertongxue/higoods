import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const source = fs.readFileSync(path.join(ROOT, 'src/pages/pda-cutting-handover.ts'), 'utf8')
const CUTTING_WAIT_HANDOVER_ROOT = '/fcs/pda/warehouse/wait-handover?scope=cutting'
const CUTTING_TASK_ID = 'TASK-CUT-PDA-NO-PICKUP-0301'
const EXPECTED_ENTRIES = [
  {
    title: '菲票装袋',
    route: `/fcs/pda/cutting/inbound/${CUTTING_TASK_ID}`,
  },
  {
    title: '中转袋入仓',
    route: `/fcs/pda/cutting/inbound/${CUTTING_TASK_ID}?action=inbound-location`,
  },
  {
    title: '中转袋交出',
    route: `/fcs/pda/cutting/handover/${CUTTING_TASK_ID}?action=transfer-bag-handover`,
  },
  {
    title: '特殊工艺回仓',
    route: `/fcs/pda/cutting/handover/${CUTTING_TASK_ID}?action=special-craft-return`,
  },
  {
    title: '菲票打编号',
    route: '/fcs/pda/cutting/fei-ticket-numbering',
  },
] as const
const EXPECTED_LEGACY_REDIRECTS = [
  { action: 'inbound', target: EXPECTED_ENTRIES[0].route },
  { action: 'inbound-location', target: EXPECTED_ENTRIES[1].route },
  { action: 'handover-bagging-confirm', target: EXPECTED_ENTRIES[2].route },
  { action: 'special-craft-return', target: EXPECTED_ENTRIES[3].route },
  { action: 'numbering', target: EXPECTED_ENTRIES[4].route },
] as const

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

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window')
const originalLocalStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')
const storageValues = new Map<string, string>()
const testStorage = {
  getItem: (key: string) => storageValues.get(key) ?? null,
  setItem: (key: string, value: string) => storageValues.set(key, String(value)),
  removeItem: (key: string) => storageValues.delete(key),
  clear: () => storageValues.clear(),
}
const testLocation = {
  pathname: '/fcs/pda/warehouse/wait-handover',
  search: '?scope=cutting',
  href: `http://localhost${CUTTING_WAIT_HANDOVER_ROOT}`,
}

function updateTestLocation(route: string): void {
  const url = new URL(route, 'http://localhost')
  testLocation.pathname = url.pathname
  testLocation.search = url.search
  testLocation.href = url.href
}

const testWindow = {
  location: testLocation,
  localStorage: testStorage,
  history: {
    state: null,
    pushState: (_state: unknown, _title: string, route?: string | URL | null) => {
      if (route !== undefined && route !== null) updateTestLocation(String(route))
    },
    replaceState: (_state: unknown, _title: string, route?: string | URL | null) => {
      if (route !== undefined && route !== null) updateTestLocation(String(route))
    },
  },
  dispatchEvent: () => true,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  requestAnimationFrame: (callback: () => void) => {
    callback()
    return 0
  },
  setTimeout: () => 0,
}

function restoreGlobalProperty(
  property: 'window' | 'localStorage',
  descriptor: PropertyDescriptor | undefined,
): void {
  if (descriptor) {
    Object.defineProperty(globalThis, property, descriptor)
  } else {
    delete (globalThis as typeof globalThis & Record<string, unknown>)[property]
  }
}

Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  writable: true,
  value: testStorage,
})
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  writable: true,
  value: testWindow,
})

let restoreAppRoute: (() => void) | null = null
try {
  const pdaStore = await import('../src/data/fcs/store-domain-pda.ts')
  const { TEST_FACTORY_ID } = await import('../src/data/fcs/factory-mock-data.ts')
  const pdaUser = pdaStore
    .listAllFactoryPdaUsers()
    .find((user) => user.status === 'ACTIVE' && user.factoryId === TEST_FACTORY_ID)
  assert(pdaUser, '真实路由检查必须找到可登录的裁床工厂 PDA 用户')
  pdaStore.setPdaSession(pdaStore.createPdaSessionFromUser(pdaUser))
  assert(pdaStore.getPdaSession(), '真实路由检查必须建立有效 PDA 登录态')

  const { appStore } = await import('../src/state/store.ts')
  const initialAppRoute = appStore.getState().pathname
  restoreAppRoute = () => {
    updateTestLocation(initialAppRoute)
    appStore.syncFromBrowser(initialAppRoute)
  }
  const { renderPdaCuttingInboundPage } = await import('../src/pages/pda-cutting-inbound.ts')
  const { renderPdaWarehouseWaitHandoverPage } = await import('../src/pages/pda-warehouse-wait-handover.ts')

  const syncRoute = (route: string): void => {
    updateTestLocation(route)
    appStore.syncFromBrowser(route)
  }

  syncRoute(`/fcs/pda/cutting/inbound/${CUTTING_TASK_ID}`)
  const inboundHtml = renderPdaCuttingInboundPage(CUTTING_TASK_ID)
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

  syncRoute(CUTTING_WAIT_HANDOVER_ROOT)
  const rootHtml = renderPdaWarehouseWaitHandoverPage()
  assert.equal(
    (rootHtml.match(/data-pda-cutting-wait-handover-entry=/g) || []).length,
    5,
    '裁床待交出仓真实根路由必须恰好渲染五个动作入口',
  )
  for (const entry of EXPECTED_ENTRIES) {
    assert.equal(
      rootHtml.split(entry.title).length - 1,
      1,
      `裁床待交出仓真实根路由必须恰好显示一次“${entry.title}”`,
    )
    assert(
      rootHtml.includes(`data-nav="${entry.route}"`),
      `裁床待交出仓真实根路由动作“${entry.title}”必须使用固定深链`,
    )
  }
  assert(rootHtml.includes('裁床待加工仓'), '裁床待交出仓真实根路由必须保留仓库切换')
  for (const forbiddenText of ['候选袋', '交出装袋确认', '混装：', '暂存袋']) {
    assert(!rootHtml.includes(forbiddenText), `裁床待交出仓真实根路由不得渲染旧内容“${forbiddenText}”`)
  }

  for (const legacy of EXPECTED_LEGACY_REDIRECTS) {
    const legacyRoute = `${CUTTING_WAIT_HANDOVER_ROOT}&action=${legacy.action}`
    syncRoute(legacyRoute)
    const redirectHtml = renderPdaWarehouseWaitHandoverPage()
    assert(
      redirectHtml.includes('正在进入裁床操作'),
      `旧 action “${legacy.action}”必须通过真实页面渲染进入重定向占位页`,
    )
    await Promise.resolve()
    assert.equal(
      appStore.getState().pathname,
      legacy.target,
      `旧 action “${legacy.action}”必须重定向到固定目标`,
    )
    assert.equal(
      `${testLocation.pathname}${testLocation.search}`,
      legacy.target,
      `旧 action “${legacy.action}”必须同步浏览器地址`,
    )
  }
} finally {
  restoreAppRoute?.()
  restoreGlobalProperty('window', originalWindowDescriptor)
  restoreGlobalProperty('localStorage', originalLocalStorageDescriptor)
}

console.log('[check-pda-cutting-wait-handover-entry-routing] 真实路由仓管导航、五入口与 legacy 重定向检查通过')
