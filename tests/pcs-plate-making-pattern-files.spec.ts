import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const typeSource = fs.readFileSync(path.join(ROOT, 'src/data/pcs-plate-making-types.ts'), 'utf8')
const generationSource = fs.readFileSync(path.join(ROOT, 'src/data/pcs-tech-pack-task-generation.ts'), 'utf8')
const pageSource = fs.readFileSync(path.join(ROOT, 'src/pages/pcs-engineering-tasks.ts'), 'utf8')

;[
  'patternImageLineItems',
  'patternPdfFileIds',
  'patternDxfFileIds',
  'patternRulFileIds',
  'supportImageIds',
  'supportVideoIds',
].forEach((field) => {
  assert.ok(typeSource.includes(field), `制版任务类型缺少字段：${field}`)
  assert.ok(pageSource.includes(field), `制版任务页面缺少字段：${field}`)
})

assert.ok(generationSource.includes('task.patternDxfFileIds'), '技术包生成必须读取 DXF 文件')
assert.ok(generationSource.includes('task.patternRulFileIds'), '技术包生成必须读取 RUL 文件')
assert.ok(generationSource.includes('task.patternPdfFileIds'), '技术包生成必须读取 PDF 文件')
assert.ok(!typeSource.includes('patternFileIds: string[]'), '不得把 PDF / DXF / RUL 压缩成通用纸样文件数组')

console.log('pcs-plate-making-pattern-files.spec.ts PASS')
