import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeEngineeringMasterTasks, type EngineeringMasterListRow } from '../../src/data/pcs-engineering-master-view-model.ts'
import type { EngineeringTaskRecord } from '../../src/data/pcs-engineering-master-types.ts'
import { EMPTY_ENGINEERING_MASTER_FILTERS, filterEngineeringMasterListRows, summarizeEngineeringMasterList, buildEngineeringMasterListCsv } from '../../src/data/pcs-engineering-master-list-query.ts'

function task(id: string, status: EngineeringTaskRecord['status'], patch: Partial<EngineeringTaskRecord> = {}): EngineeringTaskRecord {
  return { taskId: id, taskType: 'BASE_PATTERN_WOVEN', taskName: `工作${id}`, status, ownerTeamName: '制版团队', assigneeName: '', plannedCompleteAt: '', dependsOnTaskIds: [], ...patch } as EngineeringTaskRecord
}
const tasks = [task('1', '已完成'), task('2', '待审核', { assigneeName: '张师傅' }), task('3', '待前置', { dependsOnTaskIds: ['1', '2'] }), task('4', '未启用'), task('5', '返工中')]
function row(code: string, status: EngineeringMasterListRow['status'], date: string): EngineeringMasterListRow {
  return {
    masterOrderId: code, masterOrderCode: code, styleCode: 'SPU-1', styleName: '样衣,含逗号', styleImageUrl: '/style.png', merchandiserName: '林晓', status,
    currentStage: '制版', progressText: '1/4', updatedAt: date, createdAt: date, publishedAt: '', closedAt: '', preparationType: 'PURE_WOVEN', creationReason: '测款后准备',
    sourceDesignRevisionTaskId: 'DR1', sourceDesignRevisionTaskCode: 'DR-001', latestTestingId: 'T1', latestTestingCode: 'TO-001', latestTestingResult: '测款通过', bomVersionCount: 1,
    ...summarizeEngineeringMasterTasks({ status, tasks }),
  }
}
test('任务汇总排除未启用，待前置只列出未完成依赖，关闭单不继续催办', () => {
  const result = summarizeEngineeringMasterTasks({ status: '进行中', tasks })
  assert.equal(result.taskCount, 4)
  assert.equal(result.completedTaskCount, 1)
  assert.deepEqual(result.pendingTasks.find((task) => task.taskId === '3')?.waitingFor, ['工作2'])
  assert.deepEqual(result.attentionKinds, ['待分配', '待审核', '返工', '待前置'])
  for (const status of ['已关闭', '已终止'] as const) {
    const ended = summarizeEngineeringMasterTasks({ status, tasks })
    assert.deepEqual(ended.pendingTasks, [])
    assert.deepEqual(ended.attentionKinds, [])
  }
  assert.deepEqual(summarizeEngineeringMasterTasks({ status: '草稿', tasks: [] }).attentionKinds, ['待发布'])
  const changed = summarizeEngineeringMasterTasks({ status: '进行中', tasks: [task('ended', '因需求变更结束'), task('waiting', '待前置', { dependsOnTaskIds: ['ended', '2'] }), tasks[1]] })
  assert.deepEqual(changed.pendingTasks.find(item => item.taskId === 'waiting')?.waitingFor, ['工作2'])
})
test('筛选覆盖关键词、状态、跟单、待办、类型、团队和日期边界，统计范围一致', () => {
  const rows = [row('EM-1', '进行中', '2026-09-01 09:00'), row('EM-2', '草稿', '2026-09-02 18:00'), row('EM-3', '已关闭', '2026-09-03 10:00')]
  const filter = (patch: Partial<typeof EMPTY_ENGINEERING_MASTER_FILTERS>) => filterEngineeringMasterListRows(rows, { ...EMPTY_ENGINEERING_MASTER_FILTERS, ...patch })
  assert.equal(filter({ keyword: '张师傅' }).length, 1)
  assert.equal(filter({ keyword: 'TO-001' }).length, 3)
  assert.equal(filter({ status: '草稿' })[0].masterOrderCode, 'EM-2')
  assert.equal(filter({ merchandiser: '其他人' }).length, 0)
  assert.equal(filter({ attention: '待审核' }).length, 1)
  assert.equal(filter({ preparationType: 'KNIT' }).length, 0)
  assert.equal(filter({ team: '制版团队' }).length, 1)
  const dates = filter({ dateFrom: '2026-09-02', dateTo: '2026-09-02' })
  assert.deepEqual(dates.map((row) => row.masterOrderCode), ['EM-2'])
  assert.equal(summarizeEngineeringMasterList(dates)[0].value, 1)
  assert.equal(summarizeEngineeringMasterList(dates)[1].value, 1)
  assert.equal(filter({}).length, 3)
})
test('CSV包含全部匹配行和任务责任计划，不含操作列，特殊文字正确转义', () => {
  const rows = Array.from({ length: 21 }, (_, index) => row(`EM-${index}`, '进行中', '2026-09-01'))
  const csv = buildEngineeringMasterListCsv(rows)
  assert.equal((csv.match(/EM-\d+/g) || []).length, 21)
  assert.ok(csv.includes('"样衣,含逗号"'))
  assert.ok(csv.includes('张师傅'))
  assert.ok(csv.includes('计划完成 未设置'))
  assert.ok(!csv.split('\n')[0].includes('操作'))
})
