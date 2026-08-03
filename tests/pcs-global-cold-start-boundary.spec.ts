import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('全局启动不得静态加载查生产和裁床 PDA 大页面', () => {
  const main = read('src/main.ts')
  const shell = read('src/components/shell.ts')
  const pdaHandlers = read('src/main-handlers/pda-handlers.ts')

  assert.doesNotMatch(main, /^import .*\.\/components\/production-object-overview['"]/m)
  assert.doesNotMatch(main, /^import .*\.\/pages\/pda-cutting-(?:inbound|handover)['"]/m)
  assert.doesNotMatch(shell, /^import .*\.\/production-object-overview['"]/m)
  assert.doesNotMatch(pdaHandlers, /^import .*\.\.\/pages\/pda-cutting-(?:inbound|handover)['"]/m)
  assert.match(pdaHandlers, /import\('\.\.\/pages\/pda-cutting-inbound'\)/)
  assert.match(pdaHandlers, /import\('\.\.\/pages\/pda-cutting-handover'\)/)
})

test('查生产索引只能在首次使用时构造', () => {
  const source = read('src/data/fcs/production-object-overview.ts')

  assert.match(source, /function getProductionObjectSearchIndex\(\)/)
  assert.match(source, /productionObjectSearchIndexCache \?\?= buildSearchIndex\(\)/)
  assert.doesNotMatch(source, /export const productionObjectSearchIndex[^\n]*buildSearchIndex\(\)/)
})

test('进度事实一次构造仓库执行单快照并按任务复用', () => {
  const progress = read('src/data/fcs/store-domain-progress.ts')
  const warehouse = read('src/data/fcs/warehouse-material-execution.ts')

  assert.match(progress, /const warehouseExecutionSnapshot = buildWarehouseExecutionDocumentSnapshot\(runtimeTasks\)/)
  assert.match(progress, /listWarehouseExecutionDocsByRuntimeTaskId\(task\.taskId, warehouseExecutionSnapshot\)/)
  assert.match(warehouse, /export function buildWarehouseExecutionDocumentSnapshot/)
})

test('图标水合只使用显式图标集合', () => {
  const shell = read('src/components/shell.ts')

  assert.doesNotMatch(shell, /icons as lucideIcons/)
  assert.doesNotMatch(shell, /\.\.\.lucideIcons/)
  assert.match(shell, /const iconMap = shellIcons/)
})
