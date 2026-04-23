import assert from 'node:assert/strict'
import fs from 'node:fs'

const page = fs.readFileSync('src/pages/pcs-engineering-tasks.ts', 'utf8')

;[
  '任务基本信息',
  '旧款 / 新款对比',
  '改版说明',
  '面辅料变化',
  '花型变化',
  '纸样与设计稿',
  '回直播验证',
  '技术包',
  '操作记录',
].forEach((label) => {
  assert.ok(page.includes(label), `改版任务详情页缺少执行结构：${label}`)
})

console.log('pcs-revision-task-page-structure.spec.ts PASS')
