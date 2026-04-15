import assert from 'node:assert/strict'

import {
  getProjectWorkItemContract,
  listProjectWorkItemContracts,
} from '../src/data/pcs-project-domain-contract.ts'
import { getPcsWorkItemDefinition } from '../src/data/pcs-work-items.ts'
import { renderPcsWorkItemDetailPage } from '../src/pages/pcs-work-items.ts'

const NODE_STATUS_SET = new Set(['未开始', '进行中', '待确认', '已完成', '已取消'])

for (const contract of listProjectWorkItemContracts()) {
  contract.statusDefinitions.forEach((status) => {
    assert.ok(
      NODE_STATUS_SET.has(status.statusName),
      `${contract.workItemTypeCode} 的节点状态定义不应混入实例状态：${status.statusName}`,
    )
  })
}

const patternTaskContract = getProjectWorkItemContract('PATTERN_TASK')
assert.deepEqual(
  patternTaskContract.statusDefinitions.map((item) => item.statusName),
  ['未开始', '进行中', '待确认', '已完成', '已取消'],
  'PATTERN_TASK 的 statusDefinitions 应只保留节点状态',
)
assert.deepEqual(
  patternTaskContract.instanceStatusDefinitions?.map((item) => item.statusName),
  ['草稿', '未开始', '进行中', '待评审', '已确认', '已完成', '已取消'],
  'PATTERN_TASK 应单独定义任务实例状态',
)

const firstSampleContract = getProjectWorkItemContract('FIRST_SAMPLE')
assert.deepEqual(
  firstSampleContract.statusDefinitions.map((item) => item.statusName),
  ['未开始', '进行中', '待确认', '已完成', '已取消'],
  'FIRST_SAMPLE 的 statusDefinitions 应只保留节点状态',
)
assert.deepEqual(
  firstSampleContract.instanceStatusDefinitions?.map((item) => item.statusName),
  ['草稿', '待发样', '在途', '已到样待入库', '验收中', '已完成', '已取消'],
  'FIRST_SAMPLE 应单独定义样衣任务实例状态',
)

const channelListingContract = getProjectWorkItemContract('CHANNEL_PRODUCT_LISTING')
assert.deepEqual(
  channelListingContract.statusDefinitions.map((item) => item.statusName),
  ['未开始', '进行中', '待确认', '已完成', '已取消'],
  'CHANNEL_PRODUCT_LISTING 的 statusDefinitions 应只保留节点状态',
)
assert.deepEqual(
  channelListingContract.instanceStatusDefinitions?.map((item) => item.statusName),
  ['待上架', '已上架待测款', '已作废', '已生效'],
  'CHANNEL_PRODUCT_LISTING 应单独定义渠道商品实例状态',
)

const patternTaskDefinition = getPcsWorkItemDefinition('WI-016')
assert.ok(patternTaskDefinition, '应存在 WI-016 工作项定义')
assert.deepEqual(
  patternTaskDefinition!.statusOptions?.map((item) => item.value),
  ['未开始', '进行中', '待确认', '已完成', '已取消'],
  '工作项模板配置的 statusOptions 应只承接节点状态',
)

const detailHtml = renderPcsWorkItemDetailPage('WI-016')
assert.match(detailHtml, /节点状态定义/, '工作项详情应单独渲染节点状态定义')
assert.match(detailHtml, /实例状态定义/, '工作项详情应单独渲染实例状态定义')
assert.match(detailHtml, /待评审/, '工作项详情应展示实例状态')
assert.match(detailHtml, /待确认/, '工作项详情应展示节点状态')

console.log('pcs-work-item-status-contract.spec.ts PASS')
