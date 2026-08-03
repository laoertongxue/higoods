import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

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

assert.equal(normalizeEngineeringVisibleStatus('未知旧状态'), '未启用')
assert.equal(getCommonStatusMeta('未知旧状态').label, '未启用')
assert.match(renderStatusBadge('未知旧状态'), /未启用/)

assert.equal('firstOrderList' in state, false)
assert.equal('firstOrderConclusionOpen' in state, false)
assert.equal('firstSampleDetailDraft' in state, false)
assert.equal('firstSampleStartDraft' in state, false)
assert.equal('firstSampleResultDraft' in state, false)
assert.equal('revisionCreateDraft' in state, false)
assert.equal('revisionDetailDraft' in state, false)
assert.equal('revisionTab' in state, false)
assert.equal('imagePreview' in state, false)

const sharedSource = readFileSync(new URL('../src/pages/pcs-engineering-tasks/shared.ts', import.meta.url), 'utf8')
for (const removedSymbol of [
  'initialRevisionCreateDraft',
  'initialRevisionDetailDraft',
  'renderImageUploader',
  'renderFileUploader',
  'appendImageValues',
  'appendFileValues',
  'removeListValue',
  'renderPreviewImageModal',
  'getProjectDefaultValues',
]) {
  assert.doesNotMatch(sharedSource, new RegExp(`\\b${removedSymbol}\\b`), `${removedSymbol} 旧页面能力应从共享层删除`)
}
assert.ok(sharedSource.split('\n').length < 1_000, 'shared.ts 应只保留真实共用能力并明显缩小')
assert.doesNotMatch(sharedSource, /需补首单|异常待处理|已取消|待确认|已确认/, '共享层不得保留旧任务状态和首单文案')

console.log('pcs-engineering-shared-state-boundary.spec.ts PASS')
