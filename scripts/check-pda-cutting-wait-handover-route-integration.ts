import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const fastCheckSource = fs.readFileSync(
  path.join(ROOT, 'scripts/check-pda-cutting-wait-handover-entry-routing.ts'),
  'utf8',
)
const integrationCheckSource = fs.readFileSync(fileURLToPath(import.meta.url), 'utf8')
const deliveryCheckSource = fs.readFileSync(path.join(ROOT, 'scripts/check-cutting-p2-delivery.ts'), 'utf8')
const packageJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>
}

assert(
  !fastCheckSource.includes('resolvePage'),
  '快速检查不得执行页面渲染；真实 resolvePage 覆盖必须由集成检查承担',
)
assert.equal(
  packageJson.scripts['check:pda-cutting-wait-handover-route-integration'],
  'tsx scripts/check-pda-cutting-wait-handover-route-integration.ts',
  'package.json 必须注册真实路由集成检查',
)
assert(
  !packageJson.scripts['check:cutting:all'].includes('check:pda-cutting-wait-handover-route-integration'),
  '真实路由集成检查耗时较长，不得加入 check:cutting:all',
)
const releaseSequenceStart = deliveryCheckSource.indexOf('const RELEASE_READINESS_SCRIPTS = [')
const releaseSequenceEnd = deliveryCheckSource.indexOf('] as const', releaseSequenceStart)
assert.notEqual(releaseSequenceStart, -1, 'release 自检必须声明有序 RELEASE_READINESS_SCRIPTS')
assert.notEqual(releaseSequenceEnd, -1, 'release 自检必须完整声明 RELEASE_READINESS_SCRIPTS')
const releaseSequenceSource = deliveryCheckSource.slice(releaseSequenceStart, releaseSequenceEnd)
const releaseIntegrationIndex = releaseSequenceSource.indexOf("'check:pda-cutting-wait-handover-route-integration'")
const releaseAllIndex = releaseSequenceSource.indexOf("'check:cutting:all'")
assert.notEqual(releaseIntegrationIndex, -1, 'release 自检必须引用真实路由集成检查')
assert(
  releaseAllIndex > releaseIntegrationIndex,
  'release 自检必须先运行真实路由集成检查，再运行日常 cutting 聚合',
)
const releaseReadinessInvocationIndex = deliveryCheckSource.indexOf('  runReleaseReadiness()')
const deliveryCoverageIndex = deliveryCheckSource.indexOf('  const cuttingScripts =')
assert(
  releaseReadinessInvocationIndex > 0 && releaseReadinessInvocationIndex < deliveryCoverageIndex,
  'release 必须在其他交付卫生门禁前执行真实路由集成与 cutting 聚合',
)
const singleMicrotaskWaitToken = ['await Promise', '.resolve()'].join('')
assert(
  !integrationCheckSource.includes(singleMicrotaskWaitToken),
  'legacy 重定向不得只等待一个微任务，必须使用有界条件等待',
)

const CUTTING_WAIT_HANDOVER_ROOT = '/fcs/pda/warehouse/wait-handover?scope=cutting'
const CUTTING_FIXTURE_CUT_ORDER_NO = 'CUT-260304-008-01'

function buildExpectedEntries(taskId: string) {
  return [
    {
      title: '菲票装袋',
      route: `/fcs/pda/cutting/inbound/${taskId}`,
      markers: ['菲票装袋', '2 扫菲票', '确认装袋'],
    },
    {
      title: '中转袋入仓',
      route: `/fcs/pda/cutting/inbound/${taskId}?action=inbound-location`,
      markers: ['中转袋入仓', '2 扫库区库位', '确认入仓'],
    },
    {
      title: '拆袋重装',
      route: '/fcs/pda/cutting/transfer-bag/repack',
      markers: ['拆袋重装', '1 扫中转袋', '确认重装'],
    },
    {
      title: '中转袋交出',
      route: `/fcs/pda/cutting/handover/${taskId}?action=transfer-bag-handover`,
      markers: ['中转袋交出', '2 扫车缝任务', '确认交出'],
    },
    {
      title: '中转袋回收',
      route: '/fcs/pda/cutting/transfer-bag/recovery',
      markers: ['中转袋回收', '1 扫中转袋', '确认回收'],
    },
    {
      title: '中转袋报废',
      route: '/fcs/pda/cutting/transfer-bag/scrap',
      markers: ['中转袋报废', '1 扫中转袋', '确认报废'],
    },
  ] as const
}

const LEGACY_REDIRECT_MAX_ATTEMPTS = 8

