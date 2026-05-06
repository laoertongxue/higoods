import assert from 'node:assert/strict'

import { FIRST_SAMPLE_TASK_STATUS_LIST } from '../src/data/pcs-first-sample-types.ts'
import { PCS_PROJECT_WORK_ITEM_CONTRACTS } from '../src/data/pcs-project-domain-contract.ts'
import { createTaskBootstrapSnapshot } from '../src/data/pcs-task-bootstrap.ts'

const firstSampleContract = PCS_PROJECT_WORK_ITEM_CONTRACTS.find(
  (item) => item.workItemTypeCode === 'FIRST_SAMPLE',
)
assert.ok(firstSampleContract, '缺少 FIRST_SAMPLE 工作项定义')

const formalStatuses = [...FIRST_SAMPLE_TASK_STATUS_LIST]
assert.deepEqual(formalStatuses, ['草稿', '待处理', '打样中', '待确认', '已通过', '需改版', '已取消'])
assert.equal(formalStatuses.includes('需补测' as never), false)
assert.equal(formalStatuses.includes('需补样' as never), false)

const instanceStatuses = firstSampleContract.statusDefinitions.map((item) => item.statusName)
assert.equal(instanceStatuses.includes('需补测'), false)
assert.equal(instanceStatuses.includes('需补样'), false)

const storage = new Map<string, string>()
Object.defineProperty(globalThis, 'localStorage', {
  configurable: true,
  value: {
    getItem(key: string) {
      return storage.get(key) ?? null
    },
    setItem(key: string, value: string) {
      storage.set(key, value)
    },
    removeItem(key: string) {
      storage.delete(key)
    },
  },
})

const bootstrap = createTaskBootstrapSnapshot()
const legacyTask = {
  ...bootstrap.firstSampleTasks[0],
  firstSampleTaskId: 'test_legacy_first_sample_need_retest',
  firstSampleTaskCode: 'FS-LEGACY-NEED-RETEST',
  status: '需补测' as never,
}

localStorage.setItem('higood-pcs-first-sample-store-v2', JSON.stringify({
  version: 2,
  tasks: [legacyTask],
  pendingItems: [],
}))

const { listFirstSampleTasks } = await import('../src/data/pcs-first-sample-repository.ts')
const normalizedTask = listFirstSampleTasks().find(
  (item) => item.firstSampleTaskId === 'test_legacy_first_sample_need_retest',
)
assert.ok(normalizedTask, '缺少旧首版样衣任务')
assert.equal(normalizedTask.status, '需改版')
