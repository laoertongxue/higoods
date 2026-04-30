import assert from 'node:assert/strict'

import { getProjectWorkItemContract } from '../src/data/pcs-project-domain-contract.ts'

const contract = getProjectWorkItemContract('PATTERN_TASK')
const labels = contract.fieldDefinitions.map((field) => field.label)

;[
  '产品历史属性',
  '版师',
  '打版区域',
  '是否紧急',
  '样板确认时间',
  '面辅料明细',
  '花色需求',
  '唛架图片明细',
  'PDF 文件',
  'DXF 文件',
  'RUL 文件',
  '部位模板关联',
  '关联技术包版本',
].forEach((label) => {
  assert.ok(labels.includes(label), `制版任务工作项库缺少字段：${label}`)
})

console.log('pcs-plate-making-work-item-contract.spec.ts PASS')
