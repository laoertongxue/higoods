import assert from 'node:assert/strict'
import test from 'node:test'
import { filterProfessionalBusinessRows, type buildProfessionalBusinessRows } from '../../src/pages/pcs-engineering-tasks/business-list.ts'
const empty = { keyword: '', status: '', team: '', source: '', assignee: '', dateFrom: '', dateTo: '' }
test('专业列表业务字段查询与责任、来源、计划边界组合，未登记计划不误入日期结果', () => {
  type Row = ReturnType<typeof buildProfessionalBusinessRows>[number]
  const first = { id: 'T1', name: '花型任务', source: 'EM1', sourceType: '生产准备单', style: 'SPU1', requirementText: '蓝色数码印花', result: '第二轮', merchandiser: '林晓', status: '进行中', team: '花型团队', assignee: '李师傅', planned: '2026-09-25 18:00' } as Row
  const rows = [first, { ...first, id: 'T2', planned: '', status: '已完成', team: '', sourceType: '设计改款任务' }]
  assert.deepEqual(filterProfessionalBusinessRows(rows, { ...empty, dateFrom: '2026-09-25', dateTo: '2026-09-25' }).map(row => row.id), ['T1'])
  assert.equal(filterProfessionalBusinessRows(rows, { ...empty, keyword: '蓝色', team: '花型团队', source: '生产准备单', assignee: '李', status: '进行中' }).length, 1)
  assert.equal(filterProfessionalBusinessRows(rows, { ...empty, keyword: '不存在' }).length, 0)
  assert.equal(filterProfessionalBusinessRows(rows, { ...empty, source: '设计改款任务' })[0].id, 'T2')
})
