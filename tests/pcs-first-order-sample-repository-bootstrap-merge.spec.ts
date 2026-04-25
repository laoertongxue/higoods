import assert from 'node:assert/strict'

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

localStorage.setItem(
  'higood-pcs-first-order-sample-store-v2',
  JSON.stringify({
    version: 2,
    tasks: [],
    pendingItems: [],
  }),
)

const { listFirstOrderSampleTasks } = await import('../src/data/pcs-first-order-sample-repository.ts')

const tasks = listFirstOrderSampleTasks()
assert.ok(
  tasks.some((task) => task.projectCode === 'PRJ-20251216-030' && task.sampleCode === 'FOS-RESULT-25001'),
  '首单样衣任务仓储读取旧缓存时，应合并 bootstrap 中新增的已完成首单样衣任务',
)
assert.ok(
  tasks.some((task) => task.projectCode === 'PRJ-20251216-029' && task.firstOrderSampleTaskCode === 'FOS-20260425-002'),
  '首单样衣任务仓储读取旧缓存时，应合并 bootstrap 中新增的已建未补齐任务',
)
