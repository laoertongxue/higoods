import assert from 'node:assert/strict'

import {
  CHANNEL_PRODUCT_STATUS_RULES,
  STYLE_ARCHIVE_CONTROLLED_FIELD_RULES,
  STYLE_ARCHIVE_STATUS_RULES,
  TECH_PACK_AGGREGATE_STATUS_RULES,
  listUnifiedProductLifecycleRuleRows,
  normalizeStyleTechPackStatusText,
  resolveChannelProductBusinessStatus,
  resolveStyleArchiveBusinessStatus,
  resolveTechPackAggregateStatus,
  resolveTechPackVersionBusinessStatus,
} from '../src/data/pcs-product-lifecycle-governance.ts'

assert.equal(
  STYLE_ARCHIVE_STATUS_RULES[
    resolveStyleArchiveBusinessStatus({
      archiveStatus: 'DRAFT',
      currentTechPackVersionId: '',
      baseInfoStatus: '待完善',
    })
  ].label,
  '待完善',
  '基础资料未补齐时应归为待完善',
)

assert.equal(
  STYLE_ARCHIVE_STATUS_RULES[
    resolveStyleArchiveBusinessStatus({
      archiveStatus: 'DRAFT',
      currentTechPackVersionId: '',
      baseInfoStatus: '已建档',
    })
  ].label,
  '已建档待技术包',
  '正式建档后但没有当前生效技术包时应归为已建档待技术包',
)

assert.equal(
  TECH_PACK_AGGREGATE_STATUS_RULES[
    resolveTechPackAggregateStatus([{ versionStatus: 'PUBLISHED' }], '')
  ].label,
  '已发布待启用',
  '只有已发布版本但未设当前生效版本时应归为已发布待启用',
)

assert.equal(
  TECH_PACK_AGGREGATE_STATUS_RULES[
    resolveTechPackVersionBusinessStatus(
      { versionStatus: 'PUBLISHED', technicalVersionId: 'tdv_001' },
      'tdv_001',
    )
  ].label,
  '已启用',
  '当前生效版本应归为已启用',
)

assert.equal(
  CHANNEL_PRODUCT_STATUS_RULES[
    resolveChannelProductBusinessStatus({
      channelProductStatus: '已生效',
      upstreamSyncStatus: '待更新',
    })
  ].label,
  '已生效待更新',
  '渠道店铺商品已生效但未完成上游更新时应归为已生效待更新',
)

assert.equal(normalizeStyleTechPackStatusText('已发布'), '已发布待启用', '旧技术包状态文案应统一为已发布待启用')
assert.ok(
  STYLE_ARCHIVE_CONTROLLED_FIELD_RULES.some((item) => item.title === '正式建档后受控变更字段'),
  '应存在正式建档后受控变更字段定义',
)
assert.ok(
  STYLE_ARCHIVE_CONTROLLED_FIELD_RULES.some((item) => item.fields.includes('包装信息')),
  '应保留正式建档后可补充字段定义',
)
assert.equal(
  listUnifiedProductLifecycleRuleRows().length,
  Object.keys(STYLE_ARCHIVE_STATUS_RULES).length +
    Object.keys(TECH_PACK_AGGREGATE_STATUS_RULES).length +
    Object.keys(CHANNEL_PRODUCT_STATUS_RULES).length,
  '统一状态口径表应覆盖三类对象全部状态',
)

console.log('pcs-product-lifecycle-governance.spec.ts PASS')
