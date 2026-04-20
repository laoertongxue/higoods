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
const legacyCreateFromStyle = ['createTechnicalDataVersion', 'FromStyle'].join('')
const legacyCreateFromProject = ['createTechnicalDataVersion', 'FromProject'].join('')
const legacyCreateLabel = ['新建', '技术包版本'].join('')
const legacyCopyLabel = ['复制为', '新版本'].join('')

assert.ok(!writebackSource.includes(legacyCreateFromStyle), '不得再存在旧款式直建方法')
assert.ok(!writebackSource.includes(legacyCreateFromProject), '不得再存在旧项目直建方法')
assert.ok(!stylePageSource.includes(legacyCreateLabel), '商品档案页不得再渲染旧直建入口')
assert.ok(!stylePageSource.includes(legacyCopyLabel), '商品档案页不得再渲染旧复制入口')
assert.ok(!stylePageSource.includes('同时创建技术包版本 V1 草稿'), '商品档案新建抽屉不得再保留同步创建技术包草稿入口')
assert.ok(!projectPageSource.includes(legacyCreateLabel), '商品项目页不得再渲染旧直建入口')
assert.ok(generationSource.includes('generateTechPackVersionFromRevisionTask'), '必须存在改版任务正式生成入口')
assert.ok(generationSource.includes('generateTechPackVersionFromPlateTask'), '必须存在制版任务正式生成入口')
assert.ok(generationSource.includes('generateTechPackVersionFromPatternTask'), '必须存在花型任务正式生成入口')
assert.ok(engineeringSource.includes('revision-generate-tech-pack'), '改版任务页必须存在正式生成技术包动作')
assert.ok(engineeringSource.includes('plate-generate-tech-pack'), '制版任务页必须存在正式生成技术包动作')
assert.ok(engineeringSource.includes('pattern-generate-tech-pack'), '花型任务页必须存在正式生成技术包动作')
assert.ok(typeSource.includes('linkedRevisionTaskIds'), '技术包版本类型中必须包含 linkedRevisionTaskIds')

console.log('check-pcs-tech-pack-generation-entry.ts PASS')
