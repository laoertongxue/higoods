import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string): string {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const contextSource = read('src/pages/production/context.ts')
const demandDomainSource = read('src/pages/production/demand-domain.ts')
const eventsSource = read('src/pages/production/events.ts')

assert.ok(contextSource.includes('查看当前生效技术包'), '需求页按钮文案必须固定为查看当前生效技术包')
assert.ok(
  demandDomainSource.includes("techPackAction: 'open-current-tech-pack-from-demand-detail'"),
  '需求详情中的技术包入口必须使用 PCS 当前生效版本动作',
)
assert.ok(eventsSource.includes("if (action === 'open-current-tech-pack')"), '生产事件必须支持需求页打开当前生效技术包')
assert.ok(
  eventsSource.includes('/pcs/products/styles/${encodeURIComponent(info.styleId)}/technical-data/${encodeURIComponent(info.currentTechPackVersionId)}'),
  '需求页必须打开 PCS 当前生效技术包版本页',
)
assert.ok(!eventsSource.includes('/fcs/tech-pack/'), '需求页不得再打开旧的 FCS 技术包兼容页')
assert.ok(!eventsSource.includes('resolveTechnicalDataEntryBySpuCode'), '需求页不得再依赖旧的 spuCode 入口解析器')

console.log('fcs-demand-open-pcs-tech-pack.spec.ts PASS')
