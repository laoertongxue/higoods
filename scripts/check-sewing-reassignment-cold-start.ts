import assert from 'node:assert/strict'
import { reassignRuntimeSewingTask } from '../src/data/fcs/runtime-sewing-reassignment.ts'

const result = reassignRuntimeSewingTask({
  sourceTaskId: 'NOT-FOUND',
  targetFactoryId: 'F2',
  targetFactoryName: '测试厂',
  businessAssignedAt: '2026-07-01 09:00:00',
  operatedAt: '2026-07-01 10:00:00',
  reason: '测试',
  by: '测试员',
})
assert.equal(result.ok, false)
console.log('车缝改派编排模块冷启动检查通过')
process.exit(0)
