import assert from 'node:assert/strict'

import {
  getRevisionTaskById,
  resetRevisionTaskRepository,
} from '../src/data/pcs-revision-task-repository.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  renderPcsRevisionTaskDetailPage,
  renderPcsRevisionTaskPage,
  resetRevisionTaskPageState,
} from '../src/pages/pcs-engineering-tasks/revision-task.ts'

resetStyleArchiveRepository()
resetRevisionTaskRepository()
resetRevisionTaskPageState()

const revision = getRevisionTaskById('RT-20260108-002')
assert.ok(revision, '应存在改款任务演示数据')

const listHtml = renderPcsRevisionTaskPage()
;[
  '改款与设计打样任务',
  '任务类型',
  '目标款式',
  '修改范围',
  '新建任务',
].forEach((label) => {
  assert.ok(listHtml.includes(label), `独立改款任务列表缺少真实结构：${label}`)
})

const detailHtml = renderPcsRevisionTaskDetailPage(revision.revisionTaskId)
;[
  '任务信息',
  '任务要求',
  '样衣物料',
  '关联任务',
  '返回列表',
  '编辑任务',
].forEach((label) => {
  assert.ok(detailHtml.includes(label), `独立改款任务详情缺少真实结构：${label}`)
})

;[
  '旧款 / 新款对比',
  '面辅料变化',
  '回直播验证',
  '操作记录',
].forEach((legacyLabel) => {
  assert.ok(!detailHtml.includes(legacyLabel), `独立改款任务详情不得继续依赖旧巨型页面结构：${legacyLabel}`)
})

console.log('pcs-revision-task-page-structure.spec.ts PASS')
