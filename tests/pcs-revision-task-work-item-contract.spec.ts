import assert from 'node:assert/strict'

import { PCS_PROJECT_WORK_ITEM_CONTRACTS } from '../src/data/pcs-project-domain-contract.ts'

const revisionContract = PCS_PROJECT_WORK_ITEM_CONTRACTS.find((item) => item.workItemTypeCode === 'REVISION_TASK')
assert.ok(revisionContract, '必须存在 REVISION_TASK 工作项定义')

const labels = revisionContract!.fieldDefinitions.map((item) => item.label)
;[
  '旧款编码',
  '旧款名称',
  '新款候选编码',
  '新款候选名称',
  '样衣数量',
  '风格偏好',
  '修改建议',
  '面辅料变化明细',
  '新花型图片',
  '新花型 SPU',
  '纸样图片',
  '纸样文件',
  '主图图片',
  '新图设计稿',
  '纸样打印时间',
  '寄送地址',
  '打版区域',
  '打版人',
  '回直播验证状态',
  '关联技术包版本编码',
].forEach((label) => {
  assert.ok(labels.includes(label), `REVISION_TASK 工作项字段定义缺少：${label}`)
})

console.log('pcs-revision-task-work-item-contract.spec.ts PASS')
