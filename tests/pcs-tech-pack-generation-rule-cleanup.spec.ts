import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

const generationSource = read('src/data/pcs-tech-pack-task-generation.ts')
const engineeringSource = read('src/pages/pcs-engineering-tasks.ts')
const archiveSource = read('src/pages/pcs-product-archives.ts')
const projectSource = read('src/pages/pcs-projects.ts')
const typeSource = read('src/data/pcs-technical-data-version-types.ts')
const oldLinkedField = ['linked', 'Technical', 'Version'].join('')

assert.ok(!generationSource.includes('writeTaskIntoDraft'), '不得再保留三类任务共用草稿技术包的旧写入函数')
assert.ok(!generationSource.includes('getCurrentDraftTechPackVersionByStyleId'), '不得再保留按款式共用单草稿版本的旧查询函数')
assert.ok(!generationSource.includes('写入当前草稿技术包'), '不得再保留旧草稿直写口径')
assert.ok(typeSource.includes('primaryPlateTaskId'), '技术包版本类型必须包含主制版挂载字段')
assert.ok(typeSource.includes('linkedRevisionTaskIds'), '技术包版本类型必须保留改版任务链字段')
assert.ok(!typeSource.includes(oldLinkedField), '技术包版本类型不得再使用旧 linkedTechnicalVersion 字段')
assert.ok(!archiveSource.includes(['新建', '技术包版本'].join('')), '款式档案页不得再出现旧直建入口')
assert.ok(!archiveSource.includes(['复制为', '新版本'].join('')), '款式档案页不得再出现旧复制入口')
assert.ok(!projectSource.includes(['新建', '技术包版本'].join('')), '商品项目页不得再出现旧直建入口')
assert.ok(engineeringSource.includes('生成改版技术包版本'), '改版任务页必须显示新版本生成动作')
assert.ok(engineeringSource.includes('写入技术包花型'), '花型任务页必须显示花型写入动作')
assert.ok(engineeringSource.includes('生成花型新版本'), '花型任务页必须显示花型新版本动作')

console.log('pcs-tech-pack-generation-rule-cleanup.spec.ts PASS')
