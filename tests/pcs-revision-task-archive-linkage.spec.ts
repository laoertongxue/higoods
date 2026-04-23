import assert from 'node:assert/strict'
import fs from 'node:fs'

const collector = fs.readFileSync('src/data/pcs-project-archive-collector.ts', 'utf8')

;[
  'materialAdjustmentLines',
  'newPatternImageIds',
  'patternPieceImageIds',
  'patternFileIds',
  'mainImageIds',
  'designDraftImageIds',
  '面辅料变化',
  '纸样文件',
  '新图设计稿',
].forEach((field) => {
  assert.ok(collector.includes(field), `项目资料归档采集缺少改版任务字段：${field}`)
})

console.log('pcs-revision-task-archive-linkage.spec.ts PASS')
