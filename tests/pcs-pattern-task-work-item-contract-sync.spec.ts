import assert from 'node:assert/strict'

import { getProjectWorkItemContract } from '../src/data/pcs-project-domain-contract.ts'

const contract = getProjectWorkItemContract('PATTERN_ARTWORK_TASK')
const labels = contract.fieldDefinitions.map((field) => field.label)

;[
  '需求来源',
  '工艺类型',
  '数量',
  '面料',
  '需求图片',
  '分配团队',
  '分配成员',
  '买手确认状态',
  '完成确认图片',
  '转派团队',
  '花型库资产ID',
  '关联技术包版本ID',
].forEach((label) => {
  assert.ok(labels.includes(label), `花型任务工作项库缺少字段：${label}`)
})

console.log('pcs-pattern-task-work-item-contract-sync.spec.ts PASS')
