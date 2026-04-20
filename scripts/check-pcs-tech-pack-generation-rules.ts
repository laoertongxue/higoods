import assert from 'node:assert/strict'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const repoRoot = resolve(new URL('..', import.meta.url).pathname)

function read(relativePath: string): string {
  return readFileSync(resolve(repoRoot, relativePath), 'utf8')
}

function readTree(relativePath: string): string {
  const absolutePath = resolve(repoRoot, relativePath)
  if (!existsSync(absolutePath)) return ''
  const stat = statSync(absolutePath)
  if (stat.isFile()) return readFileSync(absolutePath, 'utf8')
  return readdirSync(absolutePath, { withFileTypes: true })
    .map((entry) => readTree(join(relativePath, entry.name)))
    .join('\n')
}

const generationSource = read('src/data/pcs-tech-pack-task-generation.ts')
const typeSource = read('src/data/pcs-technical-data-version-types.ts')
const logTypeSource = read('src/data/pcs-tech-pack-version-log-types.ts')
const logRepoSource = read('src/data/pcs-tech-pack-version-log-repository.ts')
const writebackSource = read('src/data/pcs-project-technical-data-writeback.ts')
const activationSource = read('src/data/pcs-tech-pack-version-activation.ts')
const engineeringPageSource = read('src/pages/pcs-engineering-tasks.ts')
const archivePageSource = read('src/pages/pcs-product-archives.ts')
const projectPageSource = read('src/pages/pcs-projects.ts')
const legacyLinkedField = ['linked', 'Technical', 'Version'].join('')
const plateActionLabel = ['生成', '技术包版本'].join('')

assert.ok(typeSource.includes('primaryPlateTaskId'), '技术包版本必须包含 primaryPlateTaskId')
assert.ok(typeSource.includes('linkedRevisionTaskIds'), '技术包版本必须包含 linkedRevisionTaskIds')
assert.ok(logTypeSource.includes('TechPackVersionLogRecord'), '必须存在 TechPackVersionLogRecord')
assert.ok(logRepoSource.includes('appendTechPackVersionLog'), '必须存在版本日志仓储')

assert.ok(!generationSource.includes('写入当前草稿技术包'), '不得再保留旧草稿直写口径')
assert.ok(!generationSource.includes('getCurrentDraftTechPackVersionByStyleId'), '不得再保留按款式共用草稿查询逻辑')
assert.ok(!generationSource.includes('writeTaskIntoDraft'), '不得再保留三类任务共用草稿写入逻辑')

const overwritePatterns = [
  'replaceArtworkInCurrentVersion',
  'overwriteExistingArtwork',
  '覆盖已有花型',
]
overwritePatterns.forEach((pattern) => {
  assert.ok(!generationSource.includes(pattern), `不得再保留旧花型覆盖逻辑：${pattern}`)
})

const legacyCreateFromStyle = ['createTechnicalDataVersion', 'FromStyle'].join('')
const legacyCreateFromProject = ['createTechnicalDataVersion', 'FromProject'].join('')
assert.ok(!archivePageSource.includes(legacyCreateFromStyle), '款式档案页不得再存在旧直建调用')
assert.ok(!projectPageSource.includes(legacyCreateFromProject), '商品项目页不得再存在旧直建调用')
assert.ok(!archivePageSource.includes(['新建', '技术包版本'].join('')), '款式档案页不得再出现旧直建入口')
assert.ok(!archivePageSource.includes(['复制为', '新版本'].join('')), '款式档案页不得再出现旧复制入口')
assert.ok(!projectPageSource.includes(['新建', '技术包版本'].join('')), '商品项目页不得再出现旧直建入口')

assert.ok(engineeringPageSource.includes('生成改版技术包版本'), '改版任务页必须保留生成改版技术包版本动作')
assert.ok(engineeringPageSource.includes(plateActionLabel), '制版任务页必须保留制版技术包动作')
assert.ok(engineeringPageSource.includes('写入技术包花型'), '花型任务页必须保留写入技术包花型动作')
assert.ok(engineeringPageSource.includes('生成花型新版本'), '花型任务页必须保留生成花型新版本动作')
assert.ok(engineeringPageSource.includes('查看版本日志'), '任务页必须提供查看版本日志入口')
assert.ok(engineeringPageSource.includes('查看关联技术包'), '任务页必须提供查看关联技术包入口')

assert.ok(!typeSource.includes(legacyLinkedField), '类型定义中不得再出现旧 linkedTechnicalVersion 字段')
assert.ok(!writebackSource.includes(legacyLinkedField), '正式写入服务中不得再出现旧 linkedTechnicalVersion 字段')
assert.ok(!activationSource.includes(legacyLinkedField), '启用服务中不得再出现旧 linkedTechnicalVersion 字段')

assert.ok(writebackSource.includes('发布技术包版本'), '发布服务必须写发布日志')
assert.ok(activationSource.includes('启用当前生效版本'), '启用服务必须写启用日志')

const fcsPaths = [
  'src/data/fcs',
  'src/pages/fcs',
  'src/pages/production',
]
const forbiddenFcsTokens = [
  'generateTechPackVersionFromRevisionTask',
  'generateTechPackVersionFromPlateTask',
  'generateTechPackVersionFromPatternTask',
  'TechPackVersionLogRecord',
]

fcsPaths.forEach((relativePath) => {
  const source = readTree(relativePath)
  if (!source) return
  forbiddenFcsTokens.forEach((token) => {
    assert.ok(!source.includes(token), `FCS 范围文件不得引入本轮技术包生成逻辑：${token}`)
  })
})

console.log('check-pcs-tech-pack-generation-rules.ts PASS')
