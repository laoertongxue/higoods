import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const [phase, directory] = process.argv.slice(2)
if (!phase) {
  const isolated = mkdtempSync(join(tmpdir(), 'wool-final-refresh-'))
  try {
    for (const step of ['save', 'reload']) execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), step, isolated], { stdio: 'inherit' })
    console.log('PASS 最终接收跨全新模块初始化仍由原交出事实恢复；款图与SKU一致，未收批次仍待接收')
  } finally { rmSync(isolated, { recursive: true, force: true }) }
} else {
  const values = new Map<string, string>(phase === 'reload' ? JSON.parse(readFileSync(join(directory, 'storage.json'), 'utf8')) : [])
  const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: storage, sessionStorage: storage, addEventListener() {}, dispatchEvent() {}, location: { pathname: '/fcs/craft/wool/linking-orders', search: '' } } })
  // Node restart contract uses the explicit Node source adapter; real IDB refresh is covered by the browser E2E.
  // Do not masquerade as a DOM browser without providing IndexedDB.
  if (phase === 'save') {
    const { prepareWoolFinalDownstreamReviewScenario } = await import('./fixtures/wool-final-downstream-review.ts')
    const scene = await prepareWoolFinalDownstreamReviewScenario()
    const { executeProcessWebAction } = await import('../src/data/fcs/process-web-status-actions.ts')
    executeProcessWebAction({ sourceType: 'SPECIAL_CRAFT', sourceId: scene.taskId, actionCode: 'SPECIAL_CRAFT_CONFIRM_RECEIVE', operatorName: '刷新验收仓管', operatedAt: '2026-09-18 10:00:00', qtyUnit: '件', objectQty: 12, woolFinalReceipts: [{ handoverId: scene.handovers[0].handoverId, actualReceivedQty: 12 }], confirmationKey: 'refresh-final-1' })
    writeFileSync(join(directory, 'scene.json'), JSON.stringify(scene))
    writeFileSync(join(directory, 'storage.json'), JSON.stringify([...values]))
  } else {
    const scene = JSON.parse(readFileSync(join(directory, 'scene.json'), 'utf8'))
    const { getSpecialCraftTaskOrderById } = await import('../src/data/fcs/special-craft-task-orders.ts')
    const { readWoolStore } = await import('../src/data/fcs/wool-domain/store.ts')
    const { listFactoryWaitProcessStockItems } = await import('../src/data/fcs/factory-internal-warehouse.ts')
    const task = getSpecialCraftTaskOrderById(scene.taskId)
    assert.ok(task, '正常生成器必须从已存生产单重建相同任务身份')
    assert.equal(task.factoryId, scene.factoryId)
    assert.equal(task.receivedQty, 12)
    assert.equal(task.woolFinalReceipts?.find(row => row.handoverId === scene.handovers[1].handoverId)?.receivedQty, undefined)
    const order = readWoolStore().workOrders[scene.woolOrderId]
    assert.equal(order.styleImageUrl, scene.styleImageUrl)
    assert.equal(order.outputPlanLines[0].outputSkuCode, scene.skuCode)
    assert.equal(task.woolFinalReceipts?.[0].styleImageUrl, scene.styleImageUrl)
    assert.equal(listFactoryWaitProcessStockItems(scene.factoryId).find(row => row.stockItemId === `SC-WPS-${scene.taskId}`)?.availableQty, 12)
  }
}
