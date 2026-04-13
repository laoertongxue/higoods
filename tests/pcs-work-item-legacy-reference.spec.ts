import assert from 'node:assert/strict'

import { listPcsWorkItems } from '../src/data/pcs-work-items.ts'
import { getPcsWorkItemDetailViewModel } from '../src/data/pcs-work-item-library-view-model.ts'

const referenceCases = [
  { workItemId: 'PROJECT_INIT', expectedText: '基础识别信息' },
  { workItemId: 'SAMPLE_ACQUIRE', expectedText: '样衣获取基础信息' },
  { workItemId: 'SAMPLE_INBOUND_CHECK', expectedText: '到样样衣管理（深圳）' },
  { workItemId: 'SAMPLE_SHOOT_FIT', expectedText: '内容拍摄' },
  { workItemId: 'CHANNEL_PRODUCT_LISTING', expectedText: 'CHANNEL_PRODUCT_PREP' },
  { workItemId: 'PATTERN_TASK', expectedText: 'PRE_PATTERN' },
] as const

referenceCases.forEach(({ workItemId, expectedText }) => {
  const workItem = listPcsWorkItems().find((item) => item.code === workItemId)
  assert.ok(workItem, `${workItemId} 应存在于工作项目录`)
  const detail = getPcsWorkItemDetailViewModel(workItem!.id)
  assert.ok(detail, `${workItemId} 应能读取工作项详情 view model`)
  assert.ok(detail!.legacyReference, `${workItemId} 应存在旧版字段参考`)
  assert.ok(
    detail!.legacyReference!.legacyCodes.includes(expectedText) ||
      detail!.legacyReference!.legacyNames.includes(expectedText) ||
      detail!.legacyReference!.legacyFieldGroupTitles.includes(expectedText),
    `${workItemId} 详情页应接入旧版参考内容：${expectedText}`,
  )
})

const conclusionItem = listPcsWorkItems().find((item) => item.code === 'TEST_CONCLUSION')
assert.ok(conclusionItem, 'TEST_CONCLUSION 应存在于工作项目录')
const conclusionDetail = getPcsWorkItemDetailViewModel(conclusionItem!.id)
assert.ok(conclusionDetail, 'TEST_CONCLUSION 应能读取工作项详情 view model')
assert.equal(conclusionDetail!.legacyReference, null, 'TEST_CONCLUSION 不应被强行塞入无来源的旧版字段参考')
assert.ok(
  conclusionDetail!.fieldRows.every((row) => row.fromLegacyReference === false),
  'TEST_CONCLUSION 的正式字段不应被误标成旧版参考字段',
)

console.log('pcs-work-item-legacy-reference.spec.ts PASS')
