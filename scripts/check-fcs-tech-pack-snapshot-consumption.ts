import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const fullPath = resolve(dir, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) return walk(fullPath)
    return [fullPath]
  })
}

function searchInSrc(keyword: string): string[] {
  return walk(resolve(repoRoot, 'src'))
    .filter((filePath) => filePath.endsWith('.ts'))
    .filter((filePath) => readFileSync(filePath, 'utf8').includes(keyword))
}

assert.equal(
  existsSync(resolve(repoRoot, 'src/data/pcs-technical-data-runtime-source.ts')),
  false,
  '旧的 spuCode 技术包兼容源文件必须删除',
)
assert.equal(
  existsSync(resolve(repoRoot, 'src/data/pcs-technical-data-entry-resolver.ts')),
  false,
  '旧的 spuCode 技术包入口解析器必须删除',
)

const routesSource = read('src/router/routes-fcs.ts')
assert.ok(!routesSource.includes('/fcs/tech-pack/([^/]+)'), 'FCS 路由中不得再存在 /fcs/tech-pack/:spuCode')
assert.ok(
  routesSource.includes('pattern: /^\\/fcs\\/production\\/orders\\/([^/]+)\\/tech-pack$/'),
  'FCS 路由中必须存在按生产单查看技术包快照的新入口',
)

;[
  'getCompatTechPackBySpuCode',
  'listTechnicalProcessEntriesBySpuCode',
  'resolveTechnicalSnapshotBySpuCode',
  'resolveTechnicalDataEntryBySpuCode',
].forEach((keyword) => {
  assert.deepEqual(searchInSrc(keyword), [], `src 目录中不得再残留旧兼容方法：${keyword}`)
})

const productionEventsSource = read('src/pages/production/events.ts')
assert.ok(productionEventsSource.includes('open-order-tech-pack-snapshot'), '生产页必须按生产单打开技术包快照')
assert.ok(!productionEventsSource.includes('/fcs/tech-pack/'), '生产页不得再打开旧的 FCS 技术包兼容路由')

const snapshotPageSource = read('src/pages/fcs-production-tech-pack-snapshot.ts')
assert.ok(snapshotPageSource.includes('技术包快照 - '), 'FCS 技术包快照页必须使用新的页面标题')
;['保存', '发布', '新增', '删除', '替换', '上传'].forEach((keyword) => {
  assert.ok(!snapshotPageSource.includes(keyword), `FCS 技术包快照页不得出现可编辑动作：${keyword}`)
})

;[
  'src/data/fcs/material-request-drafts.ts',
  'src/data/fcs/task-detail-rows.ts',
  'src/data/fcs/production-artifact-generation.ts',
  'src/data/fcs/cutting/generated-fei-tickets.ts',
  'src/domain/fcs-cutting-piece-truth/index.ts',
  'src/pages/process-factory/cutting/marker-piece-explosion.ts',
  'src/pages/process-factory/cutting/marker-spreading-model.ts',
].forEach((relativePath) => {
  const source = read(relativePath)
  assert.ok(source.includes('production-order-tech-pack-runtime'), `${relativePath} 必须改为从生产单快照访问器读取技术包`)
  assert.ok(!source.includes('pcs-technical-data-runtime-source'), `${relativePath} 不得再引用旧的 spuCode 兼容源`)
})

console.log('check-fcs-tech-pack-snapshot-consumption.ts PASS')
