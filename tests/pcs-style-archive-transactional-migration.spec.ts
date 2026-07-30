import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const workspace = process.cwd()

function runScenario(name: string, source: string): void {
  const directory = mkdtempSync(join(tmpdir(), `pcs-style-transaction-${name}-`))
  const scenarioPath = join(directory, `${name}.ts`)
  writeFileSync(scenarioPath, source)
  const result = spawnSync(process.execPath, [
    '--experimental-strip-types',
    '--experimental-specifier-resolution=node',
    scenarioPath,
  ], {
    cwd: workspace,
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, `${name} failed:\n${result.stdout}\n${result.stderr}`)
}

const common = `
import assert from 'node:assert/strict'
import { createBootstrapProjectSnapshot } from '${workspace}/src/data/pcs-project-bootstrap.ts'
import { createStyleArchiveBootstrapSnapshot } from '${workspace}/src/data/pcs-style-archive-bootstrap.ts'
class MemoryStorage {
  values = new Map()
  writes = new Map()
  failures = new Map()
  getItem(key) { return this.values.get(key) ?? null }
  setItem(key, value) {
    const remainingFailures = this.failures.get(key) || 0
    if (remainingFailures > 0) {
      this.failures.set(key, remainingFailures - 1)
      throw new Error('fault:' + key)
    }
    this.values.set(key, value)
    this.writes.set(key, (this.writes.get(key) || 0) + 1)
  }
  removeItem(key) { this.values.delete(key) }
  writeCount(key) { return this.writes.get(key) || 0 }
  resetWrites() { this.writes.clear() }
  failNextWrite(key) { this.failures.set(key, 1) }
  disableFailures() { this.failures.clear() }
}
const PROJECT_KEY = 'higood-pcs-project-store-v4-demo'
const STYLE_KEY = 'higood-pcs-style-archive-store-v3'
const storage = new MemoryStorage()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage })
const projects = createBootstrapProjectSnapshot(4)
const styleSeed = createStyleArchiveBootstrapSnapshot(3)
const project = projects.projects[0]
const projectInitNode = projects.nodes.find((node) => node.projectId === project.projectId && node.stepCode === 'PROJECT_INIT')
`

runScenario('duplicate-id-preserved', `${common}
const duplicateA = { ...styleSeed.records[0], styleId: 'duplicate-style-id', remark: 'A记录不可丢', updatedAt: '2026-01-01 10:00' }
const duplicateB = { ...styleSeed.records[1], styleId: 'duplicate-style-id', remark: 'B记录不可丢', updatedAt: '2026-02-01 10:00' }
const raw = JSON.stringify({ version: 3, records: [duplicateA, duplicateB], pendingItems: [] })
storage.setItem(STYLE_KEY, raw)
storage.resetWrites()
const repository = await import('${workspace}/src/data/pcs-style-archive-repository.ts')
assert.throws(() => repository.listStyleArchives(), /重复|冲突|duplicate-style-id/)
assert.equal(storage.getItem(STYLE_KEY), raw)
assert.equal(storage.writeCount(STYLE_KEY), 0)
`)

runScenario('failure-is-atomic', `${common}
const targetStyleId = 'style-atomic-target'
const historicalProject = { ...project, linkedStyleId: targetStyleId }
storage.setItem(PROJECT_KEY, JSON.stringify({ ...projects, projects: [historicalProject, ...projects.projects.slice(1)] }))
const target = { ...styleSeed.records[0], styleId: targetStyleId, sourceProjectId: '', sourceProjectCode: '', sourceProjectName: '', sourceProjectNodeId: '' }
const oldA = { ...styleSeed.records[1], styleId: 'style-old-a', sourceProjectId: project.projectId, sourceProjectCode: project.projectCode, sourceProjectName: project.projectName, remark: '旧主档A' }
const oldB = { ...styleSeed.records[2], styleId: 'style-old-b', sourceProjectId: project.projectId, sourceProjectCode: project.projectCode, sourceProjectName: project.projectName, remark: '旧主档B' }
const raw = JSON.stringify({ version: 3, records: [target, oldA, oldB], pendingItems: [] })
storage.setItem(STYLE_KEY, raw)
storage.resetWrites()
const projectRepository = await import('${workspace}/src/data/pcs-project-repository.ts')
assert.throws(() => projectRepository.getProjectById(project.projectId), /多个|冲突|主档/)
assert.equal(storage.getItem(STYLE_KEY), raw)
assert.equal(storage.writeCount(STYLE_KEY), 0)
`)

runScenario('success-once-idempotent', `${common}
const targetStyleId = 'style-atomic-success'
const historicalProject = { ...project, linkedStyleId: targetStyleId }
storage.setItem(PROJECT_KEY, JSON.stringify({ ...projects, projects: [historicalProject, ...projects.projects.slice(1)] }))
const target = { ...styleSeed.records[0], styleId: targetStyleId, sourceProjectId: '', sourceProjectCode: 'WRONG', sourceProjectName: '错误项目', sourceProjectNodeId: 'removed-node', remark: '业务字段保留' }
const raw = JSON.stringify({ version: 3, records: [target], pendingItems: [] })
storage.setItem(STYLE_KEY, raw)
storage.resetWrites()
const projectRepository = await import('${workspace}/src/data/pcs-project-repository.ts')
const styleRepository = await import('${workspace}/src/data/pcs-style-archive-repository.ts')
assert.ok(projectRepository.getProjectById(project.projectId))
assert.equal(storage.writeCount(STYLE_KEY), 1)
assert.equal(storage.writeCount(PROJECT_KEY), 1)
const migrated = styleRepository.getStyleArchiveById(targetStyleId)
assert.equal(migrated.sourceProjectId, project.projectId)
assert.equal(migrated.sourceProjectNodeId, projectInitNode.projectNodeId)
assert.equal(migrated.remark, '业务字段保留')
const persistedAfterFirst = storage.getItem(STYLE_KEY)
assert.ok(projectRepository.getProjectById(project.projectId))
assert.equal(storage.writeCount(STYLE_KEY), 1)
assert.equal(storage.writeCount(PROJECT_KEY), 1)
assert.equal(storage.getItem(STYLE_KEY), persistedAfterFirst)
`)

runScenario('style-write-failure-rolls-back-both-repositories', `${common}
const targetStyleId = 'style-fault-target'
const historicalProject = { ...project, linkedStyleId: targetStyleId }
const projectRaw = JSON.stringify({ ...projects, projects: [historicalProject, ...projects.projects.slice(1)] })
const target = { ...styleSeed.records[0], styleId: targetStyleId, sourceProjectId: '', sourceProjectCode: 'WRONG', sourceProjectName: '错误项目', sourceProjectNodeId: 'removed-node' }
const styleRaw = JSON.stringify({ version: 3, records: [target], pendingItems: [] })
storage.setItem(PROJECT_KEY, projectRaw)
storage.setItem(STYLE_KEY, styleRaw)
storage.resetWrites()
storage.failNextWrite(STYLE_KEY)
const projectRepository = await import('${workspace}/src/data/pcs-project-repository.ts')
assert.throws(() => projectRepository.getProjectById(project.projectId), /fault:higood-pcs-style-archive-store-v3/)
assert.equal(storage.getItem(PROJECT_KEY), projectRaw)
assert.equal(storage.getItem(STYLE_KEY), styleRaw)
storage.disableFailures()
storage.resetWrites()
assert.ok(projectRepository.getProjectById(project.projectId))
assert.equal(storage.writeCount(STYLE_KEY), 1, '款式仓内存必须回滚，重试时仍需重新提交')
assert.equal(storage.writeCount(PROJECT_KEY), 1, '项目仓内存必须保持未装载，重试时仍需重新提交')
`)

runScenario('project-write-failure-restores-style-write', `${common}
const targetStyleId = 'project-fault-target'
const historicalProject = { ...project, linkedStyleId: targetStyleId }
const projectRaw = JSON.stringify({ ...projects, projects: [historicalProject, ...projects.projects.slice(1)] })
const target = { ...styleSeed.records[0], styleId: targetStyleId, sourceProjectId: '', sourceProjectCode: 'WRONG', sourceProjectName: '错误项目', sourceProjectNodeId: 'removed-node' }
const styleRaw = JSON.stringify({ version: 3, records: [target], pendingItems: [] })
storage.setItem(PROJECT_KEY, projectRaw)
storage.setItem(STYLE_KEY, styleRaw)
storage.resetWrites()
storage.failNextWrite(PROJECT_KEY)
const projectRepository = await import('${workspace}/src/data/pcs-project-repository.ts')
assert.throws(() => projectRepository.getProjectById(project.projectId), /fault:higood-pcs-project-store-v4-demo/)
assert.equal(storage.getItem(PROJECT_KEY), projectRaw)
assert.equal(storage.getItem(STYLE_KEY), styleRaw)
storage.disableFailures()
storage.resetWrites()
assert.ok(projectRepository.getProjectById(project.projectId))
assert.equal(storage.writeCount(STYLE_KEY), 1, '款式仓内存必须恢复到提交前，重试时重新迁移')
assert.equal(storage.writeCount(PROJECT_KEY), 1, '项目仓内存必须恢复到提交前，重试时重新迁移')
`)

console.log('pcs-style-archive-transactional-migration.spec.ts PASS')
