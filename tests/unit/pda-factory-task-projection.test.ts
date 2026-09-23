import assert from 'node:assert/strict'
import test from 'node:test'
import { listPdaMobileExecutionTasks } from '../../src/data/fcs/process-mobile-task-binding.ts'
import { isMobileTaskVisibleForFactory } from '../../src/data/fcs/mobile-execution-task-index.ts'

test('按工厂投影不改变全能力、印花、染色、中央与裁片演示账号可见任务', () => {
  const all = listPdaMobileExecutionTasks()
  for (const id of ['F090', 'FAC-FLOWER', 'DYE-GOTO-GLOBAL', 'goto_global', 'FACTORY-ONBOARD-0034', 'FACTORY-ONBOARD-0035']) {
    const visible = (rows: typeof all) => rows.filter(task => isMobileTaskVisibleForFactory(task, id)).map(task => [task.taskId, task.status, task.qty, task.assignedFactoryId]).sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    assert.deepEqual(visible(listPdaMobileExecutionTasks(id)), visible(all), id)
  }
})
