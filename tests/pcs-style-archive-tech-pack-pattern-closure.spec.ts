import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

const techPackCore = read('src/pages/tech-pack/core.ts')
const patternLibraryList = read('src/pages/pcs-pattern-library.ts')
const patternLibraryDetail = read('src/pages/pcs-pattern-library-detail.ts')
const productArchives = read('src/pages/pcs-product-archives.ts')
const projects = read('src/pages/pcs-projects.ts')
const closureViewModel = read('src/data/pcs-project-closure-view-model.ts')

;[
  '关联花型库资产',
  '技术包版本日志',
  '归档状态',
  '当前花型资产',
].forEach((label) => {
  assert.ok(techPackCore.includes(label), `技术包页面缺少闭环字段：${label}`)
})

;[
  '来源花型任务',
  '来源技术包版本',
  '是否爆款',
  '归档状态',
].forEach((label) => {
  assert.ok(patternLibraryList.includes(label) || patternLibraryDetail.includes(label), `花型库页面缺少闭环字段：${label}`)
})

;[
  '当前花型资产',
  '项目资料归档',
  '归档状态',
].forEach((label) => {
  assert.ok(productArchives.includes(label) || projects.includes(label) || closureViewModel.includes(label), `款式档案或项目页缺少闭环字段：${label}`)
})

assert.ok(closureViewModel.includes('buildProjectClosureViewModel'), '项目闭环视图模型必须存在')

console.log('pcs-style-archive-tech-pack-pattern-closure.spec.ts PASS')
