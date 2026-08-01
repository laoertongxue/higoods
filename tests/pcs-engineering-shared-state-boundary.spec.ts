import assert from 'node:assert/strict'

import {
  COMMON_STATUS_META,
  ENGINEERING_COMMON_FILTER_STATUS_OPTIONS,
  ENGINEERING_LIST_STORAGE_KEYS,
  engineeringListUiState,
  getCommonStatusMeta,
  normalizeEngineeringVisibleStatus,
  renderStatusBadge,
  state,
} from '../src/pages/pcs-engineering-tasks/shared.ts'

const VISIBLE_STATUSES = ['未启用', '待前置', '待开始', '进行中', '待审核', '返工中', '已完成', '因需求变更结束']

assert.deepEqual(ENGINEERING_COMMON_FILTER_STATUS_OPTIONS, VISIBLE_STATUSES)
assert.deepEqual(Object.keys(COMMON_STATUS_META), VISIBLE_STATUSES)
assert.deepEqual(Object.keys(ENGINEERING_LIST_STORAGE_KEYS).sort(), ['color', 'firstSample', 'pattern', 'plate', 'purchase', 'revision', 'techPack'])
assert.deepEqual(Object.keys(engineeringListUiState).sort(), ['color', 'firstSample', 'pattern', 'plate', 'purchase', 'revision', 'techPack'])

assert.equal(normalizeEngineeringVisibleStatus('异常待处理'), '返工中')
assert.equal(normalizeEngineeringVisibleStatus('已取消'), '因需求变更结束')
assert.equal(getCommonStatusMeta('待确认').label, '待审核')
assert.match(renderStatusBadge('已确认'), /已完成/)

assert.equal('firstOrderList' in state, false)
assert.equal('firstOrderConclusionOpen' in state, false)
assert.equal('firstSampleDetailDraft' in state, false)
assert.equal('firstSampleStartDraft' in state, false)
assert.equal('firstSampleResultDraft' in state, false)

console.log('pcs-engineering-shared-state-boundary.spec.ts PASS')
