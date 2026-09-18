import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'

// Isolated module graphs and memory-only storage: no browser or user data is touched.
const root = process.cwd()
const prefix = 'higood-fcs-post-finishing-'
const keys = {
  state: `${prefix}full-flow-v1`, mode: `${prefix}demo-mode-v1`,
  logs: `${prefix}full-flow-operation-logs-v1`, numbers: `${prefix}document-numbering-v1`,
  authorization: `${prefix}authorization-consumptions-v1`, references: `${prefix}qc-reference-v1`,
}
const retiredKey = `${prefix}outbound-migration-v2`
const sourcePath = resolve(root, 'src/data/fcs/post-finishing-full-flow.ts')
const source = await readFile(sourcePath, 'utf8')
const entry = `
  import * as flow from './src/data/fcs/post-finishing-full-flow.ts';
  import * as logs from './src/data/fcs/post-finishing-operation-log.ts';
  import * as numbers from './src/data/fcs/post-finishing-document-numbering.ts';
  import * as authorization from './src/data/fcs/post-finishing-authorization.ts';
  import * as references from './src/data/fcs/post-finishing-qc-reference.ts';
  export { flow, logs, numbers, authorization, references };
`
async function compile(baseline: boolean) {
  const marker = 'export function loadPostFinishingDemoData(): void {'
  const end = 'function populatePostFinishingDemoData(): void {'
  assert(source.includes(marker) && source.includes(end), '基线必须保留同一固定数据生成函数')
  // Restore the former immediate-save loader around the exact same command body.
  const baselineSource = source.slice(0, source.indexOf(marker)) + `${marker}
    resetPostFinishingFullFlow()
    setPostFinishingDemoBootstrapEnabled(true)
    populatePostFinishingDemoData()
  }
  ` + source.slice(source.indexOf(end))
  const result = await build({
    stdin: { contents: entry, resolveDir: root, loader: 'ts' }, bundle: true, write: false,
    platform: 'node', format: 'iife', globalName: 'demoApi', logLevel: 'silent',
    plugins: [{ name: 'fixed-demo-baseline', setup(plugin) {
      plugin.onLoad({ filter: /post-finishing-full-flow\.ts$/ }, (args) =>
        args.path === sourcePath ? { contents: baseline ? baselineSource : source, loader: 'ts' } : undefined)
    } }],
  })
  return result.outputFiles[0].text
}
const baselineCode = await compile(true)
const batchedCode = await compile(false)
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value))
const fixedNow = Date.parse('2026-09-18T12:00:00.000Z')
class FixedDate extends Date {
  constructor(value?: string | number) { super(value ?? fixedNow) }
  static now() { return fixedNow }
}
function runtime(code: string, initial: Record<string, string> = {}) {
  const values = new Map(Object.entries({ [retiredKey]: 'retired', ...initial }))
  const writes: string[] = []
  let failureKey = ''
  let failuresLeft = 0
  const fail = (key: string) => {
    if (key === failureKey && failuresLeft > 0) { failuresLeft--; throw new Error(`injected storage failure: ${key}`) }
  }
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem(key: string, value: string) { fail(key); writes.push(`set:${key}`); values.set(key, value) },
    removeItem(key: string) { fail(key); writes.push(`remove:${key}`); values.delete(key) },
  }
  const context: Record<string, any> = {
    console, Date: FixedDate, structuredClone, localStorage: storage,
    document: { addEventListener() {}, visibilityState: 'visible' },
    window: { localStorage: storage, addEventListener() {}, location: { pathname: '/fcs/craft/wool/knitting-orders', search: '' } },
  }
  runInNewContext(code, context)
  return {
    api: context.demoApi, values, writes,
    failOnce(key: string) { failureKey = key; failuresLeft = 1 },
    saved() { return Object.fromEntries(Object.values(keys).map(key => [key, values.get(key) ?? null])) },
  }
}
function facts(instance: ReturnType<typeof runtime>) {
  const { flow, logs, numbers, authorization, references } = instance.api
  return plain({
    deliveries: flow.listPostFinishingFactoryReturns(),
    waitProcess: flow.listPostFinishingWaitProcessWarehouseRecords(),
    waitProcessFlows: flow.listPostFinishingWaitProcessWarehouseMovements(),
    waitHandover: flow.listPostFinishingWaitHandoverWarehouseRecords(),
    waitHandoverFlows: flow.listPostFinishingWaitHandoverWarehouseMovements(),
    qc: flow.listPostFinishingFullFlowQcTasks(), post: flow.listPostFinishingFullFlowPostTasks(),
    recheck: flow.listPostFinishingFullFlowRecheckOrders(), outbound: flow.listPostFinishingFullFlowOutboundOrders(),
    receipts: flow.listPostFinishingWarehouseReceipts(), defects: flow.listPostFinishingDefectRecords(),
    logs: logs.listPostFinishingOperationLogs(), numbers: numbers.listPostFinishingDocumentNumberRecords(),
    authorization: authorization.listPostFinishingAuthorizationConsumptions(), references: references.listPostFinishingQcReferences(),
  })
}
let checks = 0
function check(name: string, verify: () => void) { verify(); checks++; console.log(`✓ ${name}`) }
const baseline = runtime(baselineCode, { [keys.mode]: 'empty' })
baseline.writes.length = 0
baseline.api.flow.loadPostFinishingDemoData()
const expectedFacts = facts(baseline)
const expectedStorage = baseline.saved()
const batched = runtime(batchedCode, { [keys.mode]: 'empty' })
batched.writes.length = 0
batched.api.flow.loadPostFinishingDemoData()
check('固定15批、75个SKU明细以及所有数量、日志、单号、仓储事实与原即时保存基线深相等', () => {
  assert.equal(expectedFacts.deliveries.length, 15)
  assert.equal(expectedFacts.deliveries.reduce((sum: number, row: any) => sum + row.lines.length, 0), 75)
  assert.deepEqual(facts(batched), expectedFacts)
  assert.deepEqual(batched.saved(), expectedStorage)
})
check('每次初始化主状态、操作日志、编号各仅保存一次，授权与参考资料保持原清空语义', () => {
  for (const key of [keys.state, keys.logs, keys.numbers]) {
    assert(baseline.writes.filter(write => write === `set:${key}`).length > 1)
    assert.equal(batched.writes.filter(write => write === `set:${key}`).length, 1)
  }
  for (const key of [keys.authorization, keys.references]) assert.equal(batched.writes.filter(write => write === `remove:${key}`).length, 1)
})
check('首次无历史自动初始化仍生成相同完整事实，一次保存', () => {
  const initial = runtime(batchedCode)
  assert.deepEqual(facts(initial), expectedFacts)
  assert.deepEqual(initial.saved(), expectedStorage)
  assert.equal(initial.writes.filter(write => write === `set:${keys.state}`).length, 1)
})

