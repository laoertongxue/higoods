import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

const writebackSource = read('src/data/pcs-project-technical-data-writeback.ts')
const generationSource = read('src/data/pcs-tech-pack-task-generation.ts')
const stylePageSource = read('src/pages/pcs-product-archives.ts')
const projectPageSource = read('src/pages/pcs-projects.ts')
const engineeringSource = read('src/pages/pcs-engineering-tasks.ts')
const typeSource = read('src/data/pcs-technical-data-version-types.ts')

assert.ok(!writebackSource.includes('createTechnicalDataVersionFromStyle'), '不得再存在 createTechnicalDataVersionFromStyle')
assert.ok(!writebackSource.includes('createTechnicalDataVersionFromProject'), '不得再存在 createTechnicalDataVersionFromProject')
assert.ok(!stylePageSource.includes('新建技术包版本'), '商品档案页不得再渲染“新建技术包版本”')
assert.ok(!stylePageSource.includes('复制为新版本'), '商品档案页不得再渲染“复制为新版本”')
assert.ok(!stylePageSource.includes('同时创建技术包版本 V1 草稿'), '商品档案新建抽屉不得再保留同步创建技术包草稿入口')
assert.ok(!projectPageSource.includes('新建技术包版本'), '商品项目页不得再渲染“新建技术包版本”')
assert.ok(generationSource.includes('generateTechPackVersionFromRevisionTask'), '必须存在改版任务正式生成入口')
assert.ok(generationSource.includes('generateTechPackVersionFromPlateTask'), '必须存在制版任务正式生成入口')
assert.ok(generationSource.includes('generateTechPackVersionFromPatternTask'), '必须存在花型任务正式生成入口')
assert.ok(engineeringSource.includes('revision-generate-tech-pack'), '改版任务页必须存在正式生成技术包动作')
assert.ok(engineeringSource.includes('plate-generate-tech-pack'), '制版任务页必须存在正式生成技术包动作')
assert.ok(engineeringSource.includes('pattern-generate-tech-pack'), '花型任务页必须存在正式生成技术包动作')
assert.ok(typeSource.includes('linkedRevisionTaskIds'), '技术包版本类型中必须包含 linkedRevisionTaskIds')

console.log('check-pcs-tech-pack-generation-entry.ts PASS')
