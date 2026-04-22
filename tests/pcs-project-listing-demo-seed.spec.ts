import assert from 'node:assert/strict'
import fs from 'node:fs'

import {
  getProjectNodeRecordByWorkItemTypeCode,
  listProjectNodes,
  listProjects,
  resetProjectRepository,
} from '../src/data/pcs-project-repository.ts'
import { renderPcsProjectListPage } from '../src/pages/pcs-projects.ts'

class MemoryStorage {
  #store = new Map<string, string>()

  getItem(key: string): string | null {
    return this.#store.has(key) ? this.#store.get(key)! : null
  }

  setItem(key: string, value: string): void {
    this.#store.set(key, value)
  }

  removeItem(key: string): void {
    this.#store.delete(key)
  }

  clear(): void {
    this.#store.clear()
  }
}

const demoSeedSource = fs.readFileSync(
  new URL('../src/data/pcs-project-demo-seed-service.ts', import.meta.url),
  'utf8',
)
const demoSeedVersion =
  demoSeedSource.match(/const DEMO_SEED_VERSION = '([^']+)'/)?.[1] ??
  '2026-04-22-listing-node-demo-project'

const originalStorage = (globalThis as { localStorage?: Storage }).localStorage
Object.defineProperty(globalThis, 'localStorage', {
  value: new MemoryStorage() as unknown as Storage,
  configurable: true,
  writable: true,
})
globalThis.localStorage.setItem('higood-pcs-project-demo-seed-version', demoSeedVersion)

resetProjectRepository()
const listPageHtml = await renderPcsProjectListPage()

assert.match(
  listPageHtml,
  /2026夏季印花短袖快反项目/,
  '商品项目列表页应能直接补出并显示商品上架节点演示项目',
)

const project = listProjects().find((item) => item.projectName === '2026夏季印花短袖快反项目')

assert.ok(project, '应存在一个当前处于商品上架节点的演示商品项目')

const listingNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'CHANNEL_PRODUCT_LISTING')
assert.ok(listingNode, '演示项目应存在商品上架节点')
assert.equal(listingNode!.currentStatus, '进行中', '演示项目当前应处于商品上架节点')

const completedNodeCodes = [
  'PROJECT_INIT',
  'SAMPLE_ACQUIRE',
  'FEASIBILITY_REVIEW',
  'SAMPLE_SHOOT_FIT',
  'SAMPLE_CONFIRM',
  'SAMPLE_COST_REVIEW',
  'SAMPLE_PRICING',
] as const

completedNodeCodes.forEach((workItemTypeCode) => {
  const node = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, workItemTypeCode)
  assert.ok(node, `${workItemTypeCode} 节点应存在`)
  assert.equal(node!.currentStatus, '已完成', `${workItemTypeCode} 节点应已完成`)
})

const nodes = listProjectNodes(project!.projectId).sort((left, right) => {
  if (left.phaseCode === right.phaseCode) return left.sequenceNo - right.sequenceNo
  return left.phaseCode.localeCompare(right.phaseCode)
})
const listingNodeIndex = nodes.findIndex((node) => node.workItemTypeCode === 'CHANNEL_PRODUCT_LISTING')

assert.ok(listingNodeIndex > 0, '商品上架节点前应存在前序节点')
assert.ok(
  nodes.slice(0, listingNodeIndex).every((node) => node.currentStatus === '已完成'),
  '商品上架节点之前的所有节点都应已补齐并完成',
)

Object.defineProperty(globalThis, 'localStorage', {
  value: originalStorage,
  configurable: true,
  writable: true,
})

console.log('pcs-project-listing-demo-seed.spec.ts PASS')
process.exit(0)
