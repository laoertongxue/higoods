import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function assertIncludes(source: string, pattern: string, message: string): void {
  assert.ok(source.includes(pattern), message)
}

function listFiles(dir: string): string[] {
  const absolute = path.join(ROOT, dir)
  if (!fs.existsSync(absolute)) return []
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const relative = path.join(dir, entry.name)
    if (entry.isDirectory()) return listFiles(relative)
    return entry.isFile() ? [relative] : []
  })
}

const techPackTypes = read('src/data/pcs-technical-data-version-types.ts')
const techPackRepo = read('src/data/pcs-technical-data-version-repository.ts')
const techPackViewModel = read('src/data/pcs-technical-data-version-view-model.ts')
const techPackGeneration = read('src/data/pcs-tech-pack-task-generation.ts')
const patternTypes = read('src/data/pcs-pattern-library-types.ts')
const patternStore = read('src/data/pcs-pattern-library.ts')
const archiveTypes = read('src/data/pcs-project-archive-types.ts')
const archiveCollector = read('src/data/pcs-project-archive-collector.ts')
const archiveSync = read('src/data/pcs-project-archive-sync.ts')
const domainContract = read('src/data/pcs-project-domain-contract.ts')
const techPackPage = read('src/pages/tech-pack/core.ts')
const patternListPage = read('src/pages/pcs-pattern-library.ts')
const patternDetailPage = read('src/pages/pcs-pattern-library-detail.ts')
const productArchivesPage = read('src/pages/pcs-product-archives.ts')
const projectsPage = read('src/pages/pcs-projects.ts')

;['linkedPatternAssetIds', 'linkedPatternAssetCodes', 'archiveCollectedFlag', 'archiveCollectedAt'].forEach((field) => {
  assertIncludes(techPackTypes + techPackRepo + techPackGeneration, field, `技术包版本缺少闭环字段：${field}`)
})

;[
  'source_task_code',
  'source_task_type',
  'source_task_name',
  'source_tech_pack_version_id',
  'source_tech_pack_version_code',
  'buyer_review_status',
  'difficulty_grade',
  'assigned_team_code',
  'assigned_member_id',
  'hot_flag',
  'style_tags',
  'category_primary',
  'category_secondary',
].forEach((field) => {
  assertIncludes(patternTypes + patternStore, field, `花型库缺少来源或结构字段：${field}`)
})

;['TECH_PACK_LOG', 'currentPatternAssetIds', 'currentTechPackLogCount', 'ProjectArchiveDocumentGroup'].forEach((field) => {
  assertIncludes(archiveTypes + archiveCollector + archiveSync, field, `项目资料归档缺少闭环字段：${field}`)
})

;['TechPackVersionLog', 'PatternAsset', '花型资料', '技术包版本日志'].forEach((field) => {
  assertIncludes(archiveCollector + archiveSync, field, `归档采集器缺少技术包日志或花型库采集：${field}`)
})

;[
  'STYLE_ARCHIVE_CREATE',
  'REVISION_TASK',
  'PATTERN_TASK',
  'PATTERN_ARTWORK_TASK',
  'FIRST_SAMPLE',
  'PRE_PRODUCTION_SAMPLE',
  '关联技术包版本',
  '花型库',
  '归档状态摘要',
].forEach((field) => {
  assertIncludes(domainContract, field, `工作项库字段定义缺少闭环展示：${field}`)
})

;['技术包版本日志', '花型库', '归档状态', '当前技术包版本', '当前花型资产', '项目资料归档'].forEach((label) => {
  assertIncludes(
    techPackPage + patternListPage + patternDetailPage + productArchivesPage + projectsPage + techPackViewModel,
    label,
    `页面或视图模型缺少闭环展示：${label}`,
  )
})

const forbidden = [
  ['PROJECT', 'TRANSFER', 'PREP'].join('_'),
  ['项目', '转档', '准备'].join(''),
  ['转档', '准备'].join(''),
  ['项目', '转档'].join(''),
]

const hits: string[] = []
;['src/data', 'src/pages', 'tests', 'scripts'].flatMap(listFiles).forEach((relativePath) => {
  const content = read(relativePath)
  forbidden.forEach((word) => {
    if (content.includes(word)) hits.push(`${relativePath} 包含旧准备性节点残留`)
  })
})

assert.deepEqual(hits, [], `不得重新引入旧准备性节点：${hits.join('；')}`)

console.log('check-pcs-closure-unification PASS')