async function waitForLegacyRedirectTarget(
  expectedRoute: string,
  getAppRoute: () => string,
): Promise<void> {
  let browserRoute = `${testLocation.pathname}${testLocation.search}`
  let appRoute = getAppRoute()

  for (let attempt = 1; attempt <= LEGACY_REDIRECT_MAX_ATTEMPTS; attempt += 1) {
    browserRoute = `${testLocation.pathname}${testLocation.search}`
    appRoute = getAppRoute()
    if (browserRoute === expectedRoute && appRoute === expectedRoute) return
    if (attempt < LEGACY_REDIRECT_MAX_ATTEMPTS) {
      await new Promise<void>((resolve) => queueMicrotask(resolve))
    }
  }

  assert.fail(
    `legacy 重定向等待超限：预期=${expectedRoute}；浏览器当前=${browserRoute}；应用当前=${appRoute}`,
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
let restorePdaSession: (() => void) | null = null
try {
  const pdaStore = await import('../src/data/fcs/store-domain-pda.ts')
  const initialPdaSession = pdaStore.getPdaSession()
  restorePdaSession = () => pdaStore.setPdaSession(initialPdaSession)

  const { TEST_FACTORY_ID } = await import('../src/data/fcs/factory-mock-data.ts')
  const pdaUser = pdaStore
    .listAllFactoryPdaUsers()
    .find((user) => user.status === 'ACTIVE' && user.factoryId === TEST_FACTORY_ID)
  assert(pdaUser, '真实路由集成检查必须找到可登录的裁床工厂 PDA 用户')
  pdaStore.setPdaSession(pdaStore.createPdaSessionFromUser(pdaUser))
  assert(pdaStore.getPdaSession(), '真实路由集成检查必须建立有效 PDA 登录态')

  const { appStore } = await import('../src/state/store.ts')
  const initialAppRoute = appStore.getState().pathname
  restoreAppRoute = () => {
    updateTestLocation(initialAppRoute)
    appStore.syncFromBrowser(initialAppRoute)
  }
  const syncRoute = (route: string): void => {
    updateTestLocation(route)
    appStore.syncFromBrowser(route)
  }

  const { listPdaCuttingTaskSourceRecords } = await import('../src/data/fcs/cutting/pda-cutting-task-source.ts')
  const taskFixture = listPdaCuttingTaskSourceRecords().find(
    (record) => record.cutOrderNos.includes(CUTTING_FIXTURE_CUT_ORDER_NO),
  )
  assert(taskFixture, `真实路由集成检查必须找到裁片单 ${CUTTING_FIXTURE_CUT_ORDER_NO} 对应的任务`)
  const expectedEntries = buildExpectedEntries(taskFixture.taskId)
  const expectedLegacyRedirects = [
    { action: 'inbound', target: expectedEntries[0] },
    { action: 'inbound-location', target: expectedEntries[1] },
    { action: 'handover-bagging-confirm', target: expectedEntries[3] },
    { action: 'special-craft-return', target: expectedEntries[1] },
    {
      action: 'numbering',
      target: {
        title: '菲票打编号',
        route: '/fcs/pda/cutting/fei-ticket-numbering',
        markers: ['菲票打编号', '菲票号 / 二维码', '完成打编号'],
      },
    },
  ] as const
  const { resolvePage } = await import('../src/router/routes.ts')

  syncRoute(CUTTING_WAIT_HANDOVER_ROOT)
  const rootHtml = await resolvePage(CUTTING_WAIT_HANDOVER_ROOT)
  assert.equal(
    (rootHtml.match(/data-pda-cutting-wait-handover-entry=/g) || []).length,
    6,
    '裁床待交出仓真实根路由必须恰好渲染六个动作入口',
  )
  for (const entry of expectedEntries) {
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
  for (const forbiddenText of ['候选袋', '交出装袋确认', '混装：', '暂存袋']) {
    assert(!rootHtml.includes(forbiddenText), `裁床待交出仓真实根路由不得渲染旧内容“${forbiddenText}”`)
  }

  for (const entry of expectedEntries) {
    syncRoute(entry.route)
    const pageHtml = await resolvePage(entry.route)
    for (const marker of entry.markers) {
      assert(pageHtml.includes(marker), `新深链“${entry.title}”必须通过 resolvePage 渲染关键内容“${marker}”`)
    }
  }

  for (const legacy of expectedLegacyRedirects) {
    const legacyRoute = `${CUTTING_WAIT_HANDOVER_ROOT}&action=${legacy.action}`
    syncRoute(legacyRoute)
    const redirectHtml = await resolvePage(legacyRoute)
    assert(
      redirectHtml.includes('正在进入裁床操作'),
      `旧 action “${legacy.action}”必须通过 resolvePage 渲染重定向占位页`,
    )
    await waitForLegacyRedirectTarget(legacy.target.route, () => appStore.getState().pathname)

    syncRoute(legacy.target.route)
    const targetHtml = await resolvePage(legacy.target.route)
    for (const marker of legacy.target.markers) {
      assert(
        targetHtml.includes(marker),
        `旧 action “${legacy.action}”的目标地址必须可渲染关键内容“${marker}”`,
      )
    }
  }
} finally {
  try {
    restoreAppRoute?.()
  } finally {
    try {
      restorePdaSession?.()
    } finally {
      restoreGlobalProperty('window', originalWindowDescriptor)
      restoreGlobalProperty('localStorage', originalLocalStorageDescriptor)
    }
  }
}

console.log('[check-pda-cutting-wait-handover-route-integration] 根路由、新深链与 legacy 真实路由集成检查通过')
