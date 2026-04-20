import assert from 'node:assert/strict'

import { listProjectWorkItemContracts } from '../src/data/pcs-project-domain-contract.ts'
import { listPcsWorkItems } from '../src/data/pcs-work-items.ts'

const contracts = listProjectWorkItemContracts()
const workItems = listPcsWorkItems()

assert.ok(
  !contracts.some((item) => item.workItemTypeCode === 'SAMPLE_RETAIN_REVIEW'),
  '标准工作项定义中不应再存在 SAMPLE_RETAIN_REVIEW',
)
assert.ok(
  !contracts.some((item) => item.workItemTypeName === '样衣留存评估'),
  '标准工作项定义中不应再存在“样衣留存评估”',
)
assert.ok(
  contracts.some((item) => item.workItemTypeCode === 'SAMPLE_RETURN_HANDLE'),
  '标准工作项定义中应保留 SAMPLE_RETURN_HANDLE',
)
assert.ok(
  contracts.some((item) => item.workItemTypeName === '样衣退回处理'),
  '标准工作项定义中应保留“样衣退回处理”',
)
assert.ok(
  !workItems.some((item) => item.code === 'SAMPLE_RETAIN_REVIEW' || item.name === '样衣留存评估'),
  '工作项库列表中不应再出现样衣留存评估',
)
assert.ok(
  workItems.some((item) => item.code === 'SAMPLE_RETURN_HANDLE' && item.name === '样衣退回处理'),
  '工作项库列表中应继续存在样衣退回处理',
)
assert.equal(
  contracts.filter((item) => item.workItemTypeCode === 'SAMPLE_RETURN_HANDLE').length,
  1,
  '删除样衣留存评估后应仅保留一个样衣退回处理正式工作项',
)
