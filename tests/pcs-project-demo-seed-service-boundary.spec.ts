import assert from 'node:assert/strict'
import fs from 'node:fs'

import { ensurePcsProjectDemoDataReady } from '../src/data/pcs-project-demo-seed-service.ts'
import { listProjects, resetProjectRepository } from '../src/data/pcs-project-repository.ts'

resetProjectRepository()

const projectPageSource = fs.readFileSync(new URL('../src/pages/pcs-projects.ts', import.meta.url), 'utf8')
const demoSeedServiceSource = fs.readFileSync(
  new URL('../src/data/pcs-project-demo-seed-service.ts', import.meta.url),
  'utf8',
)
const linkedPageSources = [
  '../src/pages/pcs-live-testing.ts',
  '../src/pages/pcs-product-archives.ts',
  '../src/pages/pcs-projects.ts',
  '../src/pages/pcs-sample-application.ts',
  '../src/pages/pcs-video-testing.ts',
  '../src/pages/pcs-sample-inventory.ts',
  '../src/pages/pcs-sample-ledger.ts',
  '../src/pages/pcs-sample-return.ts',
  '../src/pages/pcs-sample-transfer.ts',
  '../src/pages/pcs-sample-view.ts',
].map((ref) => fs.readFileSync(new URL(ref, import.meta.url), 'utf8'))

assert.ok(!projectPageSource.includes('function buildDemoDraft('), '项目页不应继续持有 demo 草稿构造函数')
assert.ok(!projectPageSource.includes('function upsertDemoRelation('), '项目页不应继续持有 demo 关系写入函数')
assert.ok(!projectPageSource.includes('function seedNodeStatus('), '项目页不应继续持有节点补数逻辑')
assert.ok(!projectPageSource.includes('function ensureProjectDemoData('), '项目页不应继续持有演示数据初始化逻辑')
assert.ok(
  demoSeedServiceSource.includes('export function ensurePcsProjectDemoDataReady()'),
  '演示数据初始化入口应迁移到独立数据服务',
)
linkedPageSources.forEach((source) => {
  assert.ok(
    source.includes("../data/pcs-project-demo-seed-service.ts"),
    '依赖演示项目数据的 PCS 页面应改为引用独立数据服务',
  )
})

ensurePcsProjectDemoDataReady()

assert.ok(
  listProjects().some((project) => project.projectName.includes('双渠道归档项目')),
  '独立演示数据服务应能完成项目演示数据注入',
)

console.log('pcs-project-demo-seed-service-boundary.spec.ts PASS')
