import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  submitEngineeringTaskResult,
} from '../src/data/pcs-engineering-master-repository.ts'
import { handlePcsEngineeringMasterDetailEvent } from '../src/pages/pcs-engineering-master-detail.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const style = listStyleArchives()[0]
assert.ok(style, '应存在正式款式档案演示数据')

const master = createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserName: '跟单A',
})
publishEngineeringMasterOrder(master.masterOrderId)

const taskId = (taskType: string) => `${master.masterOrderId}-${taskType}`
submitEngineeringTaskResult(master.masterOrderId, taskId('BASE_PATTERN_WOVEN'))
submitEngineeringTaskResult(master.masterOrderId, taskId('BASE_PATTERN_KNIT'))

const sampleTaskId = taskId('PRE_PRODUCTION_SAMPLE')
let laneRenderCount = 0
let drawerRenderCount = 0
const lanesHost = {
  value: '',
  get innerHTML() { return this.value },
  set innerHTML(value: string) { laneRenderCount += 1; this.value = value },
}
const drawerHost = {
  value: '',
  get innerHTML() { return this.value },
  set innerHTML(value: string) { drawerRenderCount += 1; this.value = value },
  querySelector(selector: string) {
    if (selector === '[data-pre-production-sample-result-error]') return drawerErrorHost
    return null
  },
}
const drawerErrorHost = { innerHTML: '', textContent: '', className: '' }
const feedbackHost = { innerHTML: '' }
const formFields = {
  imageIds: { value: '' },
  quantity: { value: '' },
  submittedBy: { value: '' },
}

const originalWindow = globalThis.window
const originalDocument = globalThis.document

Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { location: { pathname: `/pcs/engineering/masters/${master.masterOrderId}` } },
})
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    querySelector(selector: string) {
      if (selector === '[data-engineering-master-region="lanes"]') return lanesHost
      if (selector === '[data-engineering-master-region="drawer"]') return drawerHost
      if (selector === '[data-engineering-master-region="feedback"]') return feedbackHost
      if (selector === '[data-pcs-engineering-master-field="sample-result-images"]') return formFields.imageIds
      if (selector === '[data-pcs-engineering-master-field="sample-result-quantity"]') return formFields.quantity
      if (selector === '[data-pcs-engineering-master-field="sample-result-submitted-by"]') return formFields.submittedBy
      return null
    },
    querySelectorAll() { return [] },
  },
})

function actionTarget(action: string, selectedTaskId = sampleTaskId): HTMLElement {
  return {
    closest(selector: string) {
      if (selector !== '[data-pcs-engineering-master-action]') return null
      return {
        dataset: {
          pcsEngineeringMasterAction: action,
          taskId: selectedTaskId,
        },
      }
    },
  } as unknown as HTMLElement
}

try {
  assert.equal(handlePcsEngineeringMasterDetailEvent(actionTarget('open-task-drawer')), true)
  assert.match(drawerHost.innerHTML, /上传成果图片/, '产前版样衣抽屉应展示成果图片字段')
  assert.match(drawerHost.innerHTML, /制作数量/, '产前版样衣抽屉应展示制作数量字段')
  assert.match(drawerHost.innerHTML, /提交人/, '产前版样衣抽屉应展示提交人字段')

  formFields.imageIds.value = 'sample-front.jpg, sample-back.jpg'
  formFields.quantity.value = '2'
  formFields.submittedBy.value = ''
  const drawerRenderCountBeforeFailure = drawerRenderCount
  const laneRenderCountBeforeFailure = laneRenderCount
  assert.equal(handlePcsEngineeringMasterDetailEvent(actionTarget('submit-pre-production-sample-result')), true)
  const afterEmptySubmit = getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find(
    (task) => task.taskId === sampleTaskId,
  )
  assert.equal(afterEmptySubmit?.status, '待前置', '空成果提交后任务不得完成')
  assert.equal(afterEmptySubmit?.submittedAt, '', '空成果提交后不得产生提交时间')
  assert.equal(drawerRenderCount, drawerRenderCountBeforeFailure, '提交失败不得重绘抽屉，必须保留已填写成果')
  assert.equal(laneRenderCount, laneRenderCountBeforeFailure, '提交失败不得刷新泳道')
  assert.match(drawerErrorHost.textContent, /请填写产前版样衣成果提交人/, '错误必须显示在当前抽屉提交按钮附近')
  assert.equal(formFields.imageIds.value, 'sample-front.jpg, sample-back.jpg', '失败后应保留图片输入')
  assert.equal(formFields.quantity.value, '2', '失败后应保留数量输入')

  formFields.imageIds.value = ''
  formFields.quantity.value = ''
  assert.equal(handlePcsEngineeringMasterDetailEvent(actionTarget('submit-pre-production-sample-result')), true)
  assert.match(drawerErrorHost.textContent, /请至少上传 1 张产前版样衣成果图片/, '空成果提交应在抽屉内提示缺少图片')

  formFields.imageIds.value = 'sample-front.jpg, sample-back.jpg'
  assert.equal(handlePcsEngineeringMasterDetailEvent(actionTarget('submit-pre-production-sample-result')), true)
  assert.match(drawerErrorHost.textContent, /制作数量必须大于 0/, '数量无效时应在抽屉内阻断提交')
  assert.equal(
    getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find((task) => task.taskId === sampleTaskId)?.submittedAt,
    '',
    '数量无效时不得产生提交时间',
  )

  formFields.quantity.value = '2'
  assert.equal(handlePcsEngineeringMasterDetailEvent(actionTarget('submit-pre-production-sample-result')), true)
  assert.match(drawerErrorHost.textContent, /请填写产前版样衣成果提交人/, '提交人为空时应在抽屉内阻断提交')
  assert.equal(
    getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find((task) => task.taskId === sampleTaskId)?.status,
    '待前置',
    '提交人为空时任务不得完成',
  )

  formFields.submittedBy.value = '样衣制作组-阿兰'

  assert.equal(handlePcsEngineeringMasterDetailEvent(actionTarget('submit-pre-production-sample-result')), true)
  const completedTask = getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find(
    (task) => task.taskId === sampleTaskId,
  )
  assert.equal(completedTask?.status, '已完成', '完整成果提交后产前版样衣任务应完成')
  assert.deepEqual(completedTask?.resultImageIds, ['sample-front.jpg', 'sample-back.jpg'])
  assert.equal(completedTask?.resultQuantity, 2)
  assert.equal(completedTask?.resultSubmittedBy, '样衣制作组-阿兰')
  assert.ok(completedTask?.submittedAt, '完整成果提交后应记录提交时间')
} finally {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
  Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })
}

console.log('pcs-engineering-pre-production-sample-submit.spec.ts PASS')
