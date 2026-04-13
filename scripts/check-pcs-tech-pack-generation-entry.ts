import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

function read(relativePath: string) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8')
}

const writebackSource = read('src/data/pcs-project-technical-data-writeback.ts')
const generationSource = read('src/data/pcs-tech-pack-task-generation.ts')
const versionTypesSource = read('src/data/pcs-technical-data-version-types.ts')
const styleDetailSource = read('src/pages/pcs-product-style-detail.ts')
const projectDetailSource = read('src/pages/pcs-project-detail.ts')
const projectNodeSource = read('src/pages/pcs-project-work-item-detail.ts')
const revisionPageSource = read('src/pages/pcs-revision-task.ts')
const platePageSource = read('src/pages/pcs-plate-making.ts')
const patternPageSource = read('src/pages/pcs-pattern-task.ts')

assert.ok(!writebackSource.includes('createTechnicalDataVersionFromStyle'), '不应保留 createTechnicalDataVersionFromStyle')
assert.ok(!writebackSource.includes('createTechnicalDataVersionFromProject'), '不应保留 createTechnicalDataVersionFromProject')
assert.ok(generationSource.includes('generateTechPackVersionFromRevisionTask'), '必须存在改版任务生成技术包版本服务')
assert.ok(generationSource.includes('generateTechPackVersionFromPlateTask'), '必须存在制版任务生成技术包版本服务')
assert.ok(generationSource.includes('generateTechPackVersionFromPatternTask'), '必须存在花型任务生成技术包版本服务')

assert.ok(!styleDetailSource.includes('新建技术包版本'), '款式档案页不应再渲染新建技术包版本')
assert.ok(!styleDetailSource.includes('复制为新版本'), '款式档案页不应再渲染复制为新版本')
assert.ok(!projectDetailSource.includes('新建技术包版本'), '项目详情页不应再渲染新建技术包版本')
assert.ok(!projectNodeSource.includes('新建技术包版本'), '项目节点详情页不应再渲染新建技术包版本')

assert.ok(revisionPageSource.includes('data-revision-action="generate-tech-pack"'), '改版任务页必须存在正式生成按钮')
assert.ok(platePageSource.includes('data-plate-action="generate-tech-pack"'), '制版任务页必须存在正式生成按钮')
assert.ok(patternPageSource.includes('data-pattern-action="generate-tech-pack"'), '花型任务页必须存在正式生成按钮')

assert.ok(revisionPageSource.includes('getTechPackGenerationBlockedReason'), '改版任务页必须接入任务状态阻断逻辑')
assert.ok(platePageSource.includes('getTechPackGenerationBlockedReason'), '制版任务页必须接入任务状态阻断逻辑')
assert.ok(patternPageSource.includes('getTechPackGenerationBlockedReason'), '花型任务页必须接入任务状态阻断逻辑')
assert.ok(generationSource.includes('当前任务尚未确认产出，不能生成技术包版本'), '正式生成服务必须统一阻断未确认任务写入')

assert.ok(versionTypesSource.includes('linkedRevisionTaskIds'), '技术包版本类型中必须包含 linkedRevisionTaskIds')
assert.ok(versionTypesSource.includes('createdFromTaskType'), '技术包版本类型中必须包含 createdFromTaskType')
assert.ok(versionTypesSource.includes('baseTechnicalVersionId'), '技术包版本类型中必须包含 baseTechnicalVersionId')

console.log('check-pcs-tech-pack-generation-entry.ts PASS')
