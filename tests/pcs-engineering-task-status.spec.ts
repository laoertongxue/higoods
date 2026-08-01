import assert from 'node:assert/strict'
import { ENGINEERING_TASK_STATUSES } from '../src/data/pcs-engineering-master-types.ts'

// 专业任务统一状态：不设置人工暂停、人工取消和异常状态。
assert.deepEqual(ENGINEERING_TASK_STATUSES, [
  '未启用',
  '待前置',
  '待开始',
  '进行中',
  '待审核',
  '返工中',
  '已完成',
  '因需求变更结束',
])
assert.ok(!ENGINEERING_TASK_STATUSES.includes('已取消' as never))
assert.ok(!ENGINEERING_TASK_STATUSES.includes('已暂停' as never))

console.log('pcs-engineering-task-status PASS')
