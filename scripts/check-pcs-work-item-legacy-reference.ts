import assert from 'node:assert/strict'

import { getPcsWorkItemLegacyReference } from '../src/data/pcs-work-item-legacy-reference.ts'

const requiredRefs = [
  'PROJECT_INIT',
  'SAMPLE_ACQUIRE',
  'SAMPLE_INBOUND_CHECK',
  'SAMPLE_SHOOT_FIT',
  'CHANNEL_PRODUCT_LISTING',
  'PATTERN_TASK',
] as const

requiredRefs.forEach((workItemTypeCode) => {
  const reference = getPcsWorkItemLegacyReference(workItemTypeCode)
  assert.ok(reference, `${workItemTypeCode} 应已配置旧版参考`)
  assert.ok(reference!.legacyFieldGroupTitles.length > 0, `${workItemTypeCode} 应具备旧版字段组标题`)
  assert.ok(reference!.legacyFieldLabels.length > 0, `${workItemTypeCode} 应具备旧版字段标签`)
})

;['TEST_CONCLUSION', 'TEST_DATA_SUMMARY', 'STYLE_ARCHIVE_CREATE', 'PROJECT_TRANSFER_PREP'].forEach((workItemTypeCode) => {
  assert.equal(
    getPcsWorkItemLegacyReference(workItemTypeCode as Parameters<typeof getPcsWorkItemLegacyReference>[0]),
    null,
    `${workItemTypeCode} 不应被强行配置无来源的旧版参考`,
  )
})

console.log('check-pcs-work-item-legacy-reference.ts PASS')