const historical = Object.fromEntries(Object.entries(expectedStorage).filter((entry): entry is [string, string] => entry[1] !== null))
historical[keys.mode] = 'empty'
// Deliberately differ from the fresh demo: a rollback must restore old facts,
// not merely regenerate identical seeds and accidentally satisfy equality.
const historicalState = JSON.parse(historical[keys.state])
historicalState.deliveries[0].deliveryPersonName = '必须保留的历史送货人'
historical[keys.state] = JSON.stringify(historicalState)
const historicalLogs = JSON.parse(historical[keys.logs])
historicalLogs[0].remark = '必须保留的历史操作说明'
historical[keys.logs] = JSON.stringify(historicalLogs)
const historicalNumbers = JSON.parse(historical[keys.numbers])
historicalNumbers[0].createdAt = '2026-08-01T00:00:00.000Z'
historical[keys.numbers] = JSON.stringify(historicalNumbers)
historical[keys.authorization] = JSON.stringify([{ authorizationId: 'EXISTING-AUTH', tokenFingerprint: 'keep', consumedAt: '2026-09-01T00:00:00Z' }])
historical[keys.references] = JSON.stringify([{ referenceId: 'EXISTING-REF', deliveryId: 'EXISTING', title: '保留历史', uploadedAt: '2026-09-01T00:00:00Z' }])
for (const key of Object.values(keys)) {
  check(`保存 ${key} 失败完整恢复五组事实与原存储，随后可重试`, () => {
    const instance = runtime(batchedCode, historical)
    const beforeFacts = facts(instance), beforeStorage = instance.saved()
    instance.failOnce(key)
    assert.throws(() => instance.api.flow.loadPostFinishingDemoData(), /injected storage failure/)
    assert.deepEqual(facts(instance), beforeFacts)
    assert.deepEqual(instance.saved(), beforeStorage)
    instance.api.flow.loadPostFinishingDemoData()
    assert.deepEqual(facts(instance), expectedFacts)
    assert.deepEqual(instance.saved(), expectedStorage)
  })
}
check('生成中途异常不产生任何部分保存，恢复所有事实与守卫', () => {
  const instance = runtime(batchedCode, historical)
  const beforeFacts = facts(instance), beforeStorage = instance.saved()
  const order = instance.api.flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[1]
  const descriptor = Object.getOwnPropertyDescriptor(order, 'skus')!
  Object.defineProperty(order, 'skus', { configurable: true, get() { throw new Error('injected generation failure after first order') } })
  instance.writes.length = 0
  assert.throws(() => instance.api.flow.loadPostFinishingDemoData(), /injected generation failure/)
  Object.defineProperty(order, 'skus', descriptor)
  assert.deepEqual(facts(instance), beforeFacts)
  assert.deepEqual(instance.saved(), beforeStorage)
  assert.equal(instance.writes.length, 0)
  instance.api.flow.loadPostFinishingDemoData()
  assert.deepEqual(facts(instance), expectedFacts)
})
check('普通登记操作在返回前即时保存主状态、日志和编号', () => {
  const { flow } = batched.api
  const order = flow.POST_FINISHING_ACCEPTANCE_PRODUCTION_ORDERS[0]
  flow.resetPostFinishingFullFlow()
  batched.writes.length = 0
  const delivery = flow.registerPostFinishingFactoryReturn({
    productionOrderNo: order.productionOrderNo, returnIndex: 6, triggerSource: '车缝正常交出', idempotencyKey: 'ORDINARY-AFTER-BATCH',
    quantities: order.skus.map((sku: any) => ({ skuId: sku.skuId, registeredQty: 1 })),
    deliveryPersonName: '专项验证', deliveryPersonPhone: '', evidenceImageUrls: [order.skus[0].imageUrl],
    actor: flow.POST_FINISHING_ACCEPTANCE_ACTORS.factoryCourier, nowMs: fixedNow,
  })
  for (const key of [keys.state, keys.logs, keys.numbers]) assert.equal(batched.writes.filter(write => write === `set:${key}`).length, 1)
  assert(JSON.parse(batched.values.get(keys.state)!).deliveries.some((row: any) => row.deliveryId === delivery.deliveryId))
})
check('已有当前空回货库及其QC历史不会触发默认演示覆盖', () => {
  const empty = JSON.parse(expectedStorage[keys.state]!)
  for (const key of Object.keys(empty)) if (Array.isArray(empty[key]) && key !== 'qcTasks') empty[key] = []
  empty.qcTasks = [empty.qcTasks[0]]
  const raw = JSON.stringify(empty)
  const instance = runtime(batchedCode, { ...historical, [keys.state]: raw, [keys.mode]: 'demo' })
  assert.equal(instance.api.flow.listPostFinishingFactoryReturns().length, 0)
  assert.equal(instance.api.flow.listPostFinishingFullFlowQcTasks().length, 1)
  assert.equal(instance.values.get(keys.state), raw)
  assert.equal(instance.writes.filter(write => Object.values(keys).some(key => write.endsWith(`:${key}`))).length, 0)
})
check('已有旧版空回货库只做既有迁移，不生成演示15批', () => {
  const instance = runtime(batchedCode, { [keys.state]: JSON.stringify({ deliveries: [], qcTasks: [] }), [keys.mode]: 'demo' })
  assert.equal(instance.api.flow.listPostFinishingFactoryReturns().length, 0)
  assert.equal(JSON.parse(instance.values.get(keys.state)!).schemaVersion, 2)
  assert.equal(instance.writes.filter(write => write === `set:${keys.state}`).length, 1)
  assert.equal(instance.values.has(keys.logs), false)
})
console.log(JSON.stringify({ baselineWrites: Object.fromEntries([keys.state, keys.logs, keys.numbers].map(key => [key, baseline.writes.filter(write => write === `set:${key}`).length])), batchedWritesPerKey: 1 }))
console.log(`PASS ${checks} post-finishing demo batch checks; no browser/performance claim.`)
