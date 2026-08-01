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

const revisionTypes = read('src/data/pcs-revision-task-types.ts')
const revisionRepository = read('src/data/pcs-revision-task-repository.ts')
const revisionPage = read('src/pages/pcs-engineering-tasks/revision-task.ts')
const sharedPage = read('src/pages/pcs-engineering-tasks/shared.ts')
const dispatcher = read('src/pages/pcs-engineering-tasks.ts')
const revisionPageTest = read('tests/pcs-revision-task-page.spec.ts')

// 独立改款／设计打样列表必须继续服从标准列表、标准表格和分页契约。
;[
  '// @page-pattern: list',
  'renderStandardListPage',
  'renderStandardListTable',
  'renderTablePagination',
  'renderEngineeringStandardListPage',
  "module: 'revision'",
  "title: '改款与设计打样任务'",
].forEach((contract) => {
  assertIncludes(revisionPage + sharedPage, contract, `改款任务列表缺少标准列表契约：${contract}`)
})

// 改款必须清楚表达“基于什么 SPU，形成什么 SPU”，并阻止源、目标相同。
;[
  'baseStyleId',
  'baseStyleCode',
  'targetStyleId',
  'targetStyleCodeCandidate',
  '基于款式',
  '目标款式',
  '基于款式与目标款式不能是同一个 SPU',
].forEach((contract) => {
  assertIncludes(revisionTypes + revisionRepository + revisionPage, contract, `改款任务缺少源 SPU → 目标 SPU 契约：${contract}`)
})

// 样衣物料与关联专业任务是独立任务详情的正式组成部分。
;[
  'materialAdjustmentLines',
  'renderMaterialPlan',
  '样衣物料',
  'patternChangeNote',
  'newPatternSpuCode',
  'renderRelatedWork',
  '关联任务',
].forEach((contract) => {
  assertIncludes(revisionTypes + revisionRepository + revisionPage, contract, `改款任务缺少物料或关联任务契约：${contract}`)
})
assertIncludes(revisionPageTest, '关联花型任务', '改款任务缺少关联花型任务展示回归')
assertIncludes(revisionPageTest, '关联调色任务', '改款任务缺少关联调色任务展示回归')

// 当前工程专业任务只允许统一八档状态，不恢复取消、异常或任务级验收语义。
;[
  '未启用',
  '待前置',
  '待开始',
  '进行中',
  '待审核',
  '返工中',
  '已完成',
  '因需求变更结束',
].forEach((status) => {
  assertIncludes(sharedPage, status, `改款任务缺少统一状态：${status}`)
})
;[
  '暂停',
  '已取消',
  '异常待处理',
  '待验收',
  '已验收',
  '待确认',
  '已确认',
  '需补首单',
].forEach((legacySemantic) => {
  assert.ok(!revisionPage.includes(legacySemantic), `独立改款页面不得恢复旧任务语义：${legacySemantic}`)
})

// 顶层文件只做兼容路由与轻交互分派，真实页面必须来自独立 revision-task 模块。
assertIncludes(dispatcher, "from './pcs-engineering-tasks/revision-task.ts'", '薄分派器没有导入独立改款任务页面')
;[
  'renderPcsRevisionTaskPage',
  'renderPcsRevisionTaskDetailPage',
  'handleRevisionTaskInput',
  'handleRevisionTaskEvent',
].forEach((symbol) => {
  assertIncludes(dispatcher, symbol, `薄分派器缺少独立改款模块符号：${symbol}`)
})
assert.ok(dispatcher.split('\n').length < 300, '工程专业任务顶层分派器不得回退为巨型页面')

console.log('check-pcs-revision-task-refactor PASS')
