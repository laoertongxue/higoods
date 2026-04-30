import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const collector = fs.readFileSync(path.join(ROOT, 'src/data/pcs-project-archive-collector.ts'), 'utf8')

;[
  'materialRequirementLines',
  'patternImageLineItems',
  'patternPdfFileIds',
  'patternDxfFileIds',
  'patternRulFileIds',
  'supportImageIds',
  'supportVideoIds',
].forEach((field) => {
  assert.ok(collector.includes(field), `项目资料归档采集缺少制版字段：${field}`)
})

assert.ok(collector.includes('面辅料图片'), '归档应采集面辅料图片')
assert.ok(collector.includes('唛架图片'), '归档应采集唛架图片')
assert.ok(collector.includes('DXF'), '归档应保留 DXF 文件类型')
assert.ok(collector.includes('RUL'), '归档应保留 RUL 文件类型')

console.log('pcs-plate-making-archive-linkage.spec.ts PASS')
