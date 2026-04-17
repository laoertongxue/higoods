import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)
const writebackSource = readFileSync(resolve(repoRoot, 'src/data/pcs-project-technical-data-writeback.ts'), 'utf8')
const generationSource = readFileSync(resolve(repoRoot, 'src/data/pcs-tech-pack-task-generation.ts'), 'utf8')
const typeSource = readFileSync(resolve(repoRoot, 'src/data/pcs-technical-data-version-types.ts'), 'utf8')

assert.ok(!writebackSource.includes('createTechnicalDataVersionFromStyle'), '不得再保留从款式档案直接创建技术包版本的方法')
assert.ok(!writebackSource.includes('createTechnicalDataVersionFromProject'), '不得再保留从商品项目直接创建技术包版本的方法')
assert.ok(generationSource.includes('generateTechPackVersionFromRevisionTask'), '必须存在改版任务生成技术包版本入口')
assert.ok(generationSource.includes('generateTechPackVersionFromPlateTask'), '必须存在制版任务生成技术包版本入口')
assert.ok(generationSource.includes('generateTechPackVersionFromPatternTask'), '必须存在花型任务生成技术包版本入口')
assert.ok(typeSource.includes('linkedRevisionTaskIds'), '技术包版本正式记录必须包含 linkedRevisionTaskIds')
assert.ok(typeSource.includes('createdFromTaskType'), '技术包版本正式记录必须包含 createdFromTaskType')
assert.ok(typeSource.includes('createdFromTaskId'), '技术包版本正式记录必须包含 createdFromTaskId')
assert.ok(typeSource.includes('createdFromTaskCode'), '技术包版本正式记录必须包含 createdFromTaskCode')

console.log('pcs-tech-pack-generation-entry.spec.ts PASS')
