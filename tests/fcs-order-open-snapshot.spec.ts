import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const ordersSource = read('src/pages/production/orders-domain.ts')
const detailSource = read('src/pages/production/detail-domain.ts')
const eventsSource = read('src/pages/production/events.ts')

assert.ok(ordersSource.includes('open-order-tech-pack-snapshot'), '生产单列表必须提供查看技术包快照入口')
assert.ok(detailSource.includes('open-order-tech-pack-snapshot'), '生产单详情必须提供查看技术包快照入口')
assert.ok(eventsSource.includes("if (action === 'open-order-tech-pack-snapshot')"), '生产事件必须处理生产单技术包快照入口')
assert.ok(
  eventsSource.includes('/fcs/production/orders/${encodeURIComponent(productionOrderId)}/tech-pack'),
  '生产单技术包入口必须按 productionOrderId 打开新快照页',
)
assert.ok(!ordersSource.includes('data-prod-action="open-tech-pack"'), '生产单列表不应再保留旧的 spuCode 技术包入口')
assert.ok(!detailSource.includes('data-prod-action="open-tech-pack"'), '生产单详情不应再保留旧的 spuCode 技术包入口')

console.log('fcs-order-open-snapshot.spec.ts PASS')
