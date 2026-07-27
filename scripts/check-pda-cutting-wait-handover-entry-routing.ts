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
  '路由检查不得直接导入待交出仓页面，必须经过 resolvePage 与 routes-pda',
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
  const { listPdaCuttingTaskSourceRecords } = await import('../src/data/fcs/cutting/pda-cutting-task-source.ts')
  const taskFixture = listPdaCuttingTaskSourceRecords().find(
    (record) => record.cutOrderNos.includes(CUTTING_FIXTURE_CUT_ORDER_NO),
  )
  assert(taskFixture, `真实路由检查必须找到裁片单 ${CUTTING_FIXTURE_CUT_ORDER_NO} 对应的任务`)
  const expectedEntries = buildExpectedEntries(taskFixture.taskId)
  const expectedLegacyRedirects = [
    { action: 'inbound', target: expectedEntries[0].route },
    { action: 'inbound-location', target: expectedEntries[1].route },
    { action: 'handover-bagging-confirm', target: expectedEntries[2].route },
    { action: 'special-craft-return', target: expectedEntries[3].route },
    { action: 'numbering', target: expectedEntries[4].route },
  ] as const
  const { resolvePage } = await import('../src/router/routes.ts')
  const { routes: pdaRoutes } = await import('../src/router/routes-pda.ts')
  const {
    getPdaCuttingWaitHandoverActions,
    resolvePdaCuttingWaitHandoverLegacyActionRoute,
  } = await import('../src/pages/pda-cutting-wait-handover-actions.ts')

  const syncRoute = (route: string): void => {
    updateTestLocation(route)
    appStore.syncFromBrowser(route)
  }

  const inboundRoute = expectedEntries[1].route
  const inboundPathname = new URL(inboundRoute, 'http://localhost').pathname
  const inboundMatch = pdaRoutes.dynamicRoutes
    .map((route) => route.pattern.exec(inboundPathname))
    .find((match): match is RegExpExecArray => Boolean(match))
  assert(
    inboundMatch,
    'routes-pda 必须使用真实动态路由接住中转袋入仓深链',
  )
  assert.equal(inboundMatch[1], taskFixture.taskId, 'routes-pda 动态路由必须完整传递裁床任务 ID')
  assert(
    inboundSource.includes("const pageTitle = mode === 'inbound-location' ? '中转袋入仓' : '菲票装袋'"),
    '中转袋入仓 query 模式必须保留独立标题',
  )
  assert(
    inboundSource.includes("backHref: '/fcs/pda/warehouse/wait-handover?scope=cutting'"),
    '菲票装袋和中转袋入仓必须返回裁床待交出仓五入口根页',
  )

  syncRoute('/fcs/pda')
  const pdaRouteHtml = await resolvePage('/fcs/pda')
  assert(pdaRouteHtml.includes('工厂端移动应用'), 'resolvePage 必须真实加载 routes-pda 并渲染 PDA 入口')

  assert(
    pdaRoutes.exactRoutes['/fcs/pda/warehouse/wait-handover'],
    'routes-pda 必须注册裁床待交出仓根路由',
  )
  assert(
    waitHandoverSource.includes('renderCuttingWaitHandoverActionCards(getPdaCuttingWaitHandoverActions())'),
    '裁床待交出仓根页必须直接使用生产五入口契约',
  )
  const actualEntries = getPdaCuttingWaitHandoverActions()
  assert.equal(
    actualEntries.length,
    5,
    '裁床待交出仓生产路由契约必须恰好提供五个动作入口',
  )
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
    '裁床待交出仓真实根路由必须接入生产 legacy 路由解析器',
  )
  assert(
    waitHandoverSource.includes("renderRouteRedirect(legacyActionRoute, '正在进入裁床操作')"),
    '裁床待交出仓真实根路由必须将 legacy action 渲染为跳转占位页',
  )
} finally {
  restoreAppRoute?.()
  restoreGlobalProperty('window', originalWindowDescriptor)
  restoreGlobalProperty('localStorage', originalLocalStorageDescriptor)
}

console.log('[check-pda-cutting-wait-handover-entry-routing] 真实路由仓管导航、五入口与 legacy 重定向检查通过')
